import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Bell,
  CalendarDays,
  ChevronDown,
  Edit3,
  Eye,
  FileText,
  Loader2,
  Megaphone,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";

import { useSchool } from "../context/SchoolContext";
import { getClasses, type SchoolClass } from "../lib/classes";
import { supabase } from "../lib/supabase";

interface AcademicYear {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

interface AcademicSection {
  id: string;
  name: string;
  academic_year_id: string;
  display_order: number;
  is_active: boolean;
}

interface Announcement {
  id: string;
  school_id: string;
  title: string;
  content: string;
  status: "Draft" | "Published" | "Archived";
  priority: "Normal" | "Important" | "Urgent";
  audience_type:
    | "All School"
    | "Parents"
    | "Students"
    | "Teachers"
    | "Staff"
    | "Section"
    | "Class";
  academic_year_id: string | null;
  academic_section_id: string | null;
  class_id: string | null;
  publish_date: string | null;
  expiry_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

type AudienceType = Announcement["audience_type"];
type Priority = Announcement["priority"];

interface AnnouncementForm {
  title: string;
  content: string;
  status: "Draft" | "Published";
  priority: Priority;
  audience_type: AudienceType;
  academic_year_id: string;
  academic_section_id: string;
  class_id: string;
  publish_date: string;
  expiry_date: string;
}

const emptyForm: AnnouncementForm = {
  title: "",
  content: "",
  status: "Draft",
  priority: "Normal",
  audience_type: "All School",
  academic_year_id: "",
  academic_section_id: "",
  class_id: "",
  publish_date: "",
  expiry_date: "",
};

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function toLocalInputValue(value: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000,
  );

