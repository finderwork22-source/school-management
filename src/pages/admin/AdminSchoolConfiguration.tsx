import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Building2,
  Check,
  CheckCircle2,
  GraduationCap,
  LayoutGrid,
  Loader2,
  Palette,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { supabase } from "../../lib/supabase";

type TabKey = "modules" | "academic" | "ai" | "branding";

type ModuleKey =
  | "admissions"
  | "students"
  | "parents"
  | "teachers"
  | "academics"
  | "timetable"
  | "attendance"
  | "assessments"
  | "student_results"
  | "finance"
  | "announcements"
  | "pickup"
  | "library"
  | "transport"
  | "ai_assistant";

interface SchoolRecord {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  logo_url: string | null;
}

interface ApplicationRecord {
  id: string;
  school_id: string | null;
  school_name: string;
  school_type: string | null;
  school_email: string | null;
  school_phone: string | null;
  country: string;
  city: string;
  address: string | null;
  applicant_first_name: string;
  applicant_last_name: string;
  applicant_email: string;
  requested_role: string | null;
  assigned_role: string | null;
  status: string;
  sections: Array<{ key: string; name: string; enabled: boolean; display_order: number }> | null;
}

interface SchoolConfiguration {
  school_id: string;
  school_type: string;
  curriculum: string;
  sections: Array<{
    key: string;
    name: string;
    enabled: boolean;
    display_order: number;
  }>;
  enabled_modules: Record<string, boolean>;
  academic_settings: {
    school_days_per_week: number;
    periods_per_day: number;
    lesson_duration_minutes: number;
    break_duration_minutes: number;
    grading_system: string;
    week_starts_on: string;
  };
  ai_settings: {
    enabled: boolean;
    allowed_roles: string[];
    allow_academic_insights: boolean;
    allow_student_insights: boolean;
    allow_teacher_insights: boolean;
    allow_timetable_insights: boolean;
    allow_finance_insights: boolean;
  };
  branding: {
    logo_url: string | null;
    primary_color: string;
    secondary_color: string;
    portal_name: string | null;
    tagline: string | null;
  };
}

interface ModuleDefinition {
  key: ModuleKey;
  name: string;
  description: string;
  category: "Core" | "Academic" | "Operations" | "Optional";
}

const MODULES: ModuleDefinition[] = [
  { key: "admissions", name: "Admissions", description: "Applications and student onboarding.", category: "Core" },
  { key: "students", name: "Students", description: "Student records, profiles and enrollment.", category: "Core" },
  { key: "parents", name: "Parents", description: "Parent records and parent portal access.", category: "Core" },
  { key: "teachers", name: "Teachers", description: "Teacher profiles, assignments and staff records.", category: "Core" },
  { key: "academics", name: "Academics", description: "Classes, subjects and academic structure.", category: "Academic" },
  { key: "timetable", name: "Timetable", description: "Weekly lessons, periods and teacher scheduling.", category: "Academic" },
  { key: "attendance", name: "Attendance", description: "Daily attendance and attendance history.", category: "Academic" },
  { key: "assessments", name: "Assessments", description: "Assessments, marks and academic results.", category: "Academic" },
  { key: "student_results", name: "Student results", description: "Student result views and reports.", category: "Academic" },
  { key: "finance", name: "Finance", description: "Fees, billing, payments and finance reports.", category: "Operations" },
  { key: "announcements", name: "Announcements", description: "School-wide communication and notices.", category: "Operations" },
  { key: "pickup", name: "Pickup desk", description: "Student pickup authorisations and release tracking.", category: "Optional" },
  { key: "library", name: "Library", description: "Books, lending and library operations.", category: "Optional" },
  { key: "transport", name: "Transport", description: "Routes, vehicles and transport management.", category: "Optional" },
  { key: "ai_assistant", name: "AI Assistant", description: "School-aware AI insights and academic assistance.", category: "Optional" },
];

const DEFAULT_MODULES: Record<ModuleKey, boolean> = {
  admissions: true,
  students: true,
  parents: true,
  teachers: true,
  academics: true,
  timetable: true,
  attendance: true,
  assessments: true,
  student_results: true,
  finance: true,
  announcements: true,
  pickup: false,
  library: false,
  transport: false,
  ai_assistant: false,
};

