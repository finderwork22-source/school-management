import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock3,
  Mail,
  MapPin,
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

const REQUESTED_ROLES = [
  { value: "", label: "Select your role" },
  { value: "owner", label: "Owner" },
  { value: "principal", label: "Principal" },
  { value: "head_of_academics", label: "Head of Academics" },
  { value: "secretary", label: "Secretary" },
  { value: "teacher", label: "Teacher" },
];

const SCHOOL_TYPES = [
  { value: "School", label: "School" },
  { value: "Primary School", label: "Primary School" },
  { value: "Secondary School", label: "Secondary School" },
  {
    value: "Primary & Secondary",
    label: "Primary & Secondary",
  },
  {
    value: "International School",
    label: "International School",
  },
  { value: "Other", label: "Other" },
];

export default function SetupSchool() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [schoolName, setSchoolName] = useState("");
  const [schoolType, setSchoolType] = useState("School");
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
  const [justSubmitted, setJustSubmitted] = useState(false);

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setJustSubmitted(false);

    if (!user) {
      setError("You must be logged in to submit a school request.");
      return;
    }

    const normalizedSchoolName = schoolName.trim();
    const normalizedCity = city.trim();
    const normalizedCountry = country.trim();
    const normalizedEmail = email.trim();
    const normalizedPhone = phone.trim();
    const normalizedAddress = address.trim();

    if (!normalizedSchoolName) {
      setError("School name is required.");
      return;
    }

    if (!normalizedCity) {
      setError("City is required.");
      return;
    }

    if (!normalizedCountry) {
      setError("Country is required.");
      return;
    }

    if (
      application &&
      ["pending", "under_review"].includes(application.status)
    ) {
      setError(
        "Your school request is already being reviewed.",
      );
      return;
    }

    if (!requestedRole) {
      setError("Please select your role at the school.");
      return;
    }

    setLoading(true);

    const { data, error: submissionError } =
      await submitSchoolApplication({
        schoolName: normalizedSchoolName,
        schoolType,
        schoolEmail: normalizedEmail,
        schoolPhone: normalizedPhone,
        country: normalizedCountry,
        city: normalizedCity,
        address: normalizedAddress,
        requestedRole,
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
    setJustSubmitted(true);
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
      <PendingApplicationView
        application={application}
        justSubmitted={justSubmitted}
        error={error}
        onReturnToLogin={() => navigate("/login")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-wiser-background px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-5">
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="inline-flex items-center gap-2 text-sm font-medium text-wiser-text-secondary transition hover:text-wiser-700"
          >
            <ArrowLeft size={15} />
            Back to sign in
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-wiser-border bg-white shadow-sm">
          {/* Header */}
          <div className="border-b border-wiser-border px-6 py-6 sm:px-8">
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

                <p className="mt-2 max-w-xl text-sm leading-6 text-wiser-text-secondary">
                  Tell us about your school. Your request will be reviewed by
                  a WISE administrator before the school workspace is
                  activated.
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
                className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
              >
                <AlertCircle
                  size={17}
                  className="mt-0.5 shrink-0"
                />
                <span>{error}</span>
              </div>
            )}

            {application?.status === "rejected" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-800">
                <p className="font-semibold">
                  Your previous request was not approved.
                </p>

                {application.rejection_reason && (
                  <p className="mt-1">
                    Reason: {application.rejection_reason}
                  </p>
                )}

                <p className="mt-2">
                  Update the information below and submit a new request.
                </p>
              </div>
            )}

            {/* School information */}
            <section>
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-wiser-text">
                  School information
                </h2>

                <p className="mt-1 text-xs text-wiser-text-muted">
                  Basic information about the school you want to register.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="School name"
                  required
                  value={schoolName}
                  onChange={setSchoolName}
                  placeholder="e.g. High Gate International Academy"
                  disabled={loading}
                />

                <SelectField
                  label="School type"
                  value={schoolType}
                  onChange={setSchoolType}
                  options={SCHOOL_TYPES}
                  disabled={loading}
                />
              </div>
            </section>

            {/* Location */}
            <section className="border-t border-wiser-border pt-6">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-wiser-text">
                  Location
                </h2>
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

              <div className="mt-5">
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
                  className="w-full rounded-lg border border-wiser-border bg-white px-3 py-2.5 text-sm text-wiser-text outline-none transition placeholder:text-slate-400 focus:border-wiser-500 focus:ring-2 focus:ring-wiser-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </div>
            </section>

            {/* Contact */}
            <section className="border-t border-wiser-border pt-6">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-wiser-text">
                  School contact
                </h2>
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
            </section>

            {/* Applicant role */}
            <section className="border-t border-wiser-border pt-6">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-wiser-text">
                  Your role
                </h2>

                <p className="mt-1 text-xs leading-5 text-wiser-text-muted">
                  Tell WISE which school role you are requesting. WISE will
                  review and assign the final role.
                </p>
              </div>

              <SelectField
                label="Role at the school"
                value={requestedRole}
                onChange={setRequestedRole}
                options={REQUESTED_ROLES}
                disabled={loading}
              />
            </section>

            {/* Process */}
            <div className="rounded-xl border border-wiser-border bg-wiser-50/60 px-4 py-4">
              <div className="flex items-start gap-3">
                <CheckCircle2
                  size={17}
                  className="mt-0.5 shrink-0 text-wiser-600"
                />

                <div>
                  <p className="text-sm font-semibold text-wiser-text">
                    What happens after you submit?
                  </p>

                  <p className="mt-1 text-sm leading-6 text-wiser-text-secondary">
                    Your request is sent to WISE for review. Once approved,
                    your school workspace will be activated and your assigned
                    role will determine your access.
                  </p>
                </div>
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

