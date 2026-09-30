import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ClipboardCheck,
  CreditCard,
  FileText,
  GraduationCap,
  Loader2,
  Printer,
  Receipt,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { useSchool } from "../context/SchoolContext";

import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";
import { supabase } from "../lib/supabase";

interface Child {
  id: string;
  studentId: string;
  name: string;
  className: string;
}

interface ParentIdentityRpcRow {
  first_name?: string | null;
  last_name?: string | null;
}

interface ParentChildRpcRow {
  student_id: string;
  student_code?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  class_name?: string | null;
}

interface ParentPickupRpcRow {
  id: string;
  student_id: string;
  student_name: string;
  student_code?: string | null;
  class_name?: string | null;
  authorised_name: string;
  authorised_phone: string;
  relationship: string;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
}

interface ParentAttendanceRpcRow {
  id: string;
  student_id: string;
  attendance_date: string;
  status: "present" | "absent" | "late" | "excused";
  class_id: string | null;
  class_name?: string | null;
}

interface ParentResultRpcRow {
  id: string;
  assessment_id: string;
  student_id: string;
  assessment_title: string;
  assessment_type: string;
  assessment_date: string;
  max_marks: number | null;
  subject_name?: string | null;
  subject_code?: string | null;
  academic_year_name?: string | null;
  marks: number | null;
  grade: string | null;
  remarks: string | null;
}

interface ParentFinanceInvoiceRpcRow {
  id: string;
  student_id: string;
  enrollment_id: string | null;
  academic_year_id: string | null;
  academic_year_name?: string | null;
  term: string | null;
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  subtotal: number | null;
  discount: number | null;
  total_amount: number | null;
  amount_paid: number | null;
  balance: number | null;
  status: "Unpaid" | "Partially Paid" | "Paid" | "Cancelled" | string;
  notes: string | null;
  created_at: string | null;
}

interface ParentFinancePaymentRpcRow {
  id: string;
  school_id: string;
  invoice_id: string | null;
  student_id: string;
  invoice_number?: string | null;
  amount: number | null;
  payment_date: string;
  payment_method: string | null;
  reference_number: string | null;
  notes: string | null;
  created_at: string | null;
}

interface ParentFinanceInvoiceItemRpcRow {
  id: string;
  invoice_id: string;
  name: string;
  description: string | null;
  amount: number | null;
  is_mandatory: boolean;
}

interface PickupAuthorisation {
  id: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  className: string;
  authorisedName: string;
  authorisedPhone: string;
  relationship: string;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
}

type ChildTab = "overview" | "attendance" | "results" | "finance";

type AttendanceStatus = ParentAttendanceRpcRow["status"];

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatMarks(marks: number | null, maxMarks: number | null) {
  if (marks === null || maxMarks === null) return "—";
  return `${marks} / ${maxMarks}`;
}

