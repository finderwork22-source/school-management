import { useEffect, useMemo, useState, type ComponentType, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  CreditCard,
  Globe2,
  ExternalLink,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  X,
} from "lucide-react";

import { supabase } from "../../lib/supabase";

type BillingCycle = "monthly" | "quarterly" | "termly" | "annual" | "one_time";

interface CompanyRecord {
  id: string;
  trading_name: string;
  legal_name: string | null;
  registration_number: string | null;
  tax_identification_number: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  default_currency: string;
}

interface PlanRecord {
  id: string;
  name: string;
  description: string | null;
  billing_cycle: BillingCycle;
  amount: number;
  currency: string;
  is_active: boolean;
}

interface PlanFormState {
  name: string;
  description: string;
  billing_cycle: BillingCycle;
  amount: string;
  currency: string;
  is_active: boolean;
}

type SettingsTab = "company" | "subscriptions" | "security";

const BILLING_CYCLES: Array<{ value: BillingCycle; label: string }> = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "termly", label: "Termly" },
  { value: "annual", label: "Annual" },
  { value: "one_time", label: "One time" },
];

function getReadableError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;

  if (error && typeof error === "object") {
    const details = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
    };

    return [
      typeof details.message === "string" ? details.message : "",
      typeof details.details === "string" ? details.details : "",
      typeof details.hint === "string" ? details.hint : "",
    ]
      .filter(Boolean)
      .join(" ") || fallback;
  }

  return fallback;
}

function formatMoney(value: number, currency = "RWF") {
  try {
    return new Intl.NumberFormat("en-RW", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Number.isFinite(value) ? value : 0);
  } catch {
    return `${Math.round(Number(value) || 0).toLocaleString()} ${currency}`;
  }
}

function formatCycle(value: BillingCycle) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function emptyPlanForm(companyCurrency = "RWF"): PlanFormState {
  return {
    name: "",
    description: "",
    billing_cycle: "termly",
    amount: "",
    currency: companyCurrency || "RWF",
    is_active: true,
  };
}

