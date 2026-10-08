import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  Award,
  Baby,
  BookOpen,
  Building2,
  CheckCircle2,
  Clock3,
  GraduationCap,
  MapPin,
  Mail,
  Phone,
  Send,
  School,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import {
  getMySchoolApplication,
  submitSchoolApplication,
  type SchoolApplication,
} from "../lib/schoolOnboarding";

const APPLICATION_STATUS_LABELS: Record<string, string> = {
  pending: "Pending review",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Not approved",
  cancelled: "Cancelled",
};

const SCHOOL_SECTION_PRESETS: Array<{
  key: string;
  name: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    key: "creche",
    name: "Crèche",
    description: "Early childhood care and development.",
    icon: Baby,
  },
  {
    key: "nursery",
    name: "Nursery",
    description: "Early years learning and foundational academics.",
    icon: BookOpen,
  },
  {
    key: "primary",
    name: "Primary",
    description: "Foundational education and core learning.",
    icon: School,
  },
  {
    key: "lower_secondary",
    name: "Lower Secondary",
    description: "Continued academic development, e.g. Grades 7–9.",
    icon: GraduationCap,
  },
  {
    key: "upper_secondary",
    name: "Upper Secondary",
    description: "Advanced secondary education, e.g. Grades 10–12.",
    icon: Award,
  },
];

const REQUESTED_ROLES = [
  { value: "", label: "Select your role" },
  { value: "owner", label: "Owner" },
  { value: "principal", label: "Principal" },
  { value: "head_of_academics", label: "Head of Academics" },
  { value: "secretary", label: "Secretary" },
  { value: "teacher", label: "Teacher" },
];

