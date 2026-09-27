import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  CreditCard,
  GraduationCap,
  Loader2,
  Phone,
  RefreshCw,
  AlertCircle,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import Card from "../components/ui/Card";
import { useSchool } from "../context/SchoolContext";
import { supabase } from "../lib/supabase";

interface SummaryData {
  activeStudents: number;
  authorizedContacts: number;
  todayPickups: number;
  todayPaymentsCount: number;
  todayPaymentsAmount: number;
  outstandingAmount: number;
  outstandingInvoices: number;
  overdueInvoices: number;
}

interface PickupItem {
  id: string;
  studentName: string;
  pickupPersonName: string;
  relationship: string;
  releasedAt: string;
}

interface PaymentItem {
  id: string;
  studentName: string;
  amount: number;
  method: string;
  paymentDate: string;
  createdAt: string;
}

interface RecentStudent {
  id: string;
  name: string;
  studentId: string;
  createdAt: string;
}

type SectionKey = "overview" | "pickups" | "payments" | "records";
type SectionState = "idle" | "loading" | "ready" | "empty" | "error";

const initialSummary: SummaryData = {
  activeStudents: 0,
  authorizedContacts: 0,
  todayPickups: 0,
  todayPaymentsCount: 0,
  todayPaymentsAmount: 0,
  outstandingAmount: 0,
  outstandingInvoices: 0,
  overdueInvoices: 0,
};

const initialSectionStatus: Record<SectionKey, SectionState> = {
  overview: "loading",
  pickups: "loading",
  payments: "loading",
  records: "loading",
};

function getToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getDateStart(value: string) {
  return new Date(`${value}T00:00:00`);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-RW", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompactMoney(value: number) {
  if (value >= 1_000_000) return `RWF ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `RWF ${(value / 1_000).toFixed(0)}K`;
  return `RWF ${formatMoney(value)}`;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function getFirstName(user: {
  user_metadata?: Record<string, unknown>;
  email?: string | null;
}) {
  const firstName = user.user_metadata?.first_name;
  if (typeof firstName === "string" && firstName.trim()) return firstName.trim();

  const fullName = user.user_metadata?.full_name;
  if (typeof fullName === "string" && fullName.trim()) {
    return fullName.trim().split(/\s+/)[0];
  }

  return user.email?.split("@")[0] || "there";
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

function SectionStateView({
  state,
  emptyTitle,
  emptyDescription,
  error,
  onRetry,
  children,
}: {
  state: SectionState;
  emptyTitle: string;
  emptyDescription: string;
  error?: string;
  onRetry?: () => void;
  children: React.ReactNode;
}) {
  if (state === "loading") {
    return (
      <div className="flex min-h-[170px] items-center justify-center px-5 py-8">
        <div className="inline-flex items-center gap-2 text-sm text-slate-500">
          <Loader2 size={17} className="animate-spin text-wiser-600" />
          Loading data...
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="px-5 py-10 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
          <AlertCircle size={19} />
        </div>
        <h3 className="mt-3 text-sm font-semibold text-slate-800">Unable to load this section</h3>
        <p className="mx-auto mt-1 max-w-md text-sm leading-5 text-slate-500">
          {error || "Something went wrong while loading the data."}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-wiser-200 hover:bg-wiser-50 hover:text-wiser-700"
          >
            <RefreshCw size={15} />
            Try again
          </button>
        )}
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className="px-5 py-10 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
          <CheckCircle2 size={19} />
        </div>
        <h3 className="mt-3 text-sm font-semibold text-slate-800">{emptyTitle}</h3>
        <p className="mx-auto mt-1 max-w-md text-sm leading-5 text-slate-500">{emptyDescription}</p>
      </div>
    );
  }

  return <>{children}</>;
}

function KpiCard({
  label,
  value,
  helper,
  icon,
  loading,
  error,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
  loading: boolean;
  error: boolean;
}) {
  return (
    <Card className="min-w-0 p-5 transition-shadow hover:shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-2 text-[1.75rem] font-semibold leading-none tracking-tight text-slate-900 sm:text-3xl">
            {loading ? "—" : error ? "!" : value}
          </p>
          <p className="mt-2 max-w-[220px] text-xs leading-5 text-slate-500">{helper}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-wiser-50 text-wiser-600">
          {icon}
        </div>
      </div>
    </Card>
  );
}

function QuickAction({
  label,
  description,
  icon,
  onClick,
}: {
  label: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-left transition hover:border-wiser-200 hover:bg-wiser-50/50"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-wiser-50 text-wiser-600 group-hover:bg-wiser-100">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-800">{label}</span>
        <span className="mt-0.5 block truncate text-xs text-slate-500">{description}</span>
      </span>
      <ArrowUpRight size={15} className="shrink-0 text-slate-400" />
    </button>
  );
}

export default function SecretaryDashboard() {
  const navigate = useNavigate();
  const { school } = useSchool();

  const [firstName, setFirstName] = useState("there");
  const [summary, setSummary] = useState<SummaryData>(initialSummary);
  const [pickups, setPickups] = useState<PickupItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [recentStudents, setRecentStudents] = useState<RecentStudent[]>([]);
  const [sectionStatus, setSectionStatus] = useState<Record<SectionKey, SectionState>>(initialSectionStatus);
  const [sectionErrors, setSectionErrors] = useState<Partial<Record<SectionKey, string>>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const today = getToday();

  async function loadDashboard() {
    if (!school?.id) {
      setSectionStatus({
        overview: "empty",
        pickups: "empty",
        payments: "empty",
        records: "empty",
      });
      return;
    }

    setRefreshing(true);
    setSectionErrors({});
    setSectionStatus({
      overview: "loading",
      pickups: "loading",
      payments: "loading",
      records: "loading",
    });

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) setFirstName(getFirstName(user));

      const yearResult = await supabase
        .from("academic_years")
        .select("id, name, is_current, start_date")
        .eq("school_id", school.id)
        .order("start_date", { ascending: false })
        .limit(10);

      if (yearResult.error) {
        throw yearResult.error;
      }

      const currentYear =
        (yearResult.data ?? []).find((year) => year.is_current) ??
        (yearResult.data ?? [])[0] ??
        null;

      const invoiceQuery = currentYear
        ? supabase
            .from("student_invoices")
            .select("id, balance, due_date, status")
            .eq("school_id", school.id)
            .eq("academic_year_id", currentYear.id)
        : supabase
            .from("student_invoices")
            .select("id, balance, due_date, status")
            .eq("school_id", school.id);

      const [
        studentsResult,
        contactsResult,
        invoiceResult,
        pickupsResult,
        recentPickupsResult,
        todayPaymentsResult,
        recentPaymentsResult,
        recentStudentsResult,
      ] = await Promise.all([
        supabase
          .from("students")
          .select("id", { count: "exact", head: true })
          .eq("school_id", school.id)
          .eq("status", "Active"),

        supabase
          .from("authorized_pickup_persons")
          .select("id", { count: "exact", head: true })
          .eq("school_id", school.id)
          .eq("is_active", true),

        invoiceQuery,

        supabase
          .from("student_pickups")
          .select("id", { count: "exact", head: true })
          .eq("school_id", school.id)
          .gte("released_at", `${today}T00:00:00`)
          .lt("released_at", `${today}T23:59:59.999`),

        supabase
          .from("student_pickups")
          .select(
            `
              id,
              released_at,
              students ( first_name, last_name ),
              authorized_pickup_persons ( first_name, last_name, relationship )
            `,
          )
          .eq("school_id", school.id)
          .order("released_at", { ascending: false })
          .limit(5),

        supabase
          .from("student_payments")
          .select("id, amount", { count: "exact" })
          .eq("school_id", school.id)
          .eq("payment_date", today),

        supabase
          .from("student_payments")
          .select("id, amount, payment_method, payment_date, created_at, students ( first_name, last_name )")
          .eq("school_id", school.id)
          .order("payment_date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(5),

        supabase
          .from("students")
          .select("id, student_id, first_name, last_name, created_at")
          .eq("school_id", school.id)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const overviewError = studentsResult.error || contactsResult.error || invoiceResult.error;
      const pickupError = pickupsResult.error || recentPickupsResult.error;
      const paymentError = todayPaymentsResult.error || recentPaymentsResult.error;
      const recordError = recentStudentsResult.error;

      setSummary({
        activeStudents: studentsResult.count ?? 0,
        authorizedContacts: contactsResult.count ?? 0,
        todayPickups: pickupsResult.count ?? 0,
        todayPaymentsCount: todayPaymentsResult.count ?? 0,
        todayPaymentsAmount: (todayPaymentsResult.data ?? []).reduce(
          (sum, payment) => sum + Number(payment.amount ?? 0),
          0,
        ),
        outstandingAmount: (invoiceResult.data ?? []).reduce(
          (sum, invoice) => sum + Math.max(0, Number(invoice.balance ?? 0)),
          0,
        ),
        outstandingInvoices: (invoiceResult.data ?? []).filter(
          (invoice) => Number(invoice.balance ?? 0) > 0,
        ).length,
        overdueInvoices: (invoiceResult.data ?? []).filter((invoice) => {
          const balance = Number(invoice.balance ?? 0);
          if (balance <= 0 || !invoice.due_date) return false;
          return getDateStart(invoice.due_date.slice(0, 10)).getTime() < getDateStart(today).getTime();
        }).length,
      });

      if (overviewError) {
        setSectionStatus((current) => ({ ...current, overview: "error" }));
        setSectionErrors((current) => ({
          ...current,
          overview: getErrorMessage(overviewError, "Could not load the secretary overview."),
        }));
      } else {
        setSectionStatus((current) => ({
          ...current,
          overview: "ready",
        }));
      }

      const mappedPickups: PickupItem[] = (recentPickupsResult.data ?? []).map((record) => {
        const student = Array.isArray(record.students) ? record.students[0] : record.students;
        const person = Array.isArray(record.authorized_pickup_persons)
          ? record.authorized_pickup_persons[0]
          : record.authorized_pickup_persons;

        return {
          id: record.id,
          studentName: student
            ? `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim()
            : "Unknown student",
          pickupPersonName: person
            ? `${person.first_name ?? ""} ${person.last_name ?? ""}`.trim()
            : "Unknown person",
          relationship: person?.relationship ?? "Authorized contact",
          releasedAt: record.released_at,
        };
      });
      setPickups(mappedPickups);

      if (pickupError) {
        setSectionStatus((current) => ({ ...current, pickups: "error" }));
        setSectionErrors((current) => ({
          ...current,
          pickups: getErrorMessage(pickupError, "Could not load pickup activity."),
        }));
      } else {
        setSectionStatus((current) => ({
          ...current,
          pickups: mappedPickups.length === 0 ? "empty" : "ready",
        }));
      }

      const mappedPayments: PaymentItem[] = (recentPaymentsResult.data ?? []).map((payment) => {
        const student = Array.isArray(payment.students) ? payment.students[0] : payment.students;

        return {
          id: payment.id,
          studentName: student
            ? `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim()
            : "Unknown student",
          amount: Number(payment.amount ?? 0),
          method: payment.payment_method ?? "Other",
          paymentDate: payment.payment_date,
          createdAt: payment.created_at,
        };
      });
      setPayments(mappedPayments);

      if (paymentError) {
        setSectionStatus((current) => ({ ...current, payments: "error" }));
        setSectionErrors((current) => ({
          ...current,
          payments: getErrorMessage(paymentError, "Could not load payment activity."),
        }));
      } else {
        setSectionStatus((current) => ({
          ...current,
          payments: mappedPayments.length === 0 && (todayPaymentsResult.data ?? []).length === 0 ? "empty" : "ready",
        }));
      }

      const mappedStudents: RecentStudent[] = (recentStudentsResult.data ?? []).map((student) => ({
        id: student.id,
        studentId: student.student_id,
        name: `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim() || "Unnamed student",
        createdAt: student.created_at,
      }));
      setRecentStudents(mappedStudents);

      if (recordError) {
        setSectionStatus((current) => ({ ...current, records: "error" }));
        setSectionErrors((current) => ({
          ...current,
          records: getErrorMessage(recordError, "Could not load student records."),
        }));
      } else {
        setSectionStatus((current) => ({
          ...current,
          records: mappedStudents.length === 0 ? "empty" : "ready",
        }));
      }

      setLastUpdated(new Date());
    } catch (error) {
      const message = getErrorMessage(error, "Could not load the secretary dashboard.");
      setSectionStatus((current) => ({
        ...current,
        overview: current.overview === "loading" ? "error" : current.overview,
        pickups: current.pickups === "loading" ? "error" : current.pickups,
        payments: current.payments === "loading" ? "error" : current.payments,
        records: current.records === "loading" ? "error" : current.records,
      }));
      setSectionErrors((current) => ({
        ...current,
        overview: current.overview ? current.overview : message,
      }));
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, [school?.id]);

  const attentionItems = useMemo(() => {
    const items: { label: string; value: string; description: string; action: () => void }[] = [];

    if (summary.outstandingInvoices > 0) {
      items.push({
        label: "Outstanding fee balances",
        value: formatCompactMoney(summary.outstandingAmount),
        description: `${summary.outstandingInvoices} invoice${summary.outstandingInvoices === 1 ? "" : "s"} with a balance`,
        action: () => navigate("/finance/payments"),
      });
    }

    if (summary.overdueInvoices > 0) {
      items.push({
        label: "Overdue invoices",
        value: String(summary.overdueInvoices),
        description: "Invoices past their due date",
        action: () => navigate("/finance/payments"),
      });
    }

    if (summary.todayPickups > 0) {
      items.push({
        label: "Pickup activity today",
        value: String(summary.todayPickups),
        description: "Student releases recorded today",
        action: () => navigate("/pickup-history"),
      });
    }

    return items;
  }, [navigate, summary.outstandingAmount, summary.outstandingInvoices, summary.overdueInvoices, summary.todayPickups]);

  const hasOperationalData =
    sectionStatus.overview === "ready" ||
    sectionStatus.pickups === "ready" ||
    sectionStatus.payments === "ready" ||
    sectionStatus.records === "ready";

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px] space-y-6 lg:space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-wiser-600">Secretary Dashboard</p>
          <h1 className="mt-2 text-[1.75rem] font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {getGreeting()}, {firstName}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Your front-office overview for student records, pickups, parent contacts, and payments.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {lastUpdated && (
            <span className="hidden text-xs text-slate-400 sm:inline">
              Updated {lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button
            type="button"
            onClick={() => void loadDashboard()}
            disabled={refreshing}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 transition hover:border-wiser-200 hover:bg-wiser-50 hover:text-wiser-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </header>

      {!hasOperationalData && sectionStatus.overview === "error" && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {sectionErrors.overview || "Some dashboard data could not be loaded."}
        </div>
      )}

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 sm:text-base">Today at a glance</h2>
            <p className="mt-1 text-xs text-slate-500">Key front-office numbers for the school day.</p>
          </div>
        </div>

        <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Active students"
          value={String(summary.activeStudents)}
          helper="Students currently active in the school"
          icon={<GraduationCap size={19} />}
          loading={sectionStatus.overview === "loading"}
          error={sectionStatus.overview === "error"}
        />
        <KpiCard
          label="Authorized contacts"
          value={String(summary.authorizedContacts)}
          helper="Active contacts available for student pickup"
          icon={<Users size={19} />}
          loading={sectionStatus.overview === "loading"}
          error={sectionStatus.overview === "error"}
        />
        <KpiCard
          label="Pickups today"
          value={String(summary.todayPickups)}
          helper="Student releases recorded today"
          icon={<Clock3 size={19} />}
          loading={sectionStatus.pickups === "loading"}
          error={sectionStatus.pickups === "error"}
        />
        <KpiCard
          label="Payments today"
          value={formatCompactMoney(summary.todayPaymentsAmount)}
          helper={`${summary.todayPaymentsCount} payment${summary.todayPaymentsCount === 1 ? "" : "s"} recorded today`}
          icon={<Wallet size={19} />}
          loading={sectionStatus.payments === "loading"}
          error={sectionStatus.payments === "error"}
        />
        </div>
      </section>

      <section className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.95fr)]">
        <Card className="min-w-0 overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Today&apos;s pickup desk</h2>
              <p className="mt-1 text-xs text-slate-500">Latest student release activity.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/pickup-desk")}
              className="inline-flex items-center gap-1.5 self-start text-xs font-semibold text-wiser-700 hover:text-wiser-800 sm:self-auto"
            >
              Open pickup desk
              <ArrowUpRight size={14} />
            </button>
          </div>

          <SectionStateView
            state={sectionStatus.pickups}
            emptyTitle="No pickup records today"
            emptyDescription="Student releases will appear here as they are confirmed at the pickup desk."
            error={sectionErrors.pickups}
            onRetry={() => void loadDashboard()}
          >
            <div className="divide-y divide-slate-100">
              {pickups.map((pickup) => (
                <div key={pickup.id} className="flex min-w-0 items-start gap-3 px-5 py-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                    <CheckCircle2 size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{pickup.studentName}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      Released to {pickup.pickupPersonName} · {pickup.relationship}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-slate-400">{formatTime(pickup.releasedAt)}</span>
                </div>
              ))}
            </div>
          </SectionStateView>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Fee collection</h2>
              <p className="mt-1 text-xs text-slate-500">Current-year balances requiring attention.</p>
            </div>
            <CreditCard size={18} className="text-wiser-600" />
          </div>

          <SectionStateView
            state={sectionStatus.overview}
            emptyTitle="No fee data available"
            emptyDescription="There are no current-year fee invoices to summarize yet."
            error={sectionErrors.overview}
            onRetry={() => void loadDashboard()}
          >
            <div className="space-y-4 p-5">
              <div className="rounded-xl border border-wiser-100 bg-wiser-50/60 p-4 sm:p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-wiser-700">Outstanding balance</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[1.75rem]">
                  RWF {formatMoney(summary.outstandingAmount)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {summary.outstandingInvoices} invoice{summary.outstandingInvoices === 1 ? "" : "s"} with a balance
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-600">Overdue invoices</span>
                <span className="font-semibold text-slate-900">{summary.overdueInvoices}</span>
              </div>

              <button
                type="button"
                onClick={() => navigate("/finance/payments")}
                className="inline-flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:border-wiser-200 hover:bg-wiser-50 hover:text-wiser-700"
              >
                Open payment desk
                <ArrowUpRight size={14} />
              </button>
            </div>
          </SectionStateView>
        </Card>
      </section>

      <section className="grid min-w-0 gap-5 lg:grid-cols-2">
        <Card className="min-w-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Recent payments</h2>
              <p className="mt-1 text-xs text-slate-500">Latest student fee transactions.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/finance/payments")}
              className="text-xs font-semibold text-wiser-700 hover:text-wiser-800"
            >
              View all
            </button>
          </div>

          <SectionStateView
            state={sectionStatus.payments}
            emptyTitle="No payment activity yet"
            emptyDescription="Recorded student fee payments will appear here."
            error={sectionErrors.payments}
            onRetry={() => void loadDashboard()}
          >
            <div className="divide-y divide-slate-100">
              {payments.map((payment) => (
                <div key={payment.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-wiser-50 text-wiser-600">
                    <Wallet size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{payment.studentName}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {payment.method} · {formatDate(payment.paymentDate)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-slate-900">
                    RWF {formatMoney(payment.amount)}
                  </span>
                </div>
              ))}
            </div>
          </SectionStateView>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Recent student records</h2>
              <p className="mt-1 text-xs text-slate-500">Newest students added to the school.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/students")}
              className="text-xs font-semibold text-wiser-700 hover:text-wiser-800"
            >
              View students
            </button>
          </div>

          <SectionStateView
            state={sectionStatus.records}
            emptyTitle="No student records yet"
            emptyDescription="New student registrations will appear here after they are added."
            error={sectionErrors.records}
            onRetry={() => void loadDashboard()}
          >
            <div className="divide-y divide-slate-100">
              {recentStudents.map((student) => (
                <div key={student.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                    <GraduationCap size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{student.name}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">ID: {student.studentId}</p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">{formatDate(student.createdAt)}</span>
                </div>
              ))}
            </div>
          </SectionStateView>
        </Card>
      </section>

      <section className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.45fr)]">
        <Card className="min-w-0 overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-5">
            <h2 className="text-sm font-semibold text-slate-900">Needs attention</h2>
            <p className="mt-1 text-xs text-slate-500">Operational items surfaced from today&apos;s data.</p>
          </div>
          {attentionItems.length === 0 ? (
            <div className="flex min-h-[170px] flex-col items-center justify-center px-5 py-8 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={19} />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-slate-800">Nothing urgent surfaced</h3>
              <p className="mt-1 max-w-sm text-sm leading-5 text-slate-500">
                The dashboard has no outstanding operational reminders right now.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {attentionItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-slate-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">{item.value}</p>
                    <ArrowUpRight size={14} className="ml-auto mt-1 text-slate-400" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-5">
            <h2 className="text-sm font-semibold text-slate-900">Quick access</h2>
            <p className="mt-1 text-xs text-slate-500">Jump directly into the secretary&apos;s daily work.</p>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2 sm:gap-4">
            <QuickAction
              label="Students"
              description="Find or update student records"
              icon={<GraduationCap size={18} />}
              onClick={() => navigate("/students")}
            />
            <QuickAction
              label="Parents"
              description="Access parent and contact records"
              icon={<Phone size={18} />}
              onClick={() => navigate("/parents")}
            />
            <QuickAction
              label="Pickup Desk"
              description="Release students safely"
              icon={<CheckCircle2 size={18} />}
              onClick={() => navigate("/pickup-desk")}
            />
            <QuickAction
              label="Pickup History"
              description="Review past releases"
              icon={<Clock3 size={18} />}
              onClick={() => navigate("/pickup-history")}
            />
            <QuickAction
              label="Payments"
              description="Record or review fee payments"
              icon={<CreditCard size={18} />}
              onClick={() => navigate("/finance/payments")}
            />
            <QuickAction
              label="Add Student"
              description="Register a new student"
              icon={<UserPlus size={18} />}
              onClick={() => navigate("/students")}
            />
          </div>
        </Card>
      </section>
    </div>
  );
}
