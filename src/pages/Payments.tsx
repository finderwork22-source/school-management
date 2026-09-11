import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CreditCard,
  FileText,
  Loader2,
  Plus,
  Search,
  User,
  X,
} from "lucide-react";
import { useSchool } from "../context/SchoolContext";
import { getStudents } from "../lib/students";
import { getClasses, type SchoolClass } from "../lib/classes";
import { supabase } from "../lib/supabase";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";

type Term = "Term 1" | "Term 2" | "Term 3";

type PaymentMethod =
  | "Cash"
  | "Bank Transfer"
  | "Mobile Money"
  | "Card"
  | "Cheque"
  | "Other";

type AcademicYear = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
};

type Student = {
  id: string;
  name: string;
  studentId: string;
  className: string;
  academicYearId: string | null;
  status: "Active" | "Inactive";
};

type Enrollment = {
  id: string;
  student_id: string;
  class_id: string;
  academic_year_id: string | null;
  status: string;
};

type Invoice = {
  id: string;
  student_id: string;
  enrollment_id: string;
  academic_year_id: string;
  term: Term;
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
  notes: string | null;
};

type Payment = {
  id: string;
  school_id: string;
  invoice_id: string;
  student_id: string;
  amount: number;
  payment_date: string;
  payment_method: PaymentMethod;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-RW", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getPaymentMethodClass(
  method: PaymentMethod,
) {
  switch (method) {
    case "Mobile Money":
      return "bg-emerald-50 text-emerald-700";

    case "Bank Transfer":
      return "bg-blue-50 text-blue-700";

    case "Card":
      return "bg-violet-50 text-violet-700";

    case "Cheque":
      return "bg-amber-50 text-amber-700";

    default:
      return "bg-slate-100 text-slate-600";
  }
}

function getInvoiceStatusClass(
  status: Invoice["status"],
) {
  switch (status) {
    case "Paid":
      return "border-emerald-100 bg-emerald-50 text-emerald-700";

    case "Partially Paid":
      return "border-amber-100 bg-amber-50 text-amber-700";

    case "Cancelled":
      return "border-slate-200 bg-slate-100 text-slate-600";

    default:
      return "border-red-100 bg-red-50 text-red-700";
  }
}

function getToday() {
  return new Date()
    .toISOString()
    .split("T")[0];
}

