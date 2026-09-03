import {
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Search,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useSchool } from "../context/SchoolContext";
import { getStudents } from "../lib/students";
import {
  getClasses,
  type SchoolClass,
} from "../lib/classes";
import { supabase } from "../lib/supabase";

type AttendanceStatus =
  | "present"
  | "absent"
  | "late"
  | "excused";

interface AcademicYear {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
}

interface AcademicSection {
  id: string;
  academic_year_id: string;
  name: string;
  display_order: number;
  is_active: boolean;
}

interface Student {
  id: string;
  name: string;
  studentId: string;
  className: string;
  academicYearId: string | null;
  status: "Active" | "Inactive";
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  attendance_date: string;
  status: AttendanceStatus;
  notes: string | null;
}

interface AttendanceRow {
  student: Student;
  status: AttendanceStatus;
  notes: string;
}

const STATUS_OPTIONS: {
  value: AttendanceStatus;
  label: string;
}[] = [
  {
    value: "present",
    label: "Present",
  },
  {
    value: "absent",
    label: "Absent",
  },
  {
    value: "late",
    label: "Late",
  },
  {
    value: "excused",
    label: "Excused",
  },
];

function getToday() {
  const date = new Date();

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getStatusClasses(
  status: AttendanceStatus,
) {
  switch (status) {
    case "present":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";

    case "absent":
      return "bg-red-50 text-red-700 border-red-200";

    case "late":
      return "bg-amber-50 text-amber-700 border-amber-200";

    case "excused":
      return "bg-blue-50 text-blue-700 border-blue-200";

    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

export default function Attendance() {
  const { school } = useSchool();

  const [academicYears, setAcademicYears] =
    useState<AcademicYear[]>([]);

  const [sections, setSections] =
    useState<AcademicSection[]>([]);

  const [schoolClasses, setSchoolClasses] =
    useState<SchoolClass[]>([]);

  const [students, setStudents] =
    useState<Student[]>([]);

  const [
    attendanceRecords,
    setAttendanceRecords,
  ] = useState<AttendanceRecord[]>([]);

  const [
    selectedAcademicYearId,
    setSelectedAcademicYearId,
  ] = useState("");

  const [
    selectedSectionId,
    setSelectedSectionId,
  ] = useState("");

  const [
    selectedClassId,
    setSelectedClassId,
  ] = useState("");

  const [
    selectedDate,
    setSelectedDate,
  ] = useState(getToday());

  const [search, setSearch] =
    useState("");

  const [attendance, setAttendance] =
    useState<Record<string, AttendanceRow>>(
      {},
    );

  const [loading, setLoading] =
    useState(true);

  const [
    loadingSections,
    setLoadingSections,
  ] = useState(false);

  const [
    loadingStudents,
    setLoadingStudents,
  ] = useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  /*
   * --------------------------------------------------------------------------
   * Load academic years and classes
   * --------------------------------------------------------------------------
   */

  async function loadAcademicStructure() {
    if (!school) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const [
      academicYearsResult,
      classesResult,
    ] = await Promise.all([
      supabase
        .from("academic_years")
        .select(
          "id, name, start_date, end_date, is_active",
        )
        .eq("school_id", school.id)
        .order("name", {
          ascending: false,
        }),

      getClasses(school.id),
    ]);

    if (academicYearsResult.error) {
      setError(
        academicYearsResult.error.message,
      );
    }

    const years =
      academicYearsResult.data ?? [];

    setAcademicYears(years);

    if (classesResult.error) {
      setError(
        classesResult.error.message,
      );

      setSchoolClasses([]);
    } else {
      setSchoolClasses(
        classesResult.data ?? [],
      );
    }

    const activeYear =
      years.find(
        (year) => year.is_active,
      ) ?? years[0];

    if (activeYear) {
      setSelectedAcademicYearId(
        activeYear.id,
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAcademicStructure();
  }, [school]);

  /*
   * --------------------------------------------------------------------------
   * Load sections for selected academic year only
   * --------------------------------------------------------------------------
   */

  async function loadSections(
    academicYearId: string,
  ) {
    if (!school || !academicYearId) {
      setSections([]);
      return;
    }

    setLoadingSections(true);
    setError("");

    const {
      data,
      error: sectionsError,
    } = await supabase
      .from("academic_sections")
      .select(
        "id, academic_year_id, name, display_order, is_active",
      )
      .eq("school_id", school.id)
      .eq(
        "academic_year_id",
        academicYearId,
      )
      .eq("is_active", true)
      .order("display_order", {
        ascending: true,
      });

    if (sectionsError) {
      setError(
        sectionsError.message,
      );

      setSections([]);
    } else {
      setSections(data ?? []);
    }

    setLoadingSections(false);
  }

  useEffect(() => {
    if (selectedAcademicYearId) {
      loadSections(
        selectedAcademicYearId,
      );
    } else {
      setSections([]);
    }

    setSelectedSectionId("");
    setSelectedClassId("");
    setStudents([]);
    setAttendance({});
    setAttendanceRecords([]);
  }, [
    selectedAcademicYearId,
  ]);

  /*
   * --------------------------------------------------------------------------
   * Classes
   * --------------------------------------------------------------------------
   */

  const classesForSelectedYear =
    useMemo(() => {
      return schoolClasses.filter(
        (schoolClass) => {
          if (
            schoolClass.academic_year_id !==
            selectedAcademicYearId
          ) {
            return false;
          }

          if (
            selectedSectionId &&
            schoolClass.academic_section_id !==
              selectedSectionId
          ) {
            return false;
          }

          return schoolClass.is_active;
        },
      );
    }, [
      schoolClasses,
      selectedAcademicYearId,
      selectedSectionId,
    ]);

  /*
   * --------------------------------------------------------------------------
   * Load students
   *
   * IMPORTANT:
   * We use the existing getStudents() helper because the students table
   * does not contain class_id directly.
   * --------------------------------------------------------------------------
   */

  async function loadStudents() {
    if (
      !school ||
      !selectedAcademicYearId ||
      !selectedClassId
    ) {
      setStudents([]);
      setAttendance({});
      return;
    }

    setLoadingStudents(true);
    setError("");
    setSuccess("");

    const {
      data,
      error: studentsError,
    } = await getStudents(
      school.id,
    );

    if (studentsError) {
      console.error(
        "Failed to load students:",
        studentsError,
      );

      setError(
        studentsError.message,
      );

      setStudents([]);
      setLoadingStudents(false);

      return;
    }

    const selectedClass =
      schoolClasses.find(
        (schoolClass) =>
          schoolClass.id ===
          selectedClassId,
      );

    if (!selectedClass) {
      setStudents([]);
      setLoadingStudents(false);
      return;
    }

    /*
     * The existing Students module identifies a student's class through
     * className and academicYearId.
     */
    const loadedStudents =
      (data ?? []).filter(
        (student) =>
          student.status ===
            "Active" &&
          student.academicYearId ===
            selectedAcademicYearId &&
          student.className ===
            selectedClass.name,
      );

    setStudents(
      loadedStudents,
    );

    const defaultAttendance: Record<
      string,
      AttendanceRow
    > = {};

    loadedStudents.forEach(
      (student) => {
        defaultAttendance[
          student.id
        ] = {
          student,
          status: "present",
          notes: "",
        };
      },
    );

    setAttendance(
      defaultAttendance,
    );

    setLoadingStudents(false);
  }

  useEffect(() => {
    if (
      selectedAcademicYearId &&
      selectedClassId
    ) {
      loadStudents();
    } else {
      setStudents([]);
      setAttendance({});
    }
  }, [
    selectedAcademicYearId,
    selectedClassId,
  ]);

  /*
   * --------------------------------------------------------------------------
   * Load existing attendance
   * --------------------------------------------------------------------------
   */

  async function loadAttendance() {
    if (
      !school ||
      !selectedAcademicYearId ||
      !selectedClassId ||
      !selectedDate
    ) {
      setAttendanceRecords([]);
      return;
    }

    const {
      data,
      error: attendanceError,
    } = await supabase
      .from("attendance_records")
      .select(
        "id, student_id, attendance_date, status, notes",
      )
      .eq("school_id", school.id)
      .eq(
        "academic_year_id",
        selectedAcademicYearId,
      )
      .eq(
        "class_id",
        selectedClassId,
      )
      .eq(
        "attendance_date",
        selectedDate,
      );

    if (attendanceError) {
      setError(
        attendanceError.message,
      );

      return;
    }

    setAttendanceRecords(
      data ?? [],
    );
  }

  useEffect(() => {
    loadAttendance();
  }, [
    school,
    selectedAcademicYearId,
    selectedClassId,
    selectedDate,
  ]);

  /*
   * --------------------------------------------------------------------------
   * Merge saved attendance
   * --------------------------------------------------------------------------
   */

  useEffect(() => {
    if (!students.length) {
      return;
    }

    const existingRecords =
      new Map(
        attendanceRecords.map(
          (record) => [
            record.student_id,
            record,
          ],
        ),
      );

    setAttendance(
      (current) => {
        const next: Record<
          string,
          AttendanceRow
        > = {};

        students.forEach(
          (student) => {
            const existing =
              existingRecords.get(
                student.id,
              );

            next[student.id] = {
              student,

              status:
                existing?.status ??
                current[
                  student.id
                ]?.status ??
                "present",

              notes:
                existing?.notes ??
                current[
                  student.id
                ]?.notes ??
                "",
            };
          },
        );

        return next;
      },
    );
  }, [
    students,
    attendanceRecords,
  ]);

  /*
   * --------------------------------------------------------------------------
   * Selection handlers
   * --------------------------------------------------------------------------
   */

  function handleAcademicYearChange(
    value: string,
  ) {
    setSelectedAcademicYearId(
      value,
    );

    setSelectedSectionId("");
    setSelectedClassId("");
    setStudents([]);
    setAttendance({});
    setAttendanceRecords([]);
    setSuccess("");
    setError("");
  }

  function handleSectionChange(
    value: string,
  ) {
    setSelectedSectionId(
      value,
    );

    setSelectedClassId("");
    setStudents([]);
    setAttendance({});
    setAttendanceRecords([]);
    setSuccess("");
    setError("");
  }

  function handleClassChange(
    value: string,
  ) {
    setSelectedClassId(
      value,
    );

    setStudents([]);
    setAttendance({});
    setAttendanceRecords([]);
    setSuccess("");
    setError("");
  }

  /*
   * --------------------------------------------------------------------------
   * Attendance actions
   * --------------------------------------------------------------------------
   */

  function updateStatus(
    studentId: string,
    status: AttendanceStatus,
  ) {
    setAttendance(
      (current) => ({
        ...current,
        [studentId]: {
          ...current[studentId],
          status,
        },
      }),
    );
  }

  function updateNotes(
    studentId: string,
    notes: string,
  ) {
    setAttendance(
      (current) => ({
        ...current,
        [studentId]: {
          ...current[studentId],
          notes,
        },
      }),
    );
  }

  function markAll(
    status: AttendanceStatus,
  ) {
    setAttendance(
      (current) => {
        const next = {
          ...current,
        };

        students.forEach(
          (student) => {
            next[student.id] = {
              ...next[student.id],
              status,
            };
          },
        );

        return next;
      },
    );
  }

  /*
   * --------------------------------------------------------------------------
   * Save attendance
   * --------------------------------------------------------------------------
   */

  async function saveAttendance() {
    if (!school) {
      return;
    }

    if (
      !selectedAcademicYearId ||
      !selectedClassId ||
      !selectedDate
    ) {
      setError(
        "Please select an academic year, class and date.",
      );

      return;
    }

    if (!students.length) {
      setError(
        "There are no active students in this class.",
      );

      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const {
      data: {
        user,
      },
    } = await supabase.auth.getUser();

    const payload =
      students.map(
        (student) => {
          const row =
            attendance[
              student.id
            ];

          return {
            school_id:
              school.id,

            academic_year_id:
              selectedAcademicYearId,

            student_id:
              student.id,

            class_id:
              selectedClassId,

            attendance_date:
              selectedDate,

            status:
              row?.status ??
              "present",

            notes:
              row?.notes?.trim() ||
              null,

            marked_by:
              user?.id ?? null,
          };
        },
      );

    const {
      data,
      error: saveError,
    } = await supabase
      .from("attendance_records")
      .upsert(
        payload,
        {
          onConflict:
            "student_id,attendance_date",
        },
      )
      .select(
        "id, student_id, attendance_date, status, notes",
      );

    if (saveError) {
      console.error(
        "Failed to save attendance:",
        saveError,
      );

      setError(
        saveError.message,
      );

      setSaving(false);

      return;
    }

    setAttendanceRecords(
      data ?? [],
    );

    setSuccess(
      `Attendance saved successfully for ${students.length} student${
        students.length === 1
          ? ""
          : "s"
      }.`,
    );

    setSaving(false);
  }

  /*
   * --------------------------------------------------------------------------
   * Search
   * --------------------------------------------------------------------------
   */

  const filteredStudents =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return students;
      }

      return students.filter(
        (student) =>
          student.name
            .toLowerCase()
            .includes(query) ||
          student.studentId
            .toLowerCase()
            .includes(query),
      );
    }, [
      students,
      search,
    ]);

  /*
   * --------------------------------------------------------------------------
   * Summary
   * --------------------------------------------------------------------------
   */

  const summary =
    useMemo(() => {
      const values =
        students.map(
          (student) =>
            attendance[
              student.id
            ]?.status ??
            "present",
        );

      return {
        total: students.length,

        present:
          values.filter(
            (status) =>
              status ===
              "present",
          ).length,

        absent:
          values.filter(
            (status) =>
              status ===
              "absent",
          ).length,

        late:
          values.filter(
            (status) =>
              status ===
              "late",
          ).length,

        excused:
          values.filter(
            (status) =>
              status ===
              "excused",
          ).length,
      };
    }, [
      students,
      attendance,
    ]);

  const attendancePercentage =
    summary.total > 0
      ? Math.round(
          (summary.present /
            summary.total) *
            100,
        )
      : 0;

  /*
   * --------------------------------------------------------------------------
   * Selected objects
   * --------------------------------------------------------------------------
   */

  const selectedYear =
    academicYears.find(
      (year) =>
        year.id ===
        selectedAcademicYearId,
    );

  const selectedSection =
    sections.find(
      (section) =>
        section.id ===
        selectedSectionId,
    );

  const selectedClass =
    schoolClasses.find(
      (schoolClass) =>
        schoolClass.id ===
        selectedClassId,
    );

  /*
   * --------------------------------------------------------------------------
   * Loading
   * --------------------------------------------------------------------------
   */

  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-sm text-slate-500">
            Loading attendance...
          </div>
        </div>
      </div>
    );
  }

  /*
   * --------------------------------------------------------------------------
   * Render
   * --------------------------------------------------------------------------
   */

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* Header */}

      <div className="mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <UserCheck
                size={21}
                className="text-indigo-600"
              />

              <h1 className="text-xl font-semibold text-slate-900">
                Attendance
              </h1>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Record and manage daily student
              attendance.
            </p>
          </div>

          <div className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600">
            <CalendarDays
              size={15}
              className="text-slate-400"
            />

            <span>
              {selectedDate}
            </span>
          </div>
        </div>
      </div>

      {/* Error */}

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <X
            size={17}
            className="mt-0.5 shrink-0"
          />

          <span>{error}</span>
        </div>
      )}

      {/* Success */}

      {success && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2
            size={17}
            className="mt-0.5 shrink-0"
          />

          <span>{success}</span>
        </div>
      )}

      {/* Filters */}

      <div className="mb-5 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Attendance register
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Select the academic year, section, class
            and date before marking attendance.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 lg:grid-cols-4">
          {/* Academic year */}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Academic year
            </label>

            <select
              value={
                selectedAcademicYearId
              }
              onChange={(event) =>
                handleAcademicYearChange(
                  event.target.value,
                )
              }
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
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
                    {year.is_active
                      ? " • Active"
                      : ""}
                  </option>
                ),
              )}
            </select>
          </div>

          {/* Section */}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Section
            </label>

            <select
              value={
                selectedSectionId
              }
              onChange={(event) =>
                handleSectionChange(
                  event.target.value,
                )
              }
              disabled={
                !selectedAcademicYearId ||
                loadingSections
              }
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">
                {loadingSections
                  ? "Loading sections..."
                  : "All sections"}
              </option>

              {sections.map(
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
          </div>

          {/* Class */}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Class
            </label>

            <select
              value={
                selectedClassId
              }
              onChange={(event) =>
                handleClassChange(
                  event.target.value,
                )
              }
              disabled={
                !selectedAcademicYearId
              }
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">
                Select class
              </option>

              {classesForSelectedYear.map(
                (schoolClass) => (
                  <option
                    key={
                      schoolClass.id
                    }
                    value={
                      schoolClass.id
                    }
                  >
                    {schoolClass.name}
                  </option>
                ),
              )}
            </select>
          </div>

          {/* Date */}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Attendance date
            </label>

            <input
              type="date"
              value={
                selectedDate
              }
              onChange={(event) =>
                setSelectedDate(
                  event.target.value,
                )
              }
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>
      </div>

      {/* Summary */}

      {selectedClassId && (
        <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-5">
          <SummaryCard
            icon={
              <Users
                size={18}
              />
            }
            label="Total students"
            value={
              summary.total
            }
          />

          <SummaryCard
            icon={
              <CheckCircle2
                size={18}
              />
            }
            label="Present"
            value={
              summary.present
            }
          />

          <SummaryCard
            icon={
              <X size={18} />
            }
            label="Absent"
            value={
              summary.absent
            }
          />

          <SummaryCard
            icon={
              <Clock3
                size={18}
              />
            }
            label="Late"
            value={
              summary.late
            }
          />

          <SummaryCard
            icon={
              <UserCheck
                size={18}
              />
            }
            label="Attendance"
            value={`${attendancePercentage}%`}
          />
        </div>
      )}

      {/* Student attendance */}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Toolbar */}

        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {selectedClass
                ? selectedClass.name
                : "Student attendance"}
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              {selectedYear?.name ??
                "No academic year"}

              {selectedSection
                ? ` • ${selectedSection.name}`
                : ""}

              {" • "}

              {selectedDate}
            </p>
          </div>

          {students.length > 0 && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() =>
                  markAll(
                    "present",
                  )
                }
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                <Check
                  size={14}
                />
                Mark all present
              </button>

              <button
                type="button"
                onClick={() =>
                  markAll(
                    "absent",
                  )
                }
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-semibold text-red-700 hover:bg-red-100"
              >
                <X
                  size={14}
                />
                Mark all absent
              </button>

              <button
                type="button"
                onClick={
                  saveAttendance
                }
                disabled={saving}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Check
                  size={14}
                />

                {saving
                  ? "Saving..."
                  : "Save attendance"}
              </button>
            </div>
          )}
        </div>

        {/* Search */}

        {students.length > 0 && (
          <div className="border-b border-slate-100 px-5 py-3">
            <div className="relative max-w-md">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search student name or ID..."
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>
        )}

        {/* Loading */}

        {loadingStudents && (
          <div className="flex min-h-[250px] items-center justify-center">
            <div className="text-sm text-slate-500">
              Loading students...
            </div>
          </div>
        )}

        {/* No class */}

        {!loadingStudents &&
          !selectedClassId && (
            <div className="flex min-h-[320px] flex-col items-center justify-center px-5 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <UserCheck
                  size={22}
                />
              </div>

              <h3 className="text-sm font-semibold text-slate-900">
                Select a class
              </h3>

              <p className="mt-1 max-w-sm text-sm text-slate-500">
                Choose an academic year, section and
                class to load students and start taking
                attendance.
              </p>
            </div>
          )}

        {/* No students */}

        {!loadingStudents &&
          selectedClassId &&
          students.length === 0 && (
            <div className="flex min-h-[320px] flex-col items-center justify-center px-5 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <Users
                  size={22}
                />
              </div>

              <h3 className="text-sm font-semibold text-slate-900">
                No students found
              </h3>

              <p className="mt-1 max-w-sm text-sm text-slate-500">
                There are no active students enrolled in
                this class for the selected academic year.
              </p>
            </div>
          )}

        {/* Student table */}

        {!loadingStudents &&
          filteredStudents.length >
            0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="w-[55px] px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      #
                    </th>

                    <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Student
                    </th>

                    <th className="w-[150px] px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Student ID
                    </th>

                    <th className="w-[380px] px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Attendance
                    </th>

                    <th className="w-[220px] px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Note
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredStudents.map(
                    (
                      student,
                      index,
                    ) => {
                      const row =
                        attendance[
                          student.id
                        ];

                      const currentStatus =
                        row?.status ??
                        "present";

                      return (
                        <tr
                          key={
                            student.id
                          }
                          className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70"
                        >
                          <td className="px-5 py-4 text-sm text-slate-400">
                            {index +
                              1}
                          </td>

                          <td className="px-3 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700">
                                {student.name
                                  .split(
                                    " ",
                                  )
                                  .filter(
                                    Boolean,
                                  )
                                  .slice(
                                    0,
                                    2,
                                  )
                                  .map(
                                    (
                                      part,
                                    ) =>
                                      part[0]?.toUpperCase(),
                                  )
                                  .join(
                                    "",
                                  )}
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-slate-900">
                                  {
                                    student.name
                                  }
                                </p>

                                <p className="mt-0.5 text-xs text-slate-400">
                                  {
                                    student.className
                                  }
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-3 py-4 text-sm text-slate-500">
                            {
                              student.studentId
                            }
                          </td>

                          <td className="px-3 py-4">
                            <div className="flex items-center gap-1.5">
                              {STATUS_OPTIONS.map(
                                (
                                  option,
                                ) => {
                                  const active =
                                    currentStatus ===
                                    option.value;

                                  return (
                                    <button
                                      key={
                                        option.value
                                      }
                                      type="button"
                                      onClick={() =>
                                        updateStatus(
                                          student.id,
                                          option.value,
                                        )
                                      }
                                      className={[
                                        "rounded-lg border px-3 py-2 text-xs font-semibold transition",
                                        active
                                          ? getStatusClasses(
                                              option.value,
                                            )
                                          : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50",
                                      ].join(
                                        " ",
                                      )}
                                    >
                                      {
                                        option.label
                                      }
                                    </button>
                                  );
                                },
                              )}
                            </div>
                          </td>

                          <td className="px-3 py-4">
                            <input
                              type="text"
                              value={
                                row?.notes ??
                                ""
                              }
                              onChange={(
                                event,
                              ) =>
                                updateNotes(
                                  student.id,
                                  event
                                    .target
                                    .value,
                                )
                              }
                              placeholder="Optional note"
                              className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                            />
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          )}

        {/* No search results */}

        {!loadingStudents &&
          selectedClassId &&
          students.length > 0 &&
          filteredStudents.length ===
            0 && (
            <div className="flex min-h-[220px] items-center justify-center px-5 text-center">
              <div>
                <Search
                  size={22}
                  className="mx-auto text-slate-300"
                />

                <p className="mt-3 text-sm font-semibold text-slate-900">
                  No students found
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Try a different student name or ID.
                </p>
              </div>
            </div>
          )}
      </div>

      {/* Bottom status */}

      {students.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Showing{" "}
            <span className="font-semibold text-slate-600">
              {
                filteredStudents.length
              }
            </span>{" "}
            of{" "}
            <span className="font-semibold text-slate-600">
              {students.length}
            </span>{" "}
            students
          </p>

          <p>
            Current attendance:{" "}
            <span className="font-semibold text-slate-600">
              {attendancePercentage}%
            </span>
          </p>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Summary card                                                               */
/* -------------------------------------------------------------------------- */

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-slate-400">
          {icon}
        </div>

        <span className="text-xl font-semibold text-slate-900">
          {value}
        </span>
      </div>

      <p className="mt-2 text-xs font-medium text-slate-500">
        {label}
      </p>
    </div>
  );
}