const DEFAULT_CONFIG: SchoolConfiguration = {
  school_id: "",
  school_type: "School",
  curriculum: "General",
  sections: [],
  enabled_modules: DEFAULT_MODULES,
  academic_settings: {
    school_days_per_week: 5,
    periods_per_day: 8,
    lesson_duration_minutes: 45,
    break_duration_minutes: 15,
    grading_system: "percentage",
    week_starts_on: "Monday",
  },
  ai_settings: {
    enabled: false,
    allowed_roles: ["owner", "principal", "head_of_academics"],
    allow_academic_insights: true,
    allow_student_insights: true,
    allow_teacher_insights: true,
    allow_timetable_insights: true,
    allow_finance_insights: false,
  },
  branding: {
    logo_url: null,
    primary_color: "#0F5CFF",
    secondary_color: "#0F172A",
    portal_name: null,
    tagline: null,
  },
};

const SCHOOL_TYPES = [
  "School",
  "Crèche",
  "Nursery",
  "Crèche & Nursery",
  "Primary",
  "Secondary",
  "Primary & Secondary",
  "International School",
  "Private School",
  "Combined",
  "Other",
];

const SECTION_PRESETS = [
  { key: "creche", name: "Crèche", description: "Early childhood care, development and daily activities." },
  { key: "nursery", name: "Nursery", description: "Early years learning, development and foundational academics." },
  { key: "primary", name: "Primary", description: "Primary school academic section." },
  { key: "lower_secondary", name: "Lower Secondary", description: "Lower secondary / junior secondary education." },
  { key: "upper_secondary", name: "Upper Secondary", description: "Upper secondary / senior secondary education." },
];

const CURRICULA = [
  "General",
  "Rwanda National Curriculum",
  "Cambridge",
  "Canadian",
  "International Baccalaureate",
  "French",
  "Montessori",
  "Custom",
];

const AI_ROLES = [
  { value: "owner", label: "Owner" },
  { value: "principal", label: "Principal" },
  { value: "head_of_academics", label: "Head of Academics" },
  { value: "secretary", label: "Secretary" },
  { value: "teacher", label: "Teacher" },
];

const inputClassName =
  "h-10 w-full rounded-lg border border-wiser-border bg-white px-3 text-sm text-wiser-text outline-none focus:border-wiser-500 focus:ring-2 focus:ring-wiser-100";

function mergeConfig(
  row: Partial<SchoolConfiguration> | null,
  schoolId: string,
): SchoolConfiguration {
  return {
    school_id: schoolId,
    school_type:
      row?.school_type === "Creche"
        ? "Crèche"
        : row?.school_type === "Creche & Nursery"
          ? "Crèche & Nursery"
          : row?.school_type ?? DEFAULT_CONFIG.school_type,
    curriculum: row?.curriculum ?? DEFAULT_CONFIG.curriculum,
    sections: Array.isArray(row?.sections) ? row!.sections : DEFAULT_CONFIG.sections,
    enabled_modules: {
      ...DEFAULT_MODULES,
      ...(row?.enabled_modules ?? {}),
    },
    academic_settings: {
      ...DEFAULT_CONFIG.academic_settings,
      ...(row?.academic_settings ?? {}),
    },
    ai_settings: {
      ...DEFAULT_CONFIG.ai_settings,
      ...(row?.ai_settings ?? {}),
    },
    branding: {
      ...DEFAULT_CONFIG.branding,
      ...(row?.branding ?? {}),
    },
  };
}

