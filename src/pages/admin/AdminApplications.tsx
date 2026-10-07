import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileClock,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  UserRound,
  XCircle,
  Globe2,
  Building2,
  ShieldCheck,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { supabase } from "../../lib/supabase";

type ApplicationStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "rejected"
  | "cancelled";

type SchoolRole =
  | "owner"
  | "principal"
  | "head_of_academics"
  | "secretary"
  | "teacher";

interface ApplicationRow {
  id: string;
  requested_by_user_id: string;
  school_name: string;
  school_type: string | null;
  school_email: string | null;
  school_phone: string | null;
  country: string;
  city: string;
  address: string | null;
  website: string | null;
  applicant_first_name: string;
  applicant_last_name: string;
  applicant_email: string;
  applicant_phone: string | null;
  requested_role: SchoolRole | null;
  assigned_role: SchoolRole | null;
  status: ApplicationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  school_id: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_FILTERS: { value: "all" | ApplicationStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "under_review", label: "Under review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const ASSIGNABLE_ROLES: { value: SchoolRole; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "principal", label: "Principal" },
  { value: "head_of_academics", label: "Head of Academics" },
  { value: "secretary", label: "Secretary" },
  { value: "teacher", label: "Teacher" },
];

function getReadableError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;

    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  if (typeof error === "object" && error !== null && "details" in error) {
    const details = (error as { details?: unknown }).details;

    if (typeof details === "string" && details.trim()) {
      return details;
    }
  }

  return fallback;
}