  return local.toISOString().slice(0, 16);
}

function getStatusClasses(
  status: Announcement["status"],
) {
  switch (status) {
    case "Published":
      return "bg-green-50 text-green-700 border-green-200";
    case "Archived":
      return "bg-gray-100 text-gray-600 border-gray-200";
    default:
      return "bg-amber-50 text-amber-700 border-amber-200";
  }
}

function getPriorityClasses(priority: Priority) {
  switch (priority) {
    case "Urgent":
      return "bg-red-50 text-red-700 border-red-200";
    case "Important":
      return "bg-blue-50 text-blue-700 border-blue-200";
    default:
      return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

function getAudienceLabel(
  announcement: Announcement,
  sections: AcademicSection[],
  classes: SchoolClass[],
) {
  if (announcement.audience_type === "Section") {
    const section = sections.find(
      (item) =>
        item.id === announcement.academic_section_id,
    );

    return section
      ? `Section • ${section.name}`
      : "Section";
  }

  if (announcement.audience_type === "Class") {
    const schoolClass = classes.find(
      (item) => item.id === announcement.class_id,
    );

    return schoolClass
      ? `Class • ${schoolClass.name}`
      : "Class";
  }

  return announcement.audience_type;
}

function getContentPreview(content: string) {
  const clean = content.replace(/\s+/g, " ").trim();

  if (clean.length <= 120) {
    return clean;
  }

  return `${clean.slice(0, 120)}...`;
}

export default function Announcements() {
  const { school } = useSchool();

  const [announcements, setAnnouncements] = useState<
    Announcement[]
  >([]);

  const [academicYears, setAcademicYears] = useState<
    AcademicYear[]
  >([]);

  const [sections, setSections] = useState<
    AcademicSection[]
  >([]);

  const [classes, setClasses] = useState<
    SchoolClass[]
  >([]);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(
    null,
  );

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] = useState<
    "All" | Announcement["status"]
  >("All");

  const [priorityFilter, setPriorityFilter] = useState<
    "All" | Priority
  >("All");

  const [audienceFilter, setAudienceFilter] =
    useState<"All" | AudienceType>("All");

  const [showModal, setShowModal] = useState(false);

  const [editingAnnouncement, setEditingAnnouncement] =
    useState<Announcement | null>(null);

  const [viewingAnnouncement, setViewingAnnouncement] =
    useState<Announcement | null>(null);

  const [form, setForm] =
    useState<AnnouncementForm>(emptyForm);

  useEffect(() => {
    loadData();
  }, [school?.id]);

  async function loadData() {
    if (!school) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const schoolId = school.id;

      const [
        announcementsResponse,
        yearsResponse,
        sectionsResponse,
        classesResponse,
      ] = await Promise.all([
        supabase
          .from("announcements")
          .select(
            `
              id,
              school_id,
              title,
              content,
              status,
              priority,
              audience_type,
              academic_year_id,
              academic_section_id,
              class_id,
              publish_date,
              expiry_date,
              created_by,
              created_at,
              updated_at
            `,
          )
          .eq("school_id", schoolId)
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("academic_years")
          .select(
            "id, name, start_date, end_date, is_current",
          )
          .eq("school_id", schoolId)
          .order("start_date", {
            ascending: false,
          }),

        supabase
          .from("academic_sections")
          .select(
            "id, name, academic_year_id, display_order, is_active",
          )
          .eq("school_id", schoolId)
          .order("display_order", {
            ascending: true,
          }),

        getClasses(schoolId),
      ]);

      if (announcementsResponse.error) {
        throw announcementsResponse.error;
      }

      if (yearsResponse.error) {
        throw yearsResponse.error;
      }

      if (sectionsResponse.error) {
        throw sectionsResponse.error;
      }

      if (classesResponse.error) {
        throw classesResponse.error;
      }

      setAnnouncements(
        (announcementsResponse.data ??
          []) as Announcement[],
      );

      const years =
        (yearsResponse.data ??
          []) as AcademicYear[];

      setAcademicYears(years);

      setSections(
        (sectionsResponse.data ??
          []) as AcademicSection[],
      );

      setClasses(classesResponse.data ?? []);

      const currentYear =
        years.find((year) => year.is_current) ??
        years[0];

      if (currentYear) {
        setForm((current) => ({
          ...current,
          academic_year_id:
            current.academic_year_id ||
            currentYear.id,
        }));
      }
    } catch (err) {
      console.error(
        "Error loading announcements:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to load announcements.",
      );
    } finally {
      setLoading(false);
    }
  }

  const currentAcademicYear = useMemo(
    () =>
      academicYears.find(
        (year) => year.is_current,
      ) ?? academicYears[0],
    [academicYears],
  );

  const sectionsForSelectedYear = useMemo(() => {
    if (!form.academic_year_id) return [];

    return sections
      .filter(
        (section) =>
          section.academic_year_id ===
          form.academic_year_id &&
          section.is_active,
      )
      .sort(
        (a, b) =>
          a.display_order - b.display_order,
      );
  }, [sections, form.academic_year_id]);

  const classesForSelectedYear = useMemo(() => {
    if (!form.academic_year_id) return [];

    return classes.filter((schoolClass) => {
      const item = schoolClass as SchoolClass & {
        academicYearId?: string | null;
        academic_year_id?: string | null;
      };

      const yearId =
        item.academicYearId ??
        item.academic_year_id ??
        null;

      return yearId === form.academic_year_id;
    });
  }, [classes, form.academic_year_id]);

  const filteredAnnouncements = useMemo(() => {
    const query = search.trim().toLowerCase();

    return announcements.filter((announcement) => {
      if (
        statusFilter !== "All" &&
        announcement.status !== statusFilter
      ) {
        return false;
      }

      if (
        priorityFilter !== "All" &&
        announcement.priority !== priorityFilter
      ) {
        return false;
      }

      if (
        audienceFilter !== "All" &&
        announcement.audience_type !== audienceFilter
      ) {
        return false;
      }

      if (!query) return true;

      return (
        announcement.title
          .toLowerCase()
          .includes(query) ||
        announcement.content
          .toLowerCase()
          .includes(query) ||
        announcement.audience_type
          .toLowerCase()
          .includes(query)
      );
    });
  }, [
    announcements,
    search,
    statusFilter,
    priorityFilter,
    audienceFilter,
  ]);

  const summary = useMemo(() => {
    return {
      total: announcements.length,
      published: announcements.filter(
        (item) => item.status === "Published",
      ).length,
      drafts: announcements.filter(
        (item) => item.status === "Draft",
      ).length,
      urgent: announcements.filter(
        (item) => item.priority === "Urgent",
      ).length,
    };
  }, [announcements]);

  function openCreateModal() {
    setEditingAnnouncement(null);

    setForm({
      ...emptyForm,
      academic_year_id:
        currentAcademicYear?.id ?? "",
    });

    setShowModal(true);
    setError(null);
  }

  function openEditModal(
    announcement: Announcement,
  ) {
    setEditingAnnouncement(announcement);

    setForm({
      title: announcement.title,
      content: announcement.content,
      status:
        announcement.status === "Archived"
          ? "Draft"
          : announcement.status,
      priority: announcement.priority,
      audience_type:
        announcement.audience_type,
      academic_year_id:
        announcement.academic_year_id ??
        currentAcademicYear?.id ??
        "",
      academic_section_id:
        announcement.academic_section_id ?? "",
      class_id:
        announcement.class_id ?? "",
      publish_date: toLocalInputValue(
        announcement.publish_date,
      ),
      expiry_date: toLocalInputValue(
        announcement.expiry_date,
      ),
    });

    setShowModal(true);
    setError(null);
  }

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setEditingAnnouncement(null);
  }

