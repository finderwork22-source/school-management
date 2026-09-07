import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Plus,
  Search,
  User,
  Wallet,
  X,
} from "lucide-react";
import { useSchool } from "../context/SchoolContext";
import { getStudents } from "../lib/students";
import { getClasses, type SchoolClass } from "../lib/classes";
import { supabase } from "../lib/supabase";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";

type Term = "Term 1" | "Term 2" | "Term 3";

type Student = {
  id: string;
  name: string;
  studentId: string;
  className: string;
  academicYearId: string | null;
  status: "Active" | "Inactive";
};

type AcademicYear = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
};

type Enrollment = {
  id: string;
  student_id: string;
  class_id: string;
  academic_year_id: string | null;
  status: string;
};

type FeeStructure = {
  id: string;
  academic_year_id: string;
  class_id: string;
  term: Term;
  name: string;
  is_active: boolean;
};

type FeeItem = {
  id: string;
  fee_structure_id: string;
  name: string;
  description: string | null;
  amount: number;
  is_mandatory: boolean;
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

type InvoiceItem = {
  id: string;
  invoice_id: string;
  name: string;
  description: string | null;
  amount: number;
  is_mandatory: boolean;
};

export default function StudentBilling() {
  const { school } = useSchool();

  const [academicYears, setAcademicYears] = useState<
    AcademicYear[]
  >([]);

  const [classes, setClasses] = useState<SchoolClass[]>(
    [],
  );

  const [students, setStudents] = useState<Student[]>([]);
  const [enrollments, setEnrollments] = useState<
    Enrollment[]
  >([]);

  const [feeStructures, setFeeStructures] = useState<
    FeeStructure[]
  >([]);

  const [feeItems, setFeeItems] = useState<FeeItem[]>(
    [],
  );

  const [invoices, setInvoices] = useState<Invoice[]>(
    [],
  );

  const [invoiceItems, setInvoiceItems] = useState<
    InvoiceItem[]
  >([]);

  const [
    selectedAcademicYearId,
    setSelectedAcademicYearId,
  ] = useState("");

  const [selectedTerm, setSelectedTerm] =
    useState<Term>("Term 1");

  const [selectedClassId, setSelectedClassId] =
    useState("");

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState<
    Invoice["status"] | "All"
  >("All");

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] =
    useState(false);

  const [error, setError] = useState<string | null>(
    null,
  );

  const [
    expandedInvoiceId,
    setExpandedInvoiceId,
  ] = useState<string | null>(null);

  const [
    showGenerateModal,
    setShowGenerateModal,
  ] = useState(false);

  const [
    selectedStudentId,
    setSelectedStudentId,
  ] = useState("");

  const [discount, setDiscount] =
    useState("0");

  const [dueDate, setDueDate] =
    useState("");

  const [notes, setNotes] =
    useState("");

  useEffect(() => {
    if (!school) {
      setLoading(false);
      return;
    }

    loadData(school.id);
  }, [school]);

  async function loadData(schoolId: string) {
    try {
      setLoading(true);
      setError(null);

      const [
        yearsResponse,
        classesResponse,
        studentsResponse,
        enrollmentsResponse,
        structuresResponse,
        invoicesResponse,
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
          .from("fee_structures")
          .select(
            "id,academic_year_id,class_id,term,name,is_active",
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

      if (structuresResponse.error) {
        throw structuresResponse.error;
      }

      if (invoicesResponse.error) {
        throw invoicesResponse.error;
      }

      const years =
        (yearsResponse.data ??
          []) as AcademicYear[];

      const structures =
        (structuresResponse.data ??
          []) as FeeStructure[];

      const loadedInvoices =
        (invoicesResponse.data ??
          []) as Invoice[];

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

      setFeeStructures(structures);

      setInvoices(loadedInvoices);

      const currentYear =
        years.find(
          (year) => year.is_current,
        ) ?? years[0];

      if (currentYear) {
        setSelectedAcademicYearId(
          currentYear.id,
        );
      }

      const structureIds =
        structures.map(
          (structure) => structure.id,
        );

      if (structureIds.length > 0) {
        const {
          data,
          error: itemsError,
        } = await supabase
          .from("fee_structure_items")
          .select(
            "id,fee_structure_id,name,description,amount,is_mandatory",
          )
          .in(
            "fee_structure_id",
            structureIds,
          );

        if (itemsError) {
          throw itemsError;
        }

        setFeeItems(
          (data ?? []) as FeeItem[],
        );
      } else {
        setFeeItems([]);
      }

      const invoiceIds =
        loadedInvoices.map(
          (invoice) => invoice.id,
        );

      if (invoiceIds.length > 0) {
        const {
          data,
          error: itemsError,
        } = await supabase
          .from("student_invoice_items")
          .select(
            "id,invoice_id,name,description,amount,is_mandatory",
          )
          .in(
            "invoice_id",
            invoiceIds,
          );

        if (itemsError) {
          throw itemsError;
        }

        setInvoiceItems(
          (data ?? []) as InvoiceItem[],
        );
      } else {
        setInvoiceItems([]);
      }
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load billing data.",
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * Only show classes that belong to
   * the currently selected academic year.
   *
   * We also use enrollments as a fallback because
   * the application's class helper may expose the
   * academic-year relationship differently.
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

      /*
       * If getClasses() exposes academicYearId,
       * use that directly.
       *
       * If the class helper doesn't expose it,
       * derive the classes from enrollments for
       * the selected academic year.
       */
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
   * Students for the selected academic year/class.
   */
  const filteredStudents =
    useMemo(() => {
      return students.filter(
        (student) => {
          if (student.status !== "Active") {
            return false;
          }

          if (
            selectedAcademicYearId &&
            student.academicYearId &&
            student.academicYearId !==
              selectedAcademicYearId
          ) {
            return false;
          }

          if (selectedClassId) {
            const enrollment =
              enrollments.find(
                (item) =>
                  item.student_id ===
                    student.id &&
                  item.academic_year_id ===
                    selectedAcademicYearId &&
                  item.status === "Active",
              );

            if (
              !enrollment ||
              enrollment.class_id !==
                selectedClassId
            ) {
              return false;
            }
          }

          const query = search
            .trim()
            .toLowerCase();

          if (!query) {
            return true;
          }

          return (
            student.name
              .toLowerCase()
              .includes(query) ||
            student.studentId
              .toLowerCase()
              .includes(query) ||
            student.className
              .toLowerCase()
              .includes(query)
          );
        },
      );
    }, [
      students,
      enrollments,
      selectedAcademicYearId,
      selectedClassId,
      search,
    ]);

  /*
   * Invoices visible under the selected
   * academic year, term, class and search.
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

          if (
            statusFilter !== "All" &&
            invoice.status !== statusFilter
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
      statusFilter,
    ]);

  /*
   * Active fee structure for the selected
   * academic year + class + term.
   */
  const activeStructure =
    useMemo(() => {
      if (
        !selectedAcademicYearId ||
        !selectedClassId
      ) {
        return null;
      }

      return (
        feeStructures.find(
          (structure) =>
            structure.academic_year_id ===
              selectedAcademicYearId &&
            structure.class_id ===
              selectedClassId &&
            structure.term ===
              selectedTerm &&
            structure.is_active,
        ) ?? null
      );
    }, [
      feeStructures,
      selectedAcademicYearId,
      selectedClassId,
      selectedTerm,
    ]);

  const activeStructureItems =
    useMemo(() => {
      if (!activeStructure) {
        return [];
      }

      return feeItems.filter(
        (item) =>
          item.fee_structure_id ===
          activeStructure.id,
      );
    }, [
      activeStructure,
      feeItems,
    ]);

  const configuredAmount =
    useMemo(() => {
      return activeStructureItems.reduce(
        (sum, item) =>
          sum + Number(item.amount),
        0,
      );
    }, [activeStructureItems]);

  const summary = useMemo(() => {
    const totalBilled =
      visibleInvoices.reduce(
        (sum, invoice) =>
          sum +
          Number(invoice.total_amount),
        0,
      );

    const totalPaid =
      visibleInvoices.reduce(
        (sum, invoice) =>
          sum +
          Number(invoice.amount_paid),
        0,
      );

    const totalBalance =
      visibleInvoices.reduce(
        (sum, invoice) =>
          sum +
          Number(invoice.balance),
        0,
      );

    return {
      invoices:
        visibleInvoices.length,
      totalBilled,
      totalPaid,
      totalBalance,
    };
  }, [visibleInvoices]);

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
        (item) =>
          item.id === classId,
      )?.name ?? "Unknown class"
    );
  }

  function getInvoiceItems(
    invoiceId: string,
  ) {
    return invoiceItems.filter(
      (item) =>
        item.invoice_id === invoiceId,
    );
  }

  function openGenerateModal() {
    if (!selectedAcademicYearId) {
      setError(
        "Please select an academic year.",
      );
      return;
    }

    if (!selectedClassId) {
      setError(
        "Please select a class before generating a bill.",
      );
      return;
    }

    if (!activeStructure) {
      setError(
        "No active fee structure exists for the selected class and term.",
      );
      return;
    }

    setSelectedStudentId("");
    setDiscount("0");
    setDueDate("");
    setNotes("");
    setError(null);

    setShowGenerateModal(true);
  }

  async function generateInvoice() {
    if (!school) {
      return;
    }

    if (!selectedStudentId) {
      setError(
        "Please select a student.",
      );
      return;
    }

    if (!selectedAcademicYearId) {
      setError(
        "Please select an academic year.",
      );
      return;
    }

    if (!selectedClassId) {
      setError(
        "Please select a class.",
      );
      return;
    }

    if (!activeStructure) {
      setError(
        "No active fee structure exists for the selected class and term.",
      );
      return;
    }

    if (
      activeStructureItems.length === 0
    ) {
      setError(
        "The selected fee structure does not contain any fee items.",
      );
      return;
    }

    const enrollment =
      enrollments.find(
        (item) =>
          item.student_id ===
            selectedStudentId &&
          item.academic_year_id ===
            selectedAcademicYearId &&
          item.status === "Active" &&
          item.class_id ===
            selectedClassId,
      );

    if (!enrollment) {
      setError(
        "No active enrollment was found for this student in the selected class and academic year.",
      );
      return;
    }

    const alreadyExists =
      invoices.some(
        (invoice) =>
          invoice.student_id ===
            selectedStudentId &&
          invoice.academic_year_id ===
            selectedAcademicYearId &&
          invoice.term ===
            selectedTerm &&
          invoice.status !==
            "Cancelled",
      );

    if (alreadyExists) {
      setError(
        "This student already has an invoice for the selected term.",
      );
      return;
    }

    const discountAmount =
      Math.max(
        0,
        Number(discount) || 0,
      );

    if (
      discountAmount >
      configuredAmount
    ) {
      setError(
        "Discount cannot be greater than the configured fee.",
      );
      return;
    }

    try {
      setGenerating(true);
      setError(null);

      const subtotal =
        configuredAmount;

      const totalAmount =
        Math.max(
          0,
          subtotal -
            discountAmount,
        );

      const now = new Date();

      const datePart =
        now.getFullYear().toString() +
        String(
          now.getMonth() + 1,
        ).padStart(2, "0") +
        String(
          now.getDate(),
        ).padStart(2, "0");

      const randomPart =
        Math.floor(
          1000 +
            Math.random() * 9000,
        );

      const invoiceNumber =
        `INV-${datePart}-${randomPart}`;

      const {
        data: invoice,
        error: invoiceError,
      } = await supabase
        .from("student_invoices")
        .insert({
          school_id:
            school.id,
          student_id:
            selectedStudentId,
          enrollment_id:
            enrollment.id,
          academic_year_id:
            selectedAcademicYearId,
          term: selectedTerm,
          invoice_number:
            invoiceNumber,
          issue_date:
            new Date()
              .toISOString()
              .split("T")[0],
          due_date:
            dueDate || null,
          subtotal,
          discount:
            discountAmount,
          total_amount:
            totalAmount,
          amount_paid: 0,
          balance:
            totalAmount,
          status:
            totalAmount === 0
              ? "Paid"
              : "Unpaid",
          notes:
            notes.trim() ||
            null,
        })
        .select(
          "id,student_id,enrollment_id,academic_year_id,term,invoice_number,issue_date,due_date,subtotal,discount,total_amount,amount_paid,balance,status,notes",
        )
        .single();

      if (invoiceError) {
        throw invoiceError;
      }

      const itemsToInsert =
        activeStructureItems.map(
          (item) => ({
            invoice_id:
              invoice.id,
            fee_structure_item_id:
              item.id,
            name: item.name,
            description:
              item.description,
            amount: Number(
              item.amount,
            ),
            is_mandatory:
              item.is_mandatory,
          }),
        );

      const {
        data: insertedItems,
        error: itemsError,
      } = await supabase
        .from("student_invoice_items")
        .insert(itemsToInsert)
        .select(
          "id,invoice_id,name,description,amount,is_mandatory",
        );

      if (itemsError) {
        await supabase
          .from("student_invoices")
          .delete()
          .eq(
            "id",
            invoice.id,
          );

        throw itemsError;
      }

      setInvoices(
        (current) => [
          invoice as Invoice,
          ...current,
        ],
      );

      setInvoiceItems(
        (current) => [
          ...((insertedItems ??
            []) as InvoiceItem[]),
          ...current,
        ],
      );

      setShowGenerateModal(
        false,
      );

      setExpandedInvoiceId(
        invoice.id,
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to generate invoice.",
      );
    } finally {
      setGenerating(false);
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
    <div className="mx-auto w-full max-w-[1320px] space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
            Finance
          </div>

          <h1 className="mt-1 text-[27px] font-semibold tracking-tight text-slate-900">
            Student Billing
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Generate and manage student invoices from your configured fee structures.
          </p>
        </div>

        <Button
          onClick={
            openGenerateModal
          }
          disabled={
            !selectedClassId ||
            !activeStructure
          }
          className="h-10 shrink-0 px-5"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Invoice
        </Button>
      </div>

      {/* ERROR */}
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

      {/* SUMMARY */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border-slate-200 shadow-none">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Invoices
              </p>

              <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                {summary.invoices}
              </p>

              <p className="mt-1 text-xs text-slate-400">
                {selectedTerm} billing
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50">
              <FileText className="h-5 w-5 text-indigo-600" />
            </div>
          </div>
        </Card>

        <Card className="border-slate-200 shadow-none">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Total Billed
              </p>

              <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                {formatMoney(summary.totalBilled)}
                <span className="ml-1 text-sm font-medium text-slate-400">
                  RWF
                </span>
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Amount invoiced
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100">
              <Wallet className="h-5 w-5 text-slate-600" />
            </div>
          </div>
        </Card>

        <Card className="border-slate-200 shadow-none">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Total Paid
              </p>

              <p className="mt-1 text-2xl font-semibold tracking-tight text-emerald-600">
                {formatMoney(summary.totalPaid)}
                <span className="ml-1 text-sm font-medium text-emerald-500">
                  RWF
                </span>
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Collected to date
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
        </Card>

        <Card className="border-slate-200 shadow-none">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Outstanding
              </p>

              <p className="mt-1 text-2xl font-semibold tracking-tight text-red-600">
                {formatMoney(summary.totalBalance)}
                <span className="ml-1 text-sm font-medium text-red-500">
                  RWF
                </span>
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Remaining balance
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50">
              <FileText className="h-5 w-5 text-red-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* FILTERS */}
      <Card className="border-slate-200 shadow-none">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div>
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

                /*
                 * Important:
                 * clear the previously selected class
                 * because it may belong to another year.
                 */
                setSelectedClassId("");

                setExpandedInvoiceId(
                  null,
                );
              }}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
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

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Term
            </label>

            <select
              value={selectedTerm}
              onChange={(event) => {
                setSelectedTerm(
                  event.target
                    .value as Term,
                );

                setExpandedInvoiceId(
                  null,
                );
              }}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
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

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Class
            </label>

            <select
              value={
                selectedClassId
              }
              onChange={(event) => {
                setSelectedClassId(
                  event.target.value,
                );

                setExpandedInvoiceId(
                  null,
                );
              }}
              disabled={
                !selectedAcademicYearId
              }
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">
                {selectedAcademicYearId
                  ? "Select class"
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

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Search
            </label>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search student or invoice..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600">
              Invoice status
            </label>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as Invoice["status"] | "All",
                )
              }
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="All">All statuses</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Paid">Paid</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </Card>

      {/* ACTIVE FEE STRUCTURE */}
      <Card className="overflow-hidden border-slate-200 p-0 shadow-none">
        <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900">
                Active Fee Structure
              </h2>

              {activeStructure && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                  Active
                </span>
              )}
            </div>

            <p className="mt-1 text-sm text-slate-500">
              {activeStructure
                ? activeStructure.name
                : selectedClassId
                  ? "No active fee structure for this class and term."
                  : "Select a class to view its fee structure."}
            </p>
          </div>

          <div className="sm:text-right">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Configured amount
            </p>

            <p className="mt-0.5 text-lg font-semibold text-slate-900">
              {formatMoney(
                configuredAmount,
              )}

              <span className="ml-1 text-sm font-medium text-slate-400">
                RWF
              </span>
            </p>
          </div>
        </div>

        {activeStructure &&
          activeStructureItems.length >
            0 && (
            <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3">
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {activeStructureItems.map(
                  (item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span className="font-medium text-slate-700">
                        {item.name}
                      </span>

                      <span className="text-slate-400">
                        {formatMoney(
                          Number(
                            item.amount,
                          ),
                        )}{" "}
                        RWF
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}
      </Card>

      {/* STUDENT INVOICES */}
      <Card className="overflow-hidden border-slate-200 p-0 shadow-none">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Student Invoices
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              {visibleInvoices.length}{" "}
              invoice
              {visibleInvoices.length === 1 ? "" : "s"}{" "}
              matching your current filters
            </p>
          </div>

          <div className="text-xs text-slate-400">
            {selectedTerm}
            {statusFilter !== "All"
              ? ` · ${statusFilter}`
              : ""}
          </div>
        </div>

        {visibleInvoices.length ===
        0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center px-6 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50">
              <FileText className="h-7 w-7 text-slate-300" />
            </div>

            <h3 className="mt-4 text-sm font-semibold text-slate-900">
              No invoices found
            </h3>

            <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">
              Generate a bill for a student using the active fee structure configured for the selected class and term.
            </p>

            {activeStructure && (
              <Button
                className="mt-5 h-10 px-5"
                onClick={
                  openGenerateModal
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Generate Bill
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
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
                    Billed
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

                    const expanded =
                      expandedInvoiceId ===
                      invoice.id;

                    return (
                      <tr
                        key={
                          invoice.id
                        }
                        className="border-b border-slate-100 align-top last:border-0"
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
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                              invoice.status ===
                              "Paid"
                                ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                                : invoice.status ===
                                  "Partially Paid"
                                  ? "border-amber-100 bg-amber-50 text-amber-700"
                                  : invoice.status ===
                                    "Cancelled"
                                    ? "border-slate-200 bg-slate-100 text-slate-600"
                                    : "border-red-100 bg-red-50 text-red-700"
                            }`}
                          >
                            {
                              invoice.status
                            }
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedInvoiceId(
                                expanded
                                  ? null
                                  : invoice.id,
                              )
                            }
                            className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                          >
                            {expanded ? (
                              <>
                                Hide
                                <ChevronUp className="ml-1.5 h-3.5 w-3.5" />
                              </>
                            ) : (
                              <>
                                Details
                                <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  },
                )}

                {visibleInvoices.map(
                  (invoice) => {
                    if (
                      expandedInvoiceId !==
                      invoice.id
                    ) {
                      return null;
                    }

                    const student =
                      getStudent(
                        invoice.student_id,
                      );

                    const items =
                      getInvoiceItems(
                        invoice.id,
                      );

                    return (
                      <tr
                        key={`${invoice.id}-details`}
                      >
                        <td
                          colSpan={8}
                          className="bg-slate-50 px-5 py-5"
                        >
                          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
                            <div>
                              <div className="mb-3">
                                <h3 className="text-sm font-semibold text-slate-900">
                                  Invoice Details
                                </h3>

                                <p className="mt-0.5 text-xs text-slate-500">
                                  {
                                    student?.name
                                  }
                                </p>
                              </div>

                              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                      <th className="px-4 py-3">
                                        Fee
                                      </th>

                                      <th className="px-4 py-3">
                                        Type
                                      </th>

                                      <th className="px-4 py-3 text-right">
                                        Amount
                                      </th>
                                    </tr>
                                  </thead>

                                  <tbody>
                                    {items.map(
                                      (
                                        item,
                                      ) => (
                                        <tr
                                          key={
                                            item.id
                                          }
                                          className="border-b border-slate-100 last:border-0"
                                        >
                                          <td className="px-4 py-3">
                                            <p className="font-medium text-slate-900">
                                              {
                                                item.name
                                              }
                                            </p>

                                            {item.description && (
                                              <p className="mt-0.5 text-xs text-slate-500">
                                                {
                                                  item.description
                                                }
                                              </p>
                                            )}
                                          </td>

                                          <td className="px-4 py-3">
                                            {item.is_mandatory ? (
                                              <span className="rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-medium text-indigo-600">
                                                Mandatory
                                              </span>
                                            ) : (
                                              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500">
                                                Optional
                                              </span>
                                            )}
                                          </td>

                                          <td className="px-4 py-3 text-right font-medium text-slate-900">
                                            {formatMoney(
                                              Number(
                                                item.amount,
                                              ),
                                            )}{" "}
                                            RWF
                                          </td>
                                        </tr>
                                      ),
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            <div className="rounded-lg border border-slate-200 bg-white p-5">
                              <h3 className="text-sm font-semibold text-slate-900">
                                Summary
                              </h3>

                              <div className="mt-4 space-y-3 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-slate-500">
                                    Subtotal
                                  </span>

                                  <span className="font-medium text-slate-900">
                                    {formatMoney(
                                      Number(
                                        invoice.subtotal,
                                      ),
                                    )}{" "}
                                    RWF
                                  </span>
                                </div>

                                <div className="flex justify-between">
                                  <span className="text-slate-500">
                                    Discount
                                  </span>

                                  <span className="font-medium text-slate-900">
                                    {formatMoney(
                                      Number(
                                        invoice.discount,
                                      ),
                                    )}{" "}
                                    RWF
                                  </span>
                                </div>

                                <div className="border-t border-slate-100 pt-3">
                                  <div className="flex justify-between">
                                    <span className="font-semibold text-slate-900">
                                      Total
                                    </span>

                                    <span className="font-semibold text-slate-900">
                                      {formatMoney(
                                        Number(
                                          invoice.total_amount,
                                        ),
                                      )}{" "}
                                      RWF
                                    </span>
                                  </div>
                                </div>

                                <div className="flex justify-between text-emerald-600">
                                  <span>
                                    Paid
                                  </span>

                                  <span className="font-medium">
                                    {formatMoney(
                                      Number(
                                        invoice.amount_paid,
                                      ),
                                    )}{" "}
                                    RWF
                                  </span>
                                </div>

                                <div className="flex justify-between border-t border-slate-100 pt-3 text-red-600">
                                  <span className="font-semibold">
                                    Balance
                                  </span>

                                  <span className="font-semibold">
                                    {formatMoney(
                                      Number(
                                        invoice.balance,
                                      ),
                                    )}{" "}
                                    RWF
                                  </span>
                                </div>
                              </div>

                              {invoice.due_date && (
                                <div className="mt-5 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
                                  Due date:{" "}
                                  <span className="font-medium text-slate-700">
                                    {
                                      invoice.due_date
                                    }
                                  </span>
                                </div>
                              )}

                              {invoice.notes && (
                                <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                                  {
                                    invoice.notes
                                  }
                                </div>
                              )}
                            </div>
                          </div>
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

      {/* GENERATE BILL MODAL */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/5">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Generate Student Bill
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Create an invoice from the active fee structure.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowGenerateModal(
                    false,
                  )
                }
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="max-h-[75vh] overflow-y-auto px-6 py-6">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Student
                  </label>

                  <select
                    value={
                      selectedStudentId
                    }
                    onChange={(
                      event,
                    ) =>
                      setSelectedStudentId(
                        event.target
                          .value,
                      )
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">
                      Select student
                    </option>

                    {filteredStudents.map(
                      (student) => {
                        const enrollment =
                          enrollments.find(
                            (item) =>
                              item.student_id ===
                                student.id &&
                              item.academic_year_id ===
                                selectedAcademicYearId &&
                              item.status ===
                                "Active" &&
                              item.class_id ===
                                selectedClassId,
                          );

                        if (
                          !enrollment
                        ) {
                          return null;
                        }

                        const alreadyBilled =
                          invoices.some(
                            (invoice) =>
                              invoice.student_id ===
                                student.id &&
                              invoice.academic_year_id ===
                                selectedAcademicYearId &&
                              invoice.term ===
                                selectedTerm &&
                              invoice.status !==
                                "Cancelled",
                          );

                        if (
                          alreadyBilled
                        ) {
                          return null;
                        }

                        return (
                          <option
                            key={
                              student.id
                            }
                            value={
                              student.id
                            }
                          >
                            {
                              student.name
                            }{" "}
                            —{" "}
                            {
                              student.studentId
                            }
                          </option>
                        );
                      },
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Academic Year
                  </label>

                  <div className="flex h-10 items-center rounded-lg bg-slate-50 px-3 text-sm text-slate-600">
                    {academicYears.find(
                      (year) =>
                        year.id ===
                        selectedAcademicYearId,
                    )?.name ??
                      "—"}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Class
                  </label>

                  <div className="flex h-10 items-center rounded-lg bg-slate-50 px-3 text-sm text-slate-600">
                    {classesForSelectedYear.find(
                      (schoolClass) =>
                        schoolClass.id ===
                        selectedClassId,
                    )?.name ??
                      "—"}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Term
                  </label>

                  <div className="flex h-10 items-center rounded-lg bg-slate-50 px-3 text-sm text-slate-600">
                    {selectedTerm}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Due Date
                  </label>

                  <input
                    type="date"
                    value={dueDate}
                    onChange={(
                      event,
                    ) =>
                      setDueDate(
                        event.target
                          .value,
                      )
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-600">
                    Discount
                  </label>

                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={discount}
                      onChange={(
                        event,
                      ) =>
                        setDiscount(
                          event.target
                            .value,
                        )
                      }
                      className="h-10 w-full rounded-lg border border-slate-200 px-3 pr-14 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />

                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                      RWF
                    </span>
                  </div>
                </div>
              </div>

              {/* Fee Items */}
              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Fee Items
                    </h3>

                    <p className="mt-0.5 text-xs text-slate-500">
                      Charges included in this bill.
                    </p>
                  </div>

                  <span className="text-sm font-semibold text-slate-900">
                    {formatMoney(
                      configuredAmount,
                    )}{" "}
                    RWF
                  </span>
                </div>

                <div className="overflow-hidden rounded-lg border border-slate-200">
                  {activeStructureItems.map(
                    (item) => (
                      <div
                        key={
                          item.id
                        }
                        className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 last:border-0"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {
                              item.name
                            }
                          </p>

                          {item.description && (
                            <p className="mt-0.5 text-xs text-slate-500">
                              {
                                item.description
                              }
                            </p>
                          )}
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-medium text-slate-900">
                            {formatMoney(
                              Number(
                                item.amount,
                              ),
                            )}{" "}
                            RWF
                          </p>

                          <p className="mt-0.5 text-[10px] text-slate-400">
                            {item.is_mandatory
                              ? "Mandatory"
                              : "Optional"}
                          </p>
                        </div>
                      </div>
                    ),
                  )}

                  {activeStructureItems.length ===
                    0 && (
                    <div className="px-4 py-8 text-center text-sm text-slate-500">
                      No fee items configured.
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="mt-5">
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Notes
                </label>

                <textarea
                  value={notes}
                  onChange={(event) =>
                    setNotes(
                      event.target
                        .value,
                    )
                  }
                  rows={3}
                  placeholder="Optional invoice notes..."
                  className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              {/* Total */}
              <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">
                    Subtotal
                  </span>

                  <span className="font-medium text-slate-800">
                    {formatMoney(
                      configuredAmount,
                    )}{" "}
                    RWF
                  </span>
                </div>

                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-slate-500">
                    Discount
                  </span>

                  <span className="font-medium text-slate-800">
                    {formatMoney(
                      Number(
                        discount,
                      ) || 0,
                    )}{" "}
                    RWF
                  </span>
                </div>

                <div className="mt-3 border-t border-indigo-100 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">
                      Total Due
                    </span>

                    <span className="text-xl font-semibold text-indigo-700">
                      {formatMoney(
                        Math.max(
                          0,
                          configuredAmount -
                            (Number(
                              discount,
                            ) || 0),
                        ),
                      )}{" "}
                      <span className="text-sm font-medium">
                        RWF
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/50 px-6 py-4">
              <button
                type="button"
                onClick={() =>
                  setShowGenerateModal(
                    false,
                  )
                }
                disabled={
                  generating
                }
                className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <Button
                onClick={
                  generateInvoice
                }
                disabled={
                  generating ||
                  !selectedStudentId ||
                  !activeStructure ||
                  activeStructureItems.length ===
                    0
                }
                className="h-10 px-5"
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Generate Invoice
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

function formatMoney(value: number) {
  return new Intl.NumberFormat(
    "en-RW",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    },
  ).format(value);
}