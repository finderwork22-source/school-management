import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  FileText,
  Loader2,
  Printer,
  Search,
  X,
} from "lucide-react";

import { useSchool } from "../context/SchoolContext";
import { getStudents } from "../lib/students";
import { getClasses, type SchoolClass } from "../lib/classes";
import { supabase } from "../lib/supabase";

interface AcademicYear {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

interface Student {
  id: string;
  name: string;
  studentId: string;
  className: string;
  academicYearId: string | null;
  photoUrl: string | null;
  status: "Active" | "Inactive";
}

interface Enrollment {
  id: string;
  student_id: string;
  class_id: string;
  academic_year_id: string | null;
  status: string;
}

interface Invoice {
  id: string;
  student_id: string;
  enrollment_id: string | null;
  academic_year_id: string;
  term: "Term 1" | "Term 2" | "Term 3";
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  discount: number;
  total_amount: number;
  amount_paid: number;
  balance: number;
  status: "Unpaid" | "Partially Paid" | "Paid" | "Cancelled";
  notes: string | null;
}

interface Payment {
  id: string;
  invoice_id: string;
  student_id: string;
  amount: number;
  payment_date: string;
  payment_method:
    | "Cash"
    | "Bank Transfer"
    | "Mobile Money"
    | "Card"
    | "Cheque"
    | "Other";
  reference_number: string | null;
  notes: string | null;
  receipt_number: string | null;
  created_at: string;
}

interface ReceiptData {
  payment: Payment;
  invoice: Invoice;
  student: Student;
  academicYear: AcademicYear | null;
  className: string;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-RW", {
    style: "currency",
    currency: "RWF",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function generateReceiptNumber(payment: Payment) {
  const date = new Date(payment.payment_date || payment.created_at);

  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  const shortId = payment.id.replace(/-/g, "").slice(0, 6).toUpperCase();

  return `RCT-${year}${month}${day}-${shortId}`;
}

function getClassAcademicYearId(schoolClass: SchoolClass) {
  const item = schoolClass as SchoolClass & {
    academicYearId?: string | null;
    academic_year_id?: string | null;
  };

  return item.academicYearId ?? item.academic_year_id ?? null;
}

function PrintableReceipt({
  receipt,
}: {
  receipt: ReceiptData;
}) {
  const { payment, invoice, student, academicYear, className } = receipt;

  return (
    <div id="schoolos-receipt-print">
      <style>{`
        @media screen {
          #schoolos-receipt-print {
            display: none;
          }
        }

        @media print {
          @page {
            size: A4 portrait;
            margin: 14mm;
          }

          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          body > #root {
            display: none !important;
          }

          body > #schoolos-receipt-print {
            display: block !important;
            position: static !important;
            width: 100% !important;
            background: white !important;
            color: #111827 !important;
          }

          #schoolos-receipt-print * {
            color: #111827 !important;
            box-shadow: none !important;
          }
        }

        .receipt-page {
          width: 100%;
          max-width: 760px;
          margin: 0 auto;
          font-family: Arial, Helvetica, sans-serif;
          color: #111827;
          background: white;
        }

        .receipt-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          padding-bottom: 22px;
          border-bottom: 2px solid #111827;
        }

        .school-name {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.5px;
        }

        .school-subtitle {
          margin-top: 5px;
          font-size: 12px;
          color: #4b5563;
          line-height: 1.5;
        }

        .receipt-title {
          text-align: right;
        }

        .receipt-title h1 {
          margin: 0;
          font-size: 26px;
          font-weight: 800;
          text-transform: uppercase;
        }

        .receipt-number {
          margin-top: 7px;
          font-size: 13px;
          font-weight: 700;
        }

        .receipt-date {
          margin-top: 4px;
          font-size: 12px;
          color: #4b5563;
        }

        .section {
          margin-top: 26px;
        }

        .section-title {
          margin-bottom: 10px;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.7px;
        }

        .student-box {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 24px;
          padding: 15px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
        }

        .field-label {
          font-size: 10px;
          color: #6b7280;
          text-transform: uppercase;
          margin-bottom: 3px;
        }

        .field-value {
          font-size: 13px;
          font-weight: 700;
        }

        .payment-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }

        .payment-table th {
          padding: 10px;
          background: #f3f4f6;
          border: 1px solid #d1d5db;
          text-align: left;
          font-size: 11px;
          text-transform: uppercase;
        }

        .payment-table td {
          padding: 12px 10px;
          border: 1px solid #d1d5db;
          font-size: 13px;
        }

        .amount-row {
          display: flex;
          justify-content: flex-end;
          margin-top: 15px;
        }

        .amount-box {
          width: 300px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          overflow: hidden;
        }

        .amount-line {
          display: flex;
          justify-content: space-between;
          padding: 10px 14px;
          font-size: 13px;
          border-bottom: 1px solid #e5e7eb;
        }

        .amount-line:last-child {
          border-bottom: 0;
        }

        .amount-line.total {
          font-size: 17px;
          font-weight: 800;
          background: #f3f4f6;
        }

        .notes {
          padding: 13px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 12px;
          line-height: 1.5;
        }

        .footer {
          margin-top: 70px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 80px;
        }

        .signature-line {
          border-top: 1px solid #111827;
          padding-top: 7px;
          font-size: 11px;
        }

        .generated {
          margin-top: 45px;
          text-align: center;
          font-size: 10px;
          color: #6b7280;
        }
      `}</style>

      <div className="receipt-page">
        <header className="receipt-header">
          <div>
            <div className="school-name">
              High Gate International Academy
            </div>

            <div className="school-subtitle">
              Kigali, Rwanda
              <br />
              Cambridge & Canadian Education Systems
            </div>
          </div>

          <div className="receipt-title">
            <h1>Payment Receipt</h1>

            <div className="receipt-number">
              {payment.receipt_number || generateReceiptNumber(payment)}
            </div>

            <div className="receipt-date">
              {formatDate(payment.payment_date)}
            </div>
          </div>
        </header>

        <section className="section">
          <div className="section-title">Student Information</div>

          <div className="student-box">
            <div>
              <div className="field-label">Student Name</div>
              <div className="field-value">{student.name}</div>
            </div>

            <div>
              <div className="field-label">Student ID</div>
              <div className="field-value">{student.studentId}</div>
            </div>

            <div>
              <div className="field-label">Class</div>
              <div className="field-value">{className || "—"}</div>
            </div>

            <div>
              <div className="field-label">Academic Year</div>
              <div className="field-value">
                {academicYear?.name || "—"}
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="section-title">Payment Information</div>

          <table className="payment-table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Invoice</th>
                <th>Term</th>
                <th>Payment Method</th>
                <th>Reference</th>
              </tr>
            </thead>

            <tbody>
              <tr>
                <td>School Fees Payment</td>
                <td>{invoice.invoice_number}</td>
                <td>{invoice.term}</td>
                <td>{payment.payment_method}</td>
                <td>{payment.reference_number || "—"}</td>
              </tr>
            </tbody>
          </table>

          <div className="amount-row">
            <div className="amount-box">
              <div className="amount-line">
                <span>Invoice Total</span>
                <strong>{formatMoney(invoice.total_amount)}</strong>
              </div>

              <div className="amount-line">
                <span>Amount Paid</span>
                <strong>{formatMoney(invoice.amount_paid)}</strong>
              </div>

              <div className="amount-line">
                <span>Balance</span>
                <strong>{formatMoney(invoice.balance)}</strong>
              </div>

              <div className="amount-line total">
                <span>This Payment</span>
                <strong>{formatMoney(payment.amount)}</strong>
              </div>
            </div>
          </div>
        </section>

        {payment.notes && (
          <section className="section">
            <div className="section-title">Notes</div>

            <div className="notes">{payment.notes}</div>
          </section>
        )}

        <div className="footer">
          <div className="signature-line">Received By</div>

          <div className="signature-line">Parent / Guardian</div>
        </div>

        <div className="generated">
          Generated from SchoolOS • High Gate International Academy
        </div>
      </div>
    </div>
  );
}

export default function Receipts() {
  const { school } = useSchool();

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [selectedAcademicYearId, setSelectedAcademicYearId] =
    useState("");

  const [selectedClassId, setSelectedClassId] = useState("");

  const [selectedTerm, setSelectedTerm] = useState<
    "All" | "Term 1" | "Term 2" | "Term 3"
  >("All");

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [selectedReceipt, setSelectedReceipt] =
    useState<ReceiptData | null>(null);

  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    loadData();
  }, [school?.id]);

