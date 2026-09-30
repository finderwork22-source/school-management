import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileClock,
  RefreshCw,
  TrendingUp,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { supabase } from "../../lib/supabase";

type AnalyticsRange = 30 | 90 | 365;
type BucketMode = "day" | "week" | "month";

type SchoolStatus = "active" | "suspended" | "archived";
type SubscriptionStatus =
  | "trial"
  | "active"
  | "past_due"
  | "suspended"
  | "cancelled"
  | "expired";

type InvoiceStatus =
  | "draft"
  | "issued"
  | "partially_paid"
  | "paid"
  | "overdue"
  | "cancelled"
  | "void";

type PaymentStatus =
  | "pending"
  | "confirmed"
  | "failed"
  | "refunded"
  | "cancelled";

interface SchoolRecord {
  id: string;
  name: string;
}

interface SchoolAccountRecord {
  school_id: string;
  status: SchoolStatus;
  joined_at: string | null;
  created_at: string;
}

interface ApplicationRecord {
  id: string;
  status: string;
  created_at: string;
}

interface SubscriptionRecord {
  id: string;
  school_id: string;
  status: SubscriptionStatus;
  billing_cycle: string;
  price: number;
  currency: string;
  start_date: string;
  end_date: string | null;
}

interface InvoiceRecord {
  id: string;
  school_id: string;
  total: number;
  currency: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
}

interface PaymentRecord {
  id: string;
  school_id: string;
  amount: number;
  currency: string;
  payment_date: string;
  status: PaymentStatus;
}

interface AuditLogRecord {
  id: string;
  action: string;
  entity_type: string;
  school_id: string | null;
  created_at: string;
}

interface TrendPoint {
  key: string;
  label: string;
  value: number;
}

interface ComparisonItem {
  label: string;
  value: number;
  caption?: string;
}

interface PortfolioRow {
  schoolId: string;
  schoolName: string;
  schoolStatus: SchoolStatus;
  subscription: SubscriptionRecord | null;
  confirmedPayments: number;
  invoiceValue: number;
}

interface AnalyticsState {
  schools: SchoolRecord[];
  accounts: SchoolAccountRecord[];
  applications: ApplicationRecord[];
  subscriptions: SubscriptionRecord[];
  invoices: InvoiceRecord[];
  payments: PaymentRecord[];
  auditLogs: AuditLogRecord[];
}

const RANGE_OPTIONS: Array<{ value: AnalyticsRange; label: string }> = [
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
  { value: 365, label: "Last 12 months" },
];

const EMPTY_STATE: AnalyticsState = {
  schools: [],
  accounts: [],
  applications: [],
  subscriptions: [],
  invoices: [],
  payments: [],
  auditLogs: [],
};

function getStartDate(days: AnalyticsRange) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days + 1);
  return date;
}

function toDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function getBucketMode(range: AnalyticsRange): BucketMode {
  if (range === 30) return "day";
  if (range === 90) return "week";
  return "month";
}

function parseDateValue(value: string) {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnlyMatch) {
    return new Date(
      Number(dateOnlyMatch[1]),
      Number(dateOnlyMatch[2]) - 1,
      Number(dateOnlyMatch[3]),
    );
  }

  return new Date(value);
}

function getBucketStart(value: string, mode: BucketMode) {
  const date = parseDateValue(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);

  if (mode === "month") {
    date.setDate(1);
    return date;
  }

  if (mode === "week") {
    const day = date.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + diff);
    return date;
  }

  return date;
}

