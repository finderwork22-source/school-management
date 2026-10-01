import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Edit3,
  FileText,
  Filter,
  Loader2,
  Plus,
  ReceiptText,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Unlink2,
  WalletCards,
  X,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";

import { supabase } from "../../lib/supabase";

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

type PaymentMethod =
  | "flutterwave"
  | "bank_transfer"
  | "mobile_money"
  | "card"
  | "cash"
  | "other";

type SubscriptionStatus =
  | "trial"
  | "active"
  | "past_due"
  | "suspended"
  | "cancelled"
  | "expired";

type BillingTab = "overview" | "invoices" | "payments" | "subscriptions";

interface SchoolRecord {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  city: string | null;
  country: string | null;
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

interface InvoiceRecord {
  id: string;
  invoice_number: string;
  company_id: string;
  school_id: string;
  subscription_id: string | null;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  currency: string;
  status: InvoiceStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface PaymentRecord {
  id: string;
  payment_number: string;
  company_id: string;
  school_id: string;
  payment_method: PaymentMethod;
  amount: number;
  currency: string;
  payment_date: string;
  reference: string | null;
  provider: string | null;
  provider_transaction_id: string | null;
  status: PaymentStatus;
  received_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface AllocationRecord {
  id: string;
  payment_id: string;
  invoice_id: string;
  amount: number;
  created_at: string;
}

interface InvoiceWithRelations extends InvoiceRecord {
  school: SchoolRecord | null;
  subscription: SubscriptionRecord | null;
  plan: PlanRecord | null;
  allocatedAmount: number;
  balance: number;
}

interface PaymentWithRelations extends PaymentRecord {
  school: SchoolRecord | null;
  allocations: Array<AllocationRecord & { invoice: InvoiceRecord | null }>;
}

const INVOICE_STATUSES: Array<{ value: "all" | InvoiceStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "issued", label: "Issued" },
  { value: "partially_paid", label: "Partially paid" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
  { value: "draft", label: "Draft" },
];

const PAYMENT_STATUSES: Array<{ value: "all" | PaymentStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "confirmed", label: "Confirmed" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
  { value: "cancelled", label: "Cancelled" },
];

const SUBSCRIPTION_STATUSES: Array<{
  value: "all" | SubscriptionStatus;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "trial", label: "Trial" },
  { value: "active", label: "Active" },
  { value: "past_due", label: "Past due" },
  { value: "suspended", label: "Suspended" },
  { value: "cancelled", label: "Cancelled" },
  { value: "expired", label: "Expired" },
];

const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: "flutterwave", label: "Flutterwave" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "mobile_money", label: "Mobile money" },
  { value: "card", label: "Card" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

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

function formatStatus(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function invoiceStatusClasses(status: InvoiceStatus) {
  switch (status) {
    case "paid":
      return "bg-emerald-50 text-emerald-700";
    case "issued":
      return "bg-indigo-50 text-indigo-700";
    case "partially_paid":
      return "bg-amber-50 text-amber-700";
    case "overdue":
      return "bg-red-50 text-red-700";
    case "draft":
      return "bg-slate-100 text-slate-600";
    case "cancelled":
    case "void":
      return "bg-slate-100 text-slate-500";
  }
}

function paymentStatusClasses(status: PaymentStatus) {
  switch (status) {
    case "confirmed":
      return "bg-emerald-50 text-emerald-700";
    case "pending":
      return "bg-amber-50 text-amber-700";
    case "failed":
      return "bg-red-50 text-red-700";
    case "refunded":
    case "cancelled":
      return "bg-slate-100 text-slate-600";
  }
}

function subscriptionStatusClasses(status: SubscriptionStatus) {
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
  }
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getMonthStart() {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}

function getSchoolName(schools: SchoolRecord[], schoolId: string) {
  return schools.find((school) => school.id === schoolId)?.name ?? "Unknown school";
}

export default function AdminBilling() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get("tab") as BillingTab | null;
  const selectedInvoiceId = searchParams.get("invoice");
  const selectedPaymentId = searchParams.get("payment");

  const [tab, setTab] = useState<BillingTab>(
    requestedTab && ["overview", "invoices", "payments", "subscriptions"].includes(requestedTab)
      ? requestedTab
      : "overview",
  );
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [allocations, setAllocations] = useState<AllocationRecord[]>([]);
  const [companyId, setCompanyId] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [invoiceFilter, setInvoiceFilter] = useState<"all" | InvoiceStatus>("all");
  const [paymentFilter, setPaymentFilter] = useState<"all" | PaymentStatus>("all");
  const [subscriptionFilter, setSubscriptionFilter] = useState<"all" | SubscriptionStatus>("all");
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [processing, setProcessing] = useState(false);

  async function loadBilling(showRefreshState = false) {
    if (showRefreshState) setRefreshing(true);
    else setLoading(true);

    setError("");

    try {
      const [
        schoolsResult,
        plansResult,
        subscriptionsResult,
        invoicesResult,
        paymentsResult,
        allocationsResult,
        companyResult,
      ] = await Promise.all([
        supabase
          .from("schools")
          .select("id, name, slug, address, city, country")
          .order("name", { ascending: true }),
        supabase
          .from("platform_subscription_plans")
          .select("id, name, description, billing_cycle, amount, currency, is_active")
          .order("name", { ascending: true }),
        supabase
          .from("platform_school_subscriptions")
          .select(
            "id, school_id, plan_id, status, billing_cycle, price, currency, start_date, end_date, trial_start, trial_end",
          )
          .order("start_date", { ascending: false }),
        supabase
          .from("platform_invoices")
          .select(
            "id, invoice_number, company_id, school_id, subscription_id, issue_date, due_date, subtotal, tax, discount, total, currency, status, notes, created_by, created_at, updated_at",
          )
          .order("issue_date", { ascending: false }),
        supabase
          .from("platform_payments")
          .select(
            "id, payment_number, company_id, school_id, payment_method, amount, currency, payment_date, reference, provider, provider_transaction_id, status, received_by, notes, created_at, updated_at",
          )
          .order("payment_date", { ascending: false }),
        supabase
          .from("platform_payment_allocations")
          .select("id, payment_id, invoice_id, amount, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("platform_company")
          .select("id")
          .limit(1)
          .maybeSingle(),
      ]);

      const firstError =
        schoolsResult.error ??
        plansResult.error ??
        subscriptionsResult.error ??
        invoicesResult.error ??
        paymentsResult.error ??
        allocationsResult.error ??
        companyResult.error;

      if (firstError) throw firstError;

      setSchools((schoolsResult.data ?? []) as SchoolRecord[]);
      setPlans((plansResult.data ?? []) as PlanRecord[]);
      setSubscriptions((subscriptionsResult.data ?? []) as SubscriptionRecord[]);
      setInvoices((invoicesResult.data ?? []) as InvoiceRecord[]);
      setPayments((paymentsResult.data ?? []) as PaymentRecord[]);
      setAllocations((allocationsResult.data ?? []) as AllocationRecord[]);
      setCompanyId(companyResult.data?.id ?? "");
    } catch (loadError) {
      console.error("Failed to load MojaSchool billing:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load MojaSchool billing.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadBilling();
  }, []);

  useEffect(() => {
    if (requestedTab && ["overview", "invoices", "payments", "subscriptions"].includes(requestedTab)) {
      setTab(requestedTab);
    }
    setSearch(searchParams.get("q") || "");
  }, [requestedTab, searchParams]);

  const planById = useMemo(
    () => new Map(plans.map((plan) => [plan.id, plan])),
    [plans],
  );

  const subscriptionById = useMemo(
    () => new Map(subscriptions.map((subscription) => [subscription.id, subscription])),
    [subscriptions],
  );

  const schoolById = useMemo(
    () => new Map(schools.map((school) => [school.id, school])),
    [schools],
  );

  const allocationsByInvoice = useMemo(() => {
    const map = new Map<string, number>();
    for (const allocation of allocations) {
      map.set(
        allocation.invoice_id,
        (map.get(allocation.invoice_id) ?? 0) + Number(allocation.amount ?? 0),
      );
    }
    return map;
  }, [allocations]);

  const allocationsByPayment = useMemo(() => {
    const map = new Map<string, AllocationRecord[]>();
    for (const allocation of allocations) {
      const current = map.get(allocation.payment_id) ?? [];
      current.push(allocation);
      map.set(allocation.payment_id, current);
    }
    return map;
  }, [allocations]);

  const invoiceRows = useMemo<InvoiceWithRelations[]>(() => {
    return invoices.map((invoice) => {
      const allocatedAmount = allocationsByInvoice.get(invoice.id) ?? 0;
      const balance = Math.max(0, Number(invoice.total) - allocatedAmount);
      return {
        ...invoice,
        school: schoolById.get(invoice.school_id) ?? null,
        subscription: invoice.subscription_id
          ? subscriptionById.get(invoice.subscription_id) ?? null
          : null,
        plan: invoice.subscription_id
          ? planById.get(subscriptionById.get(invoice.subscription_id)?.plan_id ?? "") ?? null
          : null,
        allocatedAmount,
        balance,
      };
    });
  }, [invoices, allocationsByInvoice, schoolById, subscriptionById, planById]);

  const paymentRows = useMemo<PaymentWithRelations[]>(() => {
    return payments.map((payment) => ({
      ...payment,
      school: schoolById.get(payment.school_id) ?? null,
      allocations: (allocationsByPayment.get(payment.id) ?? []).map((allocation) => ({
        ...allocation,
        invoice: invoices.find((invoice) => invoice.id === allocation.invoice_id) ?? null,
      })),
    }));
  }, [payments, schoolById, allocationsByPayment, invoices]);

  const selectedInvoice = useMemo(
    () => invoiceRows.find((invoice) => invoice.id === selectedInvoiceId) ?? null,
    [invoiceRows, selectedInvoiceId],
  );

  const selectedPayment = useMemo(
    () => paymentRows.find((payment) => payment.id === selectedPaymentId) ?? null,
    [paymentRows, selectedPaymentId],
  );

  const filteredInvoices = useMemo(() => {
    const query = search.trim().toLowerCase();
    return invoiceRows.filter((invoice) => {
      if (invoiceFilter !== "all" && invoice.status !== invoiceFilter) return false;
      if (!query) return true;
      return [
        invoice.invoice_number,
        invoice.school?.name ?? "",
        invoice.school?.city ?? "",
        invoice.school?.country ?? "",
        invoice.status,
        invoice.plan?.name ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [invoiceRows, invoiceFilter, search]);

  const filteredPayments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return paymentRows.filter((payment) => {
      if (paymentFilter !== "all" && payment.status !== paymentFilter) return false;
      if (!query) return true;
      return [
        payment.payment_number,
        payment.school?.name ?? "",
        payment.reference ?? "",
        payment.provider ?? "",
        payment.payment_method,
        payment.status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [paymentRows, paymentFilter, search]);

  const filteredSubscriptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return subscriptions.filter((subscription) => {
      if (subscriptionFilter !== "all" && subscription.status !== subscriptionFilter) return false;
      if (!query) return true;
      const school = schoolById.get(subscription.school_id);
      const plan = subscription.plan_id ? planById.get(subscription.plan_id) : null;
      return [
        school?.name ?? "",
        school?.city ?? "",
        subscription.status,
        subscription.billing_cycle,
        plan?.name ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [subscriptions, subscriptionFilter, search, schoolById, planById]);

  const summary = useMemo(() => {
    const outstandingInvoices = invoiceRows.filter((invoice) =>
      ["issued", "partially_paid", "overdue"].includes(invoice.status),
    );
    const confirmedPayments = payments.filter((payment) => payment.status === "confirmed");
    const monthStart = getMonthStart();
    const receivedThisMonth = confirmedPayments
      .filter((payment) => payment.payment_date >= monthStart)
      .reduce((sum, payment) => sum + Number(payment.amount), 0);
    const overdueAmount = invoiceRows
      .filter((invoice) => invoice.status === "overdue")
      .reduce((sum, invoice) => sum + invoice.balance, 0);
    const outstandingAmount = outstandingInvoices.reduce(
      (sum, invoice) => sum + invoice.balance,
      0,
    );
    const activeSubscriptions = subscriptions.filter((subscription) =>
      ["trial", "active", "past_due"].includes(subscription.status),
    ).length;

    return {
      outstandingAmount,
      overdueAmount,
      receivedThisMonth,
      activeSubscriptions,
      outstandingCount: outstandingInvoices.length,
      invoiceCount: invoices.length,
      paymentCount: payments.length,
    };
  }, [invoiceRows, invoices.length, payments, subscriptions]);

  function changeTab(nextTab: BillingTab) {
    setTab(nextTab);
    setSearchParams((current) => {
      current.set("tab", nextTab);
      current.delete("invoice");
      current.delete("payment");
      return current;
    });
  }

  function openInvoice(invoiceId: string) {
    setTab("invoices");
    setSearchParams((current) => {
      current.set("tab", "invoices");
      current.set("invoice", invoiceId);
      current.delete("payment");
      return current;
    });
  }

  function openPayment(paymentId: string) {
    setTab("payments");
    setSearchParams((current) => {
      current.set("tab", "payments");
      current.set("payment", paymentId);
      current.delete("invoice");
      return current;
    });
  }

  function closeInvoice() {
    setSearchParams((current) => {
      current.delete("invoice");
      current.delete("payment");
      return current;
    });
  }

  function closePayment() {
    setSearchParams((current) => {
      current.delete("payment");
      current.delete("invoice");
      return current;
    });
  }

  async function handleInvoiceCreated() {
    setShowInvoiceForm(false);
    setSuccess("Invoice created successfully.");
    await loadBilling(true);
  }

  async function handlePaymentCreated() {
    setShowPaymentForm(false);
    setSuccess("Payment recorded successfully.");
    await loadBilling(true);
  }

  if (selectedInvoice) {
    return (
      <InvoiceDetail
        invoice={selectedInvoice}
        schools={schools}
        plans={plans}
        subscriptions={subscriptions}
        payments={payments}
        allocations={allocations}
        processing={processing}
        setProcessing={setProcessing}
        error={error}
        success={success}
        onBack={closeInvoice}
        onRefresh={() => void loadBilling(true)}
      />
    );
  }

  if (selectedPayment) {
    return (
      <PaymentDetail
        payment={selectedPayment}
        invoices={invoiceRows}
        allocations={allocations}
        processing={processing}
        setProcessing={setProcessing}
        error={error}
        success={success}
        onBack={closePayment}
        onRefresh={() => void loadBilling(true)}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-MojaSchoolr-600">
            <WalletCards size={14} />
            MojaSchool platform billing
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-MojaSchoolr-text sm:text-3xl">
            Billing
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-MojaSchoolr-text-secondary">
            Manage MojaSchool subscriptions, invoices, payments and payment allocations owed by schools to the platform.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void loadBilling(true)}
            disabled={refreshing}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-MojaSchoolr-border bg-white px-4 text-sm font-semibold text-MojaSchoolr-text-secondary shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => setShowPaymentForm(true)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-MojaSchoolr-border bg-white px-4 text-sm font-semibold text-MojaSchoolr-text-secondary shadow-sm transition hover:bg-slate-50"
          >
            <ReceiptText size={16} />
            Record payment
          </button>
          <button
            type="button"
            onClick={() => setShowInvoiceForm(true)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-MojaSchoolr-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-MojaSchoolr-700"
          >
            <Plus size={16} />
            Create invoice
          </button>
        </div>
      </div>

      {error && <AlertMessage tone="error" message={error} />}
      {success && <AlertMessage tone="success" message={success} />}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Outstanding"
          value={formatMoney(summary.outstandingAmount)}
          caption={`${summary.outstandingCount} open invoice${summary.outstandingCount === 1 ? "" : "s"}`}
          icon={WalletCards}
        />
        <SummaryCard
          label="Overdue"
          value={formatMoney(summary.overdueAmount)}
          caption="Outstanding balance only"
          icon={AlertCircle}
        />
        <SummaryCard
          label="Received this month"
          value={formatMoney(summary.receivedThisMonth)}
          caption={`${summary.paymentCount} payment${summary.paymentCount === 1 ? "" : "s"} recorded`}
          icon={Banknote}
        />
        <SummaryCard
          label="Active subscriptions"
          value={String(summary.activeSubscriptions)}
          caption={`${summary.invoiceCount} invoice${summary.invoiceCount === 1 ? "" : "s"} in the platform ledger`}
          icon={CreditCard}
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-MojaSchoolr-border bg-white shadow-sm">
        <div className="flex flex-wrap border-b border-MojaSchoolr-border px-4 pt-3 sm:px-5">
          {(
            [
              ["overview", "Overview"],
              ["invoices", "Invoices"],
              ["payments", "Payments"],
              ["subscriptions", "Subscriptions"],
            ] as Array<[BillingTab, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => changeTab(value)}
              className={[
                "border-b-2 px-3 py-3 text-sm font-semibold transition sm:px-4",
                tab === value
                  ? "border-MojaSchoolr-600 text-MojaSchoolr-700"
                  : "border-transparent text-slate-500 hover:text-slate-800",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <OverviewTab
            invoiceRows={invoiceRows}
            paymentRows={paymentRows}
            subscriptions={subscriptions}
            schools={schools}
            plans={plans}
            onInvoice={openInvoice}
            onInvoices={() => changeTab("invoices")}
            onPayments={() => changeTab("payments")}
          />
        )}

        {tab === "invoices" && (
          <InvoicesTab
            rows={filteredInvoices}
            loading={loading}
            filter={invoiceFilter}
            search={search}
            setFilter={setInvoiceFilter}
            setSearch={setSearch}
            onInvoice={openInvoice}
          />
        )}

        {tab === "payments" && (
          <PaymentsTab
            rows={filteredPayments}
            loading={loading}
            filter={paymentFilter}
            search={search}
            setFilter={setPaymentFilter}
            setSearch={setSearch}
            onPayment={openPayment}
          />
        )}

        {tab === "subscriptions" && (
          <SubscriptionsTab
            rows={filteredSubscriptions}
            loading={loading}
            filter={subscriptionFilter}
            search={search}
            setFilter={setSubscriptionFilter}
            setSearch={setSearch}
            schools={schools}
            plans={plans}
          />
        )}
      </div>

      {showInvoiceForm && companyId && (
        <InvoiceForm
          companyId={companyId}
          schools={schools}
          subscriptions={subscriptions}
          plans={plans}
          onClose={() => setShowInvoiceForm(false)}
          onCreated={() => void handleInvoiceCreated()}
        />
      )}

      {showPaymentForm && companyId && (
        <PaymentForm
          companyId={companyId}
          schools={schools}
          invoices={invoiceRows}
          onClose={() => setShowPaymentForm(false)}
          onCreated={() => void handlePaymentCreated()}
        />
      )}
    </div>
  );
}

function OverviewTab({
  invoiceRows,
  paymentRows,
  subscriptions,
  schools,
  plans,
  onInvoice,
  onInvoices,
  onPayments,
}: {
  invoiceRows: InvoiceWithRelations[];
  paymentRows: PaymentWithRelations[];
  subscriptions: SubscriptionRecord[];
  schools: SchoolRecord[];
  plans: PlanRecord[];
  onInvoice: (invoiceId: string) => void;
  onInvoices: () => void;
  onPayments: () => void;
}) {
  const recentInvoices = invoiceRows.slice(0, 5);
  const recentPayments = paymentRows.slice(0, 5);
  const activeSubscriptions = subscriptions.filter((subscription) =>
    ["trial", "active", "past_due"].includes(subscription.status),
  );

  return (
    <div className="grid gap-6 p-4 sm:p-5 lg:grid-cols-2">
      <section className="overflow-hidden rounded-xl border border-slate-200">
        <SectionHeader
          title="Recent invoices"
          icon={FileText}
          actionLabel="View all"
          onAction={onInvoices}
        />
        <div className="divide-y divide-slate-100">
          {recentInvoices.length === 0 ? (
            <EmptyBlock title="No invoices yet" description="Create your first MojaSchool invoice to start the platform ledger." />
          ) : (
            recentInvoices.map((invoice) => (
              <button
                key={invoice.id}
                type="button"
                onClick={() => onInvoice(invoice.id)}
                className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{invoice.invoice_number}</p>
                  <p className="mt-1 truncate text-xs text-slate-400">
                    {invoice.school?.name ?? "Unknown school"} · Due {formatDate(invoice.due_date)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-slate-800">{formatMoney(invoice.balance, invoice.currency)}</p>
                  <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${invoiceStatusClasses(invoice.status)}`}>
                    {formatStatus(invoice.status)}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200">
        <SectionHeader
          title="Recent payments"
          icon={ReceiptText}
          actionLabel="View all"
          onAction={onPayments}
        />
        <div className="divide-y divide-slate-100">
          {recentPayments.length === 0 ? (
            <EmptyBlock title="No payments yet" description="Confirmed and pending school payments will appear here." />
          ) : (
            recentPayments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between gap-4 px-4 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{payment.payment_number}</p>
                  <p className="mt-1 truncate text-xs text-slate-400">
                    {payment.school?.name ?? "Unknown school"} · {formatDate(payment.payment_date)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-slate-800">{formatMoney(payment.amount, payment.currency)}</p>
                  <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${paymentStatusClasses(payment.status)}`}>
                    {formatStatus(payment.status)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 lg:col-span-2">
        <SectionHeader title="Subscription coverage" icon={CreditCard} />
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          {schools.slice(0, 8).map((school) => {
            const subscription = activeSubscriptions.find((item) => item.school_id === school.id);
            const plan = subscription?.plan_id
              ? plans.find((item) => item.id === subscription.plan_id)
              : null;
            return (
              <div key={school.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="truncate text-sm font-semibold text-slate-800">{school.name}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {subscription ? plan?.name ?? "Plan not assigned" : "No active subscription"}
                </p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${subscription ? subscriptionStatusClasses(subscription.status) : "bg-slate-100 text-slate-500"}`}>
                    {subscription ? formatStatus(subscription.status) : "None"}
                  </span>
                  {subscription && (
                    <span className="text-xs font-semibold text-slate-700">
                      {formatMoney(subscription.price, subscription.currency)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function InvoicesTab({
  rows,
  loading,
  filter,
  search,
  setFilter,
  setSearch,
  onInvoice,
}: {
  rows: InvoiceWithRelations[];
  loading: boolean;
  filter: "all" | InvoiceStatus;
  search: string;
  setFilter: (value: "all" | InvoiceStatus) => void;
  setSearch: (value: string) => void;
  onInvoice: (invoiceId: string) => void;
}) {
  return (
    <div>
      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search invoice, school, plan..."
        filter={filter}
        filterOptions={INVOICE_STATUSES}
        onFilter={setFilter}
      />
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[920px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70">
              {[
                "Invoice",
                "School",
                "Issue date",
                "Due date",
                "Total",
                "Balance",
                "Status",
                "",
              ].map((heading) => (
                <th key={heading} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <LoadingTable colSpan={8} label="Loading invoices..." />
            ) : rows.length === 0 ? (
              <EmptyTable colSpan={8} title="No invoices found" />
            ) : (
              rows.map((invoice) => (
                <tr key={invoice.id} className="transition hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <button type="button" onClick={() => onInvoice(invoice.id)} className="text-left">
                      <p className="text-sm font-semibold text-slate-800 hover:text-MojaSchoolr-700">{invoice.invoice_number}</p>
                      <p className="mt-1 text-xs text-slate-400">{invoice.plan?.name ?? "No plan"}</p>
                    </button>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-700">{invoice.school?.name ?? "Unknown school"}</td>
                  <td className="px-5 py-4 text-sm text-slate-500">{formatDate(invoice.issue_date)}</td>
                  <td className="px-5 py-4 text-sm text-slate-500">{formatDate(invoice.due_date)}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-slate-800">{formatMoney(invoice.total, invoice.currency)}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-slate-800">{formatMoney(invoice.balance, invoice.currency)}</td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${invoiceStatusClasses(invoice.status)}`}>
                      {formatStatus(invoice.status)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button type="button" onClick={() => onInvoice(invoice.id)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                      <ChevronRight size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-slate-100 md:hidden">
        {loading ? (
          <div className="flex min-h-[260px] items-center justify-center text-sm text-slate-500"><Loader2 size={17} className="mr-2 animate-spin" />Loading invoices...</div>
        ) : rows.length === 0 ? (
          <EmptyBlock title="No invoices found" description="Try a different filter or search term." />
        ) : (
          rows.map((invoice) => (
            <button key={invoice.id} type="button" onClick={() => onInvoice(invoice.id)} className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left hover:bg-slate-50">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{invoice.invoice_number}</p>
                <p className="mt-1 truncate text-xs text-slate-500">{invoice.school?.name ?? "Unknown school"}</p>
                <p className="mt-2 text-xs text-slate-400">Due {formatDate(invoice.due_date)}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-slate-800">{formatMoney(invoice.balance, invoice.currency)}</p>
                <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${invoiceStatusClasses(invoice.status)}`}>{formatStatus(invoice.status)}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function PaymentsTab({
  rows,
  loading,
  filter,
  search,
  setFilter,
  setSearch,
  onPayment,
}: {
  rows: PaymentWithRelations[];
  loading: boolean;
  filter: "all" | PaymentStatus;
  search: string;
  setFilter: (value: "all" | PaymentStatus) => void;
  setSearch: (value: string) => void;
  onPayment: (paymentId: string) => void;
}) {
  return (
    <div>
      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search payment, school, reference..."
        filter={filter}
        filterOptions={PAYMENT_STATUSES}
        onFilter={setFilter}
      />
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70">
              {["Payment", "School", "Date", "Method", "Amount", "Reference", "Status"].map((heading) => (
                <th key={heading} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? <LoadingTable colSpan={7} label="Loading payments..." /> : rows.length === 0 ? <EmptyTable colSpan={7} title="No payments found" /> : rows.map((payment) => (
              <tr key={payment.id} className="hover:bg-slate-50">
                <td className="px-5 py-4">
                  <button type="button" onClick={() => onPayment(payment.id)} className="text-left">
                    <p className="text-sm font-semibold text-slate-800 hover:text-MojaSchoolr-700">{payment.payment_number}</p>
                    <p className="mt-1 text-xs text-slate-400">{payment.allocations.length} allocation{payment.allocations.length === 1 ? "" : "s"}</p>
                  </button>
                </td>
                <td className="px-5 py-4 text-sm text-slate-700">{payment.school?.name ?? "Unknown school"}</td>
                <td className="px-5 py-4 text-sm text-slate-500">{formatDate(payment.payment_date)}</td>
                <td className="px-5 py-4 text-sm text-slate-500">{formatStatus(payment.payment_method)}</td>
                <td className="px-5 py-4 text-sm font-semibold text-slate-800">{formatMoney(payment.amount, payment.currency)}</td>
                <td className="px-5 py-4 text-sm text-slate-500">{payment.reference || "—"}</td>
                <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${paymentStatusClasses(payment.status)}`}>{formatStatus(payment.status)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-slate-100 md:hidden">
        {loading ? <div className="flex min-h-[260px] items-center justify-center text-sm text-slate-500"><Loader2 size={17} className="mr-2 animate-spin" />Loading payments...</div> : rows.length === 0 ? <EmptyBlock title="No payments found" description="Try a different filter or search term." /> : rows.map((payment) => (
          <button key={payment.id} type="button" onClick={() => onPayment(payment.id)} className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left hover:bg-slate-50">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">{payment.payment_number}</p>
              <p className="mt-1 truncate text-xs text-slate-500">{payment.school?.name ?? "Unknown school"}</p>
              <p className="mt-2 text-xs text-slate-400">{formatStatus(payment.payment_method)} · {formatDate(payment.payment_date)}</p>
            </div>
            <div className="shrink-0 text-right"><p className="text-sm font-semibold text-slate-800">{formatMoney(payment.amount, payment.currency)}</p><span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${paymentStatusClasses(payment.status)}`}>{formatStatus(payment.status)}</span></div>
          </button>
        ))}
      </div>
    </div>
  );
}

function SubscriptionsTab({
  rows,
  loading,
  filter,
  search,
  setFilter,
  setSearch,
  schools,
  plans,
}: {
  rows: SubscriptionRecord[];
  loading: boolean;
  filter: "all" | SubscriptionStatus;
  search: string;
  setFilter: (value: "all" | SubscriptionStatus) => void;
  setSearch: (value: string) => void;
  schools: SchoolRecord[];
  plans: PlanRecord[];
}) {
  return (
    <div>
      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search school, plan, status..."
        filter={filter}
        filterOptions={SUBSCRIPTION_STATUSES}
        onFilter={setFilter}
      />
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px]">
          <thead><tr className="border-b border-slate-200 bg-slate-50/70">{["School", "Plan", "Cycle", "Price", "Start date", "End date", "Status"].map((heading) => <th key={heading} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">{heading}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? <LoadingTable colSpan={7} label="Loading subscriptions..." /> : rows.length === 0 ? <EmptyTable colSpan={7} title="No subscriptions found" /> : rows.map((subscription) => {
              const school = schools.find((item) => item.id === subscription.school_id);
              const plan = subscription.plan_id ? plans.find((item) => item.id === subscription.plan_id) : null;
              return (
                <tr key={subscription.id} className="hover:bg-slate-50">
                  <td className="px-5 py-4 text-sm font-semibold text-slate-800">{school?.name ?? "Unknown school"}</td>
                  <td className="px-5 py-4 text-sm text-slate-600">{plan?.name ?? "Plan not assigned"}</td>
                  <td className="px-5 py-4 text-sm text-slate-500">{formatStatus(subscription.billing_cycle)}</td>
                  <td className="px-5 py-4 text-sm font-semibold text-slate-800">{formatMoney(subscription.price, subscription.currency)}</td>
                  <td className="px-5 py-4 text-sm text-slate-500">{formatDate(subscription.start_date)}</td>
                  <td className="px-5 py-4 text-sm text-slate-500">{formatDate(subscription.end_date)}</td>
                  <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${subscriptionStatusClasses(subscription.status)}`}>{formatStatus(subscription.status)}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-slate-100 md:hidden">
        {loading ? <div className="flex min-h-[260px] items-center justify-center text-sm text-slate-500"><Loader2 size={17} className="mr-2 animate-spin" />Loading subscriptions...</div> : rows.length === 0 ? <EmptyBlock title="No subscriptions found" description="Try a different filter or search term." /> : rows.map((subscription) => {
          const school = schools.find((item) => item.id === subscription.school_id);
          const plan = subscription.plan_id ? plans.find((item) => item.id === subscription.plan_id) : null;
          return <div key={subscription.id} className="flex items-start justify-between gap-4 px-4 py-4"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{school?.name ?? "Unknown school"}</p><p className="mt-1 truncate text-xs text-slate-500">{plan?.name ?? "Plan not assigned"} · {formatStatus(subscription.billing_cycle)}</p><p className="mt-2 text-xs text-slate-400">Starts {formatDate(subscription.start_date)}</p></div><div className="shrink-0 text-right"><p className="text-sm font-semibold text-slate-800">{formatMoney(subscription.price, subscription.currency)}</p><span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${subscriptionStatusClasses(subscription.status)}`}>{formatStatus(subscription.status)}</span></div></div>;
        })}
      </div>
    </div>
  );
}

function InvoiceDetail({
  invoice,
  schools,
  plans,
  subscriptions,
  payments,
  allocations,
  processing,
  setProcessing,
  error,
  success,
  onBack,
  onRefresh,
}: {
  invoice: InvoiceWithRelations;
  schools: SchoolRecord[];
  plans: PlanRecord[];
  subscriptions: SubscriptionRecord[];
  payments: PaymentRecord[];
  allocations: AllocationRecord[];
  processing: boolean;
  setProcessing: (value: boolean) => void;
  error: string;
  success: string;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const [showEdit, setShowEdit] = useState(false);
  const [showAllocationForm, setShowAllocationForm] = useState(false);
  const [localError, setLocalError] = useState("");
  const [localSuccess, setLocalSuccess] = useState("");

  const invoiceAllocations = useMemo(
    () => allocations.filter((allocation) => allocation.invoice_id === invoice.id),
    [allocations, invoice.id],
  );

  async function voidInvoice() {
    if (invoice.status === "void") return;
    if (invoice.allocatedAmount > 0) {
      setLocalError("This invoice has payment allocations. Remove its allocations before voiding the invoice.");
      setLocalSuccess("");
      return;
    }
    const confirmed = window.confirm(
      `Void invoice ${invoice.invoice_number}? This keeps the invoice record but marks it as void.`,
    );
    if (!confirmed) return;

    setProcessing(true);
    setLocalError("");
    setLocalSuccess("");
    try {
      const { error: updateError } = await supabase
        .from("platform_invoices")
        .update({ status: "void" })
        .eq("id", invoice.id);
      if (updateError) throw updateError;
      setLocalSuccess("Invoice has been voided.");
      onRefresh();
    } catch (updateError) {
      console.error("Failed to void invoice:", updateError);
      setLocalError(
        updateError instanceof Error ? updateError.message : "Could not void invoice.",
      );
    } finally {
      setProcessing(false);
    }
  }

  async function updateAllocation(allocationId: string, amount: number) {
    if (invoice.status === "void" || invoice.status === "cancelled") {
      setLocalError("Void or cancelled invoices cannot receive payment allocations.");
      return;
    }

    const allocation = invoiceAllocations.find((item) => item.id === allocationId);
    if (!allocation) return;

    const payment = payments.find((item) => item.id === allocation.payment_id);
    if (!payment) {
      setLocalError("The payment linked to this allocation could not be found.");
      return;
    }

    const otherPaymentAllocated = allocations
      .filter((item) => item.payment_id === allocation.payment_id && item.id !== allocation.id)
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const otherInvoiceAllocated = invoiceAllocations
      .filter((item) => item.id !== allocation.id)
      .reduce((sum, item) => sum + Number(item.amount), 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      setLocalError("Allocation amount must be greater than 0.");
      return;
    }
    if (amount > Number(payment.amount) - otherPaymentAllocated) {
      setLocalError(`Allocation cannot exceed the payment's remaining amount of ${formatMoney(Number(payment.amount) - otherPaymentAllocated, payment.currency)}.`);
      return;
    }
    if (amount > Number(invoice.total) - otherInvoiceAllocated) {
      setLocalError(`Allocation cannot exceed the invoice's remaining amount of ${formatMoney(Number(invoice.total) - otherInvoiceAllocated, invoice.currency)}.`);
      return;
    }

    setProcessing(true);
    setLocalError("");
    setLocalSuccess("");
    try {
      const { error: updateError } = await supabase
        .from("platform_payment_allocations")
        .update({ amount })
        .eq("id", allocationId);
      if (updateError) throw updateError;
      await syncInvoiceStatus(invoice, allocations.map((item) =>
        item.id === allocationId ? { ...item, amount } : item,
      ));
      setLocalSuccess("Payment allocation updated.");
      onRefresh();
    } catch (updateError) {
      console.error("Failed to update payment allocation:", updateError);
      setLocalError(updateError instanceof Error ? updateError.message : "Could not update payment allocation.");
    } finally {
      setProcessing(false);
    }
  }

  async function removeAllocation(allocationId: string) {
    const allocation = invoiceAllocations.find((item) => item.id === allocationId);
    if (!allocation) return;
    const confirmed = window.confirm("Remove this payment allocation from the invoice?");
    if (!confirmed) return;

    setProcessing(true);
    setLocalError("");
    setLocalSuccess("");
    try {
      const { error: deleteError } = await supabase
        .from("platform_payment_allocations")
        .delete()
        .eq("id", allocationId);
      if (deleteError) throw deleteError;
      await syncInvoiceStatus(invoice, allocations.filter((item) => item.id !== allocationId));
      setLocalSuccess("Payment allocation removed.");
      onRefresh();
    } catch (deleteError) {
      console.error("Failed to remove payment allocation:", deleteError);
      setLocalError(deleteError instanceof Error ? deleteError.message : "Could not remove payment allocation.");
    } finally {
      setProcessing(false);
    }
  }

  async function addAllocation(paymentId: string, amount: number) {
    if (invoice.status === "void" || invoice.status === "cancelled") {
      setLocalError("Void or cancelled invoices cannot receive payment allocations.");
      return;
    }
    const payment = payments.find((item) => item.id === paymentId);
    if (!payment) {
      setLocalError("Payment not found.");
      return;
    }
    if (payment.school_id !== invoice.school_id) {
      setLocalError("A payment can only be allocated to an invoice from the same school.");
      return;
    }
    if (payment.currency !== invoice.currency) {
      setLocalError("Payment and invoice currencies must match before allocation.");
      return;
    }

    const existingForPayment = allocations
      .filter((item) => item.payment_id === paymentId)
      .reduce((sum, item) => sum + Number(item.amount), 0);
    const availablePayment = Number(payment.amount) - existingForPayment;
    const availableInvoice = Math.max(0, Number(invoice.total) - invoice.allocatedAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      setLocalError("Allocation amount must be greater than 0.");
      return;
    }
    if (amount > availablePayment) {
      setLocalError(`Allocation exceeds the payment's available amount of ${formatMoney(availablePayment, payment.currency)}.`);
      return;
    }
    if (amount > availableInvoice) {
      setLocalError(`Allocation exceeds the invoice's remaining balance of ${formatMoney(availableInvoice, invoice.currency)}.`);
      return;
    }

    setProcessing(true);
    setLocalError("");
    setLocalSuccess("");
    try {
      const { error: insertError } = await supabase
        .from("platform_payment_allocations")
        .insert({
          payment_id: paymentId,
          invoice_id: invoice.id,
          amount,
        });
      if (insertError) throw insertError;

      await syncInvoiceStatus(invoice, [
        ...allocations,
        { id: "__new__", payment_id: paymentId, invoice_id: invoice.id, amount, created_at: new Date().toISOString() },
      ]);
      setShowAllocationForm(false);
      setLocalSuccess("Payment allocated to the invoice.");
      onRefresh();
    } catch (insertError) {
      console.error("Failed to add payment allocation:", insertError);
      setLocalError(insertError instanceof Error ? insertError.message : "Could not add payment allocation.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold text-MojaSchoolr-600 hover:text-MojaSchoolr-700"><ArrowLeft size={16} />Back to billing</button>
      <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight text-MojaSchoolr-text sm:text-3xl">{invoice.invoice_number}</h1><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${invoiceStatusClasses(invoice.status)}`}>{formatStatus(invoice.status)}</span></div>
          <p className="mt-2 text-sm text-MojaSchoolr-text-secondary">{invoice.school?.name ?? getSchoolName(schools, invoice.school_id)} · Issued {formatDate(invoice.issue_date)}</p>
        </div>
        <div className="text-left lg:text-right"><p className="text-xs uppercase tracking-[0.08em] text-slate-400">Outstanding balance</p><p className="mt-1 text-2xl font-semibold text-slate-900">{formatMoney(invoice.balance, invoice.currency)}</p></div>
      </div>
      {error && <AlertMessage tone="error" message={error} />}
      {success && <AlertMessage tone="success" message={success} />}
      {localError && <AlertMessage tone="error" message={localError} />}
      {localSuccess && <AlertMessage tone="success" message={localSuccess} />}
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <InfoCard title="Invoice details" icon={FileText}><InfoGrid><InfoItem label="School" value={invoice.school?.name ?? getSchoolName(schools, invoice.school_id)} /><InfoItem label="Plan" value={invoice.plan?.name ?? "Plan not assigned"} /><InfoItem label="Issue date" value={formatDate(invoice.issue_date)} /><InfoItem label="Due date" value={formatDate(invoice.due_date)} /><InfoItem label="Currency" value={invoice.currency} /><InfoItem label="Invoice status" value={formatStatus(invoice.status)} /></InfoGrid></InfoCard>
          <InfoCard title="Amounts" icon={CircleDollarSign}><div className="space-y-3"><AmountLine label="Subtotal" value={formatMoney(invoice.subtotal, invoice.currency)} /><AmountLine label="Tax" value={formatMoney(invoice.tax, invoice.currency)} /><AmountLine label="Discount" value={`-${formatMoney(invoice.discount, invoice.currency)}`} /><div className="border-t border-slate-200 pt-3"><AmountLine label="Total" value={formatMoney(invoice.total, invoice.currency)} strong /></div><AmountLine label="Allocated payments" value={formatMoney(invoice.allocatedAmount, invoice.currency)} /><AmountLine label="Balance" value={formatMoney(invoice.balance, invoice.currency)} strong /></div></InfoCard>
          <InfoCard title="Payment allocations" icon={ReceiptText}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <p className="text-xs text-slate-500">Link confirmed or pending platform payments to this invoice, including partial amounts.</p>
              <button type="button" onClick={() => setShowAllocationForm(true)} disabled={processing || invoice.status === "void" || invoice.status === "cancelled" || invoice.balance <= 0} className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-MojaSchoolr-600 px-3 text-xs font-semibold text-white hover:bg-MojaSchoolr-700 disabled:cursor-not-allowed disabled:opacity-50"><Plus size={14} />Allocate payment</button>
            </div>
            <div className="divide-y divide-slate-100">
              {invoiceAllocations.length === 0 ? <EmptyState title="No payment allocations" description="No payments have been allocated to this invoice yet." /> : invoiceAllocations.map((allocation) => {
                const payment = payments.find((item) => item.id === allocation.payment_id);
                const maxAmount = payment ? Number(payment.amount) : Number(allocation.amount);
                return <AllocationRow key={allocation.id} allocation={allocation} payment={payment} currency={invoice.currency} disabled={processing} maxAmount={maxAmount} onSave={(amount) => void updateAllocation(allocation.id, amount)} onRemove={() => void removeAllocation(allocation.id)} />;
              })}
            </div>
          </InfoCard>
        </div>
        <div className="h-fit space-y-4 xl:sticky xl:top-24">
          <section className="rounded-xl border border-MojaSchoolr-border bg-white shadow-sm"><div className="border-b border-MojaSchoolr-border px-5 py-4"><div className="flex items-center gap-2"><Filter size={17} className="text-MojaSchoolr-600" /><h2 className="text-base font-semibold text-MojaSchoolr-text">Invoice controls</h2></div><p className="mt-1 text-xs leading-5 text-MojaSchoolr-text-secondary">Edit invoice details, change its ledger state, or void it without deleting the record.</p></div><div className="space-y-2 p-5"><button type="button" onClick={() => setShowEdit(true)} disabled={processing || invoice.status === "void"} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"><Edit3 size={16} />Edit invoice</button>{invoice.status !== "void" && <button type="button" onClick={() => void voidInvoice()} disabled={processing} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"><Trash2 size={16} />Void invoice</button>}</div></section>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-400"><MetaLine label="Invoice ID" value={invoice.id} /><MetaLine label="School ID" value={invoice.school_id} /><MetaLine label="Subscription ID" value={invoice.subscription_id || "—"} /></div>
        </div>
      </div>
      {showEdit && <InvoiceEditModal invoice={invoice} subscriptions={subscriptions} allocatedAmount={invoice.allocatedAmount} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); onRefresh(); setLocalSuccess("Invoice updated successfully."); }} />}
      {showAllocationForm && <AllocationForm invoice={invoice} payments={payments} allocations={allocations} onClose={() => setShowAllocationForm(false)} onSave={(paymentId, amount) => void addAllocation(paymentId, amount)} saving={processing} />}
      {plans.length === 0 && <p className="mt-4 text-xs text-slate-400">No subscription plans have been configured yet.</p>}
    </div>
  );
}

async function syncInvoiceStatus(invoice: InvoiceWithRelations | InvoiceRecord, nextAllocations: AllocationRecord[]) {
  if (invoice.status === "void" || invoice.status === "cancelled") return;
  const allocated = nextAllocations
    .filter((item) => item.invoice_id === invoice.id)
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const total = Number(invoice.total);
  const balance = Math.max(0, total - allocated);
  let nextStatus: InvoiceStatus;
  if (balance <= 0) nextStatus = "paid";
  else if (allocated > 0) nextStatus = "partially_paid";
  else if (invoice.due_date < getToday()) nextStatus = "overdue";
  else nextStatus = "issued";
  if (nextStatus === invoice.status) return;
  const { error } = await supabase.from("platform_invoices").update({ status: nextStatus }).eq("id", invoice.id);
  if (error) throw error;
}

function AllocationRow({ allocation, payment, currency, disabled, maxAmount, onSave, onRemove }: { allocation: AllocationRecord; payment: PaymentRecord | undefined; currency: string; disabled: boolean; maxAmount: number; onSave: (amount: number) => void; onRemove: () => void; }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(allocation.amount));
  useEffect(() => { setAmount(String(allocation.amount)); }, [allocation.amount]);
  return <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{payment?.payment_number ?? "Payment"}</p><p className="mt-1 text-xs text-slate-400">{payment ? `${formatStatus(payment.status)} · ${formatDate(payment.payment_date)}` : formatDate(allocation.created_at)}</p></div>{editing ? <div className="flex items-center gap-2"><input type="number" min="0.01" step="0.01" max={maxAmount} value={amount} onChange={(e) => setAmount(e.target.value)} className="h-9 w-32 rounded-lg border border-slate-200 px-3 text-sm" /><button type="button" onClick={() => { const n = Number(amount); if (Number.isFinite(n) && n > 0) { onSave(n); setEditing(false); } }} disabled={disabled} className="inline-flex h-9 items-center gap-1 rounded-lg bg-MojaSchoolr-600 px-3 text-xs font-semibold text-white"><Save size={13} />Save</button><button type="button" onClick={() => setEditing(false)} disabled={disabled} className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600">Cancel</button></div> : <div className="flex items-center gap-3"><p className="text-sm font-semibold text-slate-800">{formatMoney(allocation.amount, currency)}</p><button type="button" onClick={() => setEditing(true)} disabled={disabled} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"><Edit3 size={14} /></button><button type="button" onClick={onRemove} disabled={disabled} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"><Unlink2 size={14} /></button></div>}</div>;
}

function AllocationForm({ invoice, payments, allocations, onClose, onSave, saving }: { invoice: InvoiceWithRelations; payments: PaymentRecord[]; allocations: AllocationRecord[]; onClose: () => void; onSave: (paymentId: string, amount: number) => void; saving: boolean; }) {
  const [paymentId, setPaymentId] = useState("");
  const [amount, setAmount] = useState("");
  const availablePayments = useMemo(() => payments.filter((payment) => payment.school_id === invoice.school_id && payment.currency === invoice.currency && ["pending", "confirmed"].includes(payment.status)).map((payment) => { const allocated = allocations.filter((item) => item.payment_id === payment.id).reduce((sum, item) => sum + Number(item.amount), 0); return { payment, available: Number(payment.amount) - allocated }; }).filter((item) => item.available > 0), [payments, allocations, invoice.school_id, invoice.currency]);
  useEffect(() => { if (!paymentId && availablePayments[0]) { setPaymentId(availablePayments[0].payment.id); setAmount(String(Math.min(availablePayments[0].available, invoice.balance))); } }, [paymentId, availablePayments, invoice.balance]);
  useEffect(() => { const item = availablePayments.find((entry) => entry.payment.id === paymentId); if (item && !amount) setAmount(String(Math.min(item.available, invoice.balance))); }, [paymentId, availablePayments, invoice.balance, amount]);
  const selected = availablePayments.find((entry) => entry.payment.id === paymentId);
  function submit(e: FormEvent) { e.preventDefault(); const n = Number(amount); if (!selected) return; if (!Number.isFinite(n) || n <= 0) return; onSave(paymentId, n); }
  return <Modal title="Allocate payment" onClose={onClose}><form onSubmit={submit} className="space-y-4"><FormRow label="Payment"><select value={paymentId} onChange={(e) => { setPaymentId(e.target.value); setAmount(""); }} className={inputClass}><option value="">Select payment</option>{availablePayments.map((entry) => <option key={entry.payment.id} value={entry.payment.id}>{entry.payment.payment_number} · Available {formatMoney(entry.available, entry.payment.currency)}</option>)}</select></FormRow><div className="grid gap-4 sm:grid-cols-2"><FormRow label="Amount"><input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} /></FormRow><FormRow label="Invoice balance"><input value={formatMoney(invoice.balance, invoice.currency)} readOnly className={`${inputClass} bg-slate-50`} /></FormRow></div>{selected && <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">Payment has {formatMoney(selected.available, selected.payment.currency)} available for allocation.</div>}<div className="flex justify-end gap-2 pt-2"><button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600">Cancel</button><button type="submit" disabled={saving || !selected} className="inline-flex h-10 items-center gap-2 rounded-lg bg-MojaSchoolr-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving && <Loader2 size={15} className="animate-spin" />}Allocate payment</button></div></form></Modal>;
}

function InvoiceEditModal({ invoice, subscriptions, allocatedAmount, onClose, onSaved }: { invoice: InvoiceRecord; subscriptions: SubscriptionRecord[]; allocatedAmount: number; onClose: () => void; onSaved: () => void; }) {
  const schoolId = invoice.school_id;
  const [subscriptionId, setSubscriptionId] = useState(invoice.subscription_id || "");
  const [invoiceNumber, setInvoiceNumber] = useState(invoice.invoice_number);
  const [issueDate, setIssueDate] = useState(invoice.issue_date);
  const [dueDate, setDueDate] = useState(invoice.due_date);
  const [subtotal, setSubtotal] = useState(String(invoice.subtotal));
  const [tax, setTax] = useState(String(invoice.tax));
  const [discount, setDiscount] = useState(String(invoice.discount));
  const [currency, setCurrency] = useState(invoice.currency);
  const [status, setStatus] = useState<InvoiceStatus>(invoice.status);
  const [notes, setNotes] = useState(invoice.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const filteredSubscriptions = subscriptions.filter((subscription) => subscription.school_id === schoolId);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const subtotalNumber = Number(subtotal);
    const taxNumber = Number(tax || 0);
    const discountNumber = Number(discount || 0);
    const total = Math.max(0, subtotalNumber + taxNumber - discountNumber);
    if (!invoiceNumber.trim()) return setError("Invoice number is required.");
    if (!issueDate || !dueDate) return setError("Issue and due dates are required.");
    if (dueDate < issueDate) return setError("Due date cannot be before the issue date.");
    if (!Number.isFinite(subtotalNumber) || subtotalNumber < 0) return setError("Subtotal cannot be negative.");
    if (discountNumber > subtotalNumber + taxNumber) return setError("Discount cannot exceed the invoice amount.");
    if (total < allocatedAmount) {
      return setError(`Invoice total cannot be lower than its allocated payments of ${formatMoney(allocatedAmount, invoice.currency)}.`);
    }
    if (allocatedAmount > 0 && currency !== invoice.currency) {
      return setError("Currency cannot be changed while the invoice has payment allocations.");
    }
    setSaving(true);
    try {
      const { error: updateError } = await supabase.from("platform_invoices").update({ invoice_number: invoiceNumber.trim(), subscription_id: subscriptionId || null, issue_date: issueDate, due_date: dueDate, subtotal: subtotalNumber, tax: taxNumber, discount: discountNumber, total, currency, status, notes: notes.trim() || null }).eq("id", invoice.id);
      if (updateError) throw updateError;
      onSaved();
    } catch (updateError) {
      console.error("Failed to edit MojaSchool invoice:", updateError);
      setError(updateError instanceof Error ? updateError.message : "Could not update invoice.");
    } finally {
      setSaving(false);
    }
  }
  return <Modal title={`Edit ${invoice.invoice_number}`} onClose={onClose}><form onSubmit={submit} className="space-y-4"><div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">School: <span className="font-semibold text-slate-700">{schoolId}</span></div><FormRow label="Subscription (optional)"><select value={subscriptionId} onChange={(e) => setSubscriptionId(e.target.value)} className={inputClass}><option value="">No subscription link</option>{filteredSubscriptions.map((subscription) => <option key={subscription.id} value={subscription.id}>{subscription.id} · {formatMoney(subscription.price, subscription.currency)}</option>)}</select></FormRow><div className="grid gap-4 sm:grid-cols-2"><FormRow label="Invoice number"><input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className={inputClass} /></FormRow><FormRow label="Currency"><input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} className={inputClass} /></FormRow><FormRow label="Issue date"><input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={inputClass} /></FormRow><FormRow label="Due date"><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass} /></FormRow><FormRow label="Subtotal"><input type="number" min="0" step="0.01" value={subtotal} onChange={(e) => setSubtotal(e.target.value)} className={inputClass} /></FormRow><FormRow label="Tax"><input type="number" min="0" step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} className={inputClass} /></FormRow><FormRow label="Discount"><input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} className={inputClass} /></FormRow><FormRow label="Status"><select value={status} onChange={(e) => setStatus(e.target.value as InvoiceStatus)} className={inputClass}>{["draft","issued","partially_paid","paid","overdue","cancelled"].map((item) => <option key={item} value={item}>{formatStatus(item)}</option>)}</select></FormRow></div><FormRow label="Notes"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={`${inputClass} py-2.5`} /></FormRow>{error && <InlineError message={error} />}<div className="flex justify-end gap-2 pt-2"><button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600">Cancel</button><button type="submit" disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-MojaSchoolr-600 px-4 text-sm font-semibold text-white disabled:opacity-60">{saving && <Loader2 size={15} className="animate-spin" />}Save changes</button></div></form></Modal>;
}

function PaymentDetail({
  payment,
  invoices,
  allocations,
  processing,
  setProcessing,
  error,
  success,
  onBack,
  onRefresh,
}: {
  payment: PaymentWithRelations;
  invoices: InvoiceWithRelations[];
  allocations: AllocationRecord[];
  processing: boolean;
  setProcessing: (value: boolean) => void;
  error: string;
  success: string;
  onBack: () => void;
  onRefresh: () => void;
}) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(payment.payment_method);
  const [amount, setAmount] = useState(String(payment.amount));
  const [paymentDate, setPaymentDate] = useState(payment.payment_date);
  const [reference, setReference] = useState(payment.reference || "");
  const [provider, setProvider] = useState(payment.provider || "");
  const [transactionId, setTransactionId] = useState(payment.provider_transaction_id || "");
  const [status, setStatus] = useState<PaymentStatus>(payment.status);
  const [notes, setNotes] = useState(payment.notes || "");
  const [localError, setLocalError] = useState("");
  const [localSuccess, setLocalSuccess] = useState("");

  const paymentAllocations = allocations.filter((allocation) => allocation.payment_id === payment.id);
  const allocatedAmount = paymentAllocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0);

  useEffect(() => {
    setPaymentMethod(payment.payment_method);
    setAmount(String(payment.amount));
    setPaymentDate(payment.payment_date);
    setReference(payment.reference || "");
    setProvider(payment.provider || "");
    setTransactionId(payment.provider_transaction_id || "");
    setStatus(payment.status);
    setNotes(payment.notes || "");
  }, [payment]);

  async function savePayment() {
    const amountNumber = Number(amount);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
      setLocalError("Payment amount must be greater than 0.");
      return;
    }
    if (amountNumber < allocatedAmount) {
      setLocalError(`Payment amount cannot be below its allocated amount of ${formatMoney(allocatedAmount, payment.currency)}.`);
      return;
    }
    setProcessing(true);
    setLocalError("");
    setLocalSuccess("");
    try {
      const { error: updateError } = await supabase.from("platform_payments").update({
        payment_method: paymentMethod,
        amount: amountNumber,
        payment_date: paymentDate,
        reference: reference.trim() || null,
        provider: provider.trim() || null,
        provider_transaction_id: transactionId.trim() || null,
        status,
        notes: notes.trim() || null,
      }).eq("id", payment.id);
      if (updateError) throw updateError;
      setLocalSuccess("Payment updated successfully.");
      onRefresh();
    } catch (updateError) {
      console.error("Failed to update MojaSchool payment:", updateError);
      setLocalError(updateError instanceof Error ? updateError.message : "Could not update payment.");
    } finally {
      setProcessing(false);
    }
  }

  async function removeAllocation(allocationId: string) {
    const allocation = paymentAllocations.find((item) => item.id === allocationId);
    if (!allocation) return;
    if (!window.confirm("Remove this payment allocation? The invoice balance will be recalculated.")) return;
    setProcessing(true);
    setLocalError("");
    setLocalSuccess("");
    try {
      const { error: deleteError } = await supabase.from("platform_payment_allocations").delete().eq("id", allocationId);
      if (deleteError) throw deleteError;
      const invoice = invoices.find((item) => item.id === allocation.invoice_id);
      if (invoice) await syncInvoiceStatus(invoice, allocations.filter((item) => item.id !== allocationId));
      setLocalSuccess("Payment allocation removed.");
      onRefresh();
    } catch (deleteError) {
      console.error("Failed to remove payment allocation:", deleteError);
      setLocalError(deleteError instanceof Error ? deleteError.message : "Could not remove payment allocation.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold text-MojaSchoolr-600 hover:text-MojaSchoolr-700"><ArrowLeft size={16} />Back to billing</button>
      <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight text-MojaSchoolr-text sm:text-3xl">{payment.payment_number}</h1><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${paymentStatusClasses(payment.status)}`}>{formatStatus(payment.status)}</span></div><p className="mt-2 text-sm text-MojaSchoolr-text-secondary">{payment.school?.name ?? "Unknown school"} · {formatDate(payment.payment_date)}</p></div><div className="text-left lg:text-right"><p className="text-xs uppercase tracking-[0.08em] text-slate-400">Payment amount</p><p className="mt-1 text-2xl font-semibold text-slate-900">{formatMoney(payment.amount, payment.currency)}</p></div></div>
      {error && <AlertMessage tone="error" message={error} />} {success && <AlertMessage tone="success" message={success} />} {localError && <AlertMessage tone="error" message={localError} />} {localSuccess && <AlertMessage tone="success" message={localSuccess} />}
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <InfoCard title="Payment details" icon={ReceiptText}><InfoGrid><InfoItem label="Payment number" value={payment.payment_number} /><InfoItem label="School" value={payment.school?.name ?? "Unknown school"} /><InfoItem label="Payment method" value={formatStatus(payment.payment_method)} /><InfoItem label="Payment date" value={formatDate(payment.payment_date)} /><InfoItem label="Reference" value={payment.reference || "—"} /><InfoItem label="Provider" value={payment.provider || "—"} /><InfoItem label="Provider transaction ID" value={payment.provider_transaction_id || "—"} /><InfoItem label="Currency" value={payment.currency} /></InfoGrid></InfoCard>
          <InfoCard title="Payment allocations" icon={WalletCards}>{paymentAllocations.length === 0 ? <EmptyState title="No allocations" description="This payment is currently unallocated." /> : <div className="divide-y divide-slate-100">{paymentAllocations.map((allocation) => { const invoice = invoices.find((item) => item.id === allocation.invoice_id); return <div key={allocation.id} className="flex items-center justify-between gap-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{invoice?.invoice_number ?? "Invoice"}</p><p className="mt-1 text-xs text-slate-400">{invoice?.school?.name ?? "Unknown school"} · {formatDate(allocation.created_at)}</p></div><div className="flex items-center gap-3"><p className="text-sm font-semibold text-slate-800">{formatMoney(allocation.amount, payment.currency)}</p><button type="button" onClick={() => void removeAllocation(allocation.id)} disabled={processing} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"><Unlink2 size={14} /></button></div></div>; })}</div>}</InfoCard>
        </div>
        <div className="h-fit xl:sticky xl:top-24"><section className="rounded-xl border border-MojaSchoolr-border bg-white shadow-sm"><div className="border-b border-MojaSchoolr-border px-5 py-4"><div className="flex items-center gap-2"><Edit3 size={17} className="text-MojaSchoolr-600" /><h2 className="text-base font-semibold text-MojaSchoolr-text">Edit payment</h2></div></div><div className="space-y-4 p-5"><FormRow label="Amount"><input type="number" min={allocatedAmount} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} /></FormRow><FormRow label="Payment method"><select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)} className={inputClass}>{PAYMENT_METHODS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></FormRow><FormRow label="Payment date"><input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className={inputClass} /></FormRow><FormRow label="Reference"><input value={reference} onChange={(e) => setReference(e.target.value)} className={inputClass} /></FormRow><FormRow label="Provider"><input value={provider} onChange={(e) => setProvider(e.target.value)} className={inputClass} /></FormRow><FormRow label="Provider transaction ID"><input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} className={inputClass} /></FormRow><FormRow label="Status"><select value={status} onChange={(e) => setStatus(e.target.value as PaymentStatus)} className={inputClass}>{PAYMENT_STATUSES.filter((item) => item.value !== "all").map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></FormRow><FormRow label="Notes"><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={`${inputClass} py-2.5`} /></FormRow><button type="button" onClick={() => void savePayment()} disabled={processing} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-MojaSchoolr-600 px-4 text-sm font-semibold text-white hover:bg-MojaSchoolr-700 disabled:cursor-not-allowed disabled:opacity-50">{processing ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}Save payment changes</button></div></section><div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-400"><MetaLine label="Payment ID" value={payment.id} /><MetaLine label="Allocated" value={formatMoney(allocatedAmount, payment.currency)} /><MetaLine label="Unallocated" value={formatMoney(Math.max(0, Number(payment.amount) - allocatedAmount), payment.currency)} /></div></div>
      </div>
    </div>
  );
}

function InvoiceForm({
  companyId,
  schools,
  subscriptions,
  plans,
  onClose,
  onCreated,
}: {
  companyId: string;
  schools: SchoolRecord[];
  subscriptions: SubscriptionRecord[];
  plans: PlanRecord[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [schoolId, setSchoolId] = useState("");
  const [subscriptionId, setSubscriptionId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState(getToday());
  const [dueDate, setDueDate] = useState(getToday());
  const [subtotal, setSubtotal] = useState("");
  const [tax, setTax] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [currency, setCurrency] = useState("RWF");
  const [status, setStatus] = useState<InvoiceStatus>("issued");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const schoolSubscriptions = useMemo(
    () => subscriptions.filter((subscription) => subscription.school_id === schoolId),
    [subscriptions, schoolId],
  );

  useEffect(() => {
    if (!invoiceNumber) {
      setInvoiceNumber(`MojaSchool-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`);
    }
  }, [invoiceNumber]);

  useEffect(() => {
    const subscription = subscriptions.find((item) => item.id === subscriptionId);
    if (subscription) {
      setCurrency(subscription.currency);
      if (!subtotal) setSubtotal(String(subscription.price));
    }
  }, [subscriptionId, subscriptions, subtotal]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const subtotalNumber = Number(subtotal);
    const taxNumber = Number(tax || 0);
    const discountNumber = Number(discount || 0);
    const total = Math.max(0, subtotalNumber + taxNumber - discountNumber);
    if (!schoolId) return setError("Please select a school.");
    if (!invoiceNumber.trim()) return setError("Invoice number is required.");
    if (!issueDate || !dueDate) return setError("Issue and due dates are required.");
    if (!Number.isFinite(subtotalNumber) || subtotalNumber <= 0) return setError("Subtotal must be greater than 0.");
    if (dueDate < issueDate) return setError("Due date cannot be before the issue date.");
    if (!companyId) return setError("MojaSchool company record is not configured.");
    setSaving(true);
    try {
      const { error: insertError } = await supabase.from("platform_invoices").insert({
        invoice_number: invoiceNumber.trim(),
        company_id: companyId,
        school_id: schoolId,
        subscription_id: subscriptionId || null,
        issue_date: issueDate,
        due_date: dueDate,
        subtotal: subtotalNumber,
        tax: taxNumber,
        discount: discountNumber,
        total,
        currency,
        status,
        notes: notes.trim() || null,
      });
      if (insertError) throw insertError;
      onCreated();
    } catch (insertError) {
      console.error("Failed to create MojaSchool invoice:", insertError);
      setError(insertError instanceof Error ? insertError.message : "Could not create invoice.");
    } finally {
      setSaving(false);
    }
  }

  return <Modal title="Create invoice" onClose={onClose}><form onSubmit={submit} className="space-y-4"><FormRow label="School"><select value={schoolId} onChange={(event) => { setSchoolId(event.target.value); setSubscriptionId(""); }} className={inputClass}><option value="">Select school</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></FormRow><FormRow label="Subscription (optional)"><select value={subscriptionId} onChange={(event) => setSubscriptionId(event.target.value)} className={inputClass}><option value="">No subscription link</option>{schoolSubscriptions.map((subscription) => { const plan = plans.find((item) => item.id === subscription.plan_id); return <option key={subscription.id} value={subscription.id}>{plan?.name ?? "Subscription"} · {formatMoney(subscription.price, subscription.currency)}</option>; })}</select></FormRow><div className="grid gap-4 sm:grid-cols-2"><FormRow label="Invoice number"><input value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} className={inputClass} /></FormRow><FormRow label="Currency"><input value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} className={inputClass} maxLength={3} /></FormRow><FormRow label="Issue date"><input type="date" value={issueDate} onChange={(event) => setIssueDate(event.target.value)} className={inputClass} /></FormRow><FormRow label="Due date"><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={inputClass} /></FormRow><FormRow label="Subtotal"><input type="number" min="0" step="0.01" value={subtotal} onChange={(event) => setSubtotal(event.target.value)} className={inputClass} /></FormRow><FormRow label="Tax"><input type="number" min="0" step="0.01" value={tax} onChange={(event) => setTax(event.target.value)} className={inputClass} /></FormRow><FormRow label="Discount"><input type="number" min="0" step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} className={inputClass} /></FormRow><FormRow label="Status"><select value={status} onChange={(event) => setStatus(event.target.value as InvoiceStatus)} className={inputClass}>{["draft", "issued", "cancelled", "void"].map((item) => <option key={item} value={item}>{formatStatus(item)}</option>)}</select></FormRow></div><FormRow label="Notes"><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className={`${inputClass} py-2.5`} placeholder="Optional billing note" /></FormRow>{error && <InlineError message={error} />}<div className="flex justify-end gap-2 pt-2"><button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button><button type="submit" disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-MojaSchoolr-600 px-4 text-sm font-semibold text-white hover:bg-MojaSchoolr-700 disabled:cursor-not-allowed disabled:opacity-60">{saving && <Loader2 size={15} className="animate-spin" />}Create invoice</button></div></form></Modal>;
}

function PaymentForm({
  companyId,
  schools,
  invoices,
  onClose,
  onCreated,
}: {
  companyId: string;
  schools: SchoolRecord[];
  invoices: InvoiceWithRelations[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [schoolId, setSchoolId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [paymentDate, setPaymentDate] = useState(getToday());
  const [reference, setReference] = useState("");
  const [provider, setProvider] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [status, setStatus] = useState<PaymentStatus>("confirmed");
  const [currency, setCurrency] = useState("RWF");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const schoolInvoices = useMemo(
    () => invoices.filter((invoice) => invoice.school_id === schoolId && invoice.balance > 0 && ["issued", "partially_paid", "overdue"].includes(invoice.status)),
    [invoices, schoolId],
  );

  useEffect(() => {
    const invoice = invoices.find((item) => item.id === invoiceId);
    if (invoice) {
      setCurrency(invoice.currency);
      if (!amount) setAmount(String(invoice.balance));
    }
  }, [invoiceId, invoices, amount]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const amountNumber = Number(amount);
    const selectedInvoice = invoiceId ? invoices.find((invoice) => invoice.id === invoiceId) : null;
    if (!schoolId) return setError("Please select a school.");
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) return setError("Payment amount must be greater than 0.");
    if (selectedInvoice && amountNumber > selectedInvoice.balance) return setError(`Payment cannot exceed the invoice balance of ${formatMoney(selectedInvoice.balance, selectedInvoice.currency)}.`);
    if (!companyId) return setError("MojaSchool company record is not configured.");
    setSaving(true);
    try {
      const paymentNumber = `PAY-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      const { data: payment, error: paymentError } = await supabase.from("platform_payments").insert({
        payment_number: paymentNumber,
        company_id: companyId,
        school_id: schoolId,
        payment_method: method,
        amount: amountNumber,
        currency,
        payment_date: paymentDate,
        reference: reference.trim() || null,
        provider: provider.trim() || null,
        provider_transaction_id: transactionId.trim() || null,
        status,
        notes: notes.trim() || null,
      }).select("id").single();
      if (paymentError) throw paymentError;
      if (invoiceId && payment?.id) {
        const { error: allocationError } = await supabase.from("platform_payment_allocations").insert({
          payment_id: payment.id,
          invoice_id: invoiceId,
          amount: amountNumber,
        });
        if (allocationError) {
          await supabase.from("platform_payments").delete().eq("id", payment.id);
          throw allocationError;
        }
      }
      onCreated();
    } catch (insertError) {
      console.error("Failed to record MojaSchool payment:", insertError);
      setError(insertError instanceof Error ? insertError.message : "Could not record payment.");
    } finally {
      setSaving(false);
    }
  }

  return <Modal title="Record payment" onClose={onClose}><form onSubmit={submit} className="space-y-4"><FormRow label="School"><select value={schoolId} onChange={(event) => { setSchoolId(event.target.value); setInvoiceId(""); setAmount(""); }} className={inputClass}><option value="">Select school</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select></FormRow><FormRow label="Allocate to invoice (optional)"><select value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)} className={inputClass}><option value="">Unallocated payment</option>{schoolInvoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoice_number} · Balance {formatMoney(invoice.balance, invoice.currency)}</option>)}</select></FormRow><div className="grid gap-4 sm:grid-cols-2"><FormRow label="Amount"><input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className={inputClass} /></FormRow><FormRow label="Currency"><input value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} className={inputClass} maxLength={3} /></FormRow><FormRow label="Payment method"><select value={method} onChange={(event) => setMethod(event.target.value as PaymentMethod)} className={inputClass}>{PAYMENT_METHODS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></FormRow><FormRow label="Payment date"><input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} className={inputClass} /></FormRow><FormRow label="Reference"><input value={reference} onChange={(event) => setReference(event.target.value)} className={inputClass} placeholder="Optional reference" /></FormRow><FormRow label="Provider"><input value={provider} onChange={(event) => setProvider(event.target.value)} className={inputClass} placeholder="Flutterwave, bank, etc." /></FormRow><FormRow label="Provider transaction ID"><input value={transactionId} onChange={(event) => setTransactionId(event.target.value)} className={inputClass} /></FormRow><FormRow label="Status"><select value={status} onChange={(event) => setStatus(event.target.value as PaymentStatus)} className={inputClass}>{PAYMENT_STATUSES.slice(1).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></FormRow></div><FormRow label="Notes"><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className={`${inputClass} py-2.5`} /></FormRow>{error && <InlineError message={error} />}<div className="flex justify-end gap-2 pt-2"><button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button><button type="submit" disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-lg bg-MojaSchoolr-600 px-4 text-sm font-semibold text-white hover:bg-MojaSchoolr-700 disabled:cursor-not-allowed disabled:opacity-60">{saving && <Loader2 size={15} className="animate-spin" />}Record payment</button></div></form></Modal>;
}

function Toolbar({
  search,
  onSearch,
  placeholder,
  filter,
  filterOptions,
  onFilter,
}: {
  search: string;
  onSearch: (value: string) => void;
  placeholder: string;
  filter: string;
  filterOptions: Array<{ value: string; label: string }>;
  onFilter: (value: never) => void;
}) {
  return <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div className="relative w-full sm:max-w-md"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={placeholder} className="h-10 w-full rounded-lg border border-MojaSchoolr-border bg-white pl-10 pr-4 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-MojaSchoolr-500 focus:ring-2 focus:ring-MojaSchoolr-100" /></div><div className="flex flex-wrap items-center gap-2"><Filter size={15} className="text-slate-400" />{filterOptions.map((item) => <button key={item.value} type="button" onClick={() => onFilter(item.value as never)} className={[
    "rounded-lg px-3 py-2 text-xs font-semibold transition",
    filter === item.value ? "bg-MojaSchoolr-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
  ].join(" ")}>{item.label}</button>)}</div></div>;
}

function SummaryCard({ label, value, caption, icon: Icon }: { label: string; value: string; caption: string; icon: typeof WalletCards }) {
  return <div className="rounded-xl border border-MojaSchoolr-border bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-xs font-medium text-MojaSchoolr-text-secondary">{label}</p><p className="mt-2 truncate text-xl font-semibold tracking-tight text-MojaSchoolr-text sm:text-2xl">{value}</p><p className="mt-1 text-[11px] text-slate-400">{caption}</p></div><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-MojaSchoolr-50 text-MojaSchoolr-600"><Icon size={18} /></div></div></div>;
}

function SectionHeader({ title, icon: Icon, actionLabel, onAction }: { title: string; icon: typeof FileText; actionLabel?: string; onAction?: () => void }) {
  return <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-5"><div className="flex items-center gap-2"><Icon size={17} className="text-MojaSchoolr-600" /><h2 className="text-sm font-semibold text-slate-800">{title}</h2></div>{actionLabel && onAction && <button type="button" onClick={onAction} className="text-xs font-semibold text-MojaSchoolr-600 hover:text-MojaSchoolr-700">{actionLabel}</button>}</div>;
}

function InfoCard({ title, icon: Icon, children }: { title: string; icon: typeof FileText; children: ReactNode }) {
  return <section className="rounded-xl border border-MojaSchoolr-border bg-white shadow-sm"><div className="flex items-center gap-2 border-b border-MojaSchoolr-border px-5 py-4"><Icon size={17} className="text-MojaSchoolr-600" /><h2 className="text-base font-semibold text-MojaSchoolr-text">{title}</h2></div><div className="p-5">{children}</div></section>;
}

function InfoGrid({ children }: { children: ReactNode }) { return <div className="grid gap-4 sm:grid-cols-2">{children}</div>; }
function InfoItem({ label, value }: { label: string; value: ReactNode }) { return <div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p><div className="mt-1 break-words text-sm text-slate-800">{value}</div></div>; }
function AmountLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div className="flex items-center justify-between gap-4"><span className={strong ? "text-sm font-semibold text-slate-800" : "text-sm text-slate-500"}>{label}</span><span className={strong ? "text-sm font-semibold text-slate-900" : "text-sm font-medium text-slate-800"}>{value}</span></div>; }
function MetaLine({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-4"><span>{label}</span><span className="break-all text-right text-slate-600">{value}</span></div>; }

function AlertMessage({ tone, message }: { tone: "error" | "success"; message: string }) {
  const isError = tone === "error";
  return <div className={[
    "mt-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
    isError ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700",
  ].join(" ")}>{isError ? <AlertCircle size={17} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={17} className="mt-0.5 shrink-0" />}<span>{message}</span></div>;
}
function InlineError({ message }: { message: string }) { return <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"><AlertCircle size={16} className="mt-0.5 shrink-0" /><span>{message}</span></div>; }
function EmptyBlock({ title, description }: { title: string; description: string }) { return <div className="px-4 py-10 text-center"><p className="text-sm font-semibold text-slate-700">{title}</p><p className="mt-1 text-sm text-slate-500">{description}</p></div>; }
function EmptyTable({ colSpan, title }: { colSpan: number; title: string }) { return <tr><td colSpan={colSpan} className="px-5 py-12 text-center text-sm text-slate-500">{title}</td></tr>; }
function LoadingTable({ colSpan, label }: { colSpan: number; label: string }) { return <tr><td colSpan={colSpan} className="px-5 py-12 text-center text-sm text-slate-500"><span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin" />{label}</span></td></tr>; }
function EmptyState({ title, description }: { title: string; description: string }) { return <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4"><p className="text-sm font-semibold text-slate-700">{title}</p><p className="mt-1 text-sm text-slate-500">{description}</p></div>; }
const inputClass = "h-10 w-full rounded-lg border border-MojaSchoolr-border bg-white px-3 text-sm text-slate-800 outline-none focus:border-MojaSchoolr-500 focus:ring-2 focus:ring-MojaSchoolr-100";
function FormRow({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>{children}</label>; }
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) { return <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/30 p-0 sm:items-center sm:p-6"><div className="w-full max-w-2xl rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><h2 className="text-base font-semibold text-slate-900">{title}</h2><button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={17} /></button></div><div className="max-h-[82vh] overflow-y-auto p-5">{children}</div></div></div>; }