  async function loadData() {
    if (!school) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const schoolId = school.id;

      const [
        yearsResponse,
        classesResponse,
        studentsResponse,
        enrollmentsResponse,
        invoicesResponse,
        paymentsResponse,
      ] = await Promise.all([
        supabase
          .from("academic_years")
          .select(
            "id, name, start_date, end_date, is_current",
          )
          .eq("school_id", schoolId)
          .order("start_date", { ascending: false }),

        getClasses(schoolId),

        getStudents(schoolId),

        supabase
          .from("enrollments")
          .select(
            "id, student_id, class_id, academic_year_id, status",
          )
          .eq("school_id", schoolId),

        supabase
          .from("student_invoices")
          .select(
            `
              id,
              student_id,
              enrollment_id,
              academic_year_id,
              term,
              invoice_number,
              issue_date,
              due_date,
              subtotal,
              discount,
              total_amount,
              amount_paid,
              balance,
              status,
              notes
            `,
          )
          .eq("school_id", schoolId)
          .order("issue_date", { ascending: false }),

        supabase
          .from("student_payments")
          .select(
            `
              id,
              invoice_id,
              student_id,
              amount,
              payment_date,
              payment_method,
              reference_number,
              notes,
              receipt_number,
              created_at
            `,
          )
          .eq("school_id", schoolId)
          .order("payment_date", { ascending: false }),
      ]);

      if (yearsResponse.error) {
        throw yearsResponse.error;
      }

      if (classesResponse.error) {
        throw classesResponse.error;
      }

      if (studentsResponse.error) {
        throw studentsResponse.error;
      }

      if (enrollmentsResponse.error) {
        throw enrollmentsResponse.error;
      }

      if (invoicesResponse.error) {
        throw invoicesResponse.error;
      }

      if (paymentsResponse.error) {
        throw paymentsResponse.error;
      }

      const years = (yearsResponse.data ??
        []) as AcademicYear[];

      setAcademicYears(years);

      setClasses(classesResponse.data ?? []);

      setStudents(
        (studentsResponse.data ?? []) as Student[],
      );

      setEnrollments(
        (enrollmentsResponse.data ??
          []) as Enrollment[],
      );

      setInvoices(
        (invoicesResponse.data ?? []) as Invoice[],
      );

      setPayments(
        (paymentsResponse.data ?? []) as Payment[],
      );

      const currentYear =
        years.find((year) => year.is_current) ??
        years[0];

      if (currentYear) {
        setSelectedAcademicYearId(currentYear.id);
      }
    } catch (err) {
      console.error("Error loading receipts:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load receipts.",
      );
    } finally {
      setLoading(false);
    }
  }

  const classesForSelectedYear = useMemo(() => {
    if (!selectedAcademicYearId) return [];

    const directClasses = classes.filter(
      (schoolClass) =>
        getClassAcademicYearId(schoolClass) ===
        selectedAcademicYearId,
    );

    if (directClasses.length > 0) {
      return directClasses;
    }

    const enrollmentClassIds = new Set(
      enrollments
        .filter(
          (enrollment) =>
            enrollment.academic_year_id ===
              selectedAcademicYearId &&
            enrollment.status === "Active",
        )
        .map((enrollment) => enrollment.class_id),
    );

    return classes.filter((schoolClass) =>
      enrollmentClassIds.has(schoolClass.id),
    );
  }, [
    classes,
    enrollments,
    selectedAcademicYearId,
  ]);

  useEffect(() => {
    if (
      selectedClassId &&
      !classesForSelectedYear.some(
        (schoolClass) =>
          schoolClass.id === selectedClassId,
      )
    ) {
      setSelectedClassId("");
    }
  }, [classesForSelectedYear, selectedClassId]);

  const studentClassMap = useMemo(() => {
    const map = new Map<string, string>();

    enrollments.forEach((enrollment) => {
      if (
        enrollment.academic_year_id ===
          selectedAcademicYearId &&
        enrollment.status === "Active"
      ) {
        const schoolClass = classes.find(
          (item) => item.id === enrollment.class_id,
        );

        if (schoolClass) {
          map.set(enrollment.student_id, schoolClass.name);
        }
      }
    });

    return map;
  }, [
    enrollments,
    classes,
    selectedAcademicYearId,
  ]);

  const visiblePayments = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    return payments.filter((payment) => {
      const invoice = invoices.find(
        (item) => item.id === payment.invoice_id,
      );

      if (!invoice) return false;

      if (
        invoice.academic_year_id !==
        selectedAcademicYearId
      ) {
        return false;
      }

      if (
        selectedTerm !== "All" &&
        invoice.term !== selectedTerm
      ) {
        return false;
      }

      if (selectedClassId) {
        const enrollment = enrollments.find(
          (item) => item.id === invoice.enrollment_id,
        );

        if (
          !enrollment ||
          enrollment.class_id !== selectedClassId
        ) {
          return false;
        }
      }

      if (!normalizedSearch) return true;

      const student = students.find(
        (item) => item.id === payment.student_id,
      );

      const studentName =
        student?.name?.toLowerCase() ?? "";

      const studentId =
        student?.studentId?.toLowerCase() ?? "";

      const invoiceNumber =
        invoice.invoice_number?.toLowerCase() ?? "";

      const receiptNumber =
        payment.receipt_number?.toLowerCase() ?? "";

      const reference =
        payment.reference_number?.toLowerCase() ?? "";

      return (
        studentName.includes(normalizedSearch) ||
        studentId.includes(normalizedSearch) ||
        invoiceNumber.includes(normalizedSearch) ||
        receiptNumber.includes(normalizedSearch) ||
        reference.includes(normalizedSearch)
      );
    });
  }, [
    payments,
    invoices,
    students,
    enrollments,
    selectedAcademicYearId,
    selectedTerm,
    selectedClassId,
    search,
  ]);

  const summary = useMemo(() => {
    const total = visiblePayments.reduce(
      (sum, payment) => sum + Number(payment.amount || 0),
      0,
    );

    const cash = visiblePayments
      .filter((payment) => payment.payment_method === "Cash")
      .reduce(
        (sum, payment) => sum + Number(payment.amount || 0),
        0,
      );

    const mobileMoney = visiblePayments
      .filter(
        (payment) =>
          payment.payment_method === "Mobile Money",
      )
      .reduce(
        (sum, payment) => sum + Number(payment.amount || 0),
        0,
      );

    return {
      total,
      count: visiblePayments.length,
      cash,
      mobileMoney,
    };
  }, [visiblePayments]);

  function openReceipt(payment: Payment) {
    const invoice = invoices.find(
      (item) => item.id === payment.invoice_id,
    );

    const student = students.find(
      (item) => item.id === payment.student_id,
    );

    if (!invoice || !student) {
      setError(
        "Unable to load the student or invoice for this receipt.",
      );
      return;
    }

    const academicYear =
      academicYears.find(
        (year) =>
          year.id === invoice.academic_year_id,
      ) ?? null;

    const className =
      studentClassMap.get(student.id) ||
      student.className ||
      "—";

    setSelectedReceipt({
      payment,
      invoice,
      student,
      academicYear,
      className,
    });
  }

  async function printReceipt() {
    if (!selectedReceipt) return;

    setPrinting(true);

    await new Promise((resolve) =>
      setTimeout(resolve, 150),
    );

    window.print();

    setTimeout(() => {
      setPrinting(false);
    }, 500);
  }

  function closeReceipt() {
    setSelectedReceipt(null);
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading receipts...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm font-medium text-gray-500">
          Finance
        </div>

        <div className="mt-1 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Receipts
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              View and print receipts for student payments.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-sm text-gray-500">
            Total Collected
          </div>

          <div className="mt-2 text-2xl font-bold text-gray-900">
            {formatMoney(summary.total)}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-sm text-gray-500">
            Receipts
          </div>

          <div className="mt-2 text-2xl font-bold text-gray-900">
            {summary.count}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-sm text-gray-500">
            Cash
          </div>

          <div className="mt-2 text-2xl font-bold text-gray-900">
            {formatMoney(summary.cash)}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-sm text-gray-500">
            Mobile Money
          </div>

          <div className="mt-2 text-2xl font-bold text-gray-900">
            {formatMoney(summary.mobileMoney)}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <select
            value={selectedAcademicYearId}
            onChange={(event) =>
              setSelectedAcademicYearId(
                event.target.value,
              )
            }
            className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-gray-500"
          >
            {academicYears.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
                {year.is_current ? " • Current" : ""}
              </option>
            ))}
          </select>

          <select
            value={selectedClassId}
            onChange={(event) =>
              setSelectedClassId(event.target.value)
            }
            className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-gray-500"
          >
            <option value="">All Classes</option>

            {classesForSelectedYear.map(
              (schoolClass) => (
                <option
                  key={schoolClass.id}
                  value={schoolClass.id}
                >
                  {schoolClass.name}
                </option>
              ),
            )}
          </select>

          <select
            value={selectedTerm}
            onChange={(event) =>
              setSelectedTerm(
                event.target.value as
                  | "All"
                  | "Term 1"
                  | "Term 2"
                  | "Term 3",
              )
            }
            className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-gray-500"
          >
            <option value="All">All Terms</option>
            <option value="Term 1">Term 1</option>
            <option value="Term 2">Term 2</option>
            <option value="Term 3">Term 3</option>
          </select>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search student, receipt..."
              className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-gray-500"
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold text-gray-900">
            Payment Receipts
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            {visiblePayments.length} receipt
            {visiblePayments.length === 1 ? "" : "s"} found.
          </p>
        </div>

        {visiblePayments.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <FileText className="h-5 w-5 text-gray-500" />
            </div>

            <h3 className="mt-4 font-semibold text-gray-900">
              No receipts found
            </h3>

            <p className="mt-1 max-w-md text-sm text-gray-500">
              Receipts will appear here after student
              payments have been recorded.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-5 py-3">
                    Receipt
                  </th>

                  <th className="px-5 py-3">
                    Student
                  </th>

                  <th className="px-5 py-3">
                    Invoice
                  </th>

                  <th className="px-5 py-3">
                    Term
                  </th>

                  <th className="px-5 py-3">
                    Payment Date
                  </th>

                  <th className="px-5 py-3">
                    Method
                  </th>

                  <th className="px-5 py-3 text-right">
                    Amount
                  </th>

                  <th className="px-5 py-3 text-right">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {visiblePayments.map((payment) => {
                  const invoice = invoices.find(
                    (item) =>
                      item.id === payment.invoice_id,
                  );

                  const student = students.find(
                    (item) =>
                      item.id === payment.student_id,
                  );

                  if (!invoice || !student) {
                    return null;
                  }

                  const receiptNumber =
                    payment.receipt_number ||
                    generateReceiptNumber(payment);

                  return (
                    <tr
                      key={payment.id}
                      className="hover:bg-gray-50"
                    >
                      <td className="px-5 py-4">
                        <div className="font-medium text-gray-900">
                          {receiptNumber}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-medium text-gray-900">
                          {student.name}
                        </div>

                        <div className="text-xs text-gray-500">
                          {student.studentId}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-700">
                        {invoice.invoice_number}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-700">
                        {invoice.term}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <CalendarDays className="h-4 w-4 text-gray-400" />

                          {formatDate(
                            payment.payment_date,
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-700">
                        {payment.payment_method}
                      </td>

                      <td className="px-5 py-4 text-right font-semibold text-gray-900">
                        {formatMoney(
                          Number(payment.amount),
                        )}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            openReceipt(payment)
                          }
                          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                        >
                          <Printer className="h-4 w-4" />
                          Print
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="font-semibold text-gray-900">
                  Payment Receipt
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  {selectedReceipt.payment.receipt_number ||
                    generateReceiptNumber(
                      selectedReceipt.payment,
                    )}
                </p>
              </div>

              <button
                type="button"
                onClick={closeReceipt}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto p-6">
              <div className="rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      High Gate International Academy
                    </h3>

                    <p className="mt-1 text-sm text-gray-500">
                      Payment Receipt
                    </p>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900">
                      {selectedReceipt.payment
                        .receipt_number ||
                        generateReceiptNumber(
                          selectedReceipt.payment,
                        )}
                    </div>

                    <div className="mt-1 text-xs text-gray-500">
                      {formatDate(
                        selectedReceipt.payment
                          .payment_date,
                      )}
                    </div>
                  </div>
                </div>

                <div className="my-5 border-t border-gray-200" />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500">
                      Student
                    </div>

                    <div className="mt-1 font-semibold text-gray-900">
                      {selectedReceipt.student.name}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">
                      Student ID
                    </div>

                    <div className="mt-1 font-semibold text-gray-900">
                      {selectedReceipt.student.studentId}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">
                      Class
                    </div>

                    <div className="mt-1 font-semibold text-gray-900">
                      {selectedReceipt.className}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">
                      Academic Year
                    </div>

                    <div className="mt-1 font-semibold text-gray-900">
                      {selectedReceipt.academicYear
                        ?.name || "—"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">
                      Invoice
                    </div>

                    <div className="mt-1 font-semibold text-gray-900">
                      {selectedReceipt.invoice
                        .invoice_number}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">
                      Term
                    </div>

                    <div className="mt-1 font-semibold text-gray-900">
                      {selectedReceipt.invoice.term}
                    </div>
                  </div>
                </div>

                <div className="my-5 border-t border-gray-200" />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-gray-500">
                      Payment Method
                    </div>

                    <div className="mt-1 font-semibold text-gray-900">
                      {
                        selectedReceipt.payment
                          .payment_method
                      }
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500">
                      Reference
                    </div>

                    <div className="mt-1 font-semibold text-gray-900">
                      {selectedReceipt.payment
                        .reference_number || "—"}
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-xl bg-gray-50 p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      This Payment
                    </span>

                    <span className="text-xl font-bold text-gray-900">
                      {formatMoney(
                        Number(
                          selectedReceipt.payment
                            .amount,
                        ),
                      )}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      Invoice Balance
                    </span>

                    <span className="font-semibold text-gray-900">
                      {formatMoney(
                        Number(
                          selectedReceipt.invoice
                            .balance,
                        ),
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-5 py-4">
              <button
                type="button"
                onClick={closeReceipt}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>

              <button
                type="button"
                onClick={printReceipt}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                <Printer className="h-4 w-4" />
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {printing && selectedReceipt
        ? createPortal(
            <PrintableReceipt
              receipt={selectedReceipt}
            />,
            document.body,
          )
        : null}
    </div>
  );
}