function getGradeClasses(grade: string | null) {
  switch ((grade ?? "").trim().toUpperCase()) {
    case "A*":
    case "A":
      return "bg-emerald-50 text-emerald-700";
    case "B":
      return "bg-blue-50 text-blue-700";
    case "C":
      return "bg-indigo-50 text-indigo-700";
    case "D":
      return "bg-amber-50 text-amber-700";
    case "E":
      return "bg-orange-50 text-orange-700";
    case "F":
    case "G":
    case "U":
      return "bg-red-50 text-red-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function getAttendanceClasses(status: AttendanceStatus) {
  switch (status) {
    case "present":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "absent":
      return "bg-red-50 text-red-700 ring-red-200";
    case "late":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "excused":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

function formatStatus(value: AttendanceStatus) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getChildInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getResultPercentage(result: ParentResultRpcRow) {
  if (result.marks === null || result.max_marks === null || result.max_marks <= 0) {
    return null;
  }

  return (Number(result.marks) / Number(result.max_marks)) * 100;
}

function getAveragePercentage(results: ParentResultRpcRow[]) {
  const percentages = results
    .map(getResultPercentage)
    .filter((value): value is number => value !== null);

  if (percentages.length === 0) return null;

  return percentages.reduce((sum, value) => sum + value, 0) / percentages.length;
}

export default function ParentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { school } = useSchool();

  const [children, setChildren] = useState<Child[]>([]);
  const [authorisations, setAuthorisations] = useState<PickupAuthorisation[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<ParentAttendanceRpcRow[]>([]);
  const [resultRows, setResultRows] = useState<ParentResultRpcRow[]>([]);
  const [financeInvoices, setFinanceInvoices] = useState<ParentFinanceInvoiceRpcRow[]>([]);
  const [financePayments, setFinancePayments] = useState<ParentFinancePaymentRpcRow[]>([]);
  const [financeInvoiceItems, setFinanceInvoiceItems] = useState<ParentFinanceInvoiceItemRpcRow[]>([]);

  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [selectedReceiptPaymentId, setSelectedReceiptPaymentId] = useState("");
  const [loadingInvoiceItems, setLoadingInvoiceItems] = useState(false);

  const [selectedChildId, setSelectedChildId] = useState("");
  const [childTab, setChildTab] = useState<ChildTab>("overview");
  const [loading, setLoading] = useState(true);
  const [childDataLoading, setChildDataLoading] = useState(false);
  const [error, setError] = useState("");
  const [childDataError, setChildDataError] = useState("");
  const [parentName, setParentName] = useState("");

  async function loadChildrenAndAuthorisations() {
    setLoading(true);
    setError("");

    const [identityResult, childrenResult, authorisationsResult] =
      await Promise.all([
        supabase.rpc("get_my_parent_membership"),
        supabase.rpc("get_parent_children"),
        supabase.rpc("get_parent_pickup_authorisations"),
      ]);

    const identity = identityResult.data as ParentIdentityRpcRow | null;
    const fallbackName =
      typeof user?.user_metadata?.first_name === "string"
        ? user.user_metadata.first_name.trim()
        : "";

    setParentName(identity?.first_name?.trim() || fallbackName || "there");

    if (identityResult.error) {
      console.error("Failed to load parent identity:", identityResult.error);
    }

    if (childrenResult.error) {
      console.error("Failed to load parent children:", childrenResult.error);
      setError(childrenResult.error.message);
    }

    if (authorisationsResult.error) {
      console.error(
        "Failed to load parent pickup authorisations:",
        authorisationsResult.error,
      );
      setError((current) => current || authorisationsResult.error.message);
    }

    const nextChildren = (
      (childrenResult.data ?? []) as ParentChildRpcRow[]
    ).map((item) => ({
      id: item.student_id,
      studentId: item.student_code ?? "",
      name: `${item.first_name ?? ""} ${item.last_name ?? ""}`.trim(),
      className: item.class_name ?? "Unassigned",
    }));

    setChildren(nextChildren);

    setSelectedChildId((current) => {
      if (current && nextChildren.some((child) => child.id === current)) {
        return current;
      }
      return nextChildren[0]?.id ?? "";
    });

    setAuthorisations(
      ((authorisationsResult.data ?? []) as ParentPickupRpcRow[]).map(
        (item) => ({
          id: item.id,
          studentId: item.student_id,
          studentName: item.student_name,
          studentCode: item.student_code ?? "",
          className: item.class_name ?? "Unassigned",
          authorisedName: item.authorised_name,
          authorisedPhone: item.authorised_phone,
          relationship: item.relationship,
          validFrom: item.valid_from,
          validUntil: item.valid_until,
          isActive: item.is_active,
        }),
      ),
    );

    setLoading(false);
  }

  async function loadSelectedChildData(studentId: string) {
    if (!studentId) {
      setAttendanceRows([]);
      setResultRows([]);
      setFinanceInvoices([]);
      setFinancePayments([]);
      setFinanceInvoiceItems([]);
      setSelectedInvoiceId("");
      setSelectedReceiptPaymentId("");
      setChildDataError("");
      return;
    }

    setChildDataLoading(true);
    setChildDataError("");

    const [
      attendanceResult,
      resultsResult,
      invoicesResult,
      paymentsResult,
    ] = await Promise.all([
      supabase.rpc("get_parent_child_attendance", {
        p_student_id: studentId,
      }),
      supabase.rpc("get_parent_child_results", {
        p_student_id: studentId,
      }),
      supabase.rpc("get_parent_child_invoices", {
        p_student_id: studentId,
      }),
      supabase.rpc("get_parent_child_payments", {
        p_student_id: studentId,
      }),
    ]);

    if (attendanceResult.error) {
      console.error("Failed to load parent child attendance:", attendanceResult.error);
      setChildDataError(attendanceResult.error.message);
      setAttendanceRows([]);
    } else {
      setAttendanceRows(
        (attendanceResult.data ?? []) as ParentAttendanceRpcRow[],
      );
    }

    if (resultsResult.error) {
      console.error("Failed to load parent child results:", resultsResult.error);
      setChildDataError((current) => current || resultsResult.error.message);
      setResultRows([]);
    } else {
      setResultRows((resultsResult.data ?? []) as ParentResultRpcRow[]);
    }

    if (invoicesResult.error) {
      console.error("Failed to load parent child invoices:", invoicesResult.error);
      setChildDataError((current) => current || invoicesResult.error.message);
      setFinanceInvoices([]);
    } else {
      setFinanceInvoices(
        (invoicesResult.data ?? []) as ParentFinanceInvoiceRpcRow[],
      );
    }

    if (paymentsResult.error) {
      console.error("Failed to load parent child payments:", paymentsResult.error);
      setChildDataError((current) => current || paymentsResult.error.message);
      setFinancePayments([]);
    } else {
      setFinancePayments(
        (paymentsResult.data ?? []) as ParentFinancePaymentRpcRow[],
      );
    }

    setFinanceInvoiceItems([]);
    setSelectedInvoiceId("");
    setSelectedReceiptPaymentId("");
    setChildDataLoading(false);
  }

  useEffect(() => {
    void loadChildrenAndAuthorisations();
  }, [user?.id]);

  useEffect(() => {
    void loadSelectedChildData(selectedChildId);
  }, [selectedChildId]);

  const selectedChild = useMemo(
    () => children.find((child) => child.id === selectedChildId) ?? null,
    [children, selectedChildId],
  );

  const activeAuthorisations = useMemo(
    () =>
      authorisations.filter(
        (item) => item.isActive && item.studentId === selectedChildId,
      ),
    [authorisations, selectedChildId],
  );

  const attendanceSummary = useMemo(() => {
    const total = attendanceRows.length;
    const present = attendanceRows.filter((row) => row.status === "present").length;
    const absent = attendanceRows.filter((row) => row.status === "absent").length;
    const late = attendanceRows.filter((row) => row.status === "late").length;
    const excused = attendanceRows.filter((row) => row.status === "excused").length;
    const attended = present + late;

    return {
      total,
      present,
      absent,
      late,
      excused,
      attendanceRate: total > 0 ? (attended / total) * 100 : 0,
    };
  }, [attendanceRows]);

  const averageResult = useMemo(
    () => getAveragePercentage(resultRows),
    [resultRows],
  );

  const latestResults = useMemo(
    () => resultRows.slice(0, 6),
    [resultRows],
  );

  const latestAttendance = useMemo(
    () => attendanceRows.slice(0, 8),
    [attendanceRows],
  );

  const financeSummary = useMemo(() => {
    const totalBilled = financeInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.total_amount ?? 0),
      0,
    );
    const totalPaid = financeInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.amount_paid ?? 0),
      0,
    );
    const outstanding = financeInvoices.reduce(
      (sum, invoice) => sum + Math.max(0, Number(invoice.balance ?? 0)),
      0,
    );

    return {
      invoiceCount: financeInvoices.length,
      paymentCount: financePayments.length,
      totalBilled,
      totalPaid,
      outstanding,
    };
  }, [financeInvoices, financePayments]);

  const selectedInvoice = useMemo(
    () =>
      financeInvoices.find((invoice) => invoice.id === selectedInvoiceId) ??
      null,
    [financeInvoices, selectedInvoiceId],
  );

  const selectedReceiptPayment = useMemo(
    () =>
      financePayments.find(
        (payment) => payment.id === selectedReceiptPaymentId,
      ) ?? null,
    [financePayments, selectedReceiptPaymentId],
  );

  const selectedReceiptInvoice = useMemo(
    () =>
      selectedReceiptPayment?.invoice_id
        ? financeInvoices.find(
            (invoice) => invoice.id === selectedReceiptPayment.invoice_id,
          ) ?? null
        : null,
    [financeInvoices, selectedReceiptPayment],
  );

  async function openInvoice(studentId: string, invoiceId: string) {
    if (!studentId || !invoiceId) return;

    setSelectedInvoiceId(invoiceId);
    setFinanceInvoiceItems([]);
    setLoadingInvoiceItems(true);

    const { data, error: invoiceItemsError } = await supabase.rpc(
      "get_parent_child_invoice_items",
      {
        p_invoice_id: invoiceId,
      },
    );

    if (invoiceItemsError) {
      console.error(
        "Failed to load parent child invoice items:",
        invoiceItemsError,
      );
      setChildDataError(invoiceItemsError.message);
      setLoadingInvoiceItems(false);
      return;
    }

    setFinanceInvoiceItems(
      (data ?? []) as ParentFinanceInvoiceItemRpcRow[],
    );
    setLoadingInvoiceItems(false);
  }

  function closeFinanceOverlays() {
    setSelectedInvoiceId("");
    setSelectedReceiptPaymentId("");
    setFinanceInvoiceItems([]);
  }

  function printReceipt(
    payment: ParentFinancePaymentRpcRow,
    invoice: ParentFinanceInvoiceRpcRow | null,
  ) {
    const studentName = selectedChild?.name ?? "Student";
    const schoolName = school?.name ?? "School";
    const receiptId = `RCP-${payment.id.slice(0, 8).toUpperCase()}`;
    const invoiceNumber = payment.invoice_number || invoice?.invoice_number || "—";
    const receiptWindow = window.open("", "_blank", "width=720,height=860");

    if (!receiptWindow) {
      setChildDataError("Please allow pop-ups to print the receipt.");
      return;
    }

    const safe = (value: string) =>
      value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

    receiptWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${safe(receiptId)}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 32px;
              color: #0f172a;
              background: #ffffff;
            }
            .receipt {
              max-width: 620px;
              margin: 0 auto;
              border: 1px solid #e2e8f0;
              border-radius: 16px;
              padding: 28px;
            }
            .header {
              display: flex;
              justify-content: space-between;
              gap: 24px;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 18px;
            }
            .muted { color: #64748b; font-size: 12px; }
            .title { font-size: 24px; font-weight: 700; margin: 4px 0; }
            .meta { margin-top: 22px; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
            .label { color: #64748b; font-size: 12px; margin-bottom: 4px; }
            .value { font-size: 14px; font-weight: 600; }
            .amount {
              margin-top: 24px;
              padding: 18px;
              border-radius: 12px;
              background: #f8fafc;
              display: flex;
              justify-content: space-between;
              gap: 16px;
              align-items: center;
            }
            .amount strong { font-size: 24px; }
            .footer {
              margin-top: 22px;
              padding-top: 16px;
              border-top: 1px solid #e2e8f0;
              color: #64748b;
              font-size: 12px;
              line-height: 1.6;
            }
            @media print {
              body { padding: 0; }
              .receipt { border: 0; padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <div>
                <div class="muted">${safe(schoolName)}</div>
                <div class="title">Payment Receipt</div>
                <div class="muted">${safe(receiptId)}</div>
              </div>
              <div style="text-align:right">
                <div class="muted">Payment date</div>
                <div class="value">${safe(formatDate(payment.payment_date))}</div>
              </div>
            </div>

            <div class="meta">
              <div>
                <div class="label">Student</div>
                <div class="value">${safe(studentName)}</div>
              </div>
              <div>
                <div class="label">Invoice</div>
                <div class="value">${safe(invoiceNumber)}</div>
              </div>
              <div>
                <div class="label">Payment method</div>
                <div class="value">${safe(payment.payment_method || "—")}</div>
              </div>
              <div>
                <div class="label">Reference</div>
                <div class="value">${safe(payment.reference_number || "—")}</div>
              </div>
            </div>

            <div class="amount">
              <span>Amount received</span>
              <strong>${safe(
                new Intl.NumberFormat("en-RW", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(Number(payment.amount ?? 0)),
              )} RWF</strong>
            </div>

            <div class="footer">
              This receipt reflects a payment recorded for the student account.
              Keep this receipt with your school payment records.
            </div>
          </div>
          <script>
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    receiptWindow.document.close();
  }

  function selectChild(studentId: string) {
    setSelectedChildId(studentId);
    setChildTab("overview");
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px] space-y-6">
      <PageHeader
        eyebrow="Parent Portal"
        title={`${getGreeting()}, ${parentName || "there"}`}
        description="Stay connected with your children, attendance, academic results and school updates."
        actions={
          <button
            type="button"
            onClick={() => void loadChildrenAndAuthorisations()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-wiser-border bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        }
      />

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <Card key={item} className="h-32 bg-slate-100">
              <div className="h-full w-full animate-pulse" />
            </Card>
          ))}
        </div>
      ) : children.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-wiser-50 text-wiser-700">
            <Users size={22} />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">
            No children linked yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            Your parent account is active, but no student has been linked to it yet. Please contact the school administrator.
          </p>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-wiser-600">
                    My children
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-slate-900">
                    Select a child to view school information
                  </h2>
                </div>
                <p className="text-xs text-slate-400">
                  Only children linked to your parent account are shown.
                </p>
              </div>
            </div>

            <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {children.map((child) => {
                const selected = child.id === selectedChildId;

                return (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => selectChild(child.id)}
                    className={[
                      "flex min-w-0 items-center gap-3 rounded-xl border px-4 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-wiser-500 focus-visible:ring-offset-2",
                      selected
                        ? "border-wiser-300 bg-wiser-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-wiser-200 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-wiser-100 text-sm font-semibold text-wiser-700">
                      {getChildInitials(child.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {child.name}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {child.studentId || "No student ID"} · {child.className}
                      </p>
                    </div>
                    <ChevronRight
                      size={16}
                      className={selected ? "text-wiser-600" : "text-slate-300"}
                    />
                  </button>
                );
              })}
            </div>
          </Card>

          {selectedChild && (
            <>
              <Card className="overflow-hidden">
                <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-wiser-100 text-base font-semibold text-wiser-700">
                      {getChildInitials(selectedChild.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-lg font-semibold text-slate-900">
                        {selectedChild.name}
                      </p>
                      <p className="mt-1 truncate text-sm text-slate-500">
                        {selectedChild.studentId || "No student ID"} · {selectedChild.className}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {([
                      ["overview", "Overview"],
                      ["attendance", "Attendance"],
                      ["results", "Results"],
                      ["finance", "Fees & Payments"],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setChildTab(value)}
                        className={[
                          "inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold transition",
                          childTab === value
                            ? "bg-wiser-600 text-white shadow-sm"
                            : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                        ].join(" ")}
                      >
                        {value === "overview" ? (
                          <BarChart3 size={15} />
                        ) : value === "attendance" ? (
                          <ClipboardCheck size={15} />
                        ) : value === "results" ? (
                          <GraduationCap size={15} />
                        ) : (
                          <Wallet size={15} />
                        )}
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {childDataError && (
                  <div className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700 sm:px-6">
                    {childDataError}
                  </div>
                )}

                {childDataLoading ? (
                  <div className="flex min-h-[260px] items-center justify-center gap-2 text-sm text-slate-500">
                    <Loader2 size={17} className="animate-spin" />
                    Loading {
                      childTab === "attendance"
                        ? "attendance"
                        : childTab === "results"
                          ? "results"
                          : childTab === "finance"
                            ? "fees and payments"
                            : "student information"
                    }...
                  </div>
                ) : childTab === "overview" ? (
                  <div className="p-5 sm:p-6">
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <SummaryCard
                        label="Attendance rate"
                        value={
                          attendanceRows.length > 0
                            ? formatPercent(attendanceSummary.attendanceRate)
                            : "—"
                        }
                        helper={
                          attendanceRows.length > 0
                            ? `${attendanceSummary.present} present · ${attendanceSummary.absent} absent`
                            : "No attendance records yet"
                        }
                        icon={<ClipboardCheck size={19} />}
                      />
                      <SummaryCard
                        label="Assessment average"
                        value={averageResult === null ? "—" : formatPercent(averageResult)}
                        helper={
                          resultRows.length > 0
                            ? `${resultRows.length} published assessment${resultRows.length === 1 ? "" : "s"}`
                            : "No published results yet"
                        }
                        icon={<GraduationCap size={19} />}
                      />
                      <SummaryCard
                        label="Recent results"
                        value={String(resultRows.slice(0, 3).length)}
                        helper="Latest published assessments"
                        icon={<BarChart3 size={19} />}
                      />
                      <SummaryCard
                        label="Active pickup"
                        value={String(activeAuthorisations.length)}
                        helper={
                          activeAuthorisations.length === 1
                            ? "Active pickup authorisation"
                            : "Active pickup authorisations"
                        }
                        icon={<ShieldCheck size={19} />}
                      />
                    </div>

                    <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                      <Card className="overflow-hidden border-slate-200 shadow-none">
                        <SectionHeader
                          icon={<ClipboardCheck size={17} />}
                          title="Recent attendance"
                          description="Latest attendance records for this child."
                          actionLabel="View attendance"
                          onAction={() => setChildTab("attendance")}
                        />

                        {latestAttendance.length === 0 ? (
                          <EmptyPanel text="No attendance records available yet." />
                        ) : (
                          <div className="divide-y divide-slate-100">
                            {latestAttendance.map((row) => (
                              <div
                                key={row.id}
                                className="flex items-center justify-between gap-3 px-5 py-3.5"
                              >
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-slate-900">
                                    {formatDate(row.attendance_date)}
                                  </p>
                                  <p className="mt-1 truncate text-xs text-slate-500">
                                    {row.class_name || selectedChild.className}
                                  </p>
                                </div>
                                <span
                                  className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getAttendanceClasses(row.status)}`}
                                >
                                  {formatStatus(row.status)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </Card>

                      <Card className="overflow-hidden border-slate-200 shadow-none">
                        <SectionHeader
                          icon={<GraduationCap size={17} />}
                          title="Recent results"
                          description="Latest published assessment results."
                          actionLabel="View results"
                          onAction={() => setChildTab("results")}
                        />

                        {latestResults.length === 0 ? (
                          <EmptyPanel text="No published assessment results available yet." />
                        ) : (
                          <div className="divide-y divide-slate-100">
                            {latestResults.map((result) => {
                              const percentage = getResultPercentage(result);

                              return (
                                <div
                                  key={result.id}
                                  className="px-5 py-3.5"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold text-slate-900">
                                        {result.subject_name || result.subject_code || "Subject"}
                                      </p>
                                      <p className="mt-1 truncate text-xs text-slate-500">
                                        {result.assessment_title} · {formatDate(result.assessment_date)}
                                      </p>
                                    </div>
                                    <span
                                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${getGradeClasses(result.grade)}`}
                                    >
                                      {result.grade || (percentage === null ? "—" : formatPercent(percentage))}
                                    </span>
                                  </div>
                                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                                    <span>{formatMarks(result.marks, result.max_marks)}</span>
                                    <span>
                                      {percentage === null ? "" : formatPercent(percentage)}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </Card>
                    </div>

                    <div className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                      <Card className="overflow-hidden border-slate-200 shadow-none">
                        <SectionHeader
                          icon={<ShieldCheck size={17} />}
                          title="Pickup authorisations"
                          description="People authorised to collect this child."
                          actionLabel="Manage pickup"
                          onAction={() => navigate("/pickup-authorisations")}
                        />

                        {activeAuthorisations.length === 0 ? (
                          <EmptyPanel text="No active pickup authorisations for this child." />
                        ) : (
                          <div className="divide-y divide-slate-100">
                            {activeAuthorisations.slice(0, 4).map((item) => (
                              <div key={item.id} className="px-5 py-3.5">
                                <div className="flex items-start gap-3">
                                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                                    <CheckCircle2 size={17} />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-900">
                                      {item.authorisedName}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      {item.relationship} · {item.authorisedPhone}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">
                                      {formatDate(item.validFrom)} – {formatDate(item.validUntil)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </Card>

                      <Card className="overflow-hidden border-slate-200 shadow-none">
                        <SectionHeader
                          icon={<Bell size={17} />}
                          title="School communication"
                          description="Stay up to date with messages from the school."
                          actionLabel="View announcements"
                          onAction={() => navigate("/announcements")}
                        />
                        <div className="px-5 py-7">
                          <p className="text-sm leading-6 text-slate-500">
                            School announcements are available from the notification centre and parent communication section.
                          </p>
                          <button
                            type="button"
                            onClick={() => navigate("/announcements")}
                            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-wiser-border px-3.5 py-2.5 text-sm font-semibold text-wiser-700 transition hover:bg-wiser-50"
                          >
                            Open announcements
                            <ArrowRight size={15} />
                          </button>
                        </div>
                      </Card>
                    </div>
                  </div>
                ) : childTab === "attendance" ? (
                  <AttendancePanel
                    child={selectedChild}
                    rows={attendanceRows}
                    summary={attendanceSummary}
                  />
                ) : childTab === "results" ? (
                  <ResultsPanel
                    child={selectedChild}
                    rows={resultRows}
                    average={averageResult}
                  />
                ) : (
                  <FinancePanel
                    child={selectedChild}
                    invoices={financeInvoices}
                    payments={financePayments}
                    summary={financeSummary}
                    onViewInvoice={(invoiceId) =>
                      void openInvoice(selectedChild.id, invoiceId)
                    }
                    onViewReceipt={(paymentId) =>
                      setSelectedReceiptPaymentId(paymentId)
                    }
                  />
                )}
              </Card>

              {(selectedInvoice || selectedReceiptPayment) && (
                <FinanceOverlay
                  child={selectedChild}
                  schoolName={school?.name ?? "School"}
                  invoice={selectedInvoice}
                  invoiceItems={financeInvoiceItems}
                  loadingInvoiceItems={loadingInvoiceItems}
                  payment={selectedReceiptPayment}
                  paymentInvoice={selectedReceiptInvoice}
                  onClose={closeFinanceOverlays}
                  onPrintReceipt={
                    selectedReceiptPayment
                      ? () =>
                          printReceipt(
                            selectedReceiptPayment,
                            selectedReceiptInvoice,
                          )
                      : undefined
                  }
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {value}
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-wiser-700 ring-1 ring-slate-200">
          {icon}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-slate-900">
          <span className="text-wiser-700">{icon}</span>
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>
      <button
        type="button"
        onClick={onAction}
        className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-wiser-700 transition hover:text-wiser-800"
      >
        {actionLabel}
        <ArrowRight size={14} />
      </button>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div className="px-5 py-9 text-center">
      <CalendarDays className="mx-auto h-7 w-7 text-slate-300" />
      <p className="mt-3 text-sm text-slate-500">{text}</p>
    </div>
  );
}

function AttendancePanel({
  child,
  rows,
  summary,
}: {
  child: Child;
  rows: ParentAttendanceRpcRow[];
  summary: {
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    attendanceRate: number;
  };
}) {
  return (
    <div className="p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard
          label="Attendance rate"
          value={rows.length === 0 ? "—" : formatPercent(summary.attendanceRate)}
          helper={`${summary.present} present days`}
          icon={<ClipboardCheck size={18} />}
        />
        <SummaryCard
          label="Present"
          value={String(summary.present)}
          helper="Recorded as present"
          icon={<CheckCircle2 size={18} />}
        />
        <SummaryCard
          label="Absent"
          value={String(summary.absent)}
          helper="Recorded as absent"
          icon={<XCircle size={18} />}
        />
        <SummaryCard
          label="Late"
          value={String(summary.late)}
          helper="Recorded as late"
          icon={<Clock3 size={18} />}
        />
        <SummaryCard
          label="Excused"
          value={String(summary.excused)}
          helper="Recorded as excused"
          icon={<UserRound size={18} />}
        />
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-900">Attendance history</h3>
          <p className="mt-1 text-xs text-slate-500">
            Attendance records for {child.name}.
          </p>
        </div>

        {rows.length === 0 ? (
          <EmptyPanel text="No attendance records are available for this child yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Date
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Class
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3.5 text-sm font-medium text-slate-900">
                      {formatDate(row.attendance_date)}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-slate-500">
                      {row.class_name || child.className}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getAttendanceClasses(row.status)}`}
                      >
                        {formatStatus(row.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


function formatFinanceMoney(value: number | null) {
  return new Intl.NumberFormat("en-RW", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function getInvoiceStatusClasses(status: string) {
  switch (status) {
    case "Paid":
      return "bg-emerald-50 text-emerald-700";
    case "Partially Paid":
      return "bg-amber-50 text-amber-700";
    case "Cancelled":
      return "bg-slate-100 text-slate-600";
    default:
      return "bg-red-50 text-red-700";
  }
}

function getPaymentMethodClasses(method: string | null) {
  switch ((method ?? "").toLowerCase()) {
    case "mobile money":
    case "flutterwave":
      return "bg-emerald-50 text-emerald-700";
    case "bank transfer":
      return "bg-blue-50 text-blue-700";
    case "card":
      return "bg-violet-50 text-violet-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function FinancePanel({
  child,
  invoices,
  payments,
  summary,
  onViewInvoice,
  onViewReceipt,
}: {
  child: Child;
  invoices: ParentFinanceInvoiceRpcRow[];
  payments: ParentFinancePaymentRpcRow[];
  summary: {
    invoiceCount: number;
    paymentCount: number;
    totalBilled: number;
    totalPaid: number;
    outstanding: number;
  };
  onViewInvoice: (invoiceId: string) => void;
  onViewReceipt: (paymentId: string) => void;
}) {
  return (
    <div className="space-y-6 p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Invoices"
          value={String(summary.invoiceCount)}
          helper="Invoices on this child account"
          icon={<FileText size={18} />}
        />
        <SummaryCard
          label="Total billed"
          value={`${formatFinanceMoney(summary.totalBilled)} RWF`}
          helper="Total invoiced amount"
          icon={<Wallet size={18} />}
        />
        <SummaryCard
          label="Total paid"
          value={`${formatFinanceMoney(summary.totalPaid)} RWF`}
          helper="Recorded payments"
          icon={<CreditCard size={18} />}
        />
        <SummaryCard
          label="Outstanding"
          value={`${formatFinanceMoney(summary.outstanding)} RWF`}
          helper="Current balance across invoices"
          icon={<Receipt size={18} />}
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Invoices & balances
              </h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Fee invoices issued for {child.name}.
              </p>
            </div>
            <span className="text-xs font-medium text-slate-400">
              {summary.invoiceCount} invoice{summary.invoiceCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {invoices.length === 0 ? (
          <EmptyPanel text="No invoices are available for this child yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Invoice
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Academic year
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Term
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Total
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Paid
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Balance
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-4">
                      <div className="text-sm font-semibold text-slate-900">
                        {invoice.invoice_number}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Issued {formatDate(invoice.issue_date)}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">
                      {invoice.academic_year_name || "—"}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">
                      {invoice.term || "—"}
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                      {formatFinanceMoney(invoice.total_amount)} RWF
                    </td>
                    <td className="px-5 py-4 text-sm text-emerald-700">
                      {formatFinanceMoney(invoice.amount_paid)} RWF
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-red-700">
                      {formatFinanceMoney(invoice.balance)} RWF
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getInvoiceStatusClasses(
                          invoice.status,
                        )}`}
                      >
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => onViewInvoice(invoice.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-wiser-700 transition hover:bg-wiser-50"
                      >
                        View invoice
                        <ChevronRight size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Payments & receipts
              </h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Recorded payments made against this child account.
              </p>
            </div>
            <span className="text-xs font-medium text-slate-400">
              {summary.paymentCount} payment{summary.paymentCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {payments.length === 0 ? (
          <EmptyPanel text="No payments are available for this child yet." />
        ) : (
          <div className="divide-y divide-slate-100">
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatFinanceMoney(payment.amount)} RWF
                    </p>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getPaymentMethodClasses(
                        payment.payment_method,
                      )}`}
                    >
                      {payment.payment_method || "Payment"}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>{formatDate(payment.payment_date)}</span>
                    <span>
                      Invoice {payment.invoice_number || "—"}
                    </span>
                    <span>
                      Ref. {payment.reference_number || "—"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onViewReceipt(payment.id)}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-wiser-700 transition hover:bg-wiser-50"
                >
                  <Receipt size={14} />
                  View receipt
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FinanceOverlay({
  child,
  schoolName,
  invoice,
  invoiceItems,
  loadingInvoiceItems,
  payment,
  paymentInvoice,
  onClose,
  onPrintReceipt,
}: {
  child: Child;
  schoolName: string;
  invoice: ParentFinanceInvoiceRpcRow | null;
  invoiceItems: ParentFinanceInvoiceItemRpcRow[];
  loadingInvoiceItems: boolean;
  payment: ParentFinancePaymentRpcRow | null;
  paymentInvoice: ParentFinanceInvoiceRpcRow | null;
  onClose: () => void;
  onPrintReceipt?: () => void;
}) {
  if (!invoice && !payment) return null;

  const isInvoice = Boolean(invoice);
  const receiptId = payment
    ? `RCP-${payment.id.slice(0, 8).toUpperCase()}`
    : "";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-wiser-600">
              {isInvoice ? "Invoice details" : "Payment receipt"}
            </p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">
              {isInvoice
                ? invoice?.invoice_number
                : receiptId}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {child.name}
              {payment
                ? ` · ${formatDate(payment.payment_date)}`
                : invoice
                  ? ` · ${invoice.term || "Fee invoice"}`
                  : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <XCircle size={18} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-5 sm:px-6">
          {isInvoice && invoice ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <SummaryCard
                  label="Total"
                  value={`${formatFinanceMoney(invoice.total_amount)} RWF`}
                  helper="Invoice total"
                  icon={<FileText size={17} />}
                />
                <SummaryCard
                  label="Balance"
                  value={`${formatFinanceMoney(invoice.balance)} RWF`}
                  helper="Amount still outstanding"
                  icon={<Wallet size={17} />}
                />
                <SummaryCard
                  label="Paid"
                  value={`${formatFinanceMoney(invoice.amount_paid)} RWF`}
                  helper="Recorded against this invoice"
                  icon={<CreditCard size={17} />}
                />
                <SummaryCard
                  label="Status"
                  value={invoice.status}
                  helper={`Issued ${formatDate(invoice.issue_date)}`}
                  icon={<Receipt size={17} />}
                />
              </div>

              <div className="rounded-xl border border-slate-200">
                <div className="border-b border-slate-200 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">
                    Invoice information
                  </p>
                </div>
                <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-slate-400">Academic year</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {invoice.academic_year_name || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Term</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {invoice.term || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Issue date</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {formatDate(invoice.issue_date)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Due date</p>
                    <p className="mt-1 text-sm font-medium text-slate-900">
                      {formatDate(invoice.due_date)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200">
                <div className="border-b border-slate-200 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">
                    Fee items
                  </p>
                </div>
                {loadingInvoiceItems ? (
                  <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-slate-500">
                    <Loader2 size={16} className="animate-spin" />
                    Loading invoice items...
                  </div>
                ) : invoiceItems.length === 0 ? (
                  <div className="px-4 py-7 text-center text-sm text-slate-500">
                    No invoice line items were recorded for this invoice.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {invoiceItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between gap-4 px-4 py-3.5"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900">
                            {item.name}
                          </p>
                          {item.description && (
                            <p className="mt-1 text-xs leading-5 text-slate-500">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold text-slate-900">
                            {formatFinanceMoney(item.amount)} RWF
                          </p>
                          <p className="mt-1 text-[11px] text-slate-400">
                            {item.is_mandatory ? "Mandatory" : "Optional"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {invoice.notes && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Notes
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {invoice.notes}
                  </p>
                </div>
              )}
            </div>
          ) : payment ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-wiser-100 bg-wiser-50 px-5 py-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-wiser-700">
                      Payment receipt
                    </p>
                    <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
                      {formatFinanceMoney(payment.amount)} RWF
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-xs text-slate-500">Receipt ID</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {receiptId}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-slate-400">Student</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {child.name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">School</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {schoolName}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Invoice</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {payment.invoice_number ||
                      paymentInvoice?.invoice_number ||
                      "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Payment date</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {formatDate(payment.payment_date)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Payment method</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {payment.payment_method || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Reference</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {payment.reference_number || "—"}
                  </p>
                </div>
              </div>

              {payment.notes && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Notes
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {payment.notes}
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Close
          </button>
          {payment && onPrintReceipt && (
            <button
              type="button"
              onClick={onPrintReceipt}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-wiser-600 px-4 text-sm font-semibold text-white transition hover:bg-wiser-700"
            >
              <Printer size={15} />
              Print receipt
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultsPanel({
  child,
  rows,
  average,
}: {
  child: Child;
  rows: ParentResultRpcRow[];
  average: number | null;
}) {
  return (
    <div className="p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Published assessments"
          value={String(rows.length)}
          helper="Results currently visible to you"
          icon={<GraduationCap size={18} />}
        />
        <SummaryCard
          label="Average"
          value={average === null ? "—" : formatPercent(average)}
          helper="Across published marks"
          icon={<BarChart3 size={18} />}
        />
        <SummaryCard
          label="Latest result"
          value={rows[0]?.grade || "—"}
          helper={rows[0]?.assessment_title || "No published result yet"}
          icon={<CheckCircle2 size={18} />}
        />
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-900">Academic results</h3>
          <p className="mt-1 text-xs text-slate-500">
            Published assessment results for {child.name}.
          </p>
        </div>

        {rows.length === 0 ? (
          <EmptyPanel text="No published assessment results are available for this child yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Assessment
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Subject
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Date
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Marks
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Percentage
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Grade
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const percentage = getResultPercentage(row);

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3.5">
                        <div className="text-sm font-medium text-slate-900">
                          {row.assessment_title}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {row.assessment_type || "Assessment"}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-500">
                        {row.subject_name || row.subject_code || "—"}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-500">
                        {formatDate(row.assessment_date)}
                      </td>
                      <td className="px-5 py-3.5 text-sm font-semibold text-slate-700">
                        {formatMarks(row.marks, row.max_marks)}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-500">
                        {percentage === null ? "—" : formatPercent(percentage)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getGradeClasses(row.grade)}`}
                        >
                          {row.grade || "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