function formatRole(role: string | null) {
  if (!role) return "—";
  return role
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function tabClasses(active: boolean) {
  return [
    "inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition",
    active
      ? "bg-wiser-600 text-white"
      : "text-wiser-text-secondary hover:bg-slate-100 hover:text-wiser-text",
  ].join(" ");
}

export default function AdminSchoolConfiguration() {
  const navigate = useNavigate();
  const { schoolId } = useParams<{ schoolId: string }>();
  const [searchParams] = useSearchParams();
  const applicationId = searchParams.get("applicationId");

  const [school, setSchool] = useState<SchoolRecord | null>(null);
  const [application, setApplication] = useState<ApplicationRecord | null>(null);
  const [config, setConfig] = useState<SchoolConfiguration>(() =>
    mergeConfig(null, schoolId ?? ""),
  );
  const [activeTab, setActiveTab] = useState<TabKey>("modules");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isApprovalMode = !schoolId && Boolean(applicationId);

  async function load(showRefreshState = false) {
    if (showRefreshState) setRefreshing(true);
    else setLoading(true);

    setError("");
    setSuccess("");

    try {
      let targetSchoolId = schoolId ?? null;

      if (applicationId) {
        const { data: applicationData, error: applicationError } = await supabase
          .from("school_applications")
          .select(
            "id, school_id, school_name, school_type, school_email, school_phone, country, city, address, applicant_first_name, applicant_last_name, applicant_email, requested_role, assigned_role, status, sections",
          )
          .eq("id", applicationId)
          .single();

        if (applicationError) throw applicationError;

        const applicationRow = applicationData as ApplicationRecord;
        setApplication(applicationRow);
        targetSchoolId = applicationRow.school_id ?? targetSchoolId;
      }

      if (!targetSchoolId) {
        if (applicationId) return;
        throw new Error("A school ID or application ID is required.");
      }

      const [{ data: schoolData, error: schoolError }, { data: configData, error: configError }] =
        await Promise.all([
          supabase
            .from("schools")
            .select("id, name, slug, email, phone, address, city, country, logo_url")
            .eq("id", targetSchoolId)
            .single(),
          supabase
            .from("school_configurations")
            .select(
              "school_id, school_type, curriculum, sections, enabled_modules, academic_settings, ai_settings, branding",
            )
            .eq("school_id", targetSchoolId)
            .maybeSingle(),
        ]);

      if (schoolError) throw schoolError;
      if (configError) throw configError;

      const schoolRow = schoolData as SchoolRecord;
      setSchool(schoolRow);
      setConfig(
        mergeConfig(
          configData as Partial<SchoolConfiguration> | null,
          targetSchoolId,
        ),
      );
    } catch (loadError) {
      console.error("Failed to load school configuration:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load the school configuration.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
  }, [schoolId, applicationId]);

  async function approveAndConfigure() {
    if (!application) return;

    const assignedRole =
      application.assigned_role ?? application.requested_role ?? "principal";

    const confirmed = window.confirm(
      `Approve ${application.school_name} as a ${formatRole(
        assignedRole,
      )} and create its WISE school account?`,
    );

    if (!confirmed) return;

    setApproving(true);
    setError("");
    setSuccess("");

    try {
      const { data, error: approvalError } = await supabase.rpc(
        "approve_school_application",
        {
          p_application_id: application.id,
          p_assigned_role: assignedRole,
        },
      );

      if (approvalError) throw approvalError;

      const result = data as { school_id?: string };

      if (!result.school_id) {
        throw new Error(
          "The school was approved, but no school ID was returned.",
        );
      }

      navigate(
        `/admin/schools/${result.school_id}/configuration`,
        { replace: true },
      );
    } catch (approvalError) {
      console.error("Failed to approve school:", approvalError);
      setError(
        approvalError instanceof Error
          ? approvalError.message
          : "Could not approve the school.",
      );
    } finally {
      setApproving(false);
    }
  }

  function updateModule(key: ModuleKey, value: boolean) {
    setConfig((current) => ({
      ...current,
      enabled_modules: {
        ...current.enabled_modules,
        [key]: value,
      },
    }));
  }

  function updateAcademic(
    key: keyof SchoolConfiguration["academic_settings"],
    value: string | number,
  ) {
    setConfig((current) => ({
      ...current,
      academic_settings: {
        ...current.academic_settings,
        [key]: value,
      },
    }));
  }

  function updateAI(
    key: keyof SchoolConfiguration["ai_settings"],
    value: boolean | string[],
  ) {
    setConfig((current) => ({
      ...current,
      ai_settings: {
        ...current.ai_settings,
        [key]: value,
      },
    }));
  }

  function setAIEnabled(value: boolean) {
    setConfig((current) => ({
      ...current,
      enabled_modules: {
        ...current.enabled_modules,
        ai_assistant: value,
      },
      ai_settings: {
        ...current.ai_settings,
        enabled: value,
      },
    }));
  }

  function toggleAIRole(role: string) {
    setConfig((current) => {
      const roles = current.ai_settings.allowed_roles ?? [];
      const nextRoles = roles.includes(role)
        ? roles.filter((item) => item !== role)
        : [...roles, role];

      return {
        ...current,
        ai_settings: {
          ...current.ai_settings,
          allowed_roles: nextRoles,
        },
      };
    });
  }

  function updateBranding(
    key: keyof SchoolConfiguration["branding"],
    value: string | null,
  ) {
    setConfig((current) => ({
      ...current,
      branding: {
        ...current.branding,
        [key]: value,
      },
    }));
  }

  function setSchoolType(value: string) {
    setConfig((current) => {
      let nextSections = current.sections;

      if (value === "Crèche & Nursery") {
        nextSections = SECTION_PRESETS.filter((section) =>
          ["creche", "nursery"].includes(section.key),
        ).map((section, index) => ({
          key: section.key,
          name: section.name,
          enabled: true,
          display_order: index + 1,
        }));
      } else if (value === "Crèche" || value === "Creche") {
        nextSections = [
          { key: "creche", name: "Crèche", enabled: true, display_order: 1 },
        ];
      } else if (value === "Nursery") {
        nextSections = [
          { key: "nursery", name: "Nursery", enabled: true, display_order: 1 },
        ];
      } else if (value === "Primary") {
        nextSections = [
          { key: "primary", name: "Primary", enabled: true, display_order: 1 },
        ];
      } else if (value === "Secondary") {
        nextSections = [
          { key: "lower_secondary", name: "Lower Secondary", enabled: true, display_order: 1 },
          { key: "upper_secondary", name: "Upper Secondary", enabled: true, display_order: 2 },
        ];
      } else if (value === "Primary & Secondary") {
        nextSections = [
          { key: "primary", name: "Primary", enabled: true, display_order: 1 },
          { key: "lower_secondary", name: "Lower Secondary", enabled: true, display_order: 2 },
          { key: "upper_secondary", name: "Upper Secondary", enabled: true, display_order: 3 },
        ];
      } else if (value === "International School") {
        nextSections = [
          { key: "creche", name: "Crèche", enabled: true, display_order: 1 },
          { key: "nursery", name: "Nursery", enabled: true, display_order: 2 },
          { key: "primary", name: "Primary", enabled: true, display_order: 3 },
          { key: "lower_secondary", name: "Lower Secondary", enabled: true, display_order: 4 },
        ];
      } else if (value === "Private School") {
        nextSections = current.sections.length
          ? current.sections
          : [{ key: "primary", name: "Primary", enabled: true, display_order: 1 }];
      }

      return {
        ...current,
        school_type: value,
        sections: nextSections,
      };
    });
  }

  function toggleSchoolSection(key: string) {
    setConfig((current) => {
      const currentSection = current.sections.find((section) => section.key === key);
      const enabled = !(currentSection?.enabled ?? false);

      const existing = current.sections.some((section) => section.key === key);
      const next = existing
        ? current.sections.map((section) =>
            section.key === key ? { ...section, enabled } : section,
          )
        : [
            ...current.sections,
            {
              key,
              name: SECTION_PRESETS.find((section) => section.key === key)?.name ?? key,
              enabled: true,
              display_order: current.sections.length + 1,
            },
          ];

      return { ...current, sections: next };
    });
  }

  async function saveConfiguration() {
    if (!school) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const { data, error: saveError } = await supabase.rpc(
        "save_school_configuration",
        {
          p_school_id: school.id,
          p_school_type: config.school_type,
          p_curriculum: config.curriculum,
          p_enabled_modules: config.enabled_modules,
          p_academic_settings: config.academic_settings,
          p_ai_settings: config.ai_settings,
          p_branding: config.branding,
        },
      );

      if (saveError) throw saveError;

      const { data: sectionsData, error: sectionsError } =
        await supabase.rpc("save_school_sections", {
          p_school_id: school.id,
          p_sections: config.sections,
        });

      if (sectionsError) throw sectionsError;

      setConfig(
        mergeConfig(
          {
            ...(data as Partial<SchoolConfiguration>),
            sections: sectionsData ?? config.sections,
          },
          school.id,
        ),
      );
      setSuccess("School configuration saved successfully.");
    } catch (saveError) {
      console.error("Failed to save school configuration:", saveError);
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save the school configuration.",
      );
    } finally {
      setSaving(false);
    }
  }

  const moduleGroups = useMemo(
    () =>
      ["Core", "Academic", "Operations", "Optional"].map((category) => ({
        category,
        modules: MODULES.filter((module) => module.category === category),
      })),
    [],
  );

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-wiser-text-secondary">
          <Loader2 size={17} className="animate-spin" />
          Loading school configuration...
        </div>
      </div>
    );
  }

  if (!school && application && isApprovalMode) {
    return (
      <div className="mx-auto w-full max-w-[1000px]">
        <button
          type="button"
          onClick={() =>
            navigate(`/admin/applications?id=${application.id}`)
          }
          className="inline-flex items-center gap-2 text-sm font-semibold text-wiser-600 hover:text-wiser-700"
        >
          <ArrowLeft size={16} />
          Back to school request
        </button>

        <div className="mt-5 rounded-2xl border border-wiser-border bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-wiser-50 text-wiser-600">
              <Building2 size={22} />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-wiser-text">
                  {application.school_name}
                </h1>
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                  {application.status.replaceAll("_", " ")}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-wiser-text-secondary">
                Approve this school first. WISE will then create the school
                account and open the configuration workspace.
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle size={17} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Info
              label="School type"
              value={application.school_type || "School"}
            />
            <Info
              label="Location"
              value={`${application.city}, ${application.country}`}
            />
            <Info
              label="Applicant"
              value={`${application.applicant_first_name} ${application.applicant_last_name}`}
            />
            <Info label="Applicant email" value={application.applicant_email} />
            <Info
              label="Requested role"
              value={formatRole(application.requested_role)}
            />
            <Info
              label="School email"
              value={application.school_email || "—"}
            />

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                Requested school sections
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(application.sections ?? []).filter((section) => section.enabled).length > 0 ? (
                  (application.sections ?? [])
                    .filter((section) => section.enabled)
                    .sort((a, b) => a.display_order - b.display_order)
                    .map((section) => (
                      <span
                        key={section.key}
                        className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-wiser-text shadow-sm ring-1 ring-slate-200"
                      >
                        {section.name}
                      </span>
                    ))
                ) : (
                  <span className="text-sm text-slate-500">No sections supplied.</span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() =>
                navigate(`/admin/applications?id=${application.id}`)
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-wiser-border bg-white px-5 text-sm font-semibold text-wiser-text-secondary hover:bg-slate-50"
            >
              Review application
            </button>

            <button
              type="button"
              onClick={() => void approveAndConfigure()}
              disabled={
                approving ||
                !["pending", "under_review"].includes(application.status)
              }
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-wiser-600 px-5 text-sm font-semibold text-white hover:bg-wiser-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {approving ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <CheckCircle2 size={17} />
              )}
              Approve & configure school
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!school) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error || "School not found."}
      </div>
    );
  }

  const aiEnabled =
    config.ai_settings.enabled && config.enabled_modules.ai_assistant;

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => navigate("/admin/schools")}
            className="inline-flex items-center gap-2 text-sm font-semibold text-wiser-600 hover:text-wiser-700"
          >
            <ArrowLeft size={16} />
            Back to schools
          </button>

          <div className="mt-4 flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-wiser-50 text-wiser-600">
              {school.logo_url ? (
                <img
                  src={school.logo_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <Building2 size={22} />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-semibold tracking-tight text-wiser-text sm:text-3xl">
                  {school.name}
                </h1>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                  Configuration
                </span>
              </div>
              <p className="mt-1 text-sm text-wiser-text-secondary">
                {school.city || "—"}, {school.country || "—"} ·{" "}
                {config.school_type} · {config.curriculum}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={refreshing || saving}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-wiser-border bg-white px-4 text-sm font-semibold text-wiser-text-secondary shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => void saveConfiguration()}
            disabled={saving}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-wiser-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-wiser-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            {saving ? "Saving..." : "Save configuration"}
          </button>
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

      <div className="mt-6 grid gap-6 xl:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="h-fit rounded-xl border border-wiser-border bg-white p-2 shadow-sm">
          <div className="px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
              School setup
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Control what this school can use on WISE.
            </p>
          </div>

          <div className="space-y-1">
            <button
              type="button"
              onClick={() => setActiveTab("modules")}
              className={tabClasses(activeTab === "modules")}
            >
              <LayoutGrid size={16} />
              Modules
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("academic")}
              className={tabClasses(activeTab === "academic")}
            >
              <GraduationCap size={16} />
              Academic
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ai")}
              className={tabClasses(activeTab === "ai")}
            >
              <Bot size={16} />
              AI access
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("branding")}
              className={tabClasses(activeTab === "branding")}
            >
              <Palette size={16} />
              Branding
            </button>
          </div>

          <div className="mt-4 rounded-lg bg-slate-50 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <ShieldCheck size={14} className="text-emerald-600" />
              Super Admin only
            </div>
            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              These settings are platform-level controls. School staff cannot
              change them from this workspace.
            </p>
          </div>
        </aside>

        <main className="min-w-0">
          {activeTab === "modules" && (
            <section className="rounded-xl border border-wiser-border bg-white shadow-sm">
              <SectionHeader
                icon={LayoutGrid}
                title="Modules"
                description="Enable only the features that this school needs. Disabled modules should be hidden from its school workspace."
              />

              <div className="space-y-7 p-5 sm:p-6">
                {moduleGroups.map((group) => (
                  <div key={group.category}>
                    <div className="mb-3">
                      <h2 className="text-sm font-semibold text-wiser-text">
                        {group.category}
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {group.category === "Core"
                          ? "The main school-management features."
                          : group.category === "Academic"
                            ? "Teaching, scheduling and academic operations."
                            : group.category === "Operations"
                              ? "Administrative and communication features."
                              : "Optional features that can be enabled per school."}
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      {group.modules.map((module) => {
                        const enabled = Boolean(
                          config.enabled_modules[module.key],
                        );

                        return (
                          <button
                            key={module.key}
                            type="button"
                            onClick={() =>
                              updateModule(module.key, !enabled)
                            }
                            className={[
                              "flex items-start gap-3 rounded-xl border p-4 text-left transition",
                              enabled
                                ? "border-wiser-200 bg-wiser-50/60"
                                : "border-slate-200 bg-white hover:bg-slate-50",
                            ].join(" ")}
                          >
                            <span
                              className={[
                                "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                                enabled
                                  ? "border-wiser-600 bg-wiser-600 text-white"
                                  : "border-slate-300 bg-white text-transparent",
                              ].join(" ")}
                            >
                              <Check size={13} strokeWidth={3} />
                            </span>

                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-slate-900">
                                  {module.name}
                                </span>
                                {module.key === "ai_assistant" && (
                                  <Sparkles
                                    size={14}
                                    className="text-wiser-600"
                                  />
                                )}
                              </span>
                              <span className="mt-1 block text-xs leading-5 text-slate-500">
                                {module.description}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === "academic" && (
            <section className="rounded-xl border border-wiser-border bg-white shadow-sm">
              <SectionHeader
                icon={GraduationCap}
                title="Academic settings"
                description="Set the academic defaults used by this school's modules and timetable."
              />

              <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-2">
                <Field label="School type">
                  <select
                    value={config.school_type}
                    onChange={(event) => setSchoolType(event.target.value)}
                    className={inputClassName}
                  >
                    {SCHOOL_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Curriculum">
                  <select
                    value={config.curriculum}
                    onChange={(event) =>
                      setConfig((current) => ({
                        ...current,
                        curriculum: event.target.value,
                      }))
                    }
                    className={inputClassName}
                  >
                    {CURRICULA.map((curriculum) => (
                      <option key={curriculum} value={curriculum}>
                        {curriculum}
                      </option>
                    ))}
                  </select>
                </Field>

                <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">School sections</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        A school can contain multiple educational sections. For a Crèche & Nursery school, enable both sections. These sections are used by classes and teacher assignments.
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-slate-500">
                      {config.sections.filter((section) => section.enabled).length} enabled
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {SECTION_PRESETS.map((section) => {
                      const enabled = config.sections.find((item) => item.key === section.key)?.enabled ?? false;

                      return (
                        <button
                          key={section.key}
                          type="button"
                          onClick={() => toggleSchoolSection(section.key)}
                          className={[
                            "flex items-start gap-3 rounded-xl border p-4 text-left transition",
                            enabled
                              ? "border-wiser-200 bg-white ring-1 ring-wiser-100"
                              : "border-slate-200 bg-slate-50 hover:bg-white",
                          ].join(" ")}
                        >
                          <span
                            className={[
                              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                              enabled
                                ? "border-wiser-600 bg-wiser-600 text-white"
                                : "border-slate-300 bg-white text-transparent",
                            ].join(" ")}
                          >
                            <Check size={13} strokeWidth={3} />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-slate-900">
                              {section.name}
                            </span>
                            <span className="mt-1 block text-xs leading-5 text-slate-500">
                              {section.description}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Field label="School days per week">
                  <input
                    type="number"
                    min={1}
                    max={7}
                    value={config.academic_settings.school_days_per_week}
                    onChange={(event) =>
                      updateAcademic(
                        "school_days_per_week",
                        Number(event.target.value),
                      )
                    }
                    className={inputClassName}
                  />
                </Field>

                <Field label="Periods per day">
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={config.academic_settings.periods_per_day}
                    onChange={(event) =>
                      updateAcademic(
                        "periods_per_day",
                        Number(event.target.value),
                      )
                    }
                    className={inputClassName}
                  />
                </Field>

                <Field label="Lesson duration (minutes)">
                  <input
                    type="number"
                    min={15}
                    max={180}
                    value={
                      config.academic_settings.lesson_duration_minutes
                    }
                    onChange={(event) =>
                      updateAcademic(
                        "lesson_duration_minutes",
                        Number(event.target.value),
                      )
                    }
                    className={inputClassName}
                  />
                </Field>

                <Field label="Break duration (minutes)">
                  <input
                    type="number"
                    min={0}
                    max={120}
                    value={config.academic_settings.break_duration_minutes}
                    onChange={(event) =>
                      updateAcademic(
                        "break_duration_minutes",
                        Number(event.target.value),
                      )
                    }
                    className={inputClassName}
                  />
                </Field>

                <Field label="Grading system">
                  <select
                    value={config.academic_settings.grading_system}
                    onChange={(event) =>
                      updateAcademic("grading_system", event.target.value)
                    }
                    className={inputClassName}
                  >
                    <option value="percentage">Percentage</option>
                    <option value="letter">Letter grades</option>
                    <option value="points">Points</option>
                    <option value="custom">Custom</option>
                  </select>
                </Field>

                <Field label="Week starts on">
                  <select
                    value={config.academic_settings.week_starts_on}
                    onChange={(event) =>
                      updateAcademic("week_starts_on", event.target.value)
                    }
                    className={inputClassName}
                  >
                    <option value="Monday">Monday</option>
                    <option value="Sunday">Sunday</option>
                  </select>
                </Field>
              </div>

              <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 text-xs leading-5 text-slate-600 sm:px-6">
                Example: a school using 5 days × 8 periods has 40 timetable
                slots per class each week. Weekly lesson requirements determine
                how those slots are allocated.
              </div>
            </section>
          )}

          {activeTab === "ai" && (
            <section className="rounded-xl border border-wiser-border bg-white shadow-sm">
              <SectionHeader
                icon={Bot}
                title="AI access"
                description="Control whether the school can use the MojaSchool AI Assistant and which staff roles can access it."
              />

              <div className="space-y-6 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles
                        size={17}
                        className="text-wiser-600"
                      />
                      <h2 className="text-sm font-semibold text-slate-900">
                        Enable AI Assistant
                      </h2>
                    </div>
                    <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                      AI remains school-aware and must still respect the user's
                      school role and RLS.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setAIEnabled(!config.ai_settings.enabled)
                    }
                    className={[
                      "relative h-7 w-12 shrink-0 rounded-full transition",
                      aiEnabled ? "bg-wiser-600" : "bg-slate-300",
                    ].join(" ")}
                    aria-pressed={aiEnabled}
                  >
                    <span
                      className={[
                        "absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition",
                        aiEnabled ? "left-6" : "left-1",
                      ].join(" ")}
                    />
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {AI_ROLES.map((role) => {
                    const allowed =
                      config.ai_settings.allowed_roles.includes(
                        role.value,
                      );

                    return (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() => toggleAIRole(role.value)}
                        disabled={!aiEnabled}
                        className={[
                          "flex items-center gap-3 rounded-xl border p-4 text-left transition",
                          allowed
                            ? "border-wiser-200 bg-wiser-50/60"
                            : "border-slate-200 bg-white",
                          !aiEnabled &&
                            "cursor-not-allowed opacity-50",
                        ].join(" ")}
                      >
                        <Users
                          size={17}
                          className={
                            allowed
                              ? "text-wiser-600"
                              : "text-slate-400"
                          }
                        />
                        <span className="flex-1">
                          <span className="block text-sm font-semibold text-slate-900">
                            {role.label}
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {allowed
                              ? "AI access enabled"
                              : "No AI access"}
                          </span>
                        </span>
                        {allowed && (
                          <CheckCircle2
                            size={16}
                            className="text-emerald-600"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {[
                    [
                      "allow_academic_insights",
                      "Academic insights",
                      "Timetable, subjects, lesson coverage and academic setup.",
                    ],
                    [
                      "allow_student_insights",
                      "Student insights",
                      "Enrollment, class counts and student information.",
                    ],
                    [
                      "allow_teacher_insights",
                      "Teacher insights",
                      "Teacher assignments and staffing information.",
                    ],
                    [
                      "allow_timetable_insights",
                      "Timetable insights",
                      "Scheduling conflicts and timetable checks.",
                    ],
                    [
                      "allow_finance_insights",
                      "Finance insights",
                      "Financial information. Keep disabled unless explicitly required.",
                    ],
                  ].map(([key, name, description]) => {
                    const typedKey =
                      key as keyof SchoolConfiguration["ai_settings"];
                    const enabled = Boolean(config.ai_settings[typedKey]);

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() =>
                          updateAI(typedKey, !enabled)
                        }
                        disabled={
                          !aiEnabled ||
                          key === "allow_finance_insights"
                        }
                        className={[
                          "rounded-xl border p-4 text-left",
                          enabled
                            ? "border-wiser-200 bg-wiser-50/60"
                            : "border-slate-200",
                          (!aiEnabled ||
                            key === "allow_finance_insights") &&
                            "cursor-not-allowed opacity-60",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-slate-900">
                            {name}
                          </span>
                          <span
                            className={
                              enabled
                                ? "text-emerald-600"
                                : "text-slate-300"
                            }
                          >
                            <CheckCircle2 size={16} />
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {description}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">
                  <ShieldCheck
                    size={16}
                    className="mt-0.5 shrink-0"
                  />
                  AI configuration does not bypass RLS. The backend must
                  enforce school and role boundaries before sending data to an
                  AI provider.
                </div>
              </div>
            </section>
          )}

          {activeTab === "branding" && (
            <section className="rounded-xl border border-wiser-border bg-white shadow-sm">
              <SectionHeader
                icon={Palette}
                title="Branding"
                description="Set the school-facing visual identity used by the MojaSchool workspace."
              />

              <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-2">
                <Field
                  label="Logo URL"
                  description="Use a public HTTPS image URL for now. Storage upload can be added later."
                >
                  <input
                    value={config.branding.logo_url ?? ""}
                    onChange={(event) =>
                      updateBranding(
                        "logo_url",
                        event.target.value || null,
                      )
                    }
                    placeholder="https://..."
                    className={inputClassName}
                  />
                </Field>

                <Field label="Portal name">
                  <input
                    value={config.branding.portal_name ?? ""}
                    onChange={(event) =>
                      updateBranding(
                        "portal_name",
                        event.target.value || null,
                      )
                    }
                    placeholder="e.g. High Gate School"
                    className={inputClassName}
                  />
                </Field>

                <Field label="Tagline">
                  <input
                    value={config.branding.tagline ?? ""}
                    onChange={(event) =>
                      updateBranding(
                        "tagline",
                        event.target.value || null,
                      )
                    }
                    placeholder="A short school tagline"
                    className={inputClassName}
                  />
                </Field>

                <Field label="Primary colour">
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={config.branding.primary_color}
                      onChange={(event) =>
                        updateBranding(
                          "primary_color",
                          event.target.value,
                        )
                      }
                      className="h-10 w-14 rounded-lg border border-slate-200 bg-white p-1"
                    />
                    <input
                      value={config.branding.primary_color}
                      onChange={(event) =>
                        updateBranding(
                          "primary_color",
                          event.target.value,
                        )
                      }
                      className={inputClassName}
                    />
                  </div>
                </Field>

                <Field label="Secondary colour">
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={config.branding.secondary_color}
                      onChange={(event) =>
                        updateBranding(
                          "secondary_color",
                          event.target.value,
                        )
                      }
                      className="h-10 w-14 rounded-lg border border-slate-200 bg-white p-1"
                    />
                    <input
                      value={config.branding.secondary_color}
                      onChange={(event) =>
                        updateBranding(
                          "secondary_color",
                          event.target.value,
                        )
                      }
                      className={inputClassName}
                    />
                  </div>
                </Field>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                    Preview
                  </p>
                  <div
                    className="mt-3 overflow-hidden rounded-xl border bg-white"
                    style={{
                      borderColor: config.branding.primary_color,
                    }}
                  >
                    <div
                      className="px-4 py-3 text-sm font-semibold text-white"
                      style={{
                        backgroundColor:
                          config.branding.primary_color,
                      }}
                    >
                      {config.branding.portal_name || school.name}
                    </div>
                    <div className="p-4">
                      <p className="text-sm font-semibold text-slate-900">
                        {config.branding.tagline ||
                          "School management workspace"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Students · Academics · Teachers · Parents
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof LayoutGrid;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-wiser-border px-5 py-4 sm:px-6">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-wiser-50 text-wiser-600">
        <Icon size={18} />
      </div>
      <div>
        <h2 className="text-base font-semibold text-wiser-text">{title}</h2>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-wiser-text-secondary">
          {description}
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-700">
        {label}
      </span>
      {description && (
        <span className="mt-1 block text-[11px] leading-5 text-slate-500">
          {description}
        </span>
      )}
      <div className="mt-2">{children}</div>
    </label>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-medium text-slate-800">
        {value}
      </p>
    </div>
  );
}