function formatBucketLabel(date: Date, mode: BucketMode) {
  if (mode === "month") {
    return date.toLocaleDateString("en-GB", {
      month: "short",
      year: "2-digit",
    });
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

function buildBuckets(start: Date, end: Date, mode: BucketMode) {
  const buckets: TrendPoint[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);

  if (mode === "month") {
    cursor.setDate(1);
  } else if (mode === "week") {
    const day = cursor.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    cursor.setDate(cursor.getDate() + diff);
  }

  while (cursor <= end) {
    const key = toDateKey(cursor);
    buckets.push({
      key,
      label: formatBucketLabel(cursor, mode),
      value: 0,
    });

    if (mode === "month") {
      cursor.setMonth(cursor.getMonth() + 1);
    } else if (mode === "week") {
      cursor.setDate(cursor.getDate() + 7);
    } else {
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return buckets;
}

function buildTrend(
  dates: Array<string | null | undefined>,
  range: AnalyticsRange,
) {
  const start = getStartDate(range);
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const mode = getBucketMode(range);
  const buckets = buildBuckets(start, end, mode);
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  for (const dateValue of dates) {
    if (!dateValue) continue;
    const bucketStart = getBucketStart(dateValue, mode);
    if (!bucketStart) continue;
    const bucket = byKey.get(toDateKey(bucketStart));
    if (bucket) bucket.value += 1;
  }

  return buckets;
}

function buildAmountTrend(
  records: Array<{ date: string; amount: number }>,
  range: AnalyticsRange,
) {
  const start = getStartDate(range);
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  const mode = getBucketMode(range);
  const buckets = buildBuckets(start, end, mode);
  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  for (const record of records) {
    const bucketStart = getBucketStart(record.date, mode);
    if (!bucketStart) continue;
    const bucket = byKey.get(toDateKey(bucketStart));
    if (bucket) bucket.value += record.amount;
  }

  return buckets;
}

function formatMoney(amount: number, currency = "RWF") {
  try {
    return new Intl.NumberFormat("en-RW", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return `${Math.round(amount).toLocaleString()} ${currency}`;
  }
}

function formatCompactMoney(amount: number, currency = "RWF") {
  const value = Math.abs(amount);
  if (value >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M ${currency}`;
  if (value >= 1_000) return `${(amount / 1_000).toFixed(0)}k ${currency}`;
  return `${Math.round(amount).toLocaleString()} ${currency}`;
}

function formatStatus(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function subscriptionStatusClasses(status: SubscriptionStatus | null) {
  switch (status) {
    case "active":
      return "bg-emerald-50 text-emerald-700";
    case "trial":
      return "bg-indigo-50 text-indigo-700";
    case "past_due":
      return "bg-amber-50 text-amber-700";
    case "suspended":
      return "bg-red-50 text-red-700";
    case "cancelled":
    case "expired":
      return "bg-slate-100 text-slate-600";
    default:
      return "bg-slate-100 text-slate-500";
  }
}

function schoolStatusClasses(status: SchoolStatus) {
  switch (status) {
    case "active":
      return "bg-emerald-50 text-emerald-700";
    case "suspended":
      return "bg-amber-50 text-amber-700";
    case "archived":
      return "bg-slate-100 text-slate-600";
  }
}

function getPrimaryCurrency(records: Array<{ currency: string }>) {
  const currencies = new Set(
    records
      .map((record) => record.currency)
      .filter((currency) => currency.trim().length > 0),
  );

  if (currencies.has("RWF")) return "RWF";
  return [...currencies][0] || "RWF";
}

function sumForCurrency(
  records: Array<{ currency: string; amount?: number; total?: number }>,
  currency: string,
) {
  return records.reduce((sum, record) => {
    if (record.currency !== currency) return sum;
    return sum + Number(record.amount ?? record.total ?? 0);
  }, 0);
}

function getSchoolStatusText(status: SchoolStatus) {
  return status === "active" ? "Active" : status === "suspended" ? "Suspended" : "Archived";
}

export default function AdminAnalytics() {
  const navigate = useNavigate();
  const [range, setRange] = useState<AnalyticsRange>(365);
  const [data, setData] = useState<AnalyticsState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadAnalytics(showRefreshState = false) {
    if (showRefreshState) setRefreshing(true);
    else setLoading(true);

    setError("");

    try {
      const startDate = getStartDate(range);
      const startIso = startDate.toISOString();
      const startDay = toDateKey(startDate);

      const [
        schoolsResult,
        accountsResult,
        applicationsResult,
        subscriptionsResult,
        invoicesResult,
        paymentsResult,
        auditLogsResult,
      ] = await Promise.all([
        supabase
          .from("schools")
          .select("id, name")
          .order("name", { ascending: true }),

        supabase
          .from("platform_school_accounts")
          .select("school_id, status, joined_at, created_at")
          .order("created_at", { ascending: false }),

        supabase
          .from("school_applications")
          .select("id, status, created_at")
          .gte("created_at", startIso)
          .order("created_at", { ascending: false }),

        supabase
          .from("platform_school_subscriptions")
          .select(
            "id, school_id, status, billing_cycle, price, currency, start_date, end_date",
          )
          .order("start_date", { ascending: false }),

        supabase
          .from("platform_invoices")
          .select("id, school_id, total, currency, status, issue_date, due_date")
          .gte("issue_date", startDay)
          .order("issue_date", { ascending: false }),

        supabase
          .from("platform_payments")
          .select("id, school_id, amount, currency, payment_date, status")
          .gte("payment_date", startDay)
          .order("payment_date", { ascending: false }),

        supabase
          .from("platform_audit_logs")
          .select("id, action, entity_type, school_id, created_at")
          .gte("created_at", startIso)
          .order("created_at", { ascending: false })
          .limit(3000),
      ]);

      const firstError =
        schoolsResult.error ??
        accountsResult.error ??
        applicationsResult.error ??
        subscriptionsResult.error ??
        invoicesResult.error ??
        paymentsResult.error ??
        auditLogsResult.error;

      if (firstError) throw firstError;

      setData({
        schools: (schoolsResult.data ?? []) as SchoolRecord[],
        accounts: (accountsResult.data ?? []) as SchoolAccountRecord[],
        applications: (applicationsResult.data ?? []) as ApplicationRecord[],
        subscriptions: (subscriptionsResult.data ?? []) as SubscriptionRecord[],
        invoices: (invoicesResult.data ?? []) as InvoiceRecord[],
        payments: (paymentsResult.data ?? []) as PaymentRecord[],
        auditLogs: (auditLogsResult.data ?? []) as AuditLogRecord[],
      });
    } catch (loadError) {
      console.error("Failed to load WISE analytics:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load WISE platform analytics.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadAnalytics();
  }, [range]);

  const schoolById = useMemo(
    () => new Map(data.schools.map((school) => [school.id, school])),
    [data.schools],
  );

  const activeSubscriptions = useMemo(
    () =>
      data.subscriptions.filter((subscription) =>
        ["trial", "active", "past_due"].includes(subscription.status),
      ),
    [data.subscriptions],
  );

  const currentSubscriptionBySchoolId = useMemo(() => {
    const map = new Map<string, SubscriptionRecord>();

    for (const subscription of data.subscriptions) {
      const current = map.get(subscription.school_id);
      if (!current) {
        map.set(subscription.school_id, subscription);
        continue;
      }

      const currentIsActive = ["trial", "active", "past_due"].includes(current.status);
      const nextIsActive = ["trial", "active", "past_due"].includes(subscription.status);

      if (nextIsActive && !currentIsActive) {
        map.set(subscription.school_id, subscription);
        continue;
      }

      if (
        nextIsActive === currentIsActive &&
        subscription.start_date > current.start_date
      ) {
        map.set(subscription.school_id, subscription);
      }
    }

    return map;
  }, [data.subscriptions]);

  const periodSchoolDates = useMemo(
    () =>
      data.accounts
        .map((account) => account.joined_at)
        .filter((value): value is string => Boolean(value)),
    [data.accounts],
  );

  const schoolGrowth = useMemo(
    () => buildTrend(periodSchoolDates, range),
    [periodSchoolDates, range],
  );

  const confirmedPayments = useMemo(
    () => data.payments.filter((payment) => payment.status === "confirmed"),
    [data.payments],
  );

  const paymentTrend = useMemo(
    () =>
      buildAmountTrend(
        confirmedPayments.map((payment) => ({
          date: payment.payment_date,
          amount: Number(payment.amount ?? 0),
        })),
        range,
      ),
    [confirmedPayments, range],
  );

  const invoiceTrend = useMemo(
    () =>
      buildAmountTrend(
        data.invoices.map((invoice) => ({
          date: invoice.issue_date,
          amount: Number(invoice.total ?? 0),
        })),
        range,
      ),
    [data.invoices, range],
  );

  const activityTrend = useMemo(
    () => buildTrend(data.auditLogs.map((log) => log.created_at), range),
    [data.auditLogs, range],
  );

  const metrics = useMemo(() => {
    const startDate = getStartDate(range);
    const periodStart = startDate.getTime();

    const newSchools = data.accounts.filter((account) => {
      if (!account.joined_at) return false;
      const timestamp = new Date(account.joined_at).getTime();
      return Number.isFinite(timestamp) && timestamp >= periodStart;
    }).length;

    const approvedApplications = data.applications.filter(
      (application) => application.status === "approved",
    ).length;

    const pendingApplications = data.applications.filter((application) =>
      ["pending", "under_review"].includes(application.status),
    ).length;

    const openInvoices = data.invoices.filter((invoice) =>
      ["issued", "partially_paid", "overdue"].includes(invoice.status),
    );

    const primaryCurrency = getPrimaryCurrency([
      ...data.payments,
      ...data.invoices.map((invoice) => ({ currency: invoice.currency })),
    ]);

    const confirmedPaymentAmount = sumForCurrency(
      confirmedPayments.map((payment) => ({
        currency: payment.currency,
        amount: Number(payment.amount ?? 0),
      })),
      primaryCurrency,
    );

    const openInvoiceValue = sumForCurrency(
      openInvoices.map((invoice) => ({
        currency: invoice.currency,
        total: Number(invoice.total ?? 0),
      })),
      primaryCurrency,
    );

    const approvalRate =
      data.applications.length > 0
        ? (approvedApplications / data.applications.length) * 100
        : 0;

    const schoolsWithoutActiveSubscription = data.accounts.filter(
      (account) => !activeSubscriptions.some((subscription) => subscription.school_id === account.school_id),
    ).length;

    const pastDueSubscriptions = data.subscriptions.filter(
      (subscription) => subscription.status === "past_due",
    ).length;

    const currencyCount = new Set(
      [...data.payments.map((payment) => payment.currency), ...data.invoices.map((invoice) => invoice.currency)].filter(Boolean),
    ).size;

    return {
      totalSchools: data.accounts.length,
      activeSchools: data.accounts.filter((account) => account.status === "active").length,
      suspendedSchools: data.accounts.filter((account) => account.status === "suspended").length,
      archivedSchools: data.accounts.filter((account) => account.status === "archived").length,
      newSchools,
      activeSubscriptions: activeSubscriptions.length,
      pendingApplications,
      approvedApplications,
      approvalRate,
      confirmedPaymentAmount,
      openInvoiceValue,
      openInvoiceCount: openInvoices.length,
      activityEvents: data.auditLogs.length,
      schoolsWithoutActiveSubscription,
      pastDueSubscriptions,
      primaryCurrency,
      currencyCount,
    };
  }, [
    activeSubscriptions,
    confirmedPayments,
    data.accounts,
    data.applications,
    data.auditLogs.length,
    data.invoices,
    data.payments,
    data.subscriptions,
    range,
  ]);

  const subscriptionMix = useMemo<ComparisonItem[]>(() => {
    const labels: SubscriptionStatus[] = [
      "active",
      "trial",
      "past_due",
      "suspended",
      "cancelled",
      "expired",
    ];

    return labels.map((status) => ({
      label: formatStatus(status),
      value: data.subscriptions.filter((subscription) => subscription.status === status).length,
    }));
  }, [data.subscriptions]);

  const applicationMix = useMemo<ComparisonItem[]>(() => {
    const labels = ["approved", "pending", "under_review", "rejected", "cancelled"];

    return labels.map((status) => ({
      label: formatStatus(status),
      value: data.applications.filter((application) => application.status === status).length,
    }));
  }, [data.applications]);

  const portfolioRows = useMemo<PortfolioRow[]>(() => {
    const paymentBySchool = new Map<string, number>();
    const invoiceBySchool = new Map<string, number>();

    for (const payment of confirmedPayments) {
      if (payment.currency !== metrics.primaryCurrency) continue;
      paymentBySchool.set(
        payment.school_id,
        (paymentBySchool.get(payment.school_id) ?? 0) + Number(payment.amount ?? 0),
      );
    }

    for (const invoice of data.invoices) {
      if (invoice.currency !== metrics.primaryCurrency) continue;
      invoiceBySchool.set(
        invoice.school_id,
        (invoiceBySchool.get(invoice.school_id) ?? 0) + Number(invoice.total ?? 0),
      );
    }

    return data.accounts
      .map((account) => ({
        schoolId: account.school_id,
        schoolName: schoolById.get(account.school_id)?.name ?? "Unknown school",
        schoolStatus: account.status,
        subscription: currentSubscriptionBySchoolId.get(account.school_id) ?? null,
        confirmedPayments: paymentBySchool.get(account.school_id) ?? 0,
        invoiceValue: invoiceBySchool.get(account.school_id) ?? 0,
      }))
      .sort((a, b) => b.confirmedPayments - a.confirmedPayments);
  }, [
    confirmedPayments,
    currentSubscriptionBySchoolId,
    data.accounts,
    data.invoices,
    metrics.primaryCurrency,
    schoolById,
  ]);

  const chartMaxes = useMemo(
    () => ({
      schoolGrowth: Math.max(...schoolGrowth.map((point) => point.value), 1),
      paymentTrend: Math.max(...paymentTrend.map((point) => point.value), 1),
      invoiceTrend: Math.max(...invoiceTrend.map((point) => point.value), 1),
      activityTrend: Math.max(...activityTrend.map((point) => point.value), 1),
      subscriptionMix: Math.max(...subscriptionMix.map((item) => item.value), 1),
      applicationMix: Math.max(...applicationMix.map((item) => item.value), 1),
    }),
    [activityTrend, applicationMix, invoiceTrend, paymentTrend, schoolGrowth, subscriptionMix],
  );

  const rangeLabel = RANGE_OPTIONS.find((option) => option.value === range)?.label || "Last 12 months";

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-wiser-600">
            <BarChart3 size={14} />
            WISE platform analytics
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-wiser-text sm:text-3xl">
            Analytics
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-wiser-text-secondary">
            Track school growth, onboarding, subscriptions, platform billing and recorded platform activity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="analytics-range">
            Analytics period
          </label>
          <select
            id="analytics-range"
            value={range}
            onChange={(event) => setRange(Number(event.target.value) as AnalyticsRange)}
            className="h-10 rounded-lg border border-wiser-border bg-white px-3 text-sm font-semibold text-wiser-text-secondary outline-none focus:border-wiser-600 focus:ring-2 focus:ring-wiser-100"
          >
            {RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void loadAnalytics(true)}
            disabled={refreshing}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-wiser-border bg-white px-4 text-sm font-semibold text-wiser-text-secondary shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard
          label="Total schools"
          value={loading ? "—" : String(metrics.totalSchools)}
          caption={`${metrics.activeSchools} active`}
          icon={Building2}
        />
        <MetricCard
          label="New schools"
          value={loading ? "—" : String(metrics.newSchools)}
          caption={rangeLabel}
          icon={TrendingUp}
        />
        <MetricCard
          label="Active subscriptions"
          value={loading ? "—" : String(metrics.activeSubscriptions)}
          caption={`${metrics.pastDueSubscriptions} past due`}
          icon={CreditCard}
        />
        <MetricCard
          label="Confirmed payments"
          value={loading ? "—" : formatMoney(metrics.confirmedPaymentAmount, metrics.primaryCurrency)}
          caption={rangeLabel}
          icon={WalletCards}
        />
        <MetricCard
          label="Open invoice value"
          value={loading ? "—" : formatMoney(metrics.openInvoiceValue, metrics.primaryCurrency)}
          caption={`${metrics.openInvoiceCount} open invoice${metrics.openInvoiceCount === 1 ? "" : "s"} in period`}
          icon={FileClock}
        />
        <MetricCard
          label="Approval rate"
          value={loading ? "—" : `${metrics.approvalRate.toFixed(0)}%`}
          caption={`${metrics.approvedApplications} approved`}
          icon={CheckCircle2}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.75fr)]">
        <ChartCard
          title="School growth"
          description={`New school records created in ${rangeLabel.toLowerCase()}.`}
          icon={TrendingUp}
          trailing={`${metrics.newSchools} new`}
        >
          <LineChart data={schoolGrowth} max={chartMaxes.schoolGrowth} valueFormatter={(value) => String(value)} />
        </ChartCard>

        <ChartCard
          title="Subscription mix"
          description="Current platform subscription status across schools."
          icon={CreditCard}
          trailing={`${metrics.activeSubscriptions} active/trial/past due`}
        >
          <HorizontalBars items={subscriptionMix} max={chartMaxes.subscriptionMix} valueFormatter={(value) => String(value)} />
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Platform billing trend"
          description={`${rangeLabel} confirmed payments versus invoices issued.`}
          icon={WalletCards}
          trailing={metrics.primaryCurrency}
        >
          <DualLineChart
            primary={paymentTrend}
            secondary={invoiceTrend}
            primaryLabel="Payments"
            secondaryLabel="Invoices"
            max={Math.max(chartMaxes.paymentTrend, chartMaxes.invoiceTrend)}
            valueFormatter={(value) => formatCompactMoney(value, metrics.primaryCurrency)}
          />
        </ChartCard>

        <ChartCard
          title="Platform activity"
          description="Recorded WISE Admin actions in the platform audit log."
          icon={Activity}
          trailing={`${metrics.activityEvents} events`}
        >
          <LineChart data={activityTrend} max={chartMaxes.activityTrend} valueFormatter={(value) => String(value)} />
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <ChartCard
          title="School onboarding"
          description="Application outcomes for the selected period."
          icon={FileClock}
          trailing={`${data.applications.length} applications`}
        >
          <HorizontalBars items={applicationMix} max={chartMaxes.applicationMix} valueFormatter={(value) => String(value)} />

          <div className="mt-5 grid grid-cols-2 gap-3">
            <InsightMiniCard label="Pending" value={metrics.pendingApplications} />
            <InsightMiniCard label="Approved" value={metrics.approvedApplications} />
          </div>
        </ChartCard>

        <section className="min-w-0 overflow-hidden rounded-xl border border-wiser-border bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-wiser-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-wiser-600" />
                <h2 className="text-base font-semibold text-wiser-text">School portfolio</h2>
              </div>
              <p className="mt-1 text-xs text-wiser-text-secondary">
                Subscription status and platform billing activity for the selected period.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/admin/schools")}
              className="inline-flex items-center gap-1 self-start text-xs font-semibold text-wiser-600 hover:text-wiser-700 sm:self-auto"
            >
              View schools
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  {[
                    "School",
                    "Platform status",
                    "Subscription",
                    "Payments",
                    "Invoice value",
                  ].map((label) => (
                    <th
                      key={label}
                      className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-wiser-text-muted"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-500">
                      Loading analytics...
                    </td>
                  </tr>
                ) : portfolioRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center">
                      <Building2 size={22} className="mx-auto text-slate-300" />
                      <p className="mt-3 text-sm font-medium text-wiser-text">No school data yet</p>
                      <p className="mt-1 text-xs text-wiser-text-secondary">
                        Schools will appear here after they are registered on WISE.
                      </p>
                    </td>
                  </tr>
                ) : (
                  portfolioRows.slice(0, 8).map((row) => (
                    <tr key={row.schoolId} className="hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-wiser-text">{row.schoolName}</p>
                        <p className="mt-1 text-xs text-wiser-text-secondary">
                          {schoolById.get(row.schoolId)?.name === row.schoolName ? "Registered school" : "School record"}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${schoolStatusClasses(row.schoolStatus)}`}>
                          {getSchoolStatusText(row.schoolStatus)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {row.subscription ? (
                          <div>
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${subscriptionStatusClasses(row.subscription.status)}`}>
                              {formatStatus(row.subscription.status)}
                            </span>
                            <p className="mt-1 text-xs text-slate-500">
                              {formatStatus(row.subscription.billing_cycle)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">No subscription</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                        {formatMoney(row.confirmedPayments, metrics.primaryCurrency)}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">
                        {formatMoney(row.invoiceValue, metrics.primaryCurrency)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InsightCard
          label="Active schools"
          value={metrics.activeSchools}
          caption={`${metrics.suspendedSchools} suspended · ${metrics.archivedSchools} archived`}
          icon={Building2}
          tone="indigo"
        />
        <InsightCard
          label="Schools without active subscription"
          value={metrics.schoolsWithoutActiveSubscription}
          caption="No trial, active or past-due subscription"
          icon={Clock3}
          tone="amber"
        />
        <InsightCard
          label="Past-due subscriptions"
          value={metrics.pastDueSubscriptions}
          caption="Requires billing follow-up"
          icon={WalletCards}
          tone="red"
        />
        <InsightCard
          label="Recorded audit events"
          value={metrics.activityEvents}
          caption="Within the selected period"
          icon={Activity}
          tone="emerald"
        />
      </div>

      {metrics.currencyCount > 1 && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Analytics totals are shown in {metrics.primaryCurrency}. Other currencies are present in the platform ledger and are not converted here.
        </div>
      )}

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
        Platform activity reflects records available in WISE's platform audit log. Usage metrics that are not stored at platform level are intentionally not estimated from school-side tables.
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  caption,
  icon: Icon,
}: {
  label: string;
  value: string;
  caption: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-xl border border-wiser-border bg-white p-5 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-wiser-50 text-wiser-600">
        <Icon size={19} />
      </div>
      <p className="mt-5 text-xs font-medium text-wiser-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-wiser-text">{value}</p>
      <p className="mt-1 text-xs text-wiser-text-secondary">{caption}</p>
    </div>
  );
}

function ChartCard({
  title,
  description,
  icon: Icon,
  trailing,
  children,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  trailing?: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-wiser-border bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-wiser-border px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-wiser-50 text-wiser-600">
            <Icon size={17} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-wiser-text">{title}</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-wiser-text-secondary">{description}</p>
          </div>
        </div>
        {trailing && (
          <span className="shrink-0 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            {trailing}
          </span>
        )}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function LineChart({
  data,
  max,
  valueFormatter,
}: {
  data: TrendPoint[];
  max: number;
  valueFormatter: (value: number) => string;
}) {
  if (data.length === 0) {
    return <EmptyChart />;
  }

  const width = 760;
  const height = 245;
  const paddingX = 28;
  const paddingTop = 18;
  const paddingBottom = 42;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingTop - paddingBottom;
  const divisor = Math.max(data.length - 1, 1);

  const points = data.map((point, index) => {
    const x = paddingX + (index / divisor) * chartWidth;
    const y = paddingTop + chartHeight - (point.value / Math.max(max, 1)) * chartHeight;
    return `${x},${y}`;
  });

  const labelStep = Math.max(1, Math.ceil(data.length / 6));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[10px] text-slate-400">
        <span>Peak {valueFormatter(Math.max(...data.map((point) => point.value), 0))}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
      <div className="overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[245px] w-full" role="img" aria-label="Analytics trend chart">
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const y = paddingTop + chartHeight - fraction * chartHeight;
            return (
              <line
                key={fraction}
                x1={paddingX}
                x2={width - paddingX}
                y1={y}
                y2={y}
                stroke="currentColor"
                className="text-slate-100"
              />
            );
          })}

          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points.join(" ")}
            className="text-wiser-600"
          />

          {data.map((point, index) => {
            if (index !== data.length - 1 && index % labelStep !== 0) return null;
            const x = paddingX + (index / divisor) * chartWidth;
            const y = paddingTop + chartHeight - (point.value / Math.max(max, 1)) * chartHeight;
            return (
              <g key={point.key}>
                <circle cx={x} cy={y} r="3.5" className="fill-white stroke-wiser-600" strokeWidth="2" />
                <text
                  x={x}
                  y={height - 15}
                  textAnchor="middle"
                  className="fill-slate-400 text-[10px]"
                >
                  {point.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function DualLineChart({
  primary,
  secondary,
  primaryLabel,
  secondaryLabel,
  max,
  valueFormatter,
}: {
  primary: TrendPoint[];
  secondary: TrendPoint[];
  primaryLabel: string;
  secondaryLabel: string;
  max: number;
  valueFormatter: (value: number) => string;
}) {
  if (primary.length === 0) return <EmptyChart />;

  const width = 760;
  const height = 245;
  const paddingX = 28;
  const paddingTop = 18;
  const paddingBottom = 42;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingTop - paddingBottom;
  const divisor = Math.max(primary.length - 1, 1);

  const buildPoints = (series: TrendPoint[]) =>
    series.map((point, index) => {
      const x = paddingX + (index / divisor) * chartWidth;
      const y = paddingTop + chartHeight - (point.value / Math.max(max, 1)) * chartHeight;
      return `${x},${y}`;
    });

  const primaryPoints = buildPoints(primary);
  const secondaryPoints = buildPoints(secondary);
  const labelStep = Math.max(1, Math.ceil(primary.length / 6));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4 text-[11px] font-medium text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-wiser-600" />
            {primaryLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            {secondaryLabel}
          </span>
        </div>
        <span className="text-[10px] text-slate-400">
          Peak {valueFormatter(Math.max(...primary.map((point) => point.value), ...secondary.map((point) => point.value), 0))}
        </span>
      </div>

      <div className="overflow-hidden">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[245px] w-full" role="img" aria-label="Billing trend chart">
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const y = paddingTop + chartHeight - fraction * chartHeight;
            return (
              <line
                key={fraction}
                x1={paddingX}
                x2={width - paddingX}
                y1={y}
                y2={y}
                stroke="currentColor"
                className="text-slate-100"
              />
            );
          })}

          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={secondaryPoints.join(" ")}
            className="text-slate-400"
          />
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={primaryPoints.join(" ")}
            className="text-wiser-600"
          />

          {primary.map((point, index) => {
            if (index !== primary.length - 1 && index % labelStep !== 0) return null;
            const x = paddingX + (index / divisor) * chartWidth;
            const primaryY = paddingTop + chartHeight - (point.value / Math.max(max, 1)) * chartHeight;
            const secondaryValue = secondary[index]?.value ?? 0;
            const secondaryY = paddingTop + chartHeight - (secondaryValue / Math.max(max, 1)) * chartHeight;

            return (
              <g key={point.key}>
                <circle cx={x} cy={secondaryY} r="3" className="fill-white stroke-slate-400" strokeWidth="1.8" />
                <circle cx={x} cy={primaryY} r="3.5" className="fill-white stroke-wiser-600" strokeWidth="2" />
                <text x={x} y={height - 15} textAnchor="middle" className="fill-slate-400 text-[10px]">
                  {point.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function HorizontalBars({
  items,
  max,
  valueFormatter,
}: {
  items: ComparisonItem[];
  max: number;
  valueFormatter: (value: number) => string;
}) {
  if (items.length === 0) return <EmptyChart />;

  return (
    <div className="space-y-4">
      {items.map((item) => {
        const percentage = Math.max(0, Math.min(100, (item.value / Math.max(max, 1)) * 100));
        return (
          <div key={item.label}>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="truncate text-xs font-medium text-slate-600">{item.label}</span>
              <span className="shrink-0 text-xs font-semibold text-slate-800">{valueFormatter(item.value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-wiser-500 transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
            {item.caption && <p className="mt-1 text-[10px] text-slate-400">{item.caption}</p>}
          </div>
        );
      })}
    </div>
  );
}

function InsightMiniCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-[11px] text-wiser-text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-wiser-text">{value}</p>
    </div>
  );
}

function InsightCard({
  label,
  value,
  caption,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  caption: string;
  icon: LucideIcon;
  tone: "indigo" | "amber" | "red" | "emerald";
}) {
  const toneClasses = {
    indigo: "bg-wiser-50 text-wiser-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    emerald: "bg-emerald-50 text-emerald-600",
  } as const;

  return (
    <div className="rounded-xl border border-wiser-border bg-white p-5 shadow-sm">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneClasses[tone]}`}>
        <Icon size={19} />
      </div>
      <p className="mt-4 text-xs font-medium text-wiser-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-wiser-text">{value}</p>
      <p className="mt-1 text-xs leading-5 text-wiser-text-secondary">{caption}</p>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[245px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-6 text-center text-sm text-slate-400">
      No data recorded for this period.
    </div>
  );
}
