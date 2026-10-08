import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock3,
  MapPin,
  Mail,
  Phone,
  Send,
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

const SCHOOL_SECTION_PRESETS = [
  { key: "creche", name: "Crèche" },
  { key: "nursery", name: "Nursery" },
  { key: "primary", name: "Primary" },
  { key: "lower_secondary", name: "Lower Secondary" },
  { key: "upper_secondary", name: "Upper Secondary" },
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
      <div className="min-h-screen bg-wiser-background px-4 py-10">
        <div className="mx-auto flex min-h-[70vh] max-w-xl items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-wiser-text-secondary">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-wiser-200 border-t-wiser-600" />
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
      <div className="min-h-screen bg-wiser-background px-4 py-10 sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
          <div className="overflow-hidden rounded-2xl border border-wiser-border bg-white shadow-sm">
            <div className="border-b border-wiser-border px-6 py-6 sm:px-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-wiser-50 text-wiser-600">
                  <Clock3 size={22} />
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-wiser-500">
                    WISE school onboarding
                  </p>

                  <h1 className="mt-2 text-xl font-semibold tracking-tight text-wiser-text sm:text-2xl">
                    Your school request is being reviewed
                  </h1>

                  <p className="mt-2 text-sm leading-6 text-wiser-text-secondary">
                    WISE has received your request. A WISE administrator will
                    review the school information and assign your school role.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-5 px-6 py-6 sm:px-8">
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {error}
                </div>
              )}

              <div className="rounded-xl border border-wiser-border bg-wiser-50/50 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-wiser-text-muted">
                      Application status
                    </p>

                    <p className="mt-1 text-sm font-semibold text-wiser-text">
                      {APPLICATION_STATUS_LABELS[
                        application.status
                      ] ?? application.status}
                    </p>
                  </div>

                  <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                    {APPLICATION_STATUS_LABELS[
                      application.status
                    ] ?? application.status}
                  </span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <InfoItem
                  icon={Building2}
                  label="School"
                  value={application.school_name}
                />

                <InfoItem
                  icon={MapPin}
                  label="Location"
                  value={[application.city, application.country]
                    .filter(Boolean)
                    .join(", ")}
                />

                <InfoItem
                  icon={Mail}
                  label="Applicant email"
                  value={application.applicant_email}
                />

                <InfoItem
                  icon={Send}
                  label="Submitted"
                  value={formatDate(application.created_at)}
                />
              </div>

              <div className="rounded-xl border border-dashed border-wiser-border px-4 py-4 text-sm leading-6 text-wiser-text-secondary">
                You can stay on this page or return to the login screen. Once
                WISE approves your request, your assigned school role will
                determine the access you receive.
              </div>

              <button
                type="button"
                onClick={() => navigate("/login")}
                className="h-11 w-full rounded-lg border border-wiser-border bg-white px-4 text-sm font-semibold text-wiser-text transition hover:bg-wiser-50"
              >
                Return to sign in
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-wiser-background px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="overflow-hidden rounded-2xl border border-wiser-border bg-white shadow-sm">
          <div className="border-b border-wiser-border bg-white px-6 py-6 sm:px-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-wiser-50 text-wiser-600">
                <Building2 size={22} />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-wiser-500">
                  WISE school onboarding
                </p>

                <h1 className="mt-2 text-xl font-semibold tracking-tight text-wiser-text sm:text-2xl">
                  Request access for your school
                </h1>

                <p className="mt-2 text-sm leading-6 text-wiser-text-secondary">
                  Tell us about your school. Your request will be reviewed by a
                  WISE administrator before the school workspace is activated.
                </p>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-6 px-6 py-6 sm:px-8"
          >
            {error && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                <AlertCircle
                  size={17}
                  className="mt-0.5 shrink-0"
                />
                <span>{error}</span>
              </div>
            )}

            {application?.status === "rejected" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                <p className="font-semibold">
                  Your previous request was not approved.
                </p>

                {application.rejection_reason && (
                  <p className="mt-1 leading-6">
                    Reason: {application.rejection_reason}
                  </p>
                )}

                <p className="mt-2 leading-6">
                  You can update the information below and submit a new
                  request.
                </p>
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="School name"
                required
                value={schoolName}
                onChange={setSchoolName}
                placeholder="e.g. High Gate International Academy"
                disabled={loading}
              />

              <div>
                <label className="mb-1.5 block text-sm font-medium text-wiser-text-secondary">
                  School type
                </label>

                <select
                  value={schoolType}
                  onChange={(event) =>
                    handleSchoolTypeChange(event.target.value)
                  }
                  disabled={loading}
                  className="h-11 w-full rounded-lg border border-wiser-border bg-white px-3 text-sm text-wiser-text outline-none transition focus:border-wiser-500 focus:ring-2 focus:ring-wiser-100"
                >
                  <option value="School">School</option>
                  <option value="Primary School">
                    Primary School
                  </option>
                  <option value="Secondary School">
                    Secondary School
                  </option>
                  <option value="Primary & Secondary">
                    Primary & Secondary
                  </option>
                  <option value="International School">
                    International School
                  </option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="rounded-xl border border-wiser-border bg-wiser-50/50 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <label className="block text-sm font-semibold text-wiser-text">
                    School sections / levels offered
                  </label>
                  <p className="mt-1 text-xs leading-5 text-wiser-text-muted">
                    Select the educational sections your school operates. A school can have multiple sections.
                  </p>
                </div>
                <span className="text-xs font-semibold text-wiser-text-muted">
                  {selectedSections.length} selected
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {SCHOOL_SECTION_PRESETS.map((section) => {
                  const selected = selectedSections.includes(section.key);

                  return (
                    <button
                      key={section.key}
                      type="button"
                      onClick={() => toggleSection(section.key)}
                      disabled={loading}
                      className={[
                        "flex min-h-12 items-center gap-3 rounded-lg border px-3 py-3 text-left text-sm transition",
                        selected
                          ? "border-wiser-300 bg-white text-wiser-700 ring-1 ring-wiser-100"
                          : "border-wiser-border bg-white text-wiser-text-secondary hover:bg-slate-50",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                          selected
                            ? "border-wiser-600 bg-wiser-600 text-white"
                            : "border-slate-300 bg-white text-transparent",
                        ].join(" ")}
                      >
                        <CheckCircle2 size={13} />
                      </span>
                      <span className="font-semibold">{section.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Country"
                required
                value={country}
                onChange={setCountry}
                placeholder="e.g. Rwanda"
                disabled={loading}
              />

              <Field
                label="City"
                required
                value={city}
                onChange={setCity}
                placeholder="e.g. Kigali"
                disabled={loading}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="School phone"
                value={phone}
                onChange={setPhone}
                placeholder="+250 7XX XXX XXX"
                type="tel"
                icon={Phone}
                disabled={loading}
              />

              <Field
                label="School email"
                value={email}
                onChange={setEmail}
                placeholder="info@school.com"
                type="email"
                icon={Mail}
                disabled={loading}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-wiser-text-secondary">
                Address
              </label>

              <textarea
                value={address}
                onChange={(event) =>
                  setAddress(event.target.value)
                }
                rows={3}
                placeholder="School address"
                disabled={loading}
                className="w-full rounded-lg border border-wiser-border bg-white px-3 py-2 text-sm text-wiser-text outline-none transition placeholder:text-slate-400 focus:border-wiser-500 focus:ring-2 focus:ring-wiser-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-wiser-text-secondary">
                Your role at the school
              </label>

              <select
                value={requestedRole}
                onChange={(event) =>
                  setRequestedRole(event.target.value)
                }
                disabled={loading}
                className="h-11 w-full rounded-lg border border-wiser-border bg-white px-3 text-sm text-wiser-text outline-none transition focus:border-wiser-500 focus:ring-2 focus:ring-wiser-100"
              >
                {REQUESTED_ROLES.map((role) => (
                  <option
                    key={role.value}
                    value={role.value}
                  >
                    {role.label}
                  </option>
                ))}
              </select>

              <p className="mt-1.5 text-xs leading-5 text-wiser-text-muted">
                This is the role you are requesting. WISE will review the
                request and assign the final school role.
              </p>
            </div>

            <div className="rounded-xl border border-wiser-border bg-wiser-50/60 px-4 py-4 text-sm leading-6 text-wiser-text-secondary">
              <div className="flex items-start gap-3">
                <CheckCircle2
                  size={17}
                  className="mt-0.5 shrink-0 text-wiser-600"
                />

                <p>
                  After approval, your assigned school role will determine
                  which school features you can access. Approved
                  Owner/Principal/Head of Academics accounts can then invite
                  additional staff members through the existing WISE
                  invitation workflow.
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-wiser-600 px-4 text-sm font-semibold text-white transition hover:bg-wiser-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wiser-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Submitting request...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Submit school request
                </>
              )}
            </button>
          </form>
        </div>
      </div>
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
      <label className="mb-1.5 block text-sm font-medium text-wiser-text-secondary">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      <div className="relative">
        {Icon && (
          <Icon
            size={16}
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-wiser-text-muted"
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
            "h-11 w-full rounded-lg border border-wiser-border bg-white pr-3 text-sm text-wiser-text outline-none transition",
            "placeholder:text-slate-400 focus:border-wiser-500 focus:ring-2 focus:ring-wiser-100",
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
    <div className="rounded-xl border border-wiser-border bg-white p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-wiser-text-muted">
        <Icon size={14} />
        {label}
      </div>

      <p className="mt-2 break-words text-sm font-medium text-wiser-text">
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