  function updateForm(
    changes: Partial<AnnouncementForm>,
  ) {
    setForm((current) => ({
      ...current,
      ...changes,
    }));
  }

  function handleAudienceChange(
    audience: AudienceType,
  ) {
    updateForm({
      audience_type: audience,
      academic_section_id:
        audience === "Section"
          ? form.academic_section_id
          : "",
      class_id:
        audience === "Class"
          ? form.class_id
          : "",
    });
  }

  function handleAcademicYearChange(
    academicYearId: string,
  ) {
    updateForm({
      academic_year_id: academicYearId,
      academic_section_id: "",
      class_id: "",
    });
  }

  async function saveAnnouncement(
    publishOverride?: boolean,
  ) {
    if (!school) return;

    const title = form.title.trim();
    const content = form.content.trim();

    if (!title) {
      setError("Please enter an announcement title.");
      return;
    }

    if (!content) {
      setError(
        "Please enter the announcement content.",
      );
      return;
    }

    if (
      form.audience_type === "Section" &&
      !form.academic_section_id
    ) {
      setError(
        "Please select a section for this announcement.",
      );
      return;
    }

    if (
      form.audience_type === "Class" &&
      !form.class_id
    ) {
      setError(
        "Please select a class for this announcement.",
      );
      return;
    }

    if (
      form.expiry_date &&
      form.publish_date &&
      new Date(form.expiry_date) <
        new Date(form.publish_date)
    ) {
      setError(
        "Expiry date cannot be earlier than the publish date.",
      );
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const status =
        publishOverride === true
          ? "Published"
          : form.status;

      const payload = {
        school_id: school.id,
        title,
        content,
        status,
        priority: form.priority,
        audience_type: form.audience_type,
        academic_year_id:
          form.academic_year_id || null,
        academic_section_id:
          form.audience_type === "Section"
            ? form.academic_section_id || null
            : null,
        class_id:
          form.audience_type === "Class"
            ? form.class_id || null
            : null,
        publish_date:
          form.publish_date
            ? new Date(
                form.publish_date,
              ).toISOString()
            : status === "Published"
              ? new Date().toISOString()
              : null,
        expiry_date:
          form.expiry_date
            ? new Date(
                form.expiry_date,
              ).toISOString()
            : null,
      };

      if (editingAnnouncement) {
        const { error: updateError } =
          await supabase
            .from("announcements")
            .update(payload)
            .eq(
              "id",
              editingAnnouncement.id,
            )
            .eq("school_id", school.id);

        if (updateError) {
          throw updateError;
        }
      } else {
        const { data, error: insertError } =
          await supabase
            .from("announcements")
            .insert(payload)
            .select(
              `
                id,
                school_id,
                title,
                content,
                status,
                priority,
                audience_type,
                academic_year_id,
                academic_section_id,
                class_id,
                publish_date,
                expiry_date,
                created_by,
                created_at,
                updated_at
              `,
            )
            .single();

        if (insertError) {
          throw insertError;
        }

        if (data) {
          setAnnouncements((current) => [
            data as Announcement,
            ...current,
          ]);
        }
      }

      if (editingAnnouncement) {
        await loadData();
      }

      setShowModal(false);
      setEditingAnnouncement(null);
    } catch (err) {
      console.error(
        "Error saving announcement:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to save announcement.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(
    announcement: Announcement,
    status: Announcement["status"],
  ) {
    if (!school) return;

    try {
      setError(null);

      const { error: updateError } =
        await supabase
          .from("announcements")
          .update({
            status,
            publish_date:
              status === "Published"
                ? announcement.publish_date ??
                  new Date().toISOString()
                : announcement.publish_date,
          })
          .eq("id", announcement.id)
          .eq("school_id", school.id);

      if (updateError) {
        throw updateError;
      }

      setAnnouncements((current) =>
        current.map((item) =>
          item.id === announcement.id
            ? {
                ...item,
                status,
                publish_date:
                  status === "Published"
                    ? item.publish_date ??
                      new Date().toISOString()
                    : item.publish_date,
              }
            : item,
        ),
      );
    } catch (err) {
      console.error(
        "Error updating announcement:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to update announcement.",
      );
    }
  }

  async function deleteAnnouncement(
    announcement: Announcement,
  ) {
    if (!school) return;

    const confirmed = window.confirm(
      `Delete "${announcement.title}"? This action cannot be undone.`,
    );

    if (!confirmed) return;

    try {
      setError(null);

      const { error: deleteError } =
        await supabase
          .from("announcements")
          .delete()
          .eq("id", announcement.id)
          .eq("school_id", school.id);

      if (deleteError) {
        throw deleteError;
      }

      setAnnouncements((current) =>
        current.filter(
          (item) =>
            item.id !== announcement.id,
        ),
      );

      if (
        viewingAnnouncement?.id ===
        announcement.id
      ) {
        setViewingAnnouncement(null);
      }
    } catch (err) {
      console.error(
        "Error deleting announcement:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete announcement.",
      );
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading announcements...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="text-sm font-medium text-gray-500">
            Communication
          </div>

          <h1 className="mt-1 text-2xl font-bold text-gray-900">
            Announcements
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            Share important information with the school
            community.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" />
          New Announcement
        </button>
      </div>

      {error && (
        <div className="flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>

          <button
            type="button"
            onClick={() => setError(null)}
            className="shrink-0 rounded p-1 hover:bg-red-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Total
            </span>

            <Megaphone className="h-5 w-5 text-gray-400" />
          </div>

          <div className="mt-2 text-2xl font-bold text-gray-900">
            {summary.total}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Published
            </span>

            <Bell className="h-5 w-5 text-gray-400" />
          </div>

          <div className="mt-2 text-2xl font-bold text-gray-900">
            {summary.published}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Drafts
            </span>

            <FileText className="h-5 w-5 text-gray-400" />
          </div>

          <div className="mt-2 text-2xl font-bold text-gray-900">
            {summary.drafts}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              Urgent
            </span>

            <Bell className="h-5 w-5 text-gray-400" />
          </div>

          <div className="mt-2 text-2xl font-bold text-gray-900">
            {summary.urgent}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="relative md:col-span-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search announcements..."
              className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-gray-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as
                  | "All"
                  | Announcement["status"],
              )
            }
            className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-gray-500"
          >
            <option value="All">
              All Statuses
            </option>

            <option value="Published">
              Published
            </option>

            <option value="Draft">
              Draft
            </option>

            <option value="Archived">
              Archived
            </option>
          </select>

          <select
            value={priorityFilter}
            onChange={(event) =>
              setPriorityFilter(
                event.target.value as
                  | "All"
                  | Priority,
              )
            }
            className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-gray-500"
          >
            <option value="All">
              All Priorities
            </option>

            <option value="Normal">
              Normal
            </option>

            <option value="Important">
              Important
            </option>

            <option value="Urgent">
              Urgent
            </option>
          </select>

          <select
            value={audienceFilter}
            onChange={(event) =>
              setAudienceFilter(
                event.target.value as
                  | "All"
                  | AudienceType,
              )
            }
            className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-gray-500"
          >
            <option value="All">
              All Audiences
            </option>

            <option value="All School">
              All School
            </option>

            <option value="Parents">
              Parents
            </option>

            <option value="Students">
              Students
            </option>

            <option value="Teachers">
              Teachers
            </option>

            <option value="Staff">
              Staff
            </option>

            <option value="Section">
              Section
            </option>

            <option value="Class">
              Class
            </option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="font-semibold text-gray-900">
            Announcements
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            {filteredAnnouncements.length} announcement
            {filteredAnnouncements.length === 1
              ? ""
              : "s"} found.
          </p>
        </div>

        {filteredAnnouncements.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
              <Megaphone className="h-6 w-6 text-gray-400" />
            </div>

            <h3 className="mt-4 font-semibold text-gray-900">
              No announcements found
            </h3>

            <p className="mt-1 max-w-md text-sm text-gray-500">
              Create an announcement to share important
              information with your school community.
            </p>

            <button
              type="button"
              onClick={openCreateModal}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              <Plus className="h-4 w-4" />
              New Announcement
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filteredAnnouncements.map(
              (announcement) => (
                <div
                  key={announcement.id}
                  className="p-5 transition hover:bg-gray-50"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-gray-900">
                          {announcement.title}
                        </h3>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusClasses(
                            announcement.status,
                          )}`}
                        >
                          {announcement.status}
                        </span>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getPriorityClasses(
                            announcement.priority,
                          )}`}
                        >
                          {announcement.priority}
                        </span>
                      </div>

                      <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
                        {getContentPreview(
                          announcement.content,
                        )}
                      </p>

                      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />

                          {getAudienceLabel(
                            announcement,
                            sections,
                            classes,
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5" />

                          Published:{" "}
                          {formatDate(
                            announcement.publish_date,
                          )}
                        </div>

                        {announcement.expiry_date && (
                          <div className="flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5" />

                            Expires:{" "}
                            {formatDate(
                              announcement.expiry_date,
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setViewingAnnouncement(
                            announcement,
                          )
                        }
                        title="View"
                        className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                      >
                        <Eye className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          openEditModal(
                            announcement,
                          )
                        }
                        title="Edit"
                        className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>

                      {announcement.status !==
                        "Published" && (
                        <button
                          type="button"
                          onClick={() =>
                            updateStatus(
                              announcement,
                              "Published",
                            )
                          }
                          title="Publish"
                          className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:bg-green-50 hover:text-green-700"
                        >
                          <Bell className="h-4 w-4" />
                        </button>
                      )}

                      {announcement.status ===
                        "Published" && (
                        <button
                          type="button"
                          onClick={() =>
                            updateStatus(
                              announcement,
                              "Archived",
                            )
                          }
                          title="Archive"
                          className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          deleteAnnouncement(
                            announcement,
                          )
                        }
                        title="Delete"
                        className="rounded-lg border border-gray-200 bg-white p-2 text-gray-500 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingAnnouncement
                    ? "Edit Announcement"
                    : "New Announcement"}
                </h2>

                <p className="mt-1 text-xs text-gray-500">
                  Create a message for the school community.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5">
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Title
                  </label>

                  <input
                    value={form.title}
                    onChange={(event) =>
                      updateForm({
                        title:
                          event.target.value,
                      })
                    }
                    placeholder="Enter announcement title"
                    className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-gray-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Content
                  </label>

                  <textarea
                    value={form.content}
                    onChange={(event) =>
                      updateForm({
                        content:
                          event.target.value,
                      })
                    }
                    rows={7}
                    placeholder="Write the announcement..."
                    className="w-full resize-y rounded-lg border border-gray-300 px-3 py-3 text-sm leading-6 outline-none focus:border-gray-500"
                  />

                  <div className="mt-1 text-right text-xs text-gray-400">
                    {form.content.length} characters
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Academic Year
                    </label>

                    <div className="relative">
                      <select
                        value={
                          form.academic_year_id
                        }
                        onChange={(event) =>
                          handleAcademicYearChange(
                            event.target.value,
                          )
                        }
                        className="h-11 w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 pr-9 text-sm outline-none focus:border-gray-500"
                      >
                        <option value="">
                          Select academic year
                        </option>

                        {academicYears.map(
                          (year) => (
                            <option
                              key={year.id}
                              value={year.id}
                            >
                              {year.name}
                              {year.is_current
                                ? " • Current"
                                : ""}
                            </option>
                          ),
                        )}
                      </select>

                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Audience
                    </label>

                    <div className="relative">
                      <select
                        value={
                          form.audience_type
                        }
                        onChange={(event) =>
                          handleAudienceChange(
                            event.target
                              .value as AudienceType,
                          )
                        }
                        className="h-11 w-full appearance-none rounded-lg border border-gray-300 bg-white px-3 pr-9 text-sm outline-none focus:border-gray-500"
                      >
                        <option value="All School">
                          All School
                        </option>

                        <option value="Parents">
                          Parents
                        </option>

                        <option value="Students">
                          Students
                        </option>

                        <option value="Teachers">
                          Teachers
                        </option>

                        <option value="Staff">
                          Staff
                        </option>

                        <option value="Section">
                          Section
                        </option>

                        <option value="Class">
                          Class
                        </option>
                      </select>

                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    </div>
                  </div>
                </div>

                {form.audience_type ===
                  "Section" && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Section
                    </label>

                    <select
                      value={
                        form.academic_section_id
                      }
                      onChange={(event) =>
                        updateForm({
                          academic_section_id:
                            event.target.value,
                        })
                      }
                      className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-gray-500"
                    >
                      <option value="">
                        Select section
                      </option>

                      {sectionsForSelectedYear.map(
                        (section) => (
                          <option
                            key={section.id}
                            value={section.id}
                          >
                            {section.name}
                          </option>
                        ),
                      )}
                    </select>

                    {sectionsForSelectedYear.length ===
                      0 && (
                      <p className="mt-1 text-xs text-amber-600">
                        No active sections found for the
                        selected academic year.
                      </p>
                    )}
                  </div>
                )}

                {form.audience_type ===
                  "Class" && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Class
                    </label>

                    <select
                      value={form.class_id}
                      onChange={(event) =>
                        updateForm({
                          class_id:
                            event.target.value,
                        })
                      }
                      className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-gray-500"
                    >
                      <option value="">
                        Select class
                      </option>

                      {classesForSelectedYear.map(
                        (schoolClass) => (
                          <option
                            key={schoolClass.id}
                            value={schoolClass.id}
                          >
                            {schoolClass.name}
                          </option>
                        ),
                      )}
                    </select>

                    {classesForSelectedYear.length ===
                      0 && (
                      <p className="mt-1 text-xs text-amber-600">
                        No classes found for the selected
                        academic year.
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Priority
                    </label>

                    <select
                      value={form.priority}
                      onChange={(event) =>
                        updateForm({
                          priority:
                            event.target
                              .value as Priority,
                        })
                      }
                      className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-gray-500"
                    >
                      <option value="Normal">
                        Normal
                      </option>

                      <option value="Important">
                        Important
                      </option>

                      <option value="Urgent">
                        Urgent
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Publish Date
                    </label>

                    <input
                      type="datetime-local"
                      value={
                        form.publish_date
                      }
                      onChange={(event) =>
                        updateForm({
                          publish_date:
                            event.target.value,
                        })
                      }
                      className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-gray-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Expiry Date
                    </label>

                    <input
                      type="datetime-local"
                      value={
                        form.expiry_date
                      }
                      onChange={(event) =>
                        updateForm({
                          expiry_date:
                            event.target.value,
                        })
                      }
                      className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-gray-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Status
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        updateForm({
                          status: "Draft",
                        })
                      }
                      className={`rounded-lg border px-4 py-3 text-left transition ${
                        form.status ===
                        "Draft"
                          ? "border-gray-900 bg-gray-50"
                          : "border-gray-200 bg-white hover:bg-gray-50"
                      }`}
                    >
                      <div className="font-medium text-gray-900">
                        Save as Draft
                      </div>

                      <div className="mt-1 text-xs text-gray-500">
                        Keep the announcement unpublished.
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        updateForm({
                          status:
                            "Published",
                        })
                      }
                      className={`rounded-lg border px-4 py-3 text-left transition ${
                        form.status ===
                        "Published"
                          ? "border-gray-900 bg-gray-50"
                          : "border-gray-200 bg-white hover:bg-gray-50"
                      }`}
                    >
                      <div className="font-medium text-gray-900">
                        Publish
                      </div>

                      <div className="mt-1 text-xs text-gray-500">
                        Make the announcement visible.
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-gray-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              {form.status === "Draft" && (
                <button
                  type="button"
                  onClick={() =>
                    saveAnnouncement(
                      false,
                    )
                  }
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {saving && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}

                  Save Draft
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  saveAnnouncement(
                    form.status ===
                      "Published",
                  )
                }
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
              >
                {saving && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}

                {form.status ===
                "Published"
                  ? editingAnnouncement
                    ? "Update & Publish"
                    : "Publish Announcement"
                  : "Save Announcement"}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewingAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5">
              <div className="pr-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusClasses(
                      viewingAnnouncement.status,
                    )}`}
                  >
                    {viewingAnnouncement.status}
                  </span>

                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getPriorityClasses(
                      viewingAnnouncement.priority,
                    )}`}
                  >
                    {viewingAnnouncement.priority}
                  </span>
                </div>

                <h2 className="mt-3 text-xl font-bold text-gray-900">
                  {viewingAnnouncement.title}
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setViewingAnnouncement(
                    null,
                  )
                }
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-6">
              <div className="flex flex-wrap gap-4 rounded-xl bg-gray-50 p-4 text-sm">
                <div>
                  <div className="text-xs text-gray-500">
                    Audience
                  </div>

                  <div className="mt-1 font-medium text-gray-900">
                    {getAudienceLabel(
                      viewingAnnouncement,
                      sections,
                      classes,
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">
                    Publish Date
                  </div>

                  <div className="mt-1 font-medium text-gray-900">
                    {formatDateTime(
                      viewingAnnouncement.publish_date,
                    )}
                  </div>
                </div>

                {viewingAnnouncement.expiry_date && (
                  <div>
                    <div className="text-xs text-gray-500">
                      Expiry Date
                    </div>

                    <div className="mt-1 font-medium text-gray-900">
                      {formatDateTime(
                        viewingAnnouncement.expiry_date,
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 whitespace-pre-wrap text-sm leading-7 text-gray-700">
                {viewingAnnouncement.content}
              </div>

              <div className="mt-8 border-t border-gray-200 pt-4 text-xs text-gray-400">
                Created{" "}
                {formatDateTime(
                  viewingAnnouncement.created_at,
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setViewingAnnouncement(
                    null,
                  );

                  openEditModal(
                    viewingAnnouncement,
                  );
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Edit3 className="h-4 w-4" />
                Edit
              </button>

              <button
                type="button"
                onClick={() =>
                  setViewingAnnouncement(
                    null,
                  )
                }
                className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}