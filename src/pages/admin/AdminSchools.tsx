import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Globe2,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  WalletCards,
  XCircle,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { supabase } from "../../lib/supabase";

type SchoolStatus = "active" | "suspended" | "archived";
type SubscriptionStatus =
  | "trial"
  | "active"
  | "past_due"
  | "suspended"
  | "cancelled"
  | "expired";

type FilterValue = "all" | SchoolStatus;

interface PlatformSchoolAccount {
  school_id: string;
  status: SchoolStatus;
  onboarding_application_id: string | null;
  joined_at: string | null;
  activated_at: string | null;
  suspended_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SchoolRecord {
  id: string;
  name: string;
  type: string | null;
  slug: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  logo_url: string | null;
}

interface SubscriptionRecord {
  id: string;
  school_id: string;
  plan_id: string | null;
  status: SubscriptionStatus;
  billing_cycle: string;
  price: number;
  currency: string;
  start_date: string;
  end_date: string | null;
  trial_start: string | null;
  trial_end: string | null;
}

interface PlanRecord {
  id: string;
  name: string;
  description: string | null;
  billing_cycle: string;
  amount: number;
  currency: string;
  is_active: boolean;
}

interface InvoiceRecord {
  id: string;
  school_id: string;
  total: number;
  currency: string;
  status: string;
  due_date: string;
  issue_date: string;
}

interface SchoolListRow {
  school: SchoolRecord;
  account: PlatformSchoolAccount;
  subscription: SubscriptionRecord | null;
  plan: PlanRecord | null;
  outstandingInvoices: number;
  outstandingAmount: number;
}

const STATUS_FILTERS: { value: FilterValue; label: string }[] = [
  { value: "all", label: "All schools" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "archived", label: "Archived" },
];

function formatStatus(status: SchoolStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatSubscriptionStatus(status: SubscriptionStatus) {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
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

function statusClasses(status: SchoolStatus) {
  switch (status) {
    case "active":
      return "bg-emerald-50 text-emerald-700";
    case "suspended":
      return "bg-amber-50 text-amber-700";
    case "archived":
      return "bg-slate-100 text-slate-600";
  }
}

function subscriptionClasses(status: SubscriptionStatus) {
  switch (status) {
    case "active":
      return "bg-emerald-50 text-emerald-700";
    case "trial":
      return "bg-indigo-50 text-indigo-700";
    case "past_due":
      return "bg-amber-50 text-amber-700";
    case "suspended":
    case "cancelled":
    case "expired":
      return "bg-slate-100 text-slate-600";
  }
}

function pickSubscription(
  subscriptions: SubscriptionRecord[],
  schoolId: string,
) {
  const schoolSubscriptions = subscriptions
    .filter((subscription) => subscription.school_id === schoolId)
    .sort((left, right) => {
      const leftTime = new Date(left.start_date).getTime();
      const rightTime = new Date(right.start_date).getTime();
      return rightTime - leftTime;
    });

  return (
    schoolSubscriptions.find((subscription) =>
      ["trial", "active", "past_due"].includes(subscription.status),
    ) ?? schoolSubscriptions[0] ?? null
  );
}

function mapPlans(plans: PlanRecord[]) {
  return new Map(plans.map((plan) => [plan.id, plan]));
}

export default function AdminSchools() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedSchoolId = searchParams.get("id");

  const [rows, setRows] = useState<SchoolListRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<SchoolListRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<FilterValue>(
    (searchParams.get("status") as FilterValue) || "all",
  );
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadSchools(showRefreshState = false) {
    if (showRefreshState) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      // Schools and platform accounts are critical. Billing/enrichment data is optional.
      const [accountsResult, schoolsResult] = await Promise.all([
        supabase.from("platform_school_accounts").select("school_id, status, onboarding_application_id, joined_at, activated_at, suspended_at, archived_at, created_at, updated_at").order("created_at", { ascending: false }),
        supabase.from("schools").select("id, name, slug, email, phone, address, city, country, logo_url").order("name", { ascending: true }),
      ]);

      if (accountsResult.error) throw accountsResult.error;
      if (schoolsResult.error) throw schoolsResult.error;

      const accounts = (accountsResult.data ?? []) as PlatformSchoolAccount[];
      const schools = (schoolsResult.data ?? []).map((school) => ({ ...school, type: null })) as SchoolRecord[];
      const accountBySchoolId = new Map(accounts.map((account) => [account.school_id, account]));

      // Optional enrichment must never hide a valid school.
      const [subscriptionsResult, plansResult, invoicesResult] = await Promise.all([
        supabase.from("platform_school_subscriptions").select("id, school_id, plan_id, status, billing_cycle, price, currency, start_date, end_date, trial_start, trial_end").order("start_date", { ascending: false }),
        supabase.from("platform_subscription_plans").select("id, name, description, billing_cycle, amount, currency, is_active").order("name", { ascending: true }),
        supabase.from("platform_invoices").select("id, school_id, total, currency, status, due_date, issue_date").in("status", ["issued", "partially_paid", "overdue"]),
      ]);

      const subscriptions = (subscriptionsResult.data ?? []) as SubscriptionRecord[];
      const plans = (plansResult.data ?? []) as PlanRecord[];
      const invoices = (invoicesResult.data ?? []) as InvoiceRecord[];
      const plansById = mapPlans(plans);
      const invoicesBySchoolId = new Map<string, { count: number; amount: number }>();

      for (const invoice of invoices) {
        const previous = invoicesBySchoolId.get(invoice.school_id) ?? { count: 0, amount: 0 };
        previous.count += 1;
        previous.amount += Number(invoice.total ?? 0);
        invoicesBySchoolId.set(invoice.school_id, previous);
      }

      const nextRows = schools
        .map((school) => {
          const account = accountBySchoolId.get(school.id);
          if (!account) return null;
          const subscription = pickSubscription(subscriptions, school.id);
          const plan = subscription?.plan_id ? plansById.get(subscription.plan_id) ?? null : null;
          const invoiceSummary = invoicesBySchoolId.get(school.id) ?? { count: 0, amount: 0 };
          return { school, account, subscription, plan, outstandingInvoices: invoiceSummary.count, outstandingAmount: invoiceSummary.amount };
        })
        .filter(Boolean) as SchoolListRow[];

      setRows(nextRows);
      if (selectedSchoolId) {
        setSelectedRow(nextRows.find((row) => row.school.id === selectedSchoolId) ?? null);
      } else {
        setSelectedRow(null);
      }

      const optionalErrors = [subscriptionsResult.error, plansResult.error, invoicesResult.error].filter(Boolean);
      if (optionalErrors.length > 0) {
        const failedParts = [
          subscriptionsResult.error ? "subscriptions" : "",
          plansResult.error ? "plans" : "",
          invoicesResult.error ? "invoices" : "",
        ].filter(Boolean);
        setError(`Schools loaded successfully, but optional data could not be loaded: ${failedParts.join(", " )}.`);
        console.warn("Optional MojaSchool platform data failed to load:", optionalErrors);
      }
    } catch (loadError) {
      console.error("Failed to load MojaSchool schools:", loadError);
      const errorDetails = loadError && typeof loadError === "object" ? (loadError as { message?: unknown; details?: unknown; hint?: unknown }) : null;
      setRows([]);
      setSelectedRow(null);
      setError(typeof errorDetails?.message === "string" ? [errorDetails.message, typeof errorDetails.details === "string" ? errorDetails.details : "", typeof errorDetails.hint === "string" ? errorDetails.hint : ""].filter(Boolean).join(" " ) : loadError instanceof Error ? loadError.message : "Could not load MojaSchool schools.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadSchools();
  }, [statusFilter]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
      const matchesStatus =
        statusFilter === "all" || row.account.status === statusFilter;

      if (!matchesStatus) return false;
      if (!query) return true;

      return [
        row.school.name,
        row.school.type ?? "",
        row.school.city ?? "",
        row.school.country ?? "",
        row.school.email ?? "",
        row.school.phone ?? "",
        row.school.slug,
        row.plan?.name ?? "",
        row.subscription?.status ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [rows, search, statusFilter]);

  const summary = useMemo(() => {
    const active = rows.filter((row) => row.account.status === "active").length;
    const suspended = rows.filter(
      (row) => row.account.status === "suspended",
    ).length;
    const archived = rows.filter(
      (row) => row.account.status === "archived",
    ).length;

    return {
      total: rows.length,
      active,
      suspended,
      archived,
    };
  }, [rows]);

  function openSchool(row: SchoolListRow) {
    setSelectedRow(row);
    setSuccess("");
    setError("");
    setSearchParams((current) => {
      current.set("id", row.school.id);
      return current;
    });
  }

  function closeSchool() {
    setSelectedRow(null);
    setSuccess("");
    setError("");
    setSearchParams((current) => {
      current.delete("id");
      return current;
    });
  }

  function changeStatusFilter(value: FilterValue) {
    setStatusFilter(value);
    setSelectedRow(null);
    setSearchParams((current) => {
      if (value === "all") current.delete("status");
      else current.set("status", value);
      current.delete("id");
      return current;
    });
  }

  async function updateSchoolStatus(nextStatus: SchoolStatus) {
    if (!selectedRow) return;

    const schoolName = selectedRow.school.name;
    const actionLabel =
      nextStatus === "active"
        ? "activate"
        : nextStatus === "suspended"
          ? "suspend"
          : "archive";

    const confirmed = window.confirm(
      `${actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1)} ${schoolName}?`,
    );

    if (!confirmed) return;

    setProcessing(true);
    setError("");
    setSuccess("");

    try {
      const timestamp = new Date().toISOString();
      const updates: Partial<PlatformSchoolAccount> = {
        status: nextStatus,
        updated_at: timestamp,
      };

      if (nextStatus === "active") {
        updates.activated_at = timestamp;
        updates.suspended_at = null;
        updates.archived_at = null;
      } else if (nextStatus === "suspended") {
        updates.suspended_at = timestamp;
        updates.archived_at = null;
      } else {
        updates.archived_at = timestamp;
      }

      const { data, error: updateError } = await supabase
        .from("platform_school_accounts")
        .update(updates)
        .eq("school_id", selectedRow.school.id)
        .select(
          "school_id, status, onboarding_application_id, joined_at, activated_at, suspended_at, archived_at, created_at, updated_at",
        )
        .single();

      if (updateError) throw updateError;

      const updatedAccount = data as PlatformSchoolAccount;
      const updatedRow = { ...selectedRow, account: updatedAccount };

      setSelectedRow(updatedRow);
      setRows((current) =>
        current.map((row) =>
          row.school.id === updatedRow.school.id ? updatedRow : row,
        ),
      );
      setSuccess(`${schoolName} has been ${actionLabel}d.`);
    } catch (updateError) {
      console.error("Failed to update school status:", updateError);
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Could not update the school status.",
      );
    } finally {
      setProcessing(false);
    }
  }

  if (selectedRow) {
    return (
      <SchoolDetail
        row={selectedRow}
        processing={processing}
        error={error}
        success={success}
        onBack={closeSchool}
        onConfigure={() =>
          navigate(`/admin/schools/${selectedRow.school.id}/configuration`)
        }
        onStatusChange={(status) => void updateSchoolStatus(status)}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-MojaSchoolr-600">
            <Building2 size={14} />
            MojaSchool platform
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-MojaSchoolr-text sm:text-3xl">
            Schools
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-MojaSchoolr-text-secondary">
            Manage schools registered on MojaSchool, their platform status and current subscription information.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadSchools(true)}
          disabled={refreshing}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-MojaSchoolr-border bg-white px-4 text-sm font-semibold text-MojaSchoolr-text-secondary shadow-sm transition hover:bg-slate-50 hover:text-MojaSchoolr-text disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <AlertMessage tone="error" message={error} />
      )}

      {success && (
        <AlertMessage tone="success" message={success} />
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total schools" value={summary.total} icon={Building2} />
        <SummaryCard label="Active" value={summary.active} icon={CheckCircle2} />
        <SummaryCard label="Suspended" value={summary.suspended} icon={XCircle} />
        <SummaryCard label="Archived" value={summary.archived} icon={Archive} />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-MojaSchoolr-border bg-white shadow-sm">
        <div className="border-b border-MojaSchoolr-border px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => changeStatusFilter(filter.value)}
                  className={[
                    "rounded-lg px-3 py-2 text-xs font-semibold transition",
                    statusFilter === filter.value
                      ? "bg-MojaSchoolr-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                  ].join(" ")}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            <div className="relative w-full xl:max-w-sm">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search school, city, subscription..."
                className="h-10 w-full rounded-lg border border-MojaSchoolr-border bg-white pl-10 pr-4 text-sm text-MojaSchoolr-text outline-none placeholder:text-slate-400 focus:border-MojaSchoolr-500 focus:ring-2 focus:ring-MojaSchoolr-100"
              />
            </div>
          </div>
        </div>

        <div className="border-b border-MojaSchoolr-border px-4 py-3 sm:px-5">
          <p className="text-sm text-MojaSchoolr-text-secondary">
            Showing <span className="font-semibold text-MojaSchoolr-text">{filteredRows.length}</span> school{filteredRows.length === 1 ? "" : "s"}
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-MojaSchoolr-text-secondary">
              <Loader2 size={17} className="animate-spin" />
              Loading schools...
            </div>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-MojaSchoolr-50 text-MojaSchoolr-600">
              <Building2 size={22} />
            </div>
            <h2 className="mt-4 text-sm font-semibold text-MojaSchoolr-text">
              No schools found
            </h2>
            <p className="mt-1 max-w-md text-sm text-MojaSchoolr-text-secondary">
              No schools match the selected status or search criteria.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredRows.map((row) => (
              <button
                key={row.school.id}
                type="button"
                onClick={() => openSchool(row)}
                className="flex w-full flex-col gap-4 px-4 py-4 text-left transition hover:bg-slate-50 sm:px-5 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <SchoolAvatar school={row.school} />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-MojaSchoolr-text">
                        {row.school.name}
                      </p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClasses(row.account.status)}`}
                      >
                        {formatStatus(row.account.status)}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-MojaSchoolr-text-secondary">
                      {row.school.type || "School"} · {row.school.city || "—"}, {row.school.country || "—"}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      <span>{row.subscription?.status ? formatSubscriptionStatus(row.subscription.status) : "No subscription"}</span>
                      <span>·</span>
                      <span>{row.plan?.name || "Plan not assigned"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex w-full shrink-0 items-center justify-between gap-4 md:w-auto md:justify-end">
                  <div className="text-left md:text-right">
                    <p className="text-xs font-medium text-slate-500">
                      {row.subscription
                        ? formatMoney(row.subscription.price, row.subscription.currency)
                        : "—"}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {row.outstandingInvoices > 0
                        ? `${row.outstandingInvoices} outstanding invoice${row.outstandingInvoices === 1 ? "" : "s"}`
                        : "No outstanding invoices"}
                    </p>
                  </div>
                  <ChevronRight size={17} className="shrink-0 text-slate-300" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SchoolDetail({
  row,
  processing,
  error,
  success,
  onBack,
  onConfigure,
  onStatusChange,
}: {
  row: SchoolListRow;
  processing: boolean;
  error: string;
  success: string;
  onBack: () => void;
  onConfigure: () => void;
  onStatusChange: (status: SchoolStatus) => void;
}) {
  const { school, account, subscription, plan } = row;

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-semibold text-MojaSchoolr-600 hover:text-MojaSchoolr-700"
      >
        <ArrowLeft size={16} />
        Back to schools
      </button>

      <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <SchoolAvatar school={school} large />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-MojaSchoolr-text sm:text-3xl">
                {school.name}
              </h1>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClasses(account.status)}`}
              >
                {formatStatus(account.status)}
              </span>
            </div>
            <p className="mt-2 text-sm text-MojaSchoolr-text-secondary">
              {school.type || "School"} · {school.city || "—"}, {school.country || "—"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Joined MojaSchool {formatDate(account.joined_at || account.created_at)}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onConfigure}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-MojaSchoolr-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-MojaSchoolr-700"
          >
            Configure school
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {error && <AlertMessage tone="error" message={error} />}
      {success && <AlertMessage tone="success" message={success} />}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <InfoCard title="School information" icon={Building2}>
            <InfoGrid>
              <InfoItem label="School name" value={school.name} />
              <InfoItem label="School type" value={school.type || "School"} />
              <InfoItem label="Email" value={school.email || "—"} />
              <InfoItem label="Phone" value={school.phone || "—"} />
              <InfoItem label="Country" value={school.country || "—"} />
              <InfoItem label="City" value={school.city || "—"} />
              <InfoItem label="Address" value={school.address || "—"} />
              <InfoItem
                label="Website"
                value={
                  school.slug ? (
                    <span className="inline-flex items-center gap-1 text-slate-700">
                      /{school.slug}
                      <Globe2 size={13} className="text-slate-400" />
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
            </InfoGrid>
          </InfoCard>

          <InfoCard title="Subscription" icon={CircleDollarSign}>
            {subscription ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-MojaSchoolr-text">
                      {plan?.name || "Subscription"}
                    </p>
                    <p className="mt-1 text-xs text-MojaSchoolr-text-secondary">
                      {subscription.billing_cycle.replaceAll("_", " ")} billing · Started {formatDate(subscription.start_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${subscriptionClasses(subscription.status)}`}
                    >
                      {formatSubscriptionStatus(subscription.status)}
                    </span>
                    <span className="text-sm font-semibold text-MojaSchoolr-text">
                      {formatMoney(subscription.price, subscription.currency)}
                    </span>
                  </div>
                </div>

                <InfoGrid>
                  <InfoItem label="Plan" value={plan?.name || "Plan not assigned"} />
                  <InfoItem label="Billing cycle" value={subscription.billing_cycle.replaceAll("_", " ")} />
                  <InfoItem label="Start date" value={formatDate(subscription.start_date)} />
                  <InfoItem label="End date" value={formatDate(subscription.end_date)} />
                </InfoGrid>
              </div>
            ) : (
              <EmptyState
                title="No subscription"
                description="This school does not currently have a MojaSchool subscription record."
              />
            )}
          </InfoCard>

          <InfoCard title="Billing summary" icon={WalletCards}>
            <div className="grid gap-4 sm:grid-cols-2">
              <MetricBox
                label="Outstanding invoices"
                value={String(row.outstandingInvoices)}
              />
              <MetricBox
                label="Outstanding amount"
                value={formatMoney(
                  row.outstandingAmount,
                  subscription?.currency || "RWF",
                )}
              />
            </div>
          </InfoCard>
        </div>

        <div className="h-fit xl:sticky xl:top-24">
          <section className="rounded-xl border border-MojaSchoolr-border bg-white shadow-sm">
            <div className="border-b border-MojaSchoolr-border px-5 py-4">
              <div className="flex items-center gap-2">
                <ShieldCheck size={17} className="text-MojaSchoolr-600" />
                <h2 className="text-base font-semibold text-MojaSchoolr-text">
                  Platform controls
                </h2>
              </div>
              <p className="mt-1 text-xs leading-5 text-MojaSchoolr-text-secondary">
                These controls change the MojaSchool platform lifecycle status for this school. School operational data remains unchanged.
              </p>
            </div>

            <div className="space-y-2 p-5">
              {account.status !== "active" && (
                <button
                  type="button"
                  onClick={() => onStatusChange("active")}
                  disabled={processing}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-MojaSchoolr-600 px-4 text-sm font-semibold text-white transition hover:bg-MojaSchoolr-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {processing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Activate school
                </button>
              )}

              {account.status === "active" && (
                <button
                  type="button"
                  onClick={() => onStatusChange("suspended")}
                  disabled={processing}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <XCircle size={16} />
                  Suspend school
                </button>
              )}

              {account.status !== "archived" && (
                <button
                  type="button"
                  onClick={() => onStatusChange("archived")}
                  disabled={processing}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Archive size={16} />
                  Archive school
                </button>
              )}

              {account.status === "archived" && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  This school is archived. Activating it again will return its MojaSchool platform account to active status.
                </div>
              )}
            </div>
          </section>

          <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-400">
            <MetaLine label="School ID" value={school.id} />
            <MetaLine label="Slug" value={school.slug} />
            <MetaLine label="Last updated" value={formatDate(account.updated_at)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Building2;
}) {
  return (
    <div className="rounded-xl border border-MojaSchoolr-border bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-MojaSchoolr-text-secondary">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-MojaSchoolr-text">
            {value}
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-MojaSchoolr-50 text-MojaSchoolr-600">
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function SchoolAvatar({
  school,
  large = false,
}: {
  school: SchoolRecord;
  large?: boolean;
}) {
  if (school.logo_url) {
    return (
      <img
        src={school.logo_url}
        alt=""
        className={[
          "shrink-0 rounded-xl border border-slate-100 bg-white object-contain",
          large ? "h-16 w-16" : "h-10 w-10",
        ].join(" ")}
      />
    );
  }

  const initials = school.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div
      className={[
        "flex shrink-0 items-center justify-center rounded-xl bg-MojaSchoolr-50 font-semibold text-MojaSchoolr-600",
        large ? "h-16 w-16 text-lg" : "h-10 w-10 text-xs",
      ].join(" ")}
    >
      {initials || <Building2 size={18} />}
    </div>
  );
}

function AlertMessage({
  tone,
  message,
}: {
  tone: "error" | "success";
  message: string;
}) {
  const isError = tone === "error";
  return (
    <div
      className={[
        "mt-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
        isError
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700",
      ].join(" ")}
    >
      {isError ? (
        <AlertCircle size={17} className="mt-0.5 shrink-0" />
      ) : (
        <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
      )}
      <span>{message}</span>
    </div>
  );
}

function InfoCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Building2;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-MojaSchoolr-border bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-MojaSchoolr-border px-5 py-4">
        <Icon size={17} className="text-MojaSchoolr-600" />
        <h2 className="text-base font-semibold text-MojaSchoolr-text">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function InfoGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </p>
      <div className="mt-1 break-words text-sm text-slate-800">{value}</div>
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
        {value}
      </p>
    </div>
  );
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span>{label}</span>
      <span className="break-all text-right text-slate-600">{value}</span>
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}
