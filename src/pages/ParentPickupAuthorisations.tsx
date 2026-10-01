import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Loader2,
  Phone,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";
import { supabase } from "../lib/supabase";

interface Child {
  id: string;
  studentId: string;
  name: string;
  className: string;
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

type ValidityPreset = "day" | "week" | "month" | "custom";

const RELATIONSHIPS = [
  "Parent",
  "Guardian",
  "Grandparent",
  "Uncle",
  "Aunt",
  "Brother",
  "Sister",
  "Family member",
  "Driver",
  "Nanny",
  "Other",
];

function localDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localDateValue(date);
}

function addMonths(dateValue: string, months: number) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setMonth(date.getMonth() + months);
  return localDateValue(date);
}

function formatDate(value: string | null) {
  if (!value) return "No end date";

  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function initialForm() {
  const today = localDateValue(new Date());

  return {
    studentId: "",
    firstName: "",
    lastName: "",
    phone: "",
    relationship: "Parent",
    validity: "day" as ValidityPreset,
    validFrom: today,
    validUntil: today,
  };
}

export default function ParentPickupAuthorisations() {
  const navigate = useNavigate();

  const [children, setChildren] = useState<Child[]>([]);
  const [authorisations, setAuthorisations] = useState<PickupAuthorisation[]>([]);
  const [form, setForm] = useState(initialForm);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    const [childrenResult, authorisationsResult] = await Promise.all([
      supabase.rpc("get_parent_children"),
      supabase.rpc("get_parent_pickup_authorisations"),
    ]);

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

    setChildren(
      ((childrenResult.data ?? []) as ParentChildRpcRow[]).map((item) => ({
        id: item.student_id,
        studentId: item.student_code ?? "",
        name: `${item.first_name ?? ""} ${item.last_name ?? ""}`.trim(),
        className: item.class_name ?? "Unassigned",
      })),
    );

    setAuthorisations(
      ((authorisationsResult.data ?? []) as ParentPickupRpcRow[]).map((item) => ({
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
      })),
    );

    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  const active = useMemo(
    () => authorisations.filter((item) => item.isActive),
    [authorisations],
  );

  const inactive = useMemo(
    () => authorisations.filter((item) => !item.isActive),
    [authorisations],
  );

  function openAdd() {
    setForm(initialForm());
    setError("");
    setSuccess("");
    setShowAdd(true);
  }

  function closeAdd() {
    if (!saving) setShowAdd(false);
  }

  function applyValidity(preset: ValidityPreset) {
    const from = form.validFrom || localDateValue(new Date());

    let until = from;

    if (preset === "week") until = addDays(from, 6);
    if (preset === "month") until = addMonths(from, 1);

    setForm((current) => ({
      ...current,
      validity: preset,
      validUntil: until,
    }));
  }

  function handleFromDateChange(value: string) {
    setForm((current) => {
      let until = current.validUntil;

      if (current.validity === "day") until = value;
      if (current.validity === "week") until = addDays(value, 6);
      if (current.validity === "month") until = addMonths(value, 1);

      return {
        ...current,
        validFrom: value,
        validUntil: until,
      };
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.studentId) {
      setError("Please select a child.");
      return;
    }

    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("Please enter the authorised person's full name.");
      return;
    }

    if (!form.phone.trim()) {
      setError("Phone number is required.");
      return;
    }

    if (!form.validFrom || !form.validUntil) {
      setError("Please select the authorisation dates.");
      return;
    }

    if (form.validUntil < form.validFrom) {
      setError("The end date cannot be before the start date.");
      return;
    }

    setSaving(true);

    const { error: createError } = await supabase.rpc(
      "create_parent_pickup_authorisation",
      {
        p_student_id: form.studentId,
        p_first_name: form.firstName.trim(),
        p_last_name: form.lastName.trim(),
        p_phone: form.phone.trim(),
        p_relationship: form.relationship,
        p_valid_from: form.validFrom,
        p_valid_until: form.validUntil,
      },
    );

    if (createError) {
      console.error("Failed to create pickup authorisation:", createError);
      setError(createError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setShowAdd(false);
    setSuccess("Pickup authorisation created successfully.");
    await loadData();
  }

  async function cancelAuthorisation(item: PickupAuthorisation) {
    const confirmed = window.confirm(
      `Cancel pickup access for ${item.authorisedName} to ${item.studentName}?`,
    );

    if (!confirmed) return;

    setCancellingId(item.id);
    setError("");
    setSuccess("");

    const { error: cancelError } = await supabase.rpc(
      "cancel_parent_pickup_authorisation",
      {
        p_authorisation_id: item.id,
      },
    );

    if (cancelError) {
      console.error("Failed to cancel pickup authorisation:", cancelError);
      setError(cancelError.message);
      setCancellingId(null);
      return;
    }

    setCancellingId(null);
    setSuccess(`${item.authorisedName}'s pickup access has been cancelled.`);
    await loadData();
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        eyebrow="Parent Portal"
        title="Pickup Authorisations"
        description="Tell the school who is allowed to pick up your child when you are unavailable."
        actions={
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-MojaSchoolr-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-MojaSchoolr-700"
          >
            <Plus size={16} />
            Add pickup person
          </button>
        }
      />

      <button
        type="button"
        onClick={() => navigate("/")}
        className="mb-5 text-sm font-medium text-MojaSchoolr-700 hover:text-MojaSchoolr-800"
      >
        ← Back to parent dashboard
      </button>

      {success && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-MojaSchoolr-700" />
            <h2 className="text-sm font-semibold text-slate-900">Active authorisations</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Only active and currently valid authorisations are shown to the Pickup Desk.
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-48 items-center justify-center">
            <Loader2 className="animate-spin text-MojaSchoolr-600" size={22} />
          </div>
        ) : active.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <ShieldCheck size={30} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">No active pickup authorisations</p>
            <p className="mt-1 text-sm text-slate-500">
              Add someone when you need another person to collect your child.
            </p>
            <button
              type="button"
              onClick={openAdd}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-MojaSchoolr-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-MojaSchoolr-700"
            >
              <Plus size={16} />
              Add pickup person
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {active.map((item) => (
              <div key={item.id} className="px-5 py-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                      <UserRound size={20} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">{item.authorisedName}</h3>
                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                          Active
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.relationship} · {item.authorisedPhone}
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-lg bg-slate-50 px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Child</p>
                          <p className="mt-1 text-sm font-medium text-slate-800">{item.studentName}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{item.studentCode} · {item.className}</p>
                        </div>
                        <div className="rounded-lg bg-slate-50 px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Valid</p>
                          <p className="mt-1 text-sm font-medium text-slate-800">
                            {formatDate(item.validFrom)} – {formatDate(item.validUntil)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={cancellingId === item.id}
                    onClick={() => void cancelAuthorisation(item)}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {cancellingId === item.id ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Trash2 size={15} />
                    )}
                    Cancel access
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {inactive.length > 0 && (
        <Card className="mt-5 overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">Previous authorisations</h2>
            <p className="mt-1 text-xs text-slate-500">Cancelled or expired authorisations remain here for your reference.</p>
          </div>
          <div className="divide-y divide-slate-100">
            {inactive.map((item) => (
              <div key={item.id} className="px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <CalendarDays size={17} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700">{item.authorisedName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.relationship} · {item.studentName}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {formatDate(item.validFrom)} – {formatDate(item.validUntil)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:max-h-[90vh] sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Add pickup person</h2>
                <p className="mt-1 text-xs text-slate-500">The school will see this authorisation in the Pickup Desk.</p>
              </div>
              <button
                type="button"
                onClick={closeAdd}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5 sm:px-6">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">Child</label>
                <select
                  value={form.studentId}
                  onChange={(event) => setForm((current) => ({ ...current, studentId: event.target.value }))}
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-MojaSchoolr-500 focus:ring-2 focus:ring-MojaSchoolr-100"
                  required
                >
                  <option value="">Select child</option>
                  {children.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.name} — {child.className}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">First name</label>
                  <input
                    value={form.firstName}
                    onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                    className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-MojaSchoolr-500 focus:ring-2 focus:ring-MojaSchoolr-100"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">Last name</label>
                  <input
                    value={form.lastName}
                    onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                    className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-MojaSchoolr-500 focus:ring-2 focus:ring-MojaSchoolr-100"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">Phone number</label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={form.phone}
                      onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                      className="h-11 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-MojaSchoolr-500 focus:ring-2 focus:ring-MojaSchoolr-100"
                      placeholder="+250 78..."
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">Relationship</label>
                  <select
                    value={form.relationship}
                    onChange={(event) => setForm((current) => ({ ...current, relationship: event.target.value }))}
                    className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-MojaSchoolr-500 focus:ring-2 focus:ring-MojaSchoolr-100"
                  >
                    {RELATIONSHIPS.map((relationship) => (
                      <option key={relationship} value={relationship}>{relationship}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium text-slate-700">How long should this person be authorised?</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {([
                    ["day", "One day"],
                    ["week", "One week"],
                    ["month", "One month"],
                    ["custom", "Custom"],
                  ] as [ValidityPreset, string][]).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => applyValidity(value)}
                      className={[
                        "rounded-lg border px-3 py-2.5 text-xs font-semibold transition",
                        form.validity === value
                          ? "border-MojaSchoolr-300 bg-MojaSchoolr-50 text-MojaSchoolr-700"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">Start date</label>
                  <input
                    type="date"
                    value={form.validFrom}
                    onChange={(event) => handleFromDateChange(event.target.value)}
                    className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-MojaSchoolr-500 focus:ring-2 focus:ring-MojaSchoolr-100"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">End date</label>
                  <input
                    type="date"
                    value={form.validUntil}
                    onChange={(event) => setForm((current) => ({ ...current, validUntil: event.target.value, validity: "custom" }))}
                    min={form.validFrom}
                    className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-MojaSchoolr-500 focus:ring-2 focus:ring-MojaSchoolr-100"
                    required
                  />
                </div>
              </div>

              <div className="rounded-xl border border-MojaSchoolr-100 bg-MojaSchoolr-50 p-3.5 text-xs leading-5 text-MojaSchoolr-800">
                The authorised person will only be visible to the school while this authorisation is active and within these dates. You can cancel access at any time.
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeAdd}
                  className="h-11 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-MojaSchoolr-600 px-5 text-sm font-semibold text-white hover:bg-MojaSchoolr-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {saving ? "Saving..." : "Confirm authorisation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