export default function Payments() {
  const { school } = useSchool();

  const [academicYears, setAcademicYears] =
    useState<AcademicYear[]>([]);

  const [classes, setClasses] =
    useState<SchoolClass[]>([]);

  const [students, setStudents] =
    useState<Student[]>([]);

  const [enrollments, setEnrollments] =
    useState<Enrollment[]>([]);

  const [invoices, setInvoices] =
    useState<Invoice[]>([]);

  const [payments, setPayments] =
    useState<Payment[]>([]);

  const [
    selectedAcademicYearId,
    setSelectedAcademicYearId,
  ] = useState("");

  const [selectedTerm, setSelectedTerm] =
    useState<Term>("Term 1");

  const [selectedClassId, setSelectedClassId] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [
    showPaymentModal,
    setShowPaymentModal,
  ] = useState(false);

  const [
    selectedInvoiceId,
    setSelectedInvoiceId,
  ] = useState("");

  const [paymentAmount, setPaymentAmount] =
    useState("");

  const [paymentDate, setPaymentDate] =
    useState(getToday());

  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState<PaymentMethod>("Cash");

  const [
    referenceNumber,
    setReferenceNumber,
  ] = useState("");

  const [paymentNotes, setPaymentNotes] =
    useState("");

  useEffect(() => {
    if (!school) {
      setLoading(false);
      return;
    }

    loadData(school.id);
  }, [school]);

  async function loadData(
    schoolId: string,
  ) {
    try {
      setLoading(true);
      setError(null);

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
            "id,name,start_date,end_date,is_current",
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
            "id,student_id,class_id,academic_year_id,status",
          )
          .eq("school_id", schoolId),

        supabase
          .from("student_invoices")
          .select(
            "id,student_id,enrollment_id,academic_year_id,term,invoice_number,issue_date,due_date,subtotal,discount,total_amount,amount_paid,balance,status,notes",
          )
          .eq("school_id", schoolId)
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("student_payments")
          .select(
            "id,school_id,invoice_id,student_id,amount,payment_date,payment_method,reference_number,notes,created_at",
          )
          .eq("school_id", schoolId)
          .order("payment_date", {
            ascending: false,
          })
          .order("created_at", {
            ascending: false,
          }),
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

      const years =
        (yearsResponse.data ??
          []) as AcademicYear[];

      setAcademicYears(years);

      setClasses(
        classesResponse.data ?? [],
      );

      setStudents(
        (studentsResponse.data ??
          []) as Student[],
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
        years.find(
          (year) => year.is_current,
        ) ?? years[0];

      if (currentYear) {
        setSelectedAcademicYearId(
          currentYear.id,
        );
      }
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load payment data.",
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * Only show classes belonging to the
   * selected academic year.
   */
  const classesForSelectedYear =
    useMemo(() => {
      if (!selectedAcademicYearId) {
        return [];
      }

      const classesWithYear =
        classes.filter((schoolClass) => {
          const classWithYear =
            schoolClass as SchoolClass & {
              academicYearId?: string | null;
              academic_year_id?: string | null;
            };

          return (
            classWithYear.academicYearId ===
              selectedAcademicYearId ||
            classWithYear.academic_year_id ===
              selectedAcademicYearId
          );
        });

      if (classesWithYear.length > 0) {
        return classesWithYear;
      }

      const enrollmentClassIds =
        new Set(
          enrollments
            .filter(
              (enrollment) =>
                enrollment.academic_year_id ===
                selectedAcademicYearId,
            )
            .map(
              (enrollment) =>
                enrollment.class_id,
            ),
        );

      return classes.filter((schoolClass) =>
        enrollmentClassIds.has(
          schoolClass.id,
        ),
      );
    }, [
      classes,
      enrollments,
      selectedAcademicYearId,
    ]);

  /*
   * Filter invoices.
   */
  const visibleInvoices =
    useMemo(() => {
      return invoices.filter(
        (invoice) => {
          if (
            invoice.academic_year_id !==
            selectedAcademicYearId
          ) {
            return false;
          }

          if (
            invoice.term !==
            selectedTerm
          ) {
            return false;
          }

          if (selectedClassId) {
            const enrollment =
              enrollments.find(
                (item) =>
                  item.id ===
                  invoice.enrollment_id,
              );

            if (
              !enrollment ||
              enrollment.class_id !==
                selectedClassId
            ) {
              return false;
            }
          }

          if (search.trim()) {
            const student =
              students.find(
                (item) =>
                  item.id ===
                  invoice.student_id,
              );

            if (!student) {
              return false;
            }

            const query = search
              .trim()
              .toLowerCase();

            return (
              student.name
                .toLowerCase()
                .includes(query) ||
              student.studentId
                .toLowerCase()
                .includes(query) ||
              student.className
                .toLowerCase()
                .includes(query) ||
              invoice.invoice_number
                .toLowerCase()
                .includes(query)
            );
          }

          return true;
        },
      );
    }, [
      invoices,
      students,
      enrollments,
      selectedAcademicYearId,
      selectedTerm,
      selectedClassId,
      search,
    ]);

  /*
   * Payments associated with visible invoices.
   */
  const visiblePayments =
    useMemo(() => {
      const invoiceIds =
        new Set(
          visibleInvoices.map(
            (invoice) =>
              invoice.id,
          ),
        );

      return payments.filter(
        (payment) =>
          invoiceIds.has(
            payment.invoice_id,
          ),
      );
    }, [
      payments,
      visibleInvoices,
    ]);

  /*
   * Summary.
   */
  const summary = useMemo(() => {
    const totalCollected =
      visiblePayments.reduce(
        (sum, payment) =>
          sum +
          Number(payment.amount),
        0,
      );

    const totalOutstanding =
      visibleInvoices.reduce(
        (sum, invoice) =>
          sum +
          Number(invoice.balance),
        0,
      );

    const paidInvoices =
      visibleInvoices.filter(
        (invoice) =>
          invoice.status === "Paid",
      ).length;

    return {
      totalCollected,
      totalOutstanding,
      paidInvoices,
      payments: visiblePayments.length,
    };
  }, [
    visiblePayments,
    visibleInvoices,
  ]);

  const selectedInvoice =
    useMemo(() => {
      return invoices.find(
        (invoice) =>
          invoice.id ===
          selectedInvoiceId,
      );
    }, [
      invoices,
      selectedInvoiceId,
    ]);

  function getStudent(
    studentId: string,
  ) {
    return students.find(
      (student) =>
        student.id === studentId,
    );
  }

  function getClassName(
    classId: string | null,
  ) {
    if (!classId) {
      return "—";
    }

    return (
      classes.find(
        (schoolClass) =>
          schoolClass.id ===
          classId,
      )?.name ?? "Unknown class"
    );
  }

  function getPaymentHistory(
    invoiceId: string,
  ) {
    return payments.filter(
      (payment) =>
        payment.invoice_id ===
        invoiceId,
    );
  }

  function openPaymentModal(
    invoiceId: string,
  ) {
    const invoice =
      invoices.find(
        (item) =>
          item.id === invoiceId,
      );

    if (!invoice) {
      return;
    }

    if (
      invoice.status ===
      "Cancelled"
    ) {
      setError(
        "Payments cannot be recorded against a cancelled invoice.",
      );
      return;
    }

    if (
      Number(invoice.balance) <=
      0
    ) {
      setError(
        "This invoice has already been fully paid.",
      );
      return;
    }

    setSelectedInvoiceId(
      invoiceId,
    );

    setPaymentAmount(
      String(
        Number(invoice.balance),
      ),
    );

    setPaymentDate(
      getToday(),
    );

    setPaymentMethod(
      "Cash",
    );

    setReferenceNumber("");
    setPaymentNotes("");
    setError(null);

    setShowPaymentModal(true);
  }

  async function recordPayment() {
    if (!school) {
      return;
    }

    if (!selectedInvoice) {
      setError(
        "Please select an invoice.",
      );
      return;
    }

    const amount =
      Number(paymentAmount);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setError(
        "Please enter a valid payment amount.",
      );
      return;
    }

    const invoiceBalance =
      Number(
        selectedInvoice.balance,
      );

    if (amount > invoiceBalance) {
      setError(
        `Payment cannot exceed the outstanding balance of ${formatMoney(
          invoiceBalance,
        )} RWF.`,
      );
      return;
    }

    if (!paymentDate) {
      setError(
        "Please select a payment date.",
      );
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const {
        data: payment,
        error: paymentError,
      } = await supabase
        .from("student_payments")
        .insert({
          school_id:
            school.id,
          invoice_id:
            selectedInvoice.id,
          student_id:
            selectedInvoice.student_id,
          amount,
          payment_date:
            paymentDate,
          payment_method:
            paymentMethod,
          reference_number:
            referenceNumber.trim() ||
            null,
          notes:
            paymentNotes.trim() ||
            null,
        })
        .select(
          "id,school_id,invoice_id,student_id,amount,payment_date,payment_method,reference_number,notes,created_at",
        )
        .single();

      if (paymentError) {
        throw paymentError;
      }

      const newAmountPaid =
        Number(
          selectedInvoice.amount_paid,
        ) + amount;

      const newBalance =
        Math.max(
          0,
          Number(
            selectedInvoice.total_amount,
          ) - newAmountPaid,
        );

      let newStatus:
        | "Unpaid"
        | "Partially Paid"
        | "Paid"
        | "Cancelled";

      if (
        newBalance === 0
      ) {
        newStatus = "Paid";
      } else if (
        newAmountPaid > 0
      ) {
        newStatus =
          "Partially Paid";
      } else {
        newStatus = "Unpaid";
      }

      const {
        data: updatedInvoice,
        error: invoiceError,
      } = await supabase
        .from("student_invoices")
        .update({
          amount_paid:
            newAmountPaid,
          balance:
            newBalance,
          status:
            newStatus,
        })
        .eq(
          "id",
          selectedInvoice.id,
        )
        .select(
          "id,student_id,enrollment_id,academic_year_id,term,invoice_number,issue_date,due_date,subtotal,discount,total_amount,amount_paid,balance,status,notes",
        )
        .single();

      if (invoiceError) {
        /*
         * If invoice update fails, remove the payment
         * so we don't leave an inconsistent payment.
         */
        await supabase
          .from("student_payments")
          .delete()
          .eq(
            "id",
            payment.id,
          );

        throw invoiceError;
      }

      setPayments(
        (current) => [
          payment as Payment,
          ...current,
        ],
      );

      setInvoices(
        (current) =>
          current.map(
            (invoice) =>
              invoice.id ===
              selectedInvoice.id
                ? (updatedInvoice as Invoice)
                : invoice,
          ),
      );

      setShowPaymentModal(
        false,
      );

      setSelectedInvoiceId("");
      setPaymentAmount("");
      setReferenceNumber("");
      setPaymentNotes("");
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to record payment.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
            Finance
          </div>

          <h1 className="mt-1 text-[27px] font-semibold tracking-tight text-slate-900">
            Payments
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Record and manage student fee payments.
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>

          <button
            type="button"
            onClick={() =>
              setError(null)
            }
            className="ml-4 rounded-md p-1 hover:bg-red-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Summary */}
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="min-w-0 border-slate-200 p-4 shadow-none sm:p-5">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">
                Payments
              </p>

              <p className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                {summary.payments}
              </p>

              <p className="mt-1 truncate text-xs text-slate-400">
                Recorded payments
              </p>
            </div>

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
              <CreditCard className="h-5 w-5 text-indigo-600" />
            </div>
          </div>
        </Card>

        <Card className="min-w-0 border-slate-200 p-4 shadow-none sm:p-5">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">
                Total Collected
              </p>

              <p className="mt-1 flex min-w-0 items-baseline gap-1 whitespace-nowrap text-xl font-semibold tracking-tight text-emerald-600 sm:text-2xl">
                <span className="truncate">
                  {formatMoney(
                    summary.totalCollected,
                  )}
                </span>

                <span className="shrink-0 text-xs font-medium text-emerald-500 sm:text-sm">
                  RWF
                </span>
              </p>

              <p className="mt-1 truncate text-xs text-slate-400">
                Collected to date
              </p>
            </div>

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
        </Card>

        <Card className="min-w-0 border-slate-200 p-4 shadow-none sm:p-5">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">
                Outstanding
              </p>

              <p className="mt-1 flex min-w-0 items-baseline gap-1 whitespace-nowrap text-xl font-semibold tracking-tight text-red-600 sm:text-2xl">
                <span className="truncate">
                  {formatMoney(
                    summary.totalOutstanding,
                  )}
                </span>

                <span className="shrink-0 text-xs font-medium text-red-500 sm:text-sm">
                  RWF
                </span>
              </p>

              <p className="mt-1 truncate text-xs text-slate-400">
                Remaining balance
              </p>
            </div>

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50">
              <FileText className="h-5 w-5 text-red-600" />
            </div>
          </div>
        </Card>

        <Card className="min-w-0 border-slate-200 p-4 shadow-none sm:p-5">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">
                Paid Invoices
              </p>

              <p className="mt-1 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
                {summary.paidInvoices}
              </p>

              <p className="mt-1 truncate text-xs text-slate-400">
                Fully paid invoices
              </p>
            </div>

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
              <FileText className="h-5 w-5 text-slate-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="min-w-0 border-slate-200 p-4 shadow-none sm:p-5">
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0">
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Academic year
            </label>

            <select
              value={
                selectedAcademicYearId
              }
              onChange={(event) => {
                setSelectedAcademicYearId(
                  event.target.value,
                );

                setSelectedClassId("");
              }}
              className="h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">
                Select academic year
              </option>

              {academicYears.map(
                (year) => (
                  <option
                    key={year.id}
                    value={year.id}
                  >
                    {year.name}
                    {year.is_current
                      ? " · Current"
                      : ""}
                  </option>
                ),
              )}
            </select>
          </div>

          <div className="min-w-0">
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Term
            </label>

            <select
              value={selectedTerm}
              onChange={(event) =>
                setSelectedTerm(
                  event.target
                    .value as Term,
                )
              }
              className="h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
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
          </div>

          <div className="min-w-0">
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Class
            </label>

            <select
              value={
                selectedClassId
              }
              onChange={(event) =>
                setSelectedClassId(
                  event.target.value,
                )
              }
              disabled={
                !selectedAcademicYearId
              }
              className="h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">
                {selectedAcademicYearId
                  ? "All classes"
                  : "Select academic year first"}
              </option>

              {classesForSelectedYear.map(
                (schoolClass) => (
                  <option
                    key={
                      schoolClass.id
                    }
                    value={
                      schoolClass.id
                    }
                  >
                    {schoolClass.name}
                  </option>
                ),
              )}
            </select>
          </div>

          <div className="min-w-0">
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Search
            </label>

            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target
                      .value,
                  )
                }
                placeholder="Student or invoice..."
                className="h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Invoice List */}
      <Card className="overflow-hidden border-slate-200 p-0 shadow-none">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Student Invoices
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              {visibleInvoices.length}{" "}
              invoice
              {visibleInvoices.length ===
              1
                ? ""
                : "s"}{" "}
              for {selectedTerm}
            </p>
          </div>
        </div>

        {visibleInvoices.length ===
        0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center px-6 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50">
              <CreditCard className="h-7 w-7 text-slate-300" />
            </div>

            <h3 className="mt-4 text-sm font-semibold text-slate-900">
              No invoices found
            </h3>

            <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
              Student invoices for the selected academic year, term and class will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3">
                    Student
                  </th>

                  <th className="px-4 py-3">
                    Invoice
                  </th>

                  <th className="px-4 py-3">
                    Class
                  </th>

                  <th className="px-4 py-3 text-right">
                    Total
                  </th>

                  <th className="px-4 py-3 text-right">
                    Paid
                  </th>

                  <th className="px-4 py-3 text-right">
                    Balance
                  </th>

                  <th className="px-4 py-3">
                    Status
                  </th>

                  <th className="px-5 py-3 text-right">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {visibleInvoices.map(
                  (invoice) => {
                    const student =
                      getStudent(
                        invoice.student_id,
                      );

                    const enrollment =
                      enrollments.find(
                        (item) =>
                          item.id ===
                          invoice.enrollment_id,
                      );

                    const invoicePayments =
                      getPaymentHistory(
                        invoice.id,
                      );

                    return (
                      <tr
                        key={
                          invoice.id
                        }
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                              <User className="h-4 w-4" />
                            </div>

                            <div>
                              <p className="font-medium text-slate-900">
                                {student?.name ??
                                  "Unknown student"}
                              </p>

                              <p className="mt-0.5 text-xs text-slate-500">
                                {student?.studentId ??
                                  "—"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-medium text-slate-900">
                            {
                              invoice.invoice_number
                            }
                          </p>

                          <p className="mt-0.5 text-xs text-slate-500">
                            {
                              invoice.issue_date
                            }
                          </p>
                        </td>

                        <td className="px-4 py-4 text-slate-600">
                          {getClassName(
                            enrollment?.class_id ??
                              null,
                          )}
                        </td>

                        <td className="px-4 py-4 text-right font-medium text-slate-900">
                          {formatMoney(
                            Number(
                              invoice.total_amount,
                            ),
                          )}{" "}
                          <span className="text-xs font-normal text-slate-400">
                            RWF
                          </span>
                        </td>

                        <td className="px-4 py-4 text-right font-medium text-emerald-600">
                          {formatMoney(
                            Number(
                              invoice.amount_paid,
                            ),
                          )}{" "}
                          <span className="text-xs font-normal text-emerald-400">
                            RWF
                          </span>
                        </td>

                        <td className="px-4 py-4 text-right font-medium text-red-600">
                          {formatMoney(
                            Number(
                              invoice.balance,
                            ),
                          )}{" "}
                          <span className="text-xs font-normal text-red-400">
                            RWF
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${getInvoiceStatusClass(
                              invoice.status,
                            )}`}
                          >
                            {
                              invoice.status
                            }
                          </span>

                          {invoicePayments.length >
                            0 && (
                            <p className="mt-1 text-[10px] text-slate-400">
                              {
                                invoicePayments.length
                              }{" "}
                              payment
                              {invoicePayments.length ===
                              1
                                ? ""
                                : "s"}
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              openPaymentModal(
                                invoice.id,
                              )
                            }
                            disabled={
                              invoice.status ===
                                "Paid" ||
                              invoice.status ===
                                "Cancelled" ||
                              Number(
                                invoice.balance,
                              ) <= 0
                            }
                            className="inline-flex h-8 items-center rounded-lg bg-indigo-600 px-3 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                          >
                            <Plus className="mr-1.5 h-3.5 w-3.5" />
                            Payment
                          </button>
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Recent Payments */}
      <Card className="overflow-hidden border-slate-200 p-0 shadow-none">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">
            Recent Payments
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Payments recorded for the selected period.
          </p>
        </div>

        {visiblePayments.length ===
        0 ? (
          <div className="px-5 py-10 text-center">
            <FileText className="mx-auto h-7 w-7 text-slate-300" />

            <p className="mt-3 text-sm font-medium text-slate-700">
              No payments recorded yet
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Recorded payments will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3">
                    Student
                  </th>

                  <th className="px-4 py-3">
                    Invoice
                  </th>

                  <th className="px-4 py-3">
                    Date
                  </th>

                  <th className="px-4 py-3">
                    Method
                  </th>

                  <th className="px-4 py-3">
                    Reference
                  </th>

                  <th className="px-5 py-3 text-right">
                    Amount
                  </th>
                </tr>
              </thead>

              <tbody>
                {visiblePayments.map(
                  (payment) => {
                    const student =
                      getStudent(
                        payment.student_id,
                      );

                    const invoice =
                      invoices.find(
                        (item) =>
                          item.id ===
                          payment.invoice_id,
                      );

                    return (
                      <tr
                        key={
                          payment.id
                        }
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                              <User className="h-4 w-4" />
                            </div>

                            <div>
                              <p className="font-medium text-slate-900">
                                {student?.name ??
                                  "Unknown student"}
                              </p>

                              <p className="mt-0.5 text-xs text-slate-500">
                                {student?.studentId ??
                                  "—"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4 text-slate-600">
                          {invoice?.invoice_number ??
                            "—"}
                        </td>

                        <td className="px-4 py-4 text-slate-600">
                          {
                            payment.payment_date
                          }
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${getPaymentMethodClass(
                              payment.payment_method,
                            )}`}
                          >
                            {
                              payment.payment_method
                            }
                          </span>
                        </td>

                        <td className="px-4 py-4 text-slate-500">
                          {
                            payment.reference_number ??
                              "—"
                          }
                        </td>

                        <td className="px-5 py-4 text-right font-semibold text-emerald-600">
                          +{" "}
                          {formatMoney(
                            Number(
                              payment.amount,
                            ),
                          )}{" "}
                          <span className="text-xs font-normal text-emerald-500">
                            RWF
                          </span>
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Payment Modal */}
      {showPaymentModal &&
        selectedInvoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]">
            <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    Record Payment
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {
                      selectedInvoice.invoice_number
                    }
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowPaymentModal(
                      false,
                    )
                  }
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Body */}
              <div className="space-y-5 px-6 py-6">
                {/* Student */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-indigo-600 shadow-sm">
                      <User className="h-5 w-5" />
                    </div>

                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {
                          getStudent(
                            selectedInvoice.student_id,
                          )?.name
                        }
                      </p>

                      <p className="mt-0.5 text-xs text-slate-500">
                        {
                          getStudent(
                            selectedInvoice.student_id,
                          )?.studentId
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {/* Invoice summary */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      Total
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {formatMoney(
                        Number(
                          selectedInvoice.total_amount,
                        ),
                      )}
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      Paid
                    </p>

                    <p className="mt-1 text-sm font-semibold text-emerald-600">
                      {formatMoney(
                        Number(
                          selectedInvoice.amount_paid,
                        ),
                      )}
                    </p>
                  </div>

                  <div className="rounded-lg border border-red-100 bg-red-50/50 p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-red-400">
                      Balance
                    </p>

                    <p className="mt-1 text-sm font-semibold text-red-600">
                      {formatMoney(
                        Number(
                          selectedInvoice.balance,
                        ),
                      )}
                    </p>
                  </div>
                </div>

                {/* Amount */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Payment amount
                  </label>

                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max={Number(
                        selectedInvoice.balance,
                      )}
                      value={
                        paymentAmount
                      }
                      onChange={(event) =>
                        setPaymentAmount(
                          event.target
                            .value,
                        )
                      }
                      className="h-11 w-full rounded-lg border border-slate-200 px-3 pr-16 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />

                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                      RWF
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setPaymentAmount(
                        String(
                          Number(
                            selectedInvoice.balance,
                          ),
                        ),
                      )
                    }
                    className="mt-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                  >
                    Pay full balance
                  </button>
                </div>

                {/* Date + method */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">
                      Payment date
                    </label>

                    <input
                      type="date"
                      value={
                        paymentDate
                      }
                      onChange={(event) =>
                        setPaymentDate(
                          event.target
                            .value,
                        )
                      }
                      className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-600">
                      Payment method
                    </label>

                    <select
                      value={
                        paymentMethod
                      }
                      onChange={(
                        event,
                      ) =>
                        setPaymentMethod(
                          event.target
                            .value as PaymentMethod,
                        )
                      }
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    >
                      <option value="Cash">
                        Cash
                      </option>

                      <option value="Bank Transfer">
                        Bank Transfer
                      </option>

                      <option value="Mobile Money">
                        Mobile Money
                      </option>

                      <option value="Card">
                        Card
                      </option>

                      <option value="Cheque">
                        Cheque
                      </option>

                      <option value="Other">
                        Other
                      </option>
                    </select>
                  </div>
                </div>

                {/* Reference */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Reference number
                    <span className="ml-1 font-normal text-slate-400">
                      Optional
                    </span>
                  </label>

                  <input
                    value={
                      referenceNumber
                    }
                    onChange={(event) =>
                      setReferenceNumber(
                        event.target
                          .value,
                      )
                    }
                    placeholder="Transaction or receipt reference..."
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Notes
                    <span className="ml-1 font-normal text-slate-400">
                      Optional
                    </span>
                  </label>

                  <textarea
                    value={
                      paymentNotes
                    }
                    onChange={(event) =>
                      setPaymentNotes(
                        event.target
                          .value,
                      )
                    }
                    rows={3}
                    placeholder="Additional payment notes..."
                    className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                {/* New balance */}
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600">
                      Balance after payment
                    </span>

                    <span className="text-lg font-semibold text-indigo-700">
                      {formatMoney(
                        Math.max(
                          0,
                          Number(
                            selectedInvoice.balance,
                          ) -
                            (Number(
                              paymentAmount,
                            ) || 0),
                        ),
                      )}{" "}
                      RWF
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/50 px-6 py-4">
                <button
                  type="button"
                  onClick={() =>
                    setShowPaymentModal(
                      false,
                    )
                  }
                  disabled={saving}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <Button
                  onClick={
                    recordPayment
                  }
                  disabled={
                    saving ||
                    !paymentAmount ||
                    Number(
                      paymentAmount,
                    ) <= 0
                  }
                  className="h-10 px-5"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Record Payment
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}