export default function SetupSchool() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [schoolName, setSchoolName] = useState("");
  const [schoolType, setSchoolType] = useState("School");
  const [selectedSections, setSelectedSections] = useState<string[]>(["primary"]);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Kigali");
  const [country, setCountry] = useState("Rwanda");
  const [requestedRole, setRequestedRole] = useState("");

  const [application, setApplication] =
    useState<SchoolApplication | null>(null);

  const [loadingApplication, setLoadingApplication] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadApplication() {
      if (!user) {
        if (!cancelled) {
          setLoadingApplication(false);
        }
        return;
      }

      setLoadingApplication(true);
      setError("");

      const { data, error: applicationError } =
        await getMySchoolApplication();

      if (cancelled) return;

      if (applicationError) {
        console.error(
          "Failed to load school application:",
          applicationError,
        );
        setError(
          applicationError.message ||
            "Unable to load your school application.",
        );
        setLoadingApplication(false);
        return;
      }

      if (data) {
        setApplication(data);

        if (data.status === "approved" && data.school_id) {
          navigate("/", { replace: true });
          return;
        }
      }

      setLoadingApplication(false);
    }

    void loadApplication();

    return () => {
      cancelled = true;
    };
  }, [navigate, user]);

  function toggleSection(key: string) {
    setSelectedSections((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  }

  function handleSchoolTypeChange(value: string) {
    setSchoolType(value);

    if (value === "Primary School") {
      setSelectedSections(["primary"]);
    } else if (value === "Secondary School") {
      setSelectedSections(["lower_secondary", "upper_secondary"]);
    } else if (value === "Primary & Secondary") {
      setSelectedSections(["primary", "lower_secondary", "upper_secondary"]);
    } else if (value === "International School") {
      setSelectedSections([
        "creche",
        "nursery",
        "primary",
        "lower_secondary",
      ]);
    } else if (value === "School") {
      setSelectedSections(["primary"]);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");

    if (!user) {
      setError("You must be logged in to submit a school request.");
      return;
    }

    if (!schoolName.trim()) {
      setError("School name is required.");
      return;
    }

    if (!city.trim()) {
      setError("City is required.");
      return;
    }

    if (!country.trim()) {
      setError("Country is required.");
      return;
    }

    if (selectedSections.length === 0) {
      setError("Select at least one school section.");
      return;
    }

    if (
      application &&
      ["pending", "under_review"].includes(application.status)
    ) {
      setError("Your school request is already being reviewed.");
      return;
    }

    setLoading(true);

    const { data, error: submissionError } =
      await submitSchoolApplication({
        schoolName,
        schoolType,
        schoolEmail: email,
        schoolPhone: phone,
        country,
        city,
        address,
        requestedRole: requestedRole || null,
        sections: selectedSections.map((key, index) => ({
          ...SCHOOL_SECTION_PRESETS.find((section) => section.key === key)!,
          enabled: true,
          display_order: index + 1,
        })),
      });

    if (submissionError) {
      console.error(
        "School application submission failed:",
        submissionError,
      );
      setError(
        submissionError.message ||
          "Unable to submit your school request.",
      );
      setLoading(false);
      return;
    }

    if (!data) {
      setError(
        "Your request could not be submitted. Please try again.",
      );
      setLoading(false);
      return;
    }

    setApplication(data);
    setLoading(false);
  }

  if (loadingApplication) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-medium text-slate-600 shadow-sm">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
            Checking your school request...
          </div>
        </div>
      </div>
    );
  }

  const isPending =
    application?.status === "pending" ||
    application?.status === "under_review";

  if (isPending) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-10">
        <div className="mx-auto w-full max-w-3xl">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_60px_-30px_rgba(15,23,42,0.28)]">
            <div className="bg-gradient-to-br from-violet-700 via-violet-600 to-indigo-600 px-6 py-8 text-white sm:px-9 sm:py-10">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20">
                  <Clock3 size={22} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-100">
                    MOJASCHOOL school onboarding
                  </p>
                  <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                    Your school request is being reviewed
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-violet-100 sm:text-base">
                    MOJASCHOOL has received your request. Our administrator will review the school information and assign your school role.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6 p-6 sm:p-9">
              {error && (
                <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertCircle size={17} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex flex-col gap-4 rounded-2xl border border-violet-100 bg-violet-50/70 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-violet-600">Application status</p>
                  <p className="mt-1 text-base font-semibold text-slate-900">
                    {APPLICATION_STATUS_LABELS[application.status] ?? application.status}
                  </p>
                </div>
                <span className="inline-flex w-fit rounded-full bg-white px-3 py-1.5 text-xs font-bold text-violet-700 ring-1 ring-violet-200">
                  {APPLICATION_STATUS_LABELS[application.status] ?? application.status}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <InfoItem icon={Building2} label="School" value={application.school_name} />
                <InfoItem icon={MapPin} label="Location" value={[application.city, application.country].filter(Boolean).join(", ")} />
                <InfoItem icon={Mail} label="Applicant email" value={application.applicant_email} />
                <InfoItem icon={Send} label="Submitted" value={formatDate(application.created_at)} />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
                You can stay on this page or return to the sign-in screen. Once MOJASCHOOL approves your request, your assigned school role will determine the access you receive.
              </div>

              <button type="button" onClick={() => navigate("/login")} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2">
                Return to sign in
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-50 px-3 py-6 sm:px-6 sm:py-10 lg:py-12">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-32 top-20 h-72 w-72 rounded-full bg-violet-200/40 blur-3xl" />
        <div className="absolute -right-32 bottom-10 h-80 w-80 rounded-full bg-indigo-200/30 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-5 flex items-center justify-between gap-4 px-1">
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          >
            <span aria-hidden="true">←</span>
            Back to sign in
          </button>

          <div className="hidden items-center gap-2 sm:flex">
            <span className="h-2 w-2 rounded-full bg-violet-600" />
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">MOJASCHOOL</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_80px_-35px_rgba(15,23,42,0.3)]">
          <div className="border-b border-slate-200 bg-gradient-to-br from-violet-50 via-white to-indigo-50/70 px-5 py-7 sm:px-9 sm:py-9">
            <div className="flex items-start gap-4 sm:gap-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 ring-1 ring-violet-200 sm:h-14 sm:w-14">
                <Building2 size={24} />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">
                  MOJASCHOOL school onboarding
                </p>
                <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                  Request access for your school
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                  Tell us about your school. Our administrator will review your request before the school workspace is activated.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 p-4 sm:space-y-6 sm:p-8 lg:p-9">
            {error && (
              <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-700">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <span className="leading-6">{error}</span>
              </div>
            )}

            {application?.status === "rejected" && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                <p className="font-bold">Your previous request was not approved.</p>
                {application.rejection_reason && <p className="mt-1 leading-6">Reason: {application.rejection_reason}</p>}
                <p className="mt-2 leading-6">Update the information below and submit a new request.</p>
              </div>
            )}

            <OnboardingSection number="1" title="School details" description="Basic information about your school.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="School name" required value={schoolName} onChange={setSchoolName} placeholder="e.g. High Gate International Academy" disabled={loading} />
                <SelectField
                  label="School type"
                  value={schoolType}
                  onChange={handleSchoolTypeChange}
                  disabled={loading}
                  options={[
                    ["School", "School"],
                    ["Primary School", "Primary School"],
                    ["Secondary School", "Secondary School"],
                    ["Primary & Secondary", "Primary & Secondary"],
                    ["International School", "International School"],
                    ["Other", "Other"],
                  ]}
                />
              </div>
            </OnboardingSection>

            <OnboardingSection
              number="2"
              title="School sections / levels offered"
              description="Select every educational section your school operates. You can have multiple sections."
              badge={`${selectedSections.length} selected`}
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {SCHOOL_SECTION_PRESETS.map((section) => {
                  const selected = selectedSections.includes(section.key);
                  const SectionIcon = section.icon;

                  return (
                    <button
                      key={section.key}
                      type="button"
                      onClick={() => toggleSection(section.key)}
                      disabled={loading}
                      aria-pressed={selected}
                      className={[
                        "group relative min-h-[112px] rounded-2xl border p-4 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2",
                        selected
                          ? "border-violet-500 bg-violet-50/70 shadow-sm ring-1 ring-violet-200"
                          : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-violet-200 hover:bg-violet-50/30 hover:shadow-sm",
                      ].join(" ")}
                    >
                      <span className={[
                        "absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-lg border text-xs font-bold transition",
                        selected ? "border-violet-600 bg-violet-600 text-white" : "border-slate-300 bg-white text-transparent",
                      ].join(" ")}>✓</span>
                      <span
                        className={[
                          "flex h-10 w-10 items-center justify-center rounded-xl transition",
                          selected
                            ? "bg-white text-violet-700 ring-1 ring-violet-200"
                            : "bg-slate-100 text-slate-500 group-hover:bg-violet-50 group-hover:text-violet-600",
                        ].join(" ")}
                        aria-hidden="true"
                      >
                        <SectionIcon size={20} strokeWidth={2} />
                      </span>
                      <span className="mt-3 block text-sm font-bold text-slate-900">
                        {section.name}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        {section.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </OnboardingSection>

            <OnboardingSection number="3" title="Location and contact information" description="Where your school is located and how to reach you.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Country" required value={country} onChange={setCountry} placeholder="e.g. Rwanda" disabled={loading} />
                <Field label="City" required value={city} onChange={setCity} placeholder="e.g. Kigali" disabled={loading} />
                <Field label="School phone" value={phone} onChange={setPhone} placeholder="+250 7XX XXX XXX" type="tel" icon={Phone} disabled={loading} />
                <Field label="School email" value={email} onChange={setEmail} placeholder="info@school.com" type="email" icon={Mail} disabled={loading} />
              </div>
              <div className="mt-4">
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Address</label>
                <textarea value={address} onChange={(event) => setAddress(event.target.value)} rows={3} placeholder="School address" disabled={loading} className="min-h-24 w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100 disabled:bg-slate-50" />
              </div>
            </OnboardingSection>

            <OnboardingSection number="4" title="Your role at the school" description="This is the role you are requesting. MOJASCHOOL will review it before approval.">
              <SelectField
                label="Role"
                required
                value={requestedRole}
                onChange={setRequestedRole}
                disabled={loading}
                options={REQUESTED_ROLES.map((role) => [role.value, role.label] as [string, string])}
              />
            </OnboardingSection>

            <div className="rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50 to-indigo-50 px-4 py-4 sm:px-5">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-violet-700 shadow-sm ring-1 ring-violet-100">
                  <CheckCircle2 size={18} />
                </div>
                <p className="text-sm leading-6 text-slate-600">
                  After approval, your assigned school role will determine which school features you can access. Approved Owner, Principal and Head of Academics accounts can invite additional staff through the existing MOJASCHOOL invitation workflow.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between sm:pt-6">
              <button type="button" onClick={() => navigate("/login")} disabled={loading} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
                Back to sign in
              </button>
              <button type="submit" disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:min-w-48">
                {loading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Submitting...</> : <><Send size={16} /> Submit request <span aria-hidden="true">→</span></>}
              </button>
            </div>
          </form>
        </div>

        <p className="mt-4 px-1 text-center text-xs text-slate-400">MOJASCHOOL · School management made simple.</p>
      </div>
    </div>
  );
}

function OnboardingSection({ number, title, description, badge, children }: { number: string; title: string; description: string; badge?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white shadow-sm">{number}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-slate-900 sm:text-base">{title}</h2>
            {badge && <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">{badge}</span>}
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500 sm:text-sm">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function SelectField({ label, value, onChange, options, disabled, required = false }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]>; disabled: boolean; required?: boolean }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-700">{label}{required && <span className="ml-1 text-red-500">*</span>}</label>
      <select required={required} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-900 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100 disabled:bg-slate-50">
        {options.map(([optionValue, optionLabel]) => <option key={optionValue || "empty"} value={optionValue}>{optionLabel}</option>)}
      </select>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  type = "text",
  icon: Icon,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  type?: string;
  icon?: typeof Phone;
  disabled: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-600">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      <div className="relative">
        {Icon && (
          <Icon
            size={16}
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
        )}

        <input
          type={type}
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={[
            "h-11 w-full rounded-xl border border-slate-200 bg-white pr-3 text-sm text-slate-900 outline-none transition",
            "placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100",
            Icon ? "pl-9" : "pl-3",
          ].join(" ")}
        />
      </div>
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400">
        <Icon size={14} />
        {label}
      </div>

      <p className="mt-2 break-words text-sm font-medium text-slate-900">
        {value || "—"}
      </p>
    </div>
  );
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
    }).format(new Date(value));
  } catch {
    return value;
  }
}
