import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  RefreshCw,
  WalletCards,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { supabase } from "../../lib/supabase";

interface DashboardStats {
  activeSchools: number;
  pendingApplications: number;
  activeSubscriptions: number;
  outstandingInvoices: number;
  outstandingAmount: number;
  receivedThisMonth: number;
}

interface ApplicationRow {
  id: string;
  school_name: string;
  applicant_first_name: string;
  applicant_last_name: string;
  applicant_email: string;
  city: string;
  country: string;
  requested_role: string | null;
  status: string;
  created_at: string;
}

const initialStats: DashboardStats = {
  activeSchools: 0,
  pendingApplications: 0,
  activeSubscriptions: 0,
  outstandingInvoices: 0,
  outstandingAmount: 0,
  receivedThisMonth: 0,
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-RW", {
    style: "currency",
    currency: "RWF",
    maximumFractionDigits: 0,
  }).format(value);
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

function formatStatus(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function statusClasses(status: string) {
  switch (status) {
    case "pending":
      return "bg-amber-50 text-amber-700";
    case "under_review":
      return "bg-indigo-50 text-indigo-700";
    case "approved":
      return "bg-emerald-50 text-emerald-700";
    case "rejected":
      return "bg-red-50 text-red-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState(initialStats);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadDashboard(showRefreshState = false) {
    if (showRefreshState) setRefreshing(true);
    else setLoading(true);

    setError("");

    try {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [
        activeSchoolsResult,
        pendingApplicationsResult,
        activeSubscriptionsResult,
        outstandingInvoicesResult,
        monthPaymentsResult,
        recentApplicationsResult,
      ] = await Promise.all([
        supabase
          .from("platform_school_accounts")
          .select("school_id", { count: "exact", head: true })
          .eq("status", "active"),
        supabase
          .from("school_applications")
          .select("id", { count: "exact", head: true })
          .in("status", ["pending", "under_review"]),
        supabase
          .from("platform_school_subscriptions")
          .select("id", { count: "exact", head: true })
          .in("status", ["trial", "active", "past_due"]),
        supabase
          .from("platform_invoices")
          .select("id, total, status")
          .in("status", ["issued", "partially_paid", "overdue"]),
        supabase
          .from("platform_payments")
          .select("amount, status, payment_date")
          .eq("status", "confirmed")
          .gte("payment_date", monthStart.toISOString().slice(0, 10)),
        supabase
          .from("school_applications")
          .select(
            "id, school_name, applicant_first_name, applicant_last_name, applicant_email, city, country, requested_role, status, created_at",
          )
          .order("created_at", { ascending: false })
          .limit(6),
      ]);

      const firstError = [
        activeSchoolsResult.error,
        pendingApplicationsResult.error,
        activeSubscriptionsResult.error,
        outstandingInvoicesResult.error,
        monthPaymentsResult.error,
        recentApplicationsResult.error,
      ].find(Boolean);

      if (firstError) throw firstError;

      const outstandingInvoices = outstandingInvoicesResult.data ?? [];
      const monthPayments = monthPaymentsResult.data ?? [];

      setStats({
        activeSchools: activeSchoolsResult.count ?? 0,
        pendingApplications: pendingApplicationsResult.count ?? 0,
        activeSubscriptions: activeSubscriptionsResult.count ?? 0,
        outstandingInvoices: outstandingInvoices.length,
        outstandingAmount: outstandingInvoices.reduce(
          (sum, invoice) => sum + Number(invoice.total ?? 0),
          0,
        ),
        receivedThisMonth: monthPayments.reduce(
          (sum, payment) => sum + Number(payment.amount ?? 0),
          0,
        ),
      });

      setApplications((recentApplicationsResult.data ?? []) as ApplicationRow[]);
    } catch (loadError) {
      console.error("Failed to load WISE Admin dashboard:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load the WISE Admin dashboard.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const statCards = [
    {
      label: "Active schools",
      value: loading ? "—" : String(stats.activeSchools),
      icon: Building2,
    },
    {
      label: "School requests",
      value: loading ? "—" : String(stats.pendingApplications),
      icon: Clock3,
      action: "/admin/applications",
    },
    {
      label: "Active subscriptions",
      value: loading ? "—" : String(stats.activeSubscriptions),
      icon: CreditCard,
    },
    {
      label: "Outstanding invoices",
      value: loading ? "—" : String(stats.outstandingInvoices),
      icon: FileText,
      secondary:
        loading ? "" : formatMoney(stats.outstandingAmount),
      action: "/admin/billing",
    },
    {
      label: "Received this month",
      value: loading ? "—" : formatMoney(stats.receivedThisMonth),
      icon: WalletCards,
      action: "/admin/billing",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-wiser-600">
            WISE platform
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-wiser-text sm:text-3xl">
            {greeting}, Admin
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-wiser-text-secondary">
            Monitor schools, onboarding activity, subscriptions and platform billing from one place.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadDashboard(true)}
          disabled={refreshing}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-wiser-border bg-white px-4 text-sm font-semibold text-wiser-text-secondary transition hover:bg-wiser-50 hover:text-wiser-text disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {statCards.map((stat) => {
          const Icon = stat.icon;

          return (
            <button
              key={stat.label}
              type="button"
              onClick={() => stat.action && navigate(stat.action)}
              disabled={!stat.action}
              className={[
                "rounded-xl border border-wiser-border bg-white p-5 text-left shadow-sm",
                stat.action
                  ? "transition hover:-translate-y-0.5 hover:border-wiser-200 hover:shadow"
                  : "cursor-default",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-wiser-50 text-wiser-600">
                  <Icon size={19} />
                </div>
                {stat.action && (
                  <ArrowRight size={16} className="text-wiser-text-muted" />
                )}
              </div>

              <p className="mt-5 text-xs font-medium text-wiser-text-muted">
                {stat.label}
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-wiser-text">
                {stat.value}
              </p>
              {stat.secondary && (
                <p className="mt-1 text-xs text-wiser-text-secondary">
                  {stat.secondary}
                </p>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 overflow-hidden rounded-xl border border-wiser-border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-wiser-border px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-wiser-text">
                Recent school requests
              </h2>
              <p className="mt-1 text-xs text-wiser-text-secondary">
                Latest applications submitted through WISE onboarding.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/admin/applications")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-wiser-600 hover:text-wiser-700"
            >
              View all
              <ArrowRight size={13} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-wiser-border bg-slate-50/70">
                  {[
                    "School",
                    "Applicant",
                    "Location",
                    "Requested role",
                    "Status",
                    "Submitted",
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
                    <td
                      colSpan={6}
                      className="px-5 py-12 text-center text-sm text-wiser-text-secondary"
                    >
                      Loading requests...
                    </td>
                  </tr>
                ) : applications.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center">
                      <CheckCircle2
                        size={22}
                        className="mx-auto text-emerald-500"
                      />
                      <p className="mt-3 text-sm font-medium text-wiser-text">
                        No school requests yet
                      </p>
                      <p className="mt-1 text-xs text-wiser-text-secondary">
                        New onboarding applications will appear here.
                      </p>
                    </td>
                  </tr>
                ) : (
                  applications.map((application) => (
                    <tr key={application.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-wiser-text">
                          {application.school_name}
                        </p>
                        <p className="mt-0.5 text-xs text-wiser-text-secondary">
                          {application.applicant_email}
                        </p>
                      </td>
                      <td className="px-5 py-4 text-sm text-wiser-text-secondary">
                        {`${application.applicant_first_name} ${application.applicant_last_name}`.trim()}
                      </td>
                      <td className="px-5 py-4 text-sm text-wiser-text-secondary">
                        {application.city}, {application.country}
                      </td>
                      <td className="px-5 py-4 text-sm text-wiser-text-secondary">
                        {application.requested_role || "—"}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClasses(application.status)}`}
                        >
                          {formatStatus(application.status)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs text-wiser-text-secondary">
                        {formatDate(application.created_at)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-xl border border-wiser-border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-wiser-50 text-wiser-600">
                <Building2 size={18} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-wiser-text">
                  School onboarding
                </h2>
                <p className="mt-1 text-xs text-wiser-text-secondary">
                  Review and approve new schools before platform access is activated.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate("/admin/applications")}
              className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-wiser-600 px-4 text-sm font-semibold text-white transition hover:bg-wiser-700"
            >
              Open school requests
              <ArrowRight size={15} />
            </button>
          </section>

          <section className="rounded-xl border border-wiser-border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <CreditCard size={18} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-wiser-text">
                  Platform billing
                </h2>
                <p className="mt-1 text-xs text-wiser-text-secondary">
                  WISE invoices and payments remain separate from each school's internal finance records.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-[11px] text-wiser-text-muted">Outstanding</p>
                <p className="mt-1 text-sm font-semibold text-wiser-text">
                  {loading ? "—" : formatMoney(stats.outstandingAmount)}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-[11px] text-wiser-text-muted">This month</p>
                <p className="mt-1 text-sm font-semibold text-wiser-text">
                  {loading ? "—" : formatMoney(stats.receivedThisMonth)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate("/admin/billing")}
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-wiser-600 hover:text-wiser-700"
            >
              Open billing
              <ArrowRight size={13} />
            </button>
          </section>

          <section className="rounded-xl border border-wiser-border bg-wiser-900 p-5 text-white shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
                <Activity size={18} />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Platform health</h2>
                <p className="mt-1 text-xs leading-5 text-wiser-100">
                  Use the audit and analytics areas for deeper operational visibility as those modules are built.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