export default function AdminPlatformSettings() {
  const [tab, setTab] = useState<SettingsTab>("company");
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanRecord | null>(null);
  const [companyForm, setCompanyForm] = useState<CompanyRecord | null>(null);
  const [planForm, setPlanForm] = useState<PlanFormState>(emptyPlanForm());

  async function loadSettings(showRefreshState = false) {
    if (showRefreshState) setRefreshing(true);
    else setLoading(true);

    setError("");

    try {
      const [companyResult, plansResult] = await Promise.all([
        supabase
          .from("platform_company")
          .select(
            "id, trading_name, legal_name, registration_number, tax_identification_number, country, city, address, email, phone, default_currency",
          )
          .limit(1)
          .maybeSingle(),
        supabase
          .from("platform_subscription_plans")
          .select("id, name, description, billing_cycle, amount, currency, is_active")
          .order("is_active", { ascending: false })
          .order("amount", { ascending: true })
          .order("name", { ascending: true }),
      ]);

      if (companyResult.error) throw companyResult.error;
      if (plansResult.error) throw plansResult.error;

      const loadedCompany = companyResult.data
        ? (companyResult.data as CompanyRecord)
        : null;

      setCompanyForm(loadedCompany);
      setPlans((plansResult.data ?? []) as PlanRecord[]);

      if (!loadedCompany && plansResult.data?.length === 0) {
        setSuccess("Platform settings are ready to configure.");
      }
    } catch (loadError) {
      console.error("Failed to load WISE platform settings:", loadError);
      setError(getReadableError(loadError, "Could not load platform settings."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  useEffect(() => {
    if (companyForm?.default_currency && !editingPlan) {
      setPlanForm((current) => ({
        ...current,
        currency: current.currency || companyForm.default_currency,
      }));
    }
  }, [companyForm?.default_currency, editingPlan]);

  const activePlans = useMemo(
    () => plans.filter((plan) => plan.is_active),
    [plans],
  );

  const inactivePlans = useMemo(
    () => plans.filter((plan) => !plan.is_active),
    [plans],
  );

  function updateCompanyField<K extends keyof CompanyRecord>(
    field: K,
    value: CompanyRecord[K],
  ) {
    setCompanyForm((current) =>
      current
        ? {
            ...current,
            [field]: value,
          }
        : current,
    );
  }

  async function handleCompanySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!companyForm?.trading_name.trim()) {
      setError("Trading name is required.");
      return;
    }

    if (!companyForm.default_currency.trim()) {
      setError("Default currency is required.");
      return;
    }

    setSavingCompany(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        trading_name: companyForm.trading_name.trim(),
        legal_name: companyForm.legal_name?.trim() || null,
        registration_number: companyForm.registration_number?.trim() || null,
        tax_identification_number:
          companyForm.tax_identification_number?.trim() || null,
        country: companyForm.country?.trim() || null,
        city: companyForm.city?.trim() || null,
        address: companyForm.address?.trim() || null,
        email: companyForm.email?.trim() || null,
        phone: companyForm.phone?.trim() || null,
        default_currency: companyForm.default_currency.trim().toUpperCase(),
      };

      if (companyForm.id) {
        const { data, error: updateError } = await supabase
          .from("platform_company")
          .update(payload)
          .eq("id", companyForm.id)
          .select(
            "id, trading_name, legal_name, registration_number, tax_identification_number, country, city, address, email, phone, default_currency",
          )
          .maybeSingle();

        if (updateError) throw updateError;

        const savedCompany = (data ?? { ...companyForm, ...payload }) as CompanyRecord;
        setCompanyForm(savedCompany);
      } else {
        const { data, error: insertError } = await supabase
          .from("platform_company")
          .insert({ ...payload, singleton_key: true })
          .select(
            "id, trading_name, legal_name, registration_number, tax_identification_number, country, city, address, email, phone, default_currency",
          )
          .single();

        if (insertError) throw insertError;

        const savedCompany = data as CompanyRecord;
        setCompanyForm(savedCompany);
      }

      setSuccess("Platform company settings saved successfully.");
    } catch (saveError) {
      console.error("Failed to save WISE company settings:", saveError);
      setError(getReadableError(saveError, "Could not save company settings."));
    } finally {
      setSavingCompany(false);
    }
  }

  function openCreatePlan() {
    setEditingPlan(null);
    setPlanForm(emptyPlanForm(companyForm?.default_currency || "RWF"));
    setShowPlanModal(true);
    setError("");
    setSuccess("");
  }

  function openEditPlan(plan: PlanRecord) {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      description: plan.description ?? "",
      billing_cycle: plan.billing_cycle,
      amount: String(plan.amount),
      currency: plan.currency,
      is_active: plan.is_active,
    });
    setShowPlanModal(true);
    setError("");
    setSuccess("");
  }

  function closePlanModal() {
    if (savingPlan) return;
    setShowPlanModal(false);
    setEditingPlan(null);
  }

  async function handlePlanSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = planForm.name.trim();
    const amount = Number(planForm.amount);
    const currency = planForm.currency.trim().toUpperCase();

    if (!name) {
      setError("Plan name is required.");
      return;
    }

    if (!Number.isFinite(amount) || amount < 0) {
      setError("Enter a valid plan amount.");
      return;
    }

    if (!currency) {
      setError("Plan currency is required.");
      return;
    }

    setSavingPlan(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        name,
        description: planForm.description.trim() || null,
        billing_cycle: planForm.billing_cycle,
        amount,
        currency,
        is_active: planForm.is_active,
      };

      if (editingPlan) {
        const { error: updateError } = await supabase
          .from("platform_subscription_plans")
          .update(payload)
          .eq("id", editingPlan.id);

        if (updateError) throw updateError;

        setSuccess("Subscription plan updated successfully.");
      } else {
        const { error: insertError } = await supabase
          .from("platform_subscription_plans")
          .insert(payload);

        if (insertError) throw insertError;

        setSuccess("Subscription plan created successfully.");
      }

      closePlanModal();
      await loadSettings(true);
    } catch (saveError) {
      console.error("Failed to save WISE subscription plan:", saveError);
      setError(getReadableError(saveError, "Could not save subscription plan."));
    } finally {
      setSavingPlan(false);
    }
  }

  async function togglePlan(plan: PlanRecord) {
    setError("");
    setSuccess("");

    try {
      const { error: updateError } = await supabase
        .from("platform_subscription_plans")
        .update({ is_active: !plan.is_active })
        .eq("id", plan.id);

      if (updateError) throw updateError;

      setPlans((current) =>
        current.map((item) =>
          item.id === plan.id
            ? { ...item, is_active: !item.is_active }
            : item,
        ),
      );

      setSuccess(
        `${plan.name} ${plan.is_active ? "deactivated" : "activated"} successfully.`,
      );
    } catch (toggleError) {
      console.error("Failed to toggle WISE subscription plan:", toggleError);
      setError(getReadableError(toggleError, "Could not update subscription plan."));
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[420px] w-full max-w-[1440px] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-wiser-text-secondary">
          <Loader2 size={17} className="animate-spin" />
          Loading platform settings...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-wiser-600">
            <Settings2 size={14} />
            WISE platform
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-wiser-text sm:text-3xl">
            Platform settings
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-wiser-text-secondary">
            Configure WISE company details, platform billing defaults and subscription plans.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadSettings(true)}
          disabled={refreshing}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-wiser-border bg-white px-4 text-sm font-semibold text-wiser-text-secondary shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {(error || success) && (
        <div className="mt-5 space-y-3">
          {error && (
            <AlertMessage tone="error" message={error} />
          )}
          {success && (
            <AlertMessage tone="success" message={success} />
          )}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="h-fit rounded-xl border border-wiser-border bg-white p-2 shadow-sm">
          <SettingsNavButton
            active={tab === "company"}
            icon={Building2}
            title="Company"
            description="Business and billing identity"
            onClick={() => setTab("company")}
          />
          <SettingsNavButton
            active={tab === "subscriptions"}
            icon={CreditCard}
            title="Subscription plans"
            description="Plans offered to schools"
            onClick={() => setTab("subscriptions")}
          />
          <SettingsNavButton
            active={tab === "security"}
            icon={ShieldCheck}
            title="Security"
            description="Platform access and controls"
            onClick={() => setTab("security")}
          />
        </aside>

        <main className="min-w-0">
          {tab === "company" && (
            <CompanySettings
              company={companyForm}
              saving={savingCompany}
              onChange={updateCompanyField}
              onSubmit={handleCompanySubmit}
            />
          )}

          {tab === "subscriptions" && (
            <SubscriptionSettings
              plans={plans}
              activePlans={activePlans}
              inactivePlans={inactivePlans}
              onCreate={openCreatePlan}
              onEdit={openEditPlan}
              onToggle={togglePlan}
            />
          )}

          {tab === "security" && <SecuritySettings />}
        </main>
      </div>

      {showPlanModal && (
        <PlanModal
          editingPlan={editingPlan}
          form={planForm}
          saving={savingPlan}
          onChange={setPlanForm}
          onClose={closePlanModal}
          onSubmit={handlePlanSubmit}
        />
      )}
    </div>
  );
}

function CompanySettings({
  company,
  saving,
  onChange,
  onSubmit,
}: {
  company: CompanyRecord | null;
  saving: boolean;
  onChange: <K extends keyof CompanyRecord>(field: K, value: CompanyRecord[K]) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void> | void;
}) {
  if (!company) {
    return (
      <section className="rounded-xl border border-wiser-border bg-white p-5 shadow-sm sm:p-6">
        <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
          <Building2 size={28} className="text-wiser-400" />
          <h2 className="mt-4 text-base font-semibold text-wiser-text">
            WISE company record not found
          </h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-wiser-text-secondary">
            The platform company table is currently empty. Run the platform foundation migration first, then return here to configure the company profile.
          </p>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="rounded-xl border border-wiser-border bg-white shadow-sm">
        <SectionHeader
          icon={Building2}
          title="Company identity"
          description="These details appear as the WISE platform business identity on billing documents."
        />

        <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
          <Field label="Trading name" required>
            <Input
              value={company.trading_name}
              onChange={(value) => onChange("trading_name", value)}
              placeholder="WISE"
            />
          </Field>

          <Field label="Legal name">
            <Input
              value={company.legal_name ?? ""}
              onChange={(value) => onChange("legal_name", value)}
              placeholder="WISE Rwanda Ltd"
            />
          </Field>

          <Field label="Registration number">
            <Input
              value={company.registration_number ?? ""}
              onChange={(value) => onChange("registration_number", value)}
              placeholder="Company registration number"
            />
          </Field>

          <Field label="Tax identification number">
            <Input
              value={company.tax_identification_number ?? ""}
              onChange={(value) => onChange("tax_identification_number", value)}
              placeholder="TIN"
            />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-wiser-border bg-white shadow-sm">
        <SectionHeader
          icon={MapPin}
          title="Business location"
          description="Use the official WISE business address for invoices and platform correspondence."
        />

        <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
          <Field label="Country">
            <Input
              value={company.country ?? ""}
              onChange={(value) => onChange("country", value)}
              placeholder="Rwanda"
              icon={Globe2}
            />
          </Field>

          <Field label="City">
            <Input
              value={company.city ?? ""}
              onChange={(value) => onChange("city", value)}
              placeholder="Kigali"
              icon={MapPin}
            />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Address">
              <Input
                value={company.address ?? ""}
                onChange={(value) => onChange("address", value)}
                placeholder="Street, building, district..."
                icon={MapPin}
              />
            </Field>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-wiser-border bg-white shadow-sm">
        <SectionHeader
          icon={Mail}
          title="Contact and billing defaults"
          description="These values are used for platform correspondence and the default invoice currency."
        />

        <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
          <Field label="Email">
            <Input
              type="email"
              value={company.email ?? ""}
              onChange={(value) => onChange("email", value)}
              placeholder="billing@wise.rw"
              icon={Mail}
            />
          </Field>

          <Field label="Phone">
            <Input
              value={company.phone ?? ""}
              onChange={(value) => onChange("phone", value)}
              placeholder="+250 7xx xxx xxx"
              icon={Phone}
            />
          </Field>

          <Field label="Default currency" required>
            <Input
              value={company.default_currency}
              onChange={(value) => onChange("default_currency", value.toUpperCase())}
              placeholder="RWF"
              maxLength={3}
            />
          </Field>

          <div className="flex items-end">
            <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-wiser-text-muted">
                Current billing currency
              </p>
              <p className="mt-1 text-sm font-semibold text-wiser-text">
                {company.default_currency || "Not set"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-wiser-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-xs leading-5 text-wiser-text-muted">
            Saving company settings updates the platform company record used <br/> by WISE billing.
          </p>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-wiser-600 px-4 text-sm font-semibold text-white transition hover:bg-wiser-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Saving..." : "Save company settings"}
          </button>
        </div>
      </section>
    </form>
  );
}

function SubscriptionSettings({
  plans,
  activePlans,
  inactivePlans,
  onCreate,
  onEdit,
  onToggle,
}: {
  plans: PlanRecord[];
  activePlans: PlanRecord[];
  inactivePlans: PlanRecord[];
  onCreate: () => void;
  onEdit: (plan: PlanRecord) => void;
  onToggle: (plan: PlanRecord) => Promise<void>;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-wiser-border bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-wiser-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-wiser-600">
              Billing catalogue
            </p>
            <h2 className="mt-2 text-base font-semibold text-wiser-text">
              Subscription plans
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-wiser-text-secondary">
              Create and maintain the plans that can be assigned to schools in WISE.
            </p>
          </div>

          <button
            type="button"
            onClick={onCreate}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-wiser-600 px-4 text-sm font-semibold text-white transition hover:bg-wiser-700"
          >
            <Plus size={16} />
            New plan
          </button>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
          <MetricCard label="Total plans" value={plans.length} icon={CreditCard} />
          <MetricCard label="Active plans" value={activePlans.length} icon={CheckCircle2} />
          <MetricCard label="Inactive plans" value={inactivePlans.length} icon={ToggleLeft} />
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-wiser-border bg-white shadow-sm">
        <div className="border-b border-wiser-border px-5 py-4 sm:px-6">
          <h3 className="text-sm font-semibold text-wiser-text">Plan catalogue</h3>
          <p className="mt-1 text-xs text-wiser-text-secondary">
            Plans are reused by school subscriptions and platform invoices.
          </p>
        </div>

        {plans.length === 0 ? (
          <div className="px-5 py-14 text-center sm:px-6">
            <CreditCard size={26} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-wiser-text">No subscription plans yet</p>
            <p className="mt-1 text-sm text-wiser-text-secondary">
              Create the first WISE plan to start assigning subscription pricing to schools.
            </p>
            <button
              type="button"
              onClick={onCreate}
              className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-wiser-border bg-white px-4 text-sm font-semibold text-wiser-text-secondary transition hover:bg-slate-50"
            >
              <Plus size={16} />
              Create plan
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-wiser-border bg-slate-50/70">
                  {[
                    "Plan",
                    "Billing cycle",
                    "Amount",
                    "Currency",
                    "Status",
                    "Actions",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-wiser-text-muted"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-wiser-text">{plan.name}</p>
                      {plan.description && (
                        <p className="mt-1 max-w-[360px] text-xs leading-5 text-wiser-text-secondary">
                          {plan.description}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-wiser-text-secondary">
                      {formatCycle(plan.billing_cycle)}
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-wiser-text">
                      {formatMoney(Number(plan.amount), plan.currency)}
                    </td>
                    <td className="px-5 py-4 text-sm text-wiser-text-secondary">
                      {plan.currency}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={[
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                          plan.is_active
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500",
                        ].join(" ")}
                      >
                        {plan.is_active ? <CheckCircle2 size={12} /> : <ToggleLeft size={12} />}
                        {plan.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onEdit(plan)}
                          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-800"
                        >
                          <Pencil size={14} />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void onToggle(plan)}
                          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-800"
                        >
                          {plan.is_active ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
                          {plan.is_active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function SecuritySettings() {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-wiser-border bg-white shadow-sm">
        <SectionHeader
          icon={ShieldCheck}
          title="Platform access"
          description="WISE Admin accounts are controlled at the platform level and remain separate from school staff roles."
        />

        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <InfoCard
            icon={ShieldCheck}
            title="Platform administrators"
            value="Managed through platform admin access"
            description="WISE Admin is not a school_members role."
          />
          <InfoCard
            icon={Settings2}
            title="Security-sensitive actions"
            value="Protected by platform permissions"
            description="Administrative modules use platform-level access controls."
          />
        </div>
      </section>

      <section className="rounded-xl border border-wiser-border bg-white shadow-sm">
        <SectionHeader
          icon={KeyRound}
          title="Password recovery"
          description="Use Supabase Auth to send a secure password reset email to the current super admin account."
        />

        <div className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-wiser-text">Need to reset the administrator password?</p>
            <p className="mt-1 text-sm leading-6 text-wiser-text-secondary">
              The reset link takes the administrator back to WISE, verifies the recovery session, and lets them choose a new password without storing passwords in the platform database.
            </p>
          </div>

          <a
            href="/admin/forgot-password"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-wiser-border bg-white px-4 text-sm font-semibold text-wiser-text-secondary transition hover:bg-slate-50"
          >
            <KeyRound size={16} />
            Open password recovery
            <ExternalLink size={14} />
          </a>
        </div>
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <AlertCircle size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-900">Authentication remains server-authoritative</h3>
            <p className="mt-1 text-sm leading-6 text-amber-800/80">
              Passwords are managed by Supabase Auth. WISE stores platform-admin identity and authorization separately and does not expose password hashes or credentials in its application tables.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function PlanModal({
  editingPlan,
  form,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  editingPlan: PlanRecord | null;
  form: PlanFormState;
  saving: boolean;
  onChange: Dispatch<SetStateAction<PlanFormState>>;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void> | void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-semibold text-wiser-text">
              {editingPlan ? "Edit subscription plan" : "Create subscription plan"}
            </h2>
            <p className="mt-1 text-xs text-wiser-text-secondary">
              Define the price and billing cycle schools can subscribe to.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={onSubmit}>
          <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
            <div className="sm:col-span-2">
              <Field label="Plan name" required>
                <Input
                  value={form.name}
                  onChange={(value) => onChange((current) => ({ ...current, name: value }))}
                  placeholder="Standard"
                />
              </Field>
            </div>

            <div className="sm:col-span-2">
              <Field label="Description">
                <textarea
                  value={form.description}
                  onChange={(event) =>
                    onChange((current) => ({ ...current, description: event.target.value }))
                  }
                  rows={3}
                  placeholder="Describe what is included in this plan..."
                  className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-wiser-500 focus:ring-2 focus:ring-wiser-100"
                />
              </Field>
            </div>

            <Field label="Billing cycle" required>
              <select
                value={form.billing_cycle}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    billing_cycle: event.target.value as BillingCycle,
                  }))
                }
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-wiser-500 focus:ring-2 focus:ring-wiser-100"
              >
                {BILLING_CYCLES.map((cycle) => (
                  <option key={cycle.value} value={cycle.value}>
                    {cycle.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Amount" required>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(value) => onChange((current) => ({ ...current, amount: value }))}
                placeholder="7500"
              />
            </Field>

            <Field label="Currency" required>
              <Input
                value={form.currency}
                onChange={(value) => onChange((current) => ({ ...current, currency: value.toUpperCase() }))}
                placeholder="RWF"
                maxLength={3}
              />
            </Field>

            <div className="flex items-end sm:justify-end">
              <button
                type="button"
                onClick={() =>
                  onChange((current) => ({
                    ...current,
                    is_active: !current.is_active,
                  }))
                }
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
              >
                {form.is_active ? <ToggleRight size={18} className="text-emerald-600" /> : <ToggleLeft size={18} className="text-slate-400" />}
                {form.is_active ? "Active plan" : "Inactive plan"}
              </button>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-wiser-600 px-4 text-sm font-semibold text-white transition hover:bg-wiser-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? "Saving..." : editingPlan ? "Save changes" : "Create plan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SettingsNavButton({
  active,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition",
        active ? "bg-wiser-50 text-wiser-700" : "text-slate-600 hover:bg-slate-50",
      ].join(" ")}
    >
      <div
        className={[
          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          active ? "bg-white text-wiser-600 shadow-sm" : "bg-slate-100 text-slate-500",
        ].join(" ")}
      >
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className={active ? "text-sm font-semibold text-wiser-700" : "text-sm font-semibold text-slate-700"}>
          {title}
        </p>
        <p className="mt-0.5 text-[11px] leading-5 text-slate-400">{description}</p>
      </div>
    </button>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-wiser-border px-5 py-4 sm:px-6">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-wiser-50 text-wiser-600">
        <Icon size={18} />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-wiser-text">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-wiser-text-secondary">{description}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
        {required && <span className="ml-1 text-wiser-600">*</span>}
      </span>
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  icon: Icon,
  maxLength,
  min,
  step,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  maxLength?: number;
  min?: string;
  step?: string;
}) {
  return (
    <div className="relative">
      {Icon && (
        <Icon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      )}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        min={min}
        step={step}
        className={[
          "h-10 w-full rounded-lg border border-slate-200 bg-white text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-wiser-500 focus:ring-2 focus:ring-wiser-100",
          Icon ? "pl-9 pr-3" : "px-3",
        ].join(" ")}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-wiser-600 shadow-sm">
          <Icon size={16} />
        </div>
        <span className="text-2xl font-semibold tracking-tight text-wiser-text">{value}</span>
      </div>
      <p className="mt-3 text-xs font-medium text-wiser-text-secondary">{label}</p>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  value,
  description,
}: {
  icon: ComponentType<{ size?: number; className?: string }>;
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-wiser-600 shadow-sm">
        <Icon size={16} />
      </div>
      <p className="mt-4 text-xs font-medium text-wiser-text-muted">{title}</p>
      <p className="mt-1 text-sm font-semibold text-wiser-text">{value}</p>
      <p className="mt-1 text-xs leading-5 text-wiser-text-secondary">{description}</p>
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
  const success = tone === "success";
  return (
    <div
      className={[
        "rounded-xl border px-4 py-3 text-sm",
        success
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700",
      ].join(" ")}
    >
      <div className="flex items-start gap-2">
        {success ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
        <span>{message}</span>
      </div>
    </div>
  );
}