function formatStatus(status: ApplicationStatus) {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatRole(role: string | null) {
  if (!role) return "—";

  return role
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

function formatDateTime(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusClasses(status: ApplicationStatus) {
  switch (status) {
    case "pending":
      return "bg-amber-50 text-amber-700";
    case "under_review":
      return "bg-indigo-50 text-indigo-700";
    case "approved":
      return "bg-emerald-50 text-emerald-700";
    case "rejected":
      return "bg-red-50 text-red-700";
    case "cancelled":
      return "bg-slate-100 text-slate-600";
  }
}

function getApplicantName(application: ApplicationRow) {
  return [application.applicant_first_name, application.applicant_last_name]
    .filter(Boolean)
    .join(" ");
}

export default function AdminApplications() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedApplicationId = searchParams.get("id");

  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [selectedApplication, setSelectedApplication] =
    useState<ApplicationRow | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | ApplicationStatus>(
    (searchParams.get("status") as "all" | ApplicationStatus) || "all",
  );
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [assignedRole, setAssignedRole] = useState<SchoolRole>("principal");

  async function loadApplications(showRefreshState = false) {
    if (showRefreshState) setRefreshing(true);
    else setLoading(true);

    setError("");

    try {
      let query = supabase
        .from("school_applications")
        .select(
          "id, requested_by_user_id, school_name, school_type, school_email, school_phone, country, city, address, website, applicant_first_name, applicant_last_name, applicant_email, applicant_phone, requested_role, assigned_role, status, reviewed_by, reviewed_at, rejection_reason, school_id, created_at, updated_at",
        )
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error: queryError } = await query;

      if (queryError) throw queryError;

      const rows = (data ?? []) as ApplicationRow[];
      setApplications(rows);

      if (selectedApplicationId) {
        const selected = rows.find((row) => row.id === selectedApplicationId);
        if (selected) {
          setSelectedApplication(selected);
          setAssignedRole(
            selected.assigned_role ?? selected.requested_role ?? "principal",
          );
          setRejectionReason(selected.rejection_reason ?? "");
        } else {
          setSelectedApplication(null);
        }
      }
    } catch (loadError) {
      console.error("Failed to load school applications:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load school applications.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadApplications();
  }, [statusFilter]);

  const filteredApplications = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return applications;

    return applications.filter((application) =>
      [
        application.school_name,
        application.school_type ?? "",
        application.city,
        application.country,
        application.applicant_first_name,
        application.applicant_last_name,
        application.applicant_email,
        application.school_email ?? "",
        application.school_phone ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [applications, search]);

  function openApplication(application: ApplicationRow) {
    setSelectedApplication(application);
    setAssignedRole(
      application.assigned_role ?? application.requested_role ?? "principal",
    );
    setRejectionReason(application.rejection_reason ?? "");
    setSuccess("");
    setError("");
    setSearchParams((current) => {
      current.set("id", application.id);
      return current;
    });
  }

  function closeApplication() {
    setSelectedApplication(null);
    setSuccess("");
    setError("");
    setSearchParams((current) => {
      current.delete("id");
      return current;
    });
  }

  function changeStatusFilter(value: "all" | ApplicationStatus) {
    setStatusFilter(value);
    setSearchParams((current) => {
      if (value === "all") current.delete("status");
      else current.set("status", value);
      current.delete("id");
      return current;
    });
    setSelectedApplication(null);
  }

  async function markUnderReview() {
    if (!selectedApplication) return;

    setProcessing(true);
    setError("");
    setSuccess("");

    try {
      const { data, error: updateError } = await supabase.rpc(
        "set_school_application_under_review",
        {
          p_application_id: selectedApplication.id,
        },
      );

      if (updateError) throw updateError;

      const updated = data as ApplicationRow;
      setSelectedApplication(updated);
      setSuccess("The application has been moved to under review.");
      await loadApplications(true);
    } catch (processError) {
      console.error("Failed to mark application under review:", processError);
      setError(
        processError instanceof Error
          ? processError.message
          : "Could not update the application status.",
      );
    } finally {
      setProcessing(false);
    }
  }

  async function approveApplication() {
    if (!selectedApplication) return;

    const confirmed = window.confirm(
      `Approve ${selectedApplication.school_name} and create the school account with the ${formatRole(assignedRole)} role?`,
    );

    if (!confirmed) return;

    setProcessing(true);
    setError("");
    setSuccess("");

    try {
      const { data, error: approvalError } = await supabase.rpc(
        "approve_school_application",
        {
          p_application_id: selectedApplication.id,
          p_assigned_role: assignedRole,
        },
      );

      if (approvalError) throw approvalError;

      const result = data as {
        success?: boolean;
        application_id?: string;
        school_id?: string;
        membership_id?: string;
        assigned_role?: string;
        status?: string;
      };

      if (!result.school_id) {
        throw new Error(
          "The application was approved, but no school ID was returned. The school configuration cannot be opened.",
        );
      }

      // The approval RPC already creates the school, platform account,
      // membership, and default configuration. Open that configuration
      // workspace immediately after a successful approval.
      navigate(`/admin/schools/${result.school_id}/configuration`, {
        replace: true,
      });
    } catch (processError) {
      console.error("Failed to approve application:", processError);

      setError(
        getReadableError(processError, "Could not approve the application."),
      );
    }
  }

  async function rejectApplication() {
    if (!selectedApplication) return;

    const reason = rejectionReason.trim();

    if (!reason) {
      setError(
        "Please provide a rejection reason before rejecting the application.",
      );
      return;
    }

    setProcessing(true);
    setError("");
    setSuccess("");

    try {
      const { data, error: rejectionError } = await supabase.rpc(
        "reject_school_application",
        {
          p_application_id: selectedApplication.id,
          p_rejection_reason: reason,
        },
      );

      if (rejectionError) throw rejectionError;

      setSelectedApplication(data as ApplicationRow);
      setSuccess("The application has been rejected.");
      await loadApplications(true);
    } catch (processError) {
      console.error("Failed to reject application:", processError);
      setError(
        processError instanceof Error
          ? processError.message
          : "Could not reject the application.",
      );
    } finally {
      setProcessing(false);
    }
  }

  const actionable =
    selectedApplication?.status === "pending" ||
    selectedApplication?.status === "under_review";

  if (selectedApplication) {
    return (
      <ApplicationDetail
        application={selectedApplication}
        assignedRole={assignedRole}
        setAssignedRole={setAssignedRole}
        rejectionReason={rejectionReason}
        setRejectionReason={setRejectionReason}
        actionable={Boolean(actionable)}
        processing={processing}
        error={error}
        success={success}
        onBack={closeApplication}
        onUnderReview={() => void markUnderReview()}
        onApprove={() => void approveApplication()}
        onReject={() => void rejectApplication()}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-MojaSchoolr-600">
            <FileClock size={14} />
            Platform onboarding
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-MojaSchoolr-text sm:text-3xl">
            School requests
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-MojaSchoolr-text-secondary">
            Review schools that have applied to join MojaSchool and control their
            onboarding status from one place.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadApplications(true)}
          disabled={refreshing}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-MojaSchoolr-border bg-white px-4 text-sm font-semibold text-MojaSchoolr-text-secondary shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

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
                placeholder="Search school, applicant, city..."
                className="h-10 w-full rounded-lg border border-MojaSchoolr-border bg-white pl-10 pr-4 text-sm text-MojaSchoolr-text outline-none placeholder:text-slate-400 focus:border-MojaSchoolr-500 focus:ring-2 focus:ring-MojaSchoolr-100"
              />
            </div>
          </div>
        </div>

        <div className="border-b border-MojaSchoolr-border px-4 py-3 sm:px-5">
          <p className="text-sm text-MojaSchoolr-text-secondary">
            Showing{" "}
            <span className="font-semibold text-MojaSchoolr-text">
              {filteredApplications.length}
            </span>{" "}
            request{filteredApplications.length === 1 ? "" : "s"}
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-MojaSchoolr-text-secondary">
              <Loader2 size={17} className="animate-spin" />
              Loading school requests...
            </div>
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center px-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-MojaSchoolr-50 text-MojaSchoolr-600">
              <FileClock size={22} />
            </div>
            <h2 className="mt-4 text-sm font-semibold text-MojaSchoolr-text">
              No school requests found
            </h2>
            <p className="mt-1 max-w-md text-sm text-MojaSchoolr-text-secondary">
              No applications match the current status or search filters.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredApplications.map((application) => (
              <button
                key={application.id}
                type="button"
                onClick={() => openApplication(application)}
                className="flex w-full flex-col gap-4 px-4 py-4 text-left transition hover:bg-slate-50 sm:px-5 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-MojaSchoolr-50 text-MojaSchoolr-600">
                    <Building2 size={18} />
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-MojaSchoolr-text">
                        {application.school_name}
                      </p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClasses(application.status)}`}
                      >
                        {formatStatus(application.status)}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-MojaSchoolr-text-secondary">
                      {application.school_type || "School"} · {application.city}
                      , {application.country}
                    </p>

                    <p className="mt-1 truncate text-xs text-slate-400">
                      {getApplicantName(application)} ·{" "}
                      {application.applicant_email}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-start gap-1 text-xs text-slate-400 md:items-end">
                  <span>{formatDate(application.created_at)}</span>
                  <span>{formatRole(application.requested_role)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ApplicationDetail({
  application,
  assignedRole,
  setAssignedRole,
  rejectionReason,
  setRejectionReason,
  actionable,
  processing,
  error,
  success,
  onBack,
  onUnderReview,
  onApprove,
  onReject,
}: {
  application: ApplicationRow;
  assignedRole: SchoolRole;
  setAssignedRole: (value: SchoolRole) => void;
  rejectionReason: string;
  setRejectionReason: (value: string) => void;
  actionable: boolean;
  processing: boolean;
  error: string;
  success: string;
  onBack: () => void;
  onUnderReview: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const applicantName = getApplicantName(application);

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-semibold text-MojaSchoolr-600 hover:text-MojaSchoolr-700"
      >
        <ArrowLeft size={16} />
        Back to requests
      </button>

      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-MojaSchoolr-text sm:text-3xl">
              {application.school_name}
            </h1>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClasses(application.status)}`}
            >
              {formatStatus(application.status)}
            </span>
          </div>
          <p className="mt-2 text-sm text-MojaSchoolr-text-secondary">
            Submitted {formatDateTime(application.created_at)}
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <InfoCard title="School information" icon={Building2}>
            <InfoGrid>
              <InfoItem label="School name" value={application.school_name} />
              <InfoItem
                label="School type"
                value={application.school_type || "School"}
              />
              <InfoItem label="Email" value={application.school_email || "—"} />
              <InfoItem label="Phone" value={application.school_phone || "—"} />
              <InfoItem label="Country" value={application.country} />
              <InfoItem label="City" value={application.city} />
              <InfoItem label="Address" value={application.address || "—"} />
              <InfoItem
                label="Website"
                value={
                  application.website ? (
                    <a
                      href={application.website}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-MojaSchoolr-600 hover:underline"
                    >
                      {application.website}
                      <Globe2 size={13} />
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
            </InfoGrid>
          </InfoCard>

          <InfoCard title="Applicant" icon={UserRound}>
            <InfoGrid>
              <InfoItem label="Name" value={applicantName || "—"} />
              <InfoItem label="Email" value={application.applicant_email} />
              <InfoItem
                label="Phone"
                value={application.applicant_phone || "—"}
              />
              <InfoItem
                label="Requested role"
                value={formatRole(application.requested_role)}
              />
              <InfoItem label="Application ID" value={application.id} />
              <InfoItem
                label="Submitted"
                value={formatDateTime(application.created_at)}
              />
            </InfoGrid>
          </InfoCard>

          {(application.reviewed_at || application.rejection_reason) && (
            <InfoCard title="Review history" icon={Clock3}>
              <InfoGrid>
                <InfoItem
                  label="Reviewed at"
                  value={formatDateTime(application.reviewed_at)}
                />
                <InfoItem
                  label="Assigned role"
                  value={formatRole(application.assigned_role)}
                />
                <InfoItem
                  label="Rejection reason"
                  value={application.rejection_reason || "—"}
                />
                <InfoItem
                  label="School ID"
                  value={application.school_id || "—"}
                />
              </InfoGrid>
            </InfoCard>
          )}
        </div>

        <div className="h-fit xl:sticky xl:top-24">
          <section className="rounded-xl border border-MojaSchoolr-border bg-white shadow-sm">
            <div className="border-b border-MojaSchoolr-border px-5 py-4">
              <div className="flex items-center gap-2">
                <ShieldCheck size={17} className="text-MojaSchoolr-600" />
                <h2 className="text-base font-semibold text-MojaSchoolr-text">
                  Review decision
                </h2>
              </div>
              <p className="mt-1 text-xs leading-5 text-MojaSchoolr-text-secondary">
                Approval creates the school, activates its platform account and
                assigns the initial school role in one transaction.
              </p>
            </div>

            <div className="space-y-5 p-5">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-MojaSchoolr-text-secondary">
                  Assign school role
                </label>
                <select
                  value={assignedRole}
                  onChange={(event) =>
                    setAssignedRole(event.target.value as SchoolRole)
                  }
                  disabled={!actionable || processing}
                  className="h-10 w-full rounded-lg border border-MojaSchoolr-border bg-white px-3 text-sm text-MojaSchoolr-text outline-none focus:border-MojaSchoolr-500 focus:ring-2 focus:ring-MojaSchoolr-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                >
                  {ASSIGNABLE_ROLES.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              {actionable && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-700">
                    Rejection reason
                  </p>
                  <textarea
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    rows={4}
                    placeholder="Explain why the application is being rejected..."
                    disabled={processing}
                    className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-MojaSchoolr-500 focus:ring-2 focus:ring-MojaSchoolr-100 disabled:bg-slate-50"
                  />
                </div>
              )}

              {actionable ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={onApprove}
                    disabled={processing}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-MojaSchoolr-600 px-4 text-sm font-semibold text-white transition hover:bg-MojaSchoolr-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {processing ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <CheckCircle2 size={16} />
                    )}
                    Approve application
                  </button>

                  <button
                    type="button"
                    onClick={onUnderReview}
                    disabled={
                      processing || application.status === "under_review"
                    }
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Clock3 size={16} />
                    {application.status === "under_review"
                      ? "Already under review"
                      : "Mark under review"}
                  </button>

                  <button
                    type="button"
                    onClick={onReject}
                    disabled={processing}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <XCircle size={16} />
                    Reject application
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  This application has already been processed. No further action
                  is available.
                </div>
              )}

              <div className="flex items-start gap-2 text-[11px] leading-5 text-slate-400">
                <MapPin size={13} className="mt-0.5 shrink-0" />
                <span>
                  The applicant's school membership is created only by the
                  secure approval workflow.
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
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

function InfoItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </p>
      <div className="mt-1 break-words text-sm text-slate-800">{value}</div>
    </div>
  );
}
