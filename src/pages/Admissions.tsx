import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  GraduationCap,
  ImagePlus,
  Loader2,
  Plus,
  Search,
  UserRound,
  X,
  XCircle,
} from "lucide-react";

import { useSchool } from "../context/SchoolContext";
import { supabase } from "../lib/supabase";

type AdmissionStatus =
  | "Pending"
  | "Under Review"
  | "Accepted"
  | "Rejected"
  | "Waitlisted"
  | "Enrolled"
  | "Withdrawn";

type AcademicYear = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
};

type AcademicSection = {
  id: string;
  academic_year_id: string;
  name: string;
  display_order: number;
  is_active: boolean;
};

type SchoolClass = {
  id: string;
  academic_year_id: string | null;
  academic_section_id: string | null;
  name: string;
  is_active: boolean;
};

type AdmissionApplication = {
  id: string;
  school_id: string;
  application_number: string;
  academic_year_id: string;
  section_id: string | null;
  class_id: string | null;

  first_name: string;
  middle_name: string | null;
  last_name: string;

  date_of_birth: string | null;
  gender: string | null;
  nationality: string | null;
  photo_url: string | null;

  previous_school: string | null;
  previous_class: string | null;

  application_date: string;
  status: AdmissionStatus;

  notes: string | null;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  decision_date: string | null;

  student_id: string | null;

  created_at: string;
  updated_at: string;
};

type Form = {
  academicYearId: string;
  sectionId: string;
  classId: string;

  firstName: string;
  middleName: string;
  lastName: string;

  dateOfBirth: string;
  gender: string;
  nationality: string;

  previousSchool: string;
  previousClass: string;

  notes: string;

  photoFile: File | null;
  photoPreview: string;
};

const STATUS_OPTIONS: Array<"All" | AdmissionStatus> = [
  "All",
  "Pending",
  "Under Review",
  "Accepted",
  "Rejected",
  "Waitlisted",
  "Enrolled",
  "Withdrawn",
];

const STATUS_STYLES: Record<AdmissionStatus, string> = {
  Pending: "bg-amber-50 text-amber-700",
  "Under Review": "bg-blue-50 text-blue-700",
  Accepted: "bg-emerald-50 text-emerald-700",
  Rejected: "bg-red-50 text-red-700",
  Waitlisted: "bg-violet-50 text-violet-700",
  Enrolled: "bg-indigo-50 text-indigo-700",
  Withdrawn: "bg-slate-100 text-slate-600",
};

const EMPTY_FORM: Form = {
  academicYearId: "",
  sectionId: "",
  classId: "",

  firstName: "",
  middleName: "",
  lastName: "",

  dateOfBirth: "",
  gender: "",
  nationality: "",

  previousSchool: "",
  previousClass: "",

  notes: "",

  photoFile: null,
  photoPreview: "",
};