function PendingApplicationView({
  application,
  justSubmitted,
  error,
  onReturnToLogin,
}: {
  application: SchoolApplication;
  justSubmitted: boolean;
  error: string;
  onReturnToLogin: () => void;
}) {
  return (
    <div className="min-h-screen bg-wiser-background px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto w-full max-w-2xl">
        <div className="overflow-hidden rounded-2xl border border-wiser-border bg-white shadow-sm">
          <div className="border-b border-wiser-border px-6 py-7 sm:px-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={22} />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-wiser-500">
                  WISE school onboarding
                </p>

                <h1 className="mt-2 text-xl font-semibold tracking-tight text-wiser-text sm:text-2xl">
                  {justSubmitted
                    ? "Your request has been submitted"
                    : "Your school request is being reviewed"}
                </h1>

                <p className="mt-2 text-sm leading-6 text-wiser-text-secondary">
                  {justSubmitted
                    ? "WISE has received your school information. A WISE administrator will review your request before your workspace is activated."
                    : "WISE has received your request. A WISE administrator is reviewing the school information and requested role."}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 px-6 py-6 sm:px-8">
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
              >
                {error}
              </div>
            )}

            <div className="rounded-xl border border-wiser-border bg-wiser-50/60 p-5">
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

                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                  <Clock3 size={13} />
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

            <div className="rounded-xl border border-dashed border-wiser-border px-4 py-4">
              <p className="text-sm font-medium text-wiser-text">
                What happens next?
              </p>

              <p className="mt-1 text-sm leading-6 text-wiser-text-secondary">
                WISE will review the request. Once approved, the school will
                be activated and your assigned school role will determine
                which features you can access.
              </p>
            </div>

            <button
              type="button"
              onClick={onReturnToLogin}
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
            "disabled:cursor-not-allowed disabled:bg-slate-50",
            Icon ? "pl-9" : "pl-3",
          ].join(" ")}
        />
      </div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{
    value: string;
    label: string;
  }>;
  disabled: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-wiser-text-secondary">
        {label}
      </label>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-11 w-full rounded-lg border border-wiser-border bg-white px-3 text-sm text-wiser-text outline-none transition focus:border-wiser-500 focus:ring-2 focus:ring-wiser-100 disabled:cursor-not-allowed disabled:bg-slate-50"
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
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
  value: string | null;
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