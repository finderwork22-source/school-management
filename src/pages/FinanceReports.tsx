import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  BarChart3,
  CalendarDays,
  Loader2,
  Printer,
  Search,
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
  status:
    | "Unpaid"
    | "Partially Paid"
    | "Paid"
    | "Cancelled";
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
}

interface ClassReport {
  classId: string;
  className: string;
  students: number;
  invoices: number;
  invoiced: number;
  paid: number;
  balance: number;
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

function getClassAcademicYearId(
  schoolClass: SchoolClass,
) {
  const item = schoolClass as SchoolClass & {
    academicYearId?: string | null;
    academic_year_id?: string | null;
  };

  return (
    item.academicYearId ??
    item.academic_year_id ??
    null
  );
}

function getPaymentMethodLabel(method: string) {
  return method || "Other";
}

export default function FinanceReports() {
  const { school } = useSchool();

  const [academicYears, setAcademicYears] = useState<
    AcademicYear[]
  >([]);

  const [classes, setClasses] = useState<
    SchoolClass[]
  >([]);

  const [students, setStudents] = useState<Student[]>(
    [],
  );

  const [enrollments, setEnrollments] = useState<
    Enrollment[]
  >([]);

  const [invoices, setInvoices] = useState<Invoice[]>(
    [],
  );

  const [payments, setPayments] = useState<Payment[]>(
    [],
  );

  const [selectedAcademicYearId, setSelectedAcademicYearId] =
    useState("");

  const [selectedClassId, setSelectedClassId] =
    useState("");

  const [selectedTerm, setSelectedTerm] = useState<
    "All" | "Term 1" | "Term 2" | "Term 3"
  >("All");

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(
    null,
  );

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
          .order("start_date", {
            ascending: false,
          }),

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
              status
            `,
          )
          .eq("school_id", schoolId)
          .order("issue_date", {
            ascending: false,
          }),

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
              reference_number
            `,
          )
          .eq("school_id", schoolId)
          .order("payment_date", {
            ascending: false,
          }),
      ]);

      if (yearsResponse.error)
        throw yearsResponse.error;

      if (classesResponse.error)
        throw classesResponse.error;

      if (studentsResponse.error)
        throw studentsResponse.error;

      if (enrollmentsResponse.error)
        throw enrollmentsResponse.error;

      if (invoicesResponse.error)
        throw invoicesResponse.error;

      if (paymentsResponse.error)
        throw paymentsResponse.error;

      const years =
        (yearsResponse.data ?? []) as AcademicYear[];

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
        (invoicesResponse.data ??
          []) as Invoice[],
      );

      setPayments(
        (paymentsResponse.data ??
          []) as Payment[],
      );

      const currentYear =
        years.find((year) => year.is_current) ??
        years[0];

      if (currentYear) {
        setSelectedAcademicYearId(
          currentYear.id,
        );
      }
    } catch (err) {
      console.error(
        "Error loading finance reports:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load finance reports.",
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
        .map(
          (enrollment) => enrollment.class_id,
        ),
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
  }, [
    classesForSelectedYear,
    selectedClassId,
  ]);

  const filteredInvoices = useMemo(() => {
    const normalizedSearch = search
      .trim()
      .toLowerCase();

    return invoices.filter((invoice) => {
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
          (item) =>
            item.id === invoice.enrollment_id,
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
        (item) => item.id === invoice.student_id,
      );

      const studentName =
        student?.name?.toLowerCase() ?? "";

      const studentId =
        student?.studentId?.toLowerCase() ?? "";

      const invoiceNumber =
        invoice.invoice_number?.toLowerCase() ?? "";

      return (
        studentName.includes(normalizedSearch) ||
        studentId.includes(normalizedSearch) ||
        invoiceNumber.includes(
          normalizedSearch,
        )
      );
    });
  }, [
    invoices,
    students,
    enrollments,
    selectedAcademicYearId,
    selectedTerm,
    selectedClassId,
    search,
  ]);

  const filteredInvoiceIds = useMemo(
    () => new Set(filteredInvoices.map((item) => item.id)),
    [filteredInvoices],
  );

  const filteredPayments = useMemo(() => {
    return payments.filter((payment) =>
      filteredInvoiceIds.has(payment.invoice_id),
    );
  }, [payments, filteredInvoiceIds]);

  const summary = useMemo(() => {
    const invoiced = filteredInvoices.reduce(
      (sum, invoice) =>
        sum + Number(invoice.total_amount || 0),
      0,
    );

    const paid = filteredPayments.reduce(
      (sum, payment) =>
        sum + Number(payment.amount || 0),
      0,
    );

    const balance = filteredInvoices.reduce(
      (sum, invoice) =>
        sum + Math.max(Number(invoice.balance || 0), 0),
      0,
    );

    const paidInvoices = filteredInvoices.filter(
      (invoice) => invoice.status === "Paid",
    ).length;

    const unpaidInvoices = filteredInvoices.filter(
      (invoice) =>
        invoice.status === "Unpaid" ||
        invoice.status === "Partially Paid",
    ).length;

    const collectionRate =
      invoiced > 0
        ? Math.min((paid / invoiced) * 100, 100)
        : 0;

    return {
      invoiced,
      paid,
      balance,
      paidInvoices,
      unpaidInvoices,
      collectionRate,
    };
  }, [filteredInvoices, filteredPayments]);

  const paymentMethodSummary = useMemo(() => {
    const methods = new Map<
      string,
      number
    >();

    filteredPayments.forEach((payment) => {
      const method =
        getPaymentMethodLabel(
          payment.payment_method,
        );

      methods.set(
        method,
        (methods.get(method) ?? 0) +
          Number(payment.amount || 0),
      );
    });

    return Array.from(methods.entries())
      .map(([method, amount]) => ({
        method,
        amount,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredPayments]);

  const termSummary = useMemo(() => {
    const terms: Array<
      "Term 1" | "Term 2" | "Term 3"
    > = [
      "Term 1",
      "Term 2",
      "Term 3",
    ];

    return terms.map((term) => {
      const termInvoices = filteredInvoices.filter(
        (invoice) => invoice.term === term,
      );

      const termInvoiceIds = new Set(
        termInvoices.map(
          (invoice) => invoice.id,
        ),
      );

      const termPayments = filteredPayments.filter(
        (payment) =>
          termInvoiceIds.has(payment.invoice_id),
      );

      const invoiced = termInvoices.reduce(
        (sum, invoice) =>
          sum +
          Number(invoice.total_amount || 0),
        0,
      );

      const paid = termPayments.reduce(
        (sum, payment) =>
          sum + Number(payment.amount || 0),
        0,
      );

      return {
        term,
        invoiced,
        paid,
        balance: Math.max(invoiced - paid, 0),
      };
    });
  }, [filteredInvoices, filteredPayments]);

  const classSummary = useMemo<ClassReport[]>(
    () => {
      const relevantClasses =
        selectedClassId
          ? classesForSelectedYear.filter(
              (schoolClass) =>
                schoolClass.id ===
                selectedClassId,
            )
          : classesForSelectedYear;

      return relevantClasses
        .map((schoolClass) => {
          const classEnrollments =
            enrollments.filter(
              (enrollment) =>
                enrollment.class_id ===
                  schoolClass.id &&
                enrollment.academic_year_id ===
                  selectedAcademicYearId &&
                enrollment.status === "Active",
            );

          const classStudentIds = new Set(
            classEnrollments.map(
              (enrollment) =>
                enrollment.student_id,
            ),
          );

          const classInvoices =
            filteredInvoices.filter(
              (invoice) =>
                classStudentIds.has(
                  invoice.student_id,
                ),
            );

          const classInvoiced =
            classInvoices.reduce(
              (sum, invoice) =>
                sum +
                Number(
                  invoice.total_amount || 0,
                ),
              0,
            );

          const classInvoiceIds = new Set(
            classInvoices.map(
              (invoice) => invoice.id,
            ),
          );

          const classPaid =
            filteredPayments
              .filter((payment) =>
                classInvoiceIds.has(
                  payment.invoice_id,
                ),
              )
              .reduce(
                (sum, payment) =>
                  sum +
                  Number(payment.amount || 0),
                0,
              );

          return {
            classId: schoolClass.id,
            className: schoolClass.name,
            students: classStudentIds.size,
            invoices: classInvoices.length,
            invoiced: classInvoiced,
            paid: classPaid,
            balance: Math.max(
              classInvoiced - classPaid,
              0,
            ),
          };
        })
        .filter(
          (item) =>
            item.students > 0 ||
            item.invoices > 0,
        )
        .sort((a, b) =>
          a.className.localeCompare(
            b.className,
          ),
        );
    },
    [
      selectedClassId,
      classesForSelectedYear,
      enrollments,
      selectedAcademicYearId,
      filteredInvoices,
      filteredPayments,
    ],
  );

  const recentPayments = useMemo(() => {
    return [...filteredPayments]
      .sort(
        (a, b) =>
          new Date(
            b.payment_date,
          ).getTime() -
          new Date(
            a.payment_date,
          ).getTime(),
      )
      .slice(0, 10);
  }, [filteredPayments]);

  const selectedYear = academicYears.find(
    (year) =>
      year.id === selectedAcademicYearId,
  );

  function getStudentName(studentId: string) {
    return (
      students.find(
        (student) => student.id === studentId,
      )?.name ?? "Unknown Student"
    );
  }

  function getStudentId(studentId: string) {
    return (
      students.find(
        (student) => student.id === studentId,
      )?.studentId ?? "—"
    );
  }

  function getPaymentInvoice(
    payment: Payment,
  ) {
    return invoices.find(
      (invoice) =>
        invoice.id === payment.invoice_id,
    );
  }

  function printReport() {
    setPrinting(true);

    setTimeout(() => {
      window.print();

      setTimeout(() => {
        setPrinting(false);
      }, 500);
    }, 150);
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading finance reports...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="text-sm font-medium text-gray-500">
            Finance
          </div>

          <h1 className="mt-1 text-2xl font-bold text-gray-900">
            Finance Reports
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Review fees, collections and outstanding
            balances.
          </p>
        </div>

        <button
          type="button"
          onClick={printReport}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          <Printer className="h-4 w-4" />
          Print Report
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

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
              <option
                key={year.id}
                value={year.id}
              >
                {year.name}
                {year.is_current
                  ? " • Current"
                  : ""}
              </option>
            ))}
          </select>

          <select
            value={selectedClassId}
            onChange={(event) =>
              setSelectedClassId(
                event.target.value,
              )
            }
            className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-gray-500"
          >
            <option value="">
              All Classes
            </option>

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
            <option value="All">
              All Terms
            </option>
            <option value="Term 1">
              Term 1
            </option>
            <option value="Term 2">
              Term 2
            </option>
            <option value="Term 3">
              Term 3
            </option>
          </select>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search student or invoice..."
              className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-gray-500"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-sm text-gray-500">
            Total Invoiced
          </div>

          <div className="mt-2 text-2xl font-bold text-gray-900">
            {formatMoney(summary.invoiced)}
          </div>

          <div className="mt-2 text-xs text-gray-500">
            {filteredInvoices.length} invoice
            {filteredInvoices.length === 1
              ? ""
              : "s"}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-sm text-gray-500">
            Total Collected
          </div>

          <div className="mt-2 text-2xl font-bold text-gray-900">
            {formatMoney(summary.paid)}
          </div>

          <div className="mt-2 text-xs text-gray-500">
            {summary.collectionRate.toFixed(1)}%
            collection rate
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-sm text-gray-500">
            Outstanding Balance
          </div>

          <div className="mt-2 text-2xl font-bold text-gray-900">
            {formatMoney(summary.balance)}
          </div>

          <div className="mt-2 text-xs text-gray-500">
            {summary.unpaidInvoices} invoice
            {summary.unpaidInvoices === 1
              ? ""
              : "s"} pending
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="text-sm text-gray-500">
            Payments Recorded
          </div>

          <div className="mt-2 text-2xl font-bold text-gray-900">
            {filteredPayments.length}
          </div>

          <div className="mt-2 text-xs text-gray-500">
            {summary.paidInvoices} invoices fully paid
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-5 py-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-gray-500" />

              <h2 className="font-semibold text-gray-900">
                Collection by Payment Method
              </h2>
            </div>
          </div>

          <div className="p-5">
            {paymentMethodSummary.length ===
            0 ? (
              <div className="py-10 text-center text-sm text-gray-500">
                No payment data available.
              </div>
            ) : (
              <div className="space-y-4">
                {paymentMethodSummary.map(
                  (item) => {
                    const percentage =
                      summary.paid > 0
                        ? (item.amount /
                            summary.paid) *
                          100
                        : 0;

                    return (
                      <div key={item.method}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-gray-700">
                            {item.method}
                          </span>

                          <span className="font-semibold text-gray-900">
                            {formatMoney(
                              item.amount,
                            )}
                          </span>
                        </div>

                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-gray-800"
                            style={{
                              width: `${Math.min(
                                percentage,
                                100,
                              )}%`,
                            }}
                          />
                        </div>

                        <div className="mt-1 text-right text-xs text-gray-500">
                          {percentage.toFixed(
                            1,
                          )}
                          %
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="font-semibold text-gray-900">
              Collection by Term
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-5 py-3">
                    Term
                  </th>

                  <th className="px-5 py-3 text-right">
                    Invoiced
                  </th>

                  <th className="px-5 py-3 text-right">
                    Collected
                  </th>

                  <th className="px-5 py-3 text-right">
                    Balance
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {termSummary.map((item) => (
                  <tr key={item.term}>
                    <td className="px-5 py-4 text-sm font-medium text-gray-900">
                      {item.term}
                    </td>

                    <td className="px-5 py-4 text-right text-sm text-gray-700">
                      {formatMoney(
                        item.invoiced,
                      )}
                    </td>

                    <td className="px-5 py-4 text-right text-sm font-medium text-gray-900">
                      {formatMoney(
                        item.paid,
                      )}
                    </td>

                    <td className="px-5 py-4 text-right text-sm text-gray-700">
                      {formatMoney(
                        item.balance,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold text-gray-900">
            Class Finance Summary
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Finance performance by class for{" "}
            {selectedYear?.name || "the selected year"}.
          </p>
        </div>

        {classSummary.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">
            No class finance data available.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-5 py-3">
                    Class
                  </th>

                  <th className="px-5 py-3 text-right">
                    Students
                  </th>

                  <th className="px-5 py-3 text-right">
                    Invoices
                  </th>

                  <th className="px-5 py-3 text-right">
                    Invoiced
                  </th>

                  <th className="px-5 py-3 text-right">
                    Collected
                  </th>

                  <th className="px-5 py-3 text-right">
                    Balance
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {classSummary.map((item) => (
                  <tr
                    key={item.classId}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-5 py-4 font-medium text-gray-900">
                      {item.className}
                    </td>

                    <td className="px-5 py-4 text-right text-sm text-gray-700">
                      {item.students}
                    </td>

                    <td className="px-5 py-4 text-right text-sm text-gray-700">
                      {item.invoices}
                    </td>

                    <td className="px-5 py-4 text-right text-sm text-gray-700">
                      {formatMoney(
                        item.invoiced,
                      )}
                    </td>

                    <td className="px-5 py-4 text-right text-sm font-medium text-gray-900">
                      {formatMoney(
                        item.paid,
                      )}
                    </td>

                    <td className="px-5 py-4 text-right text-sm font-semibold text-gray-900">
                      {formatMoney(
                        item.balance,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-gray-500" />

            <div>
              <h2 className="font-semibold text-gray-900">
                Recent Payments
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Latest payments matching the selected filters.
              </p>
            </div>
          </div>
        </div>

        {recentPayments.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-500">
            No payments available.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-5 py-3">
                    Date
                  </th>

                  <th className="px-5 py-3">
                    Student
                  </th>

                  <th className="px-5 py-3">
                    Invoice
                  </th>

                  <th className="px-5 py-3">
                    Method
                  </th>

                  <th className="px-5 py-3">
                    Reference
                  </th>

                  <th className="px-5 py-3 text-right">
                    Amount
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {recentPayments.map(
                  (payment) => {
                    const invoice =
                      getPaymentInvoice(
                        payment,
                      );

                    return (
                      <tr key={payment.id}>
                        <td className="px-5 py-4 text-sm text-gray-700">
                          {formatDate(
                            payment.payment_date,
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <div className="font-medium text-gray-900">
                            {getStudentName(
                              payment.student_id,
                            )}
                          </div>

                          <div className="text-xs text-gray-500">
                            {getStudentId(
                              payment.student_id,
                            )}
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-700">
                          {invoice?.invoice_number ||
                            "—"}
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-700">
                          {payment.payment_method}
                        </td>

                        <td className="px-5 py-4 text-sm text-gray-500">
                          {payment.reference_number ||
                            "—"}
                        </td>

                        <td className="px-5 py-4 text-right text-sm font-semibold text-gray-900">
                          {formatMoney(
                            Number(
                              payment.amount,
                            ),
                          )}
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {printing &&
        createPortal(
          <div id="schoolos-finance-report-print">
            <style>{`
              @media screen {
                #schoolos-finance-report-print {
                  display: none;
                }
              }

              @media print {
                @page {
                  size: A4 portrait;
                  margin: 12mm;
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

                body > #schoolos-finance-report-print {
                  display: block !important;
                  position: static !important;
                  width: 100% !important;
                  background: white !important;
                  color: #111827 !important;
                }

                #schoolos-finance-report-print * {
                  color: #111827 !important;
                  box-shadow: none !important;
                }

                table {
                  width: 100%;
                  border-collapse: collapse;
                }

                thead {
                  display: table-header-group;
                }

                tr {
                  page-break-inside: avoid;
                }

                th,
                td {
                  border: 1px solid #d1d5db;
                }
              }

              .finance-print {
                font-family: Arial, Helvetica, sans-serif;
                color: #111827;
              }

              .print-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                border-bottom: 2px solid #111827;
                padding-bottom: 16px;
              }

              .print-school {
                font-size: 22px;
                font-weight: 800;
              }

              .print-subtitle {
                margin-top: 4px;
                font-size: 11px;
                color: #6b7280;
              }

              .print-title {
                text-align: right;
              }

              .print-title h1 {
                margin: 0;
                font-size: 21px;
                font-weight: 800;
              }

              .print-title p {
                margin: 4px 0 0;
                font-size: 11px;
              }

              .print-section {
                margin-top: 22px;
              }

              .print-section h2 {
                margin: 0 0 9px;
                font-size: 13px;
                text-transform: uppercase;
                letter-spacing: .5px;
              }

              .print-summary {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 8px;
              }

              .print-card {
                border: 1px solid #d1d5db;
                padding: 10px;
              }

              .print-card-label {
                font-size: 9px;
                color: #6b7280;
                text-transform: uppercase;
              }

              .print-card-value {
                margin-top: 5px;
                font-size: 14px;
                font-weight: 800;
              }

              .print-table {
                width: 100%;
                border-collapse: collapse;
              }

              .print-table th,
              .print-table td {
                padding: 7px;
                font-size: 9px;
                text-align: left;
              }

              .print-table th {
                background: #f3f4f6;
                font-weight: 800;
                text-transform: uppercase;
              }

              .print-right {
                text-align: right !important;
              }

              .print-footer {
                margin-top: 35px;
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 70px;
              }

              .signature {
                border-top: 1px solid #111827;
                padding-top: 6px;
                font-size: 10px;
              }

              .print-generated {
                margin-top: 25px;
                text-align: center;
                font-size: 9px;
                color: #6b7280;
              }
            `}</style>

            <div className="finance-print">
              <div className="print-header">
                <div>
                  <div className="print-school">
                    High Gate International Academy
                  </div>

                  <div className="print-subtitle">
                    Kigali, Rwanda
                    <br />
                    Finance Department
                  </div>
                </div>

                <div className="print-title">
                  <h1>Finance Report</h1>

                  <p>
                    {selectedYear?.name ||
                      "Academic Year"}
                  </p>

                  <p>
                    {selectedTerm === "All"
                      ? "All Terms"
                      : selectedTerm}
                  </p>

                  <p>
                    Generated:{" "}
                    {formatDate(
                      new Date().toISOString(),
                    )}
                  </p>
                </div>
              </div>

              <div className="print-section">
                <h2>Summary</h2>

                <div className="print-summary">
                  <div className="print-card">
                    <div className="print-card-label">
                      Total Invoiced
                    </div>

                    <div className="print-card-value">
                      {formatMoney(
                        summary.invoiced,
                      )}
                    </div>
                  </div>

                  <div className="print-card">
                    <div className="print-card-label">
                      Total Collected
                    </div>

                    <div className="print-card-value">
                      {formatMoney(
                        summary.paid,
                      )}
                    </div>
                  </div>

                  <div className="print-card">
                    <div className="print-card-label">
                      Outstanding
                    </div>

                    <div className="print-card-value">
                      {formatMoney(
                        summary.balance,
                      )}
                    </div>
                  </div>

                  <div className="print-card">
                    <div className="print-card-label">
                      Collection Rate
                    </div>

                    <div className="print-card-value">
                      {summary.collectionRate.toFixed(
                        1,
                      )}
                      %
                    </div>
                  </div>
                </div>
              </div>

              <div className="print-section">
                <h2>
                  Collection by Payment Method
                </h2>

                <table className="print-table">
                  <thead>
                    <tr>
                      <th>Payment Method</th>
                      <th className="print-right">
                        Amount
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {paymentMethodSummary.map(
                      (item) => (
                        <tr key={item.method}>
                          <td>
                            {item.method}
                          </td>

                          <td className="print-right">
                            {formatMoney(
                              item.amount,
                            )}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>

              <div className="print-section">
                <h2>
                  Collection by Term
                </h2>

                <table className="print-table">
                  <thead>
                    <tr>
                      <th>Term</th>
                      <th className="print-right">
                        Invoiced
                      </th>
                      <th className="print-right">
                        Collected
                      </th>
                      <th className="print-right">
                        Balance
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {termSummary.map(
                      (item) => (
                        <tr key={item.term}>
                          <td>{item.term}</td>

                          <td className="print-right">
                            {formatMoney(
                              item.invoiced,
                            )}
                          </td>

                          <td className="print-right">
                            {formatMoney(
                              item.paid,
                            )}
                          </td>

                          <td className="print-right">
                            {formatMoney(
                              item.balance,
                            )}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>

              <div className="print-section">
                <h2>
                  Class Finance Summary
                </h2>

                <table className="print-table">
                  <thead>
                    <tr>
                      <th>Class</th>
                      <th className="print-right">
                        Students
                      </th>
                      <th className="print-right">
                        Invoices
                      </th>
                      <th className="print-right">
                        Invoiced
                      </th>
                      <th className="print-right">
                        Collected
                      </th>
                      <th className="print-right">
                        Balance
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {classSummary.map(
                      (item) => (
                        <tr
                          key={item.classId}
                        >
                          <td>
                            {item.className}
                          </td>

                          <td className="print-right">
                            {item.students}
                          </td>

                          <td className="print-right">
                            {item.invoices}
                          </td>

                          <td className="print-right">
                            {formatMoney(
                              item.invoiced,
                            )}
                          </td>

                          <td className="print-right">
                            {formatMoney(
                              item.paid,
                            )}
                          </td>

                          <td className="print-right">
                            {formatMoney(
                              item.balance,
                            )}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>

              <div className="print-footer">
                <div className="signature">
                  Prepared By
                </div>

                <div className="signature">
                  Approved By
                </div>
              </div>

              <div className="print-generated">
                Generated from SchoolOS • High Gate
                International Academy
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}