export default function Admissions() {
  const { school } = useSchool();
  const navigate = useNavigate();

  const [applications, setApplications] = useState<
    AdmissionApplication[]
  >([]);

  const [academicYears, setAcademicYears] = useState<
    AcademicYear[]
  >([]);

  const [sections, setSections] = useState<
    AcademicSection[]
  >([]);

  const [classes, setClasses] = useState<SchoolClass[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<"All" | AdmissionStatus>("All");

  const [yearFilter, setYearFilter] = useState("All");

  const [showNewModal, setShowNewModal] = useState(false);

  const [form, setForm] = useState<Form>(EMPTY_FORM);

  async function loadData() {
    if (!school?.id) {
      setApplications([]);
      setAcademicYears([]);
      setSections([]);
      setClasses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const schoolId = school.id;

      const [
        applicationsResult,
        academicYearsResult,
        sectionsResult,
        classesResult,
      ] = await Promise.all([
        supabase
          .from("admission_applications")
          .select("*")
          .eq("school_id", schoolId)
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("academic_years")
          .select(
            "id,name,start_date,end_date,is_active",
          )
          .eq("school_id", schoolId)
          .order("start_date", {
            ascending: false,
          }),

        supabase
          .from("academic_sections")
          .select(
            "id,academic_year_id,name,display_order,is_active",
          )
          .eq("school_id", schoolId)
          .order("display_order", {
            ascending: true,
          }),

        supabase
          .from("classes")
          .select(
            "id,academic_year_id,academic_section_id,name,is_active",
          )
          .eq("school_id", schoolId)
          .order("name", {
            ascending: true,
          }),
      ]);

      if (applicationsResult.error) {
        throw applicationsResult.error;
      }

      if (academicYearsResult.error) {
        throw academicYearsResult.error;
      }

      if (sectionsResult.error) {
        throw sectionsResult.error;
      }

      if (classesResult.error) {
        throw classesResult.error;
      }

      setApplications(
        (applicationsResult.data ??
          []) as AdmissionApplication[],
      );

      setAcademicYears(
        (academicYearsResult.data ??
          []) as AcademicYear[],
      );

      setSections(
        (sectionsResult.data ??
          []) as AcademicSection[],
      );

      setClasses(
        (classesResult.data ??
          []) as SchoolClass[],
      );
    } catch (e) {
      console.error(e);

      setError(
        e instanceof Error
          ? e.message
          : "Unable to load admissions.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [school?.id]);

  const activeYear = useMemo(
    () =>
      academicYears.find((year) => year.is_active) ??
      academicYears[0] ??
      null,
    [academicYears],
  );

  const yearMap = useMemo(
    () =>
      new Map(
        academicYears.map((year) => [
          year.id,
          year.name,
        ]),
      ),
    [academicYears],
  );

  const sectionMap = useMemo(
    () =>
      new Map(
        sections.map((section) => [
          section.id,
          section.name,
        ]),
      ),
    [sections],
  );

  const classMap = useMemo(
    () =>
      new Map(
        classes.map((schoolClass) => [
          schoolClass.id,
          schoolClass.name,
        ]),
      ),
    [classes],
  );

  const formSections = useMemo(
    () =>
      sections
        .filter(
          (section) =>
            section.is_active &&
            section.academic_year_id ===
              form.academicYearId,
        )
        .sort(
          (a, b) =>
            a.display_order - b.display_order,
        ),
    [sections, form.academicYearId],
  );

  const formClasses = useMemo(
    () =>
      classes
        .filter(
          (schoolClass) =>
            schoolClass.is_active &&
            schoolClass.academic_year_id ===
              form.academicYearId &&
            (!form.sectionId ||
              schoolClass.academic_section_id ===
                form.sectionId),
        )
        .sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
    [
      classes,
      form.academicYearId,
      form.sectionId,
    ],
  );

  const counts = useMemo(() => {
    const count = (status: AdmissionStatus) =>
      applications.filter(
        (application) =>
          application.status === status,
      ).length;

    return {
      total: applications.length,
      pending: count("Pending"),
      review: count("Under Review"),
      accepted: count("Accepted"),
      rejected: count("Rejected"),
      enrolled: count("Enrolled"),
    };
  }, [applications]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return applications.filter((application) => {
      const name = [
        application.first_name,
        application.middle_name,
        application.last_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const applicationNumber =
        application.application_number?.toLowerCase() ??
        "";

      const previousSchool =
        application.previous_school?.toLowerCase() ??
        "";

      return (
        (statusFilter === "All" ||
          application.status === statusFilter) &&
        (yearFilter === "All" ||
          application.academic_year_id === yearFilter) &&
        (!query ||
          name.includes(query) ||
          applicationNumber.includes(query) ||
          previousSchool.includes(query))
      );
    });
  }, [
    applications,
    search,
    statusFilter,
    yearFilter,
  ]);

  function update<K extends keyof Form>(
    key: K,
    value: Form[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function openNew() {
    setError("");

    setForm({
      ...EMPTY_FORM,
      academicYearId: activeYear?.id ?? "",
    });

    setShowNewModal(true);
  }

  function closeNew() {
    if (saving) return;

    if (form.photoPreview) {
      URL.revokeObjectURL(form.photoPreview);
    }

    setShowNewModal(false);
    setForm(EMPTY_FORM);
    setError("");
  }

  function handlePhotoChange(file: File | null) {
    if (!file) return;

    if (
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
      ].includes(file.type)
    ) {
      setError(
        "Please upload a JPG, PNG or WebP image.",
      );
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError(
        "Photo must be 5 MB or smaller.",
      );
      return;
    }

    if (form.photoPreview) {
      URL.revokeObjectURL(form.photoPreview);
    }

    const previewUrl = URL.createObjectURL(file);

    setError("");

    setForm((current) => ({
      ...current,
      photoFile: file,
      photoPreview: previewUrl,
    }));
  }

  function removePhoto() {
    if (form.photoPreview) {
      URL.revokeObjectURL(form.photoPreview);
    }

    setForm((current) => ({
      ...current,
      photoFile: null,
      photoPreview: "",
    }));
  }

  function generateApplicationNumber(
    academicYearId: string,
  ) {
    const year =
      academicYears.find(
        (item) => item.id === academicYearId,
      );

    const yearLabel =
      year?.name?.match(/\d{4}/)?.[0] ??
      new Date().getFullYear().toString();

    const timestamp =
      Date.now().toString().slice(-6);

    const random = Math.floor(
      100 + Math.random() * 900,
    );

    return `ADM-${yearLabel}-${timestamp}${random}`;
  }

  async function uploadApplicantPhoto(
    applicationId: string,
    file: File,
  ) {
    if (!school?.id) {
      throw new Error(
        "No school is associated with your account.",
      );
    }

    const extension =
      file.name
        .split(".")
        .pop()
        ?.toLowerCase() || "jpg";

    const filePath = [
      school.id,
      applicationId,
      `applicant-${crypto.randomUUID()}.${extension}`,
    ].join("/");

    const { error: uploadError } =
      await supabase.storage
        .from("admission-photos")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

    if (uploadError) {
      throw uploadError;
    }

    const {
      data: { publicUrl },
    } = supabase.storage
      .from("admission-photos")
      .getPublicUrl(filePath);

    return publicUrl;
  }

  async function createApplication() {
    if (!school?.id) return;

    if (!form.academicYearId) {
      setError(
        "Please select an academic year.",
      );
      return;
    }

    if (!form.sectionId) {
      setError("Please select a section.");
      return;
    }

    if (
      !form.firstName.trim() ||
      !form.lastName.trim()
    ) {
      setError(
        "First name and last name are required.",
      );
      return;
    }

    setSaving(true);
    setError("");

    let createdApplicationId: string | null =
      null;

    try {
      const applicationNumber =
        generateApplicationNumber(
          form.academicYearId,
        );

      const payload = {
        school_id: school.id,
        application_number:
          applicationNumber,

        academic_year_id:
          form.academicYearId,

        section_id:
          form.sectionId || null,

        class_id:
          form.classId || null,

        first_name:
          form.firstName.trim(),

        middle_name:
          form.middleName.trim() || null,

        last_name:
          form.lastName.trim(),

        date_of_birth:
          form.dateOfBirth || null,

        gender:
          form.gender || null,

        nationality:
          form.nationality.trim() || null,

        photo_url: null,

        previous_school:
          form.previousSchool.trim() || null,

        previous_class:
          form.previousClass.trim() || null,

        notes:
          form.notes.trim() || null,

        status: "Pending",
      };

      const {
        data,
        error: createError,
      } = await supabase
        .from("admission_applications")
        .insert(payload)
        .select("*")
        .single();

      if (createError) {
        throw createError;
      }

      const created =
        data as AdmissionApplication;

      createdApplicationId = created.id;

      let photoUrl: string | null = null;

      if (form.photoFile) {
        photoUrl =
          await uploadApplicantPhoto(
            created.id,
            form.photoFile,
          );

        const {
          error: photoUpdateError,
        } = await supabase
          .from("admission_applications")
          .update({
            photo_url: photoUrl,
          })
          .eq("id", created.id)
          .eq("school_id", school.id);

        if (photoUpdateError) {
          throw photoUpdateError;
        }
      }

      const finalApplication: AdmissionApplication =
        {
          ...created,
          photo_url: photoUrl,
        };

      setApplications((current) => [
        finalApplication,
        ...current,
      ]);

      if (form.photoPreview) {
        URL.revokeObjectURL(
          form.photoPreview,
        );
      }

      setShowNewModal(false);
      setForm(EMPTY_FORM);
    } catch (e) {
      console.error(
        "Failed to create admission application:",
        e,
      );

      /*
       * If the application was created but the photo
       * upload/update failed, remove the incomplete
       * application so we don't leave a broken record.
       */
      if (createdApplicationId) {
        await supabase
          .from("admission_applications")
          .delete()
          .eq("id", createdApplicationId)
          .eq("school_id", school.id);
      }

      setError(
        e instanceof Error
          ? e.message
          : "Unable to create the application.",
      );
    } finally {
      setSaving(false);
    }
  }

  const date = (value: string | null) => {
    if (!value) return "—";

    const parsedDate = new Date(
      `${value}T00:00:00`,
    );

    if (Number.isNaN(parsedDate.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat(
      "en-GB",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      },
    ).format(parsedDate);
  };

  const name = (
    application: AdmissionApplication,
  ) =>
    [
      application.first_name,
      application.middle_name,
      application.last_name,
    ]
      .filter(Boolean)
      .join(" ");

  if (!school) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-[1400px]">
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <GraduationCap className="mx-auto h-10 w-10 text-slate-300" />

          <h2 className="mt-4 text-base font-semibold text-slate-900">
            Select a school
          </h2>

          <p className="mt-1 max-w-full break-words text-sm text-slate-500">
            Select a school before managing
            admissions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto w-full min-w-0 max-w-[1400px]">
        {/* Header */}
        <div className="mb-6 flex min-w-0 w-full flex-col gap-4 sm:mb-7 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              School
            </p>

            <h1 className="mt-1 break-words text-2xl font-semibold text-slate-900 sm:text-2xl">
              Admissions
            </h1>

            <p className="mt-1 max-w-full break-words text-sm text-slate-500">
              Manage applications, admission
              decisions and enrollment.
            </p>
          </div>

          <button
            type="button"
            onClick={openNew}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 sm:w-auto"
          >
            <Plus size={17} />
            New Application
          </button>
        </div>

        {error && !showNewModal && (
          <ErrorBox
            error={error}
            clear={() => setError("")}
          />
        )}

        {/* Metrics */}
        <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
          <MetricCard
            icon={<FileText size={18} />}
            label="Total Applications"
            value={counts.total}
          />

          <MetricCard
            icon={<Clock3 size={18} />}
            label="Pending"
            value={counts.pending}
          />

          <MetricCard
            icon={<Search size={18} />}
            label="Under Review"
            value={counts.review}
          />

          <MetricCard
            icon={<CheckCircle2 size={18} />}
            label="Accepted"
            value={counts.accepted}
          />

          <MetricCard
            icon={<XCircle size={18} />}
            label="Rejected"
            value={counts.rejected}
          />

          <MetricCard
            icon={<GraduationCap size={18} />}
            label="Enrolled"
            value={counts.enrolled}
          />
        </div>

        {/* Applications */}
        <div className="mt-5 min-w-0 w-full max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:mt-6">
          <div className="min-w-0 border-b border-slate-200 p-4 sm:p-5">
            <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Applications
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Review and manage student
                  admission applications.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-center">
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    value={search}
                    onChange={(event) =>
                      setSearch(event.target.value)
                    }
                    placeholder="Search applications..."
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                <select
                  value={yearFilter}
                  onChange={(event) =>
                    setYearFilter(event.target.value)
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-500"
                >
                  <option value="All">
                    All academic years
                  </option>

                  {academicYears.map((year) => (
                    <option
                      key={year.id}
                      value={year.id}
                    >
                      {year.name}
                    </option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value as
                        | "All"
                        | AdmissionStatus,
                    )
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-500"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option
                      key={status}
                      value={status}
                    >
                      {status === "All"
                        ? "All statuses"
                        : status}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[320px] items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <Loader2
                  size={18}
                  className="animate-spin text-indigo-600"
                />
                Loading applications...
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyApplications
              onAdd={openNew}
            />
          ) : (
            <>
            <div className="md:hidden divide-y divide-slate-100">
              {filtered.map((application) => (
                <div key={application.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-50 text-indigo-600">
                        {application.photo_url ? (
                          <img src={application.photo_url} alt={name(application)} className="h-full w-full object-cover" />
                        ) : (
                          <UserRound size={18} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-900">{name(application)}</div>
                        <div className="mt-0.5 truncate text-xs font-medium text-indigo-700">{application.application_number || "—"}</div>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLES[application.status]}`}>
                      {application.status}
                    </span>
                  </div>
                  <div className="mt-4 grid min-w-0 grid-cols-1 gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
                    <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Academic Year</p><p className="mt-1 text-xs font-medium text-slate-700">{yearMap.get(application.academic_year_id) || "—"}</p></div>
                    <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Section</p><p className="mt-1 text-xs font-medium text-slate-700">{application.section_id ? sectionMap.get(application.section_id) || "—" : "—"}</p></div>
                    <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Class</p><p className="mt-1 text-xs font-medium text-slate-700">{application.class_id ? classMap.get(application.class_id) || "—" : "Not assigned"}</p></div>
                    <div><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Applied</p><p className="mt-1 text-xs font-medium text-slate-700">{date(application.application_date)}</p></div>
                  </div>
                  <button type="button" onClick={() => navigate(`/admissions/${application.id}`)} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600">
                    View Application <ArrowRight size={13} />
                  </button>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-[1000px] w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {[
                      "Application",
                      "Applicant",
                      "Academic Year",
                      "Section",
                      "Class",
                      "Applied",
                      "Status",
                      "Action",
                    ].map((heading, index) => (
                      <th
                        key={heading}
                        className={`px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 ${
                          index === 7
                            ? "text-right"
                            : ""
                        }`}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filtered.map(
                    (application) => (
                      <tr
                        key={application.id}
                        className="transition hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-4 text-sm font-semibold text-indigo-700">
                          {application.application_number ||
                            "—"}
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-50 text-indigo-600">
                              {application.photo_url ? (
                                <img
                                  src={
                                    application.photo_url
                                  }
                                  alt={name(
                                    application,
                                  )}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <UserRound
                                  size={16}
                                />
                              )}
                            </div>

                            <div>
                              <div className="text-sm font-medium text-slate-900">
                                {name(
                                  application,
                                )}
                              </div>

                              <div className="mt-0.5 text-xs text-slate-400">
                                {application.gender ||
                                  "Gender not provided"}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {yearMap.get(
                            application.academic_year_id,
                          ) || "—"}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {application.section_id
                            ? sectionMap.get(
                                application.section_id,
                              ) || "—"
                            : "—"}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {application.class_id
                            ? classMap.get(
                                application.class_id,
                              ) || "—"
                            : "Not assigned"}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {date(
                            application.application_date,
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                              STATUS_STYLES[
                                application.status
                              ]
                            }`}
                          >
                            {application.status}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                `/admissions/${application.id}`,
                              )
                            }
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
                          >
                            View
                            <ArrowRight
                              size={13}
                            />
                          </button>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
            </>
          )}

          {!loading &&
            filtered.length > 0 && (
              <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400 sm:px-5">
                Showing {filtered.length} of{" "}
                {applications.length} applications
              </div>
            )}
        </div>
      </div>

      {showNewModal && (
        <NewApplicationModal
          form={form}
          saving={saving}
          error={error}
          academicYears={academicYears}
          sections={formSections}
          classes={formClasses}
          onChange={update}
          onClose={closeNew}
          onSave={createApplication}
          onSectionChange={(id) => {
            update("sectionId", id);
            update("classId", "");
          }}
          onPhotoChange={handlePhotoChange}
          onRemovePhoto={removePhoto}
        />
      )}
    </>
  );
}

/* =========================================================
   METRIC CARD
========================================================= */

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          {icon}
        </div>

        <div>
          <p className="text-xs font-medium text-slate-500">
            {label}
          </p>

          <p className="mt-0.5 text-2xl font-semibold text-slate-900">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   EMPTY STATE
========================================================= */

function EmptyApplications({
  onAdd,
}: {
  onAdd: () => void;
}) {
  return (
    <div className="px-5 py-16 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
        <FileText size={22} />
      </div>

      <h3 className="mt-4 text-sm font-semibold text-slate-900">
        No admission applications
      </h3>

      <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
        Start by creating an admission
        application for a prospective student.
      </p>

      <button
        type="button"
        onClick={onAdd}
        className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"
      >
        <Plus size={16} />
        New Application
      </button>
    </div>
  );
}

/* =========================================================
   NEW APPLICATION MODAL
========================================================= */

function NewApplicationModal({
  form,
  saving,
  error,
  academicYears,
  sections,
  classes,
  onChange,
  onClose,
  onSave,
  onSectionChange,
  onPhotoChange,
  onRemovePhoto,
}: {
  form: Form;
  saving: boolean;
  error: string;

  academicYears: AcademicYear[];
  sections: AcademicSection[];
  classes: SchoolClass[];

  onChange: <K extends keyof Form>(
    key: K,
    value: Form[K],
  ) => void;

  onClose: () => void;
  onSave: () => void;

  onSectionChange: (id: string) => void;

  onPhotoChange: (
    file: File | null,
  ) => void;

  onRemovePhoto: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[96vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl">
        {/* Modal header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              New Admission Application
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Register a prospective student for
              admission.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:p-6">
          {error && (
            <ErrorBox
              error={error}
              clear={() => undefined}
            />
          )}

          <div className="space-y-6">
            {/* Placement */}
            <section>
              <SectionTitle
                icon={
                  <CalendarDays size={16} />
                }
                title="Admission placement"
                description="Choose the academic year and intended school section."
              />

              <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
                <SelectField
                  label="Academic year"
                  value={
                    form.academicYearId
                  }
                  onChange={(value) => {
                    onChange(
                      "academicYearId",
                      value,
                    );

                    onChange(
                      "sectionId",
                      "",
                    );

                    onChange(
                      "classId",
                      "",
                    );
                  }}
                  options={academicYears.map(
                    (year) => ({
                      value: year.id,
                      label: year.name,
                    }),
                  )}
                  placeholder="Select academic year"
                  required
                />

                <SelectField
                  label="Section"
                  value={form.sectionId}
                  onChange={
                    onSectionChange
                  }
                  options={sections.map(
                    (section) => ({
                      value: section.id,
                      label: section.name,
                    }),
                  )}
                  placeholder="Select section"
                  required
                  disabled={
                    !form.academicYearId
                  }
                />

                <SelectField
                  label="Desired class"
                  value={form.classId}
                  onChange={(value) =>
                    onChange(
                      "classId",
                      value,
                    )
                  }
                  options={classes.map(
                    (schoolClass) => ({
                      value:
                        schoolClass.id,
                      label:
                        schoolClass.name,
                    }),
                  )}
                  placeholder="Select class (optional)"
                  disabled={
                    !form.sectionId
                  }
                />
              </div>
            </section>

            {/* Student information */}
            <section>
              <SectionTitle
                icon={
                  <UserRound size={16} />
                }
                title="Student information"
                description="Basic information about the applicant."
              />

              <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
                <InputField
                  label="First name"
                  value={form.firstName}
                  onChange={(value) =>
                    onChange(
                      "firstName",
                      value,
                    )
                  }
                  placeholder="First name"
                  required
                />

                <InputField
                  label="Middle name"
                  value={form.middleName}
                  onChange={(value) =>
                    onChange(
                      "middleName",
                      value,
                    )
                  }
                  placeholder="Middle name"
                />

                <InputField
                  label="Last name"
                  value={form.lastName}
                  onChange={(value) =>
                    onChange(
                      "lastName",
                      value,
                    )
                  }
                  placeholder="Last name"
                  required
                />

                <InputField
                  label="Date of birth"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(value) =>
                    onChange(
                      "dateOfBirth",
                      value,
                    )
                  }
                />

                <SelectField
                  label="Gender"
                  value={form.gender}
                  onChange={(value) =>
                    onChange(
                      "gender",
                      value,
                    )
                  }
                  options={[
                    {
                      value: "Male",
                      label: "Male",
                    },
                    {
                      value: "Female",
                      label: "Female",
                    },
                  ]}
                  placeholder="Select gender"
                />

                <InputField
                  label="Nationality"
                  value={form.nationality}
                  onChange={(value) =>
                    onChange(
                      "nationality",
                      value,
                    )
                  }
                  placeholder="e.g. Rwandan"
                />

                {/* Applicant photo */}
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Applicant photo
                  </label>

                  <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      {/* Preview */}
                      <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white">
                        {form.photoPreview ? (
                          <img
                            src={
                              form.photoPreview
                            }
                            alt="Applicant preview"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-300">
                            <UserRound
                              size={32}
                            />

                            <span className="mt-1 text-[10px]">
                              No photo
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <label className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 sm:w-auto">
                          <ImagePlus
                            size={16}
                          />

                          {form.photoFile
                            ? "Change photo"
                            : "Upload photo"}

                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            disabled={saving}
                            onChange={(
                              event,
                            ) => {
                              const file =
                                event
                                  .target
                                  .files?.[0] ??
                                null;

                              onPhotoChange(
                                file,
                              );

                              event.currentTarget.value =
                                "";
                            }}
                          />
                        </label>

                        {form.photoFile && (
                          <button
                            type="button"
                            onClick={
                              onRemovePhoto
                            }
                            disabled={saving}
                            className="mt-2 block text-xs font-medium text-red-500 hover:text-red-600 sm:ml-2 sm:mt-0 sm:inline-block"
                          >
                            Remove
                          </button>
                        )}

                        <p className="mt-2 text-[11px] leading-5 text-slate-400">
                          JPG, PNG or WebP
                          <br />
                          Maximum 5 MB
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Previous education */}
            <section>
              <SectionTitle
                icon={
                  <GraduationCap size={16} />
                }
                title="Previous education"
                description="Optional information about the applicant's previous school."
              />

              <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
                <InputField
                  label="Previous school"
                  value={
                    form.previousSchool
                  }
                  onChange={(value) =>
                    onChange(
                      "previousSchool",
                      value,
                    )
                  }
                  placeholder="School name"
                />

                <InputField
                  label="Previous class"
                  value={
                    form.previousClass
                  }
                  onChange={(value) =>
                    onChange(
                      "previousClass",
                      value,
                    )
                  }
                  placeholder="e.g. Grade 5"
                />
              </div>
            </section>

            {/* Notes */}
            <section>
              <SectionTitle
                icon={
                  <FileText size={16} />
                }
                title="Application notes"
                description="Add any useful information for the admissions team."
              />

              <textarea
                value={form.notes}
                onChange={(event) =>
                  onChange(
                    "notes",
                    event.target.value,
                  )
                }
                placeholder="Additional information..."
                rows={4}
                className="mt-4 w-full resize-none rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 px-4 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-10 w-full rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 sm:w-auto"
          >
            {saving && (
              <Loader2
                size={16}
                className="animate-spin"
              />
            )}

            {saving
              ? "Creating..."
              : "Create Application"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   SECTION TITLE
========================================================= */

function SectionTitle({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
        {icon}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900">
          {title}
        </h3>

        <p className="mt-0.5 text-xs text-slate-500">
          {description}
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   INPUT FIELD
========================================================= */

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-700">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </label>

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        required={required}
        className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />
    </div>
  );
}

/* =========================================================
   SELECT FIELD
========================================================= */

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  required = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{
    value: string;
    label: string;
  }>;
  placeholder: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-700">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </label>

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        disabled={disabled}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 disabled:bg-slate-50"
      >
        <option value="">
          {placeholder}
        </option>

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

/* =========================================================
   ERROR BOX
========================================================= */

function ErrorBox({
  error,
  clear,
}: {
  error: string;
  clear: () => void;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
      <div className="flex items-start gap-2">
        <AlertCircle
          size={16}
          className="mt-0.5 shrink-0 text-red-500"
        />

        <p className="text-sm text-red-700">
          {error}
        </p>
      </div>

      <button
        type="button"
        onClick={clear}
        className="shrink-0 text-red-400 hover:text-red-600"
      >
        <X size={16} />
      </button>
    </div>
  );
}