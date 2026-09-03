import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Filter,
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
  academic_year_id: string;
  class_id: string;
  attendance_date: string;
  status: AttendanceStatus;
  notes: string | null;
  created_at: string;
}

interface HistoryRow {
  record: AttendanceRecord;
  student: Student | null;
  className: string;
  sectionName: string;
}

const STATUS_OPTIONS: {
  value: AttendanceStatus | "";
  label: string;
}[] = [
  {
    value: "",
    label: "All statuses",
  },
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

function getFirstDayOfMonth() {
  const date = new Date();

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");

  return `${year}-${month}-01`;
}

function formatDate(date: string) {
  if (!date) {
    return "";
  }

  const parsed = new Date(
    `${date}T00:00:00`,
  );

  return parsed.toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  );
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

function getStatusLabel(
  status: AttendanceStatus,
) {
  return (
    STATUS_OPTIONS.find(
      (option) =>
        option.value === status,
    )?.label ?? status
  );
}

export default function AttendanceHistory() {
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
    startDate,
    setStartDate,
  ] = useState(
    getFirstDayOfMonth(),
  );

  const [
    endDate,
    setEndDate,
  ] = useState(getToday());

  const [statusFilter, setStatusFilter] =
    useState<
      AttendanceStatus | ""
    >("");

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [loadingHistory, setLoadingHistory] =
    useState(false);

  const [error, setError] =
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

    setAcademicYears(
      academicYearsResult.data ?? [],
    );

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
      (academicYearsResult.data ?? []).find(
        (year) => year.is_active,
      ) ??
      (academicYearsResult.data ?? [])[0];

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
   * Load sections for selected academic year
   * --------------------------------------------------------------------------
   */

  async function loadSections(
    academicYearId: string,
  ) {
    if (!school || !academicYearId) {
      setSections([]);
      return;
    }

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
      return;
    }

    setSections(data ?? []);
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
   * --------------------------------------------------------------------------
   */

  async function loadStudents() {
    if (!school) {
      setStudents([]);
      return;
    }

    const {
      data,
      error: studentsError,
    } = await getStudents(
      school.id,
    );

    if (studentsError) {
      setError(
        studentsError.message,
      );
      setStudents([]);
      return;
    }

    setStudents(data ?? []);
  }

  useEffect(() => {
    loadStudents();
  }, [school]);

  /*
   * --------------------------------------------------------------------------
   * Load attendance history
   * --------------------------------------------------------------------------
   */

  async function loadHistory() {
    if (
      !school ||
      !selectedAcademicYearId ||
      !startDate ||
      !endDate
    ) {
      setAttendanceRecords([]);
      return;
    }

    if (startDate > endDate) {
      setError(
        "The start date cannot be after the end date.",
      );
      setAttendanceRecords([]);
      return;
    }

    setLoadingHistory(true);
    setError("");

    let query = supabase
      .from("attendance_records")
      .select(
        "id, student_id, academic_year_id, class_id, attendance_date, status, notes, created_at",
      )
      .eq(
        "school_id",
        school.id,
      )
      .eq(
        "academic_year_id",
        selectedAcademicYearId,
      )
      .gte(
        "attendance_date",
        startDate,
      )
      .lte(
        "attendance_date",
        endDate,
      )
      .order(
        "attendance_date",
        {
          ascending: false,
        },
      );

    if (selectedClassId) {
      query = query.eq(
        "class_id",
        selectedClassId,
      );
    }

    if (statusFilter) {
      query = query.eq(
        "status",
        statusFilter,
      );
    }

    const {
      data,
      error: historyError,
    } = await query;

    if (historyError) {
      console.error(
        "Failed to load attendance history:",
        historyError,
      );

      setError(
        historyError.message,
      );

      setAttendanceRecords([]);
      setLoadingHistory(false);

      return;
    }

    setAttendanceRecords(
      data ?? [],
    );

    setLoadingHistory(false);
  }

  useEffect(() => {
    loadHistory();
  }, [
    school,
    selectedAcademicYearId,
    selectedClassId,
    startDate,
    endDate,
    statusFilter,
  ]);

  /*
   * --------------------------------------------------------------------------
   * Build history rows
   * --------------------------------------------------------------------------
   */

  const historyRows =
    useMemo(() => {
      const studentMap =
        new Map(
          students.map(
            (student) => [
              student.id,
              student,
            ],
          ),
        );

      const classMap =
        new Map(
          schoolClasses.map(
            (schoolClass) => [
              schoolClass.id,
              schoolClass,
            ],
          ),
        );

      const sectionMap =
        new Map(
          sections.map(
            (section) => [
              section.id,
              section,
            ],
          ),
        );

      return attendanceRecords
        .map(
          (record) => {
            const student =
              studentMap.get(
                record.student_id,
              ) ?? null;

            const schoolClass =
              classMap.get(
                record.class_id,
              );

            const section =
              schoolClass
                ? sectionMap.get(
                    schoolClass.academic_section_id ??
                      "",
                  )
                : undefined;

            return {
              record,
              student,
              className:
                schoolClass?.name ??
                student?.className ??
                "Unknown class",
              sectionName:
                section?.name ??
                "—",
            };
          },
        )
        .filter(
          (row) => {
            /*
             * If a section is selected, ensure the record belongs
             * to a class in that section.
             */
            if (
              selectedSectionId
            ) {
              const schoolClass =
                schoolClasses.find(
                  (schoolClass) =>
                    schoolClass.id ===
                    row.record
                      .class_id,
                );

              if (
                schoolClass?.academic_section_id !==
                selectedSectionId
              ) {
                return false;
              }
            }

            return true;
          },
        );
    }, [
      attendanceRecords,
      students,
      schoolClasses,
      sections,
      selectedSectionId,
    ]);

  /*
   * --------------------------------------------------------------------------
   * Search
   * --------------------------------------------------------------------------
   */

  const filteredRows =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return historyRows;
      }

      return historyRows.filter(
        (row) => {
          const studentName =
            row.student?.name
              ?.toLowerCase() ??
            "";

          const studentId =
            row.student?.studentId
              ?.toLowerCase() ??
            "";

          const className =
            row.className.toLowerCase();

          return (
            studentName.includes(
              query,
            ) ||
            studentId.includes(
              query,
            ) ||
            className.includes(
              query,
            )
          );
        },
      );
    }, [
      historyRows,
      search,
    ]);

  /*
   * --------------------------------------------------------------------------
   * Summary
   * --------------------------------------------------------------------------
   */

  const summary =
    useMemo(() => {
      return {
        total:
          filteredRows.length,

        present:
          filteredRows.filter(
            (row) =>
              row.record.status ===
              "present",
          ).length,

        absent:
          filteredRows.filter(
            (row) =>
              row.record.status ===
              "absent",
          ).length,

        late:
          filteredRows.filter(
            (row) =>
              row.record.status ===
              "late",
          ).length,

        excused:
          filteredRows.filter(
            (row) =>
              row.record.status ===
              "excused",
          ).length,
      };
    }, [
      filteredRows,
    ]);

  /*
   * --------------------------------------------------------------------------
   * Handlers
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
  }

  function handleSectionChange(
    value: string,
  ) {
    setSelectedSectionId(
      value,
    );

    setSelectedClassId("");
  }

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
            Loading attendance history...
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
              <CalendarDays
                size={21}
                className="text-indigo-600"
              />

              <h1 className="text-xl font-semibold text-slate-900">
                Attendance History
              </h1>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Review attendance records from previous
              dates.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
            <Filter
              size={14}
            />

            {filteredRows.length} record
            {filteredRows.length ===
            1
              ? ""
              : "s"}
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

      {/* Filters */}

      <div className="mb-5 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            History filters
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Select an academic year and date range to
            review recorded attendance.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 lg:grid-cols-3">
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
                !selectedAcademicYearId
              }
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">
                All sections
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
                setSelectedClassId(
                  event.target.value,
                )
              }
              disabled={
                !selectedAcademicYearId
              }
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">
                All classes
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

          {/* Start date */}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              From
            </label>

            <input
              type="date"
              value={
                startDate
              }
              onChange={(event) =>
                setStartDate(
                  event.target.value,
                )
              }
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* End date */}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              To
            </label>

            <input
              type="date"
              value={
                endDate
              }
              onChange={(event) =>
                setEndDate(
                  event.target.value,
                )
              }
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>

          {/* Status */}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Status
            </label>

            <select
              value={
                statusFilter
              }
              onChange={(event) =>
                setStatusFilter(
                  event.target
                    .value as AttendanceStatus | "",
                )
              }
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              {STATUS_OPTIONS.map(
                (option) => (
                  <option
                    key={
                      option.value
                    }
                    value={
                      option.value
                    }
                  >
                    {option.label}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Summary */}

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <SummaryCard
          icon={
            <Users
              size={18}
            />
          }
          label="Total records"
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
          label="Excused"
          value={
            summary.excused
          }
        />
      </div>

      {/* History table */}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Table header */}

        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Attendance records
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              {startDate &&
                endDate &&
                `${formatDate(
                  startDate,
                )} – ${formatDate(
                  endDate,
                )}`}
            </p>
          </div>

          <div className="relative w-full lg:w-[300px]">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              value={
                search
              }
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search student or class..."
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        {/* Loading */}

        {loadingHistory && (
          <div className="flex min-h-[280px] items-center justify-center">
            <div className="text-sm text-slate-500">
              Loading attendance records...
            </div>
          </div>
        )}

        {/* Empty */}

        {!loadingHistory &&
          filteredRows.length ===
            0 && (
            <div className="flex min-h-[320px] flex-col items-center justify-center px-5 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <CalendarDays
                  size={22}
                />
              </div>

              <h3 className="text-sm font-semibold text-slate-900">
                No attendance records
              </h3>

              <p className="mt-1 max-w-sm text-sm text-slate-500">
                No attendance records match the selected
                filters and date range.
              </p>
            </div>
          )}

        {/* Table */}

        {!loadingHistory &&
          filteredRows.length >
            0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="w-[150px] px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Date
                    </th>

                    <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Student
                    </th>

                    <th className="w-[140px] px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Student ID
                    </th>

                    <th className="w-[180px] px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Class
                    </th>

                    <th className="w-[150px] px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Status
                    </th>

                    <th className="w-[250px] px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Note
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRows.map(
                    (
                      row,
                    ) => (
                      <tr
                        key={
                          row.record.id
                        }
                        className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70"
                      >
                        <td className="px-5 py-4 text-sm text-slate-600">
                          {formatDate(
                            row.record
                              .attendance_date,
                          )}
                        </td>

                        <td className="px-3 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700">
                              {row.student?.name
                                ? row.student.name
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
                                    )
                                : "S"}
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-900">
                                {row.student
                                  ?.name ??
                                  "Unknown student"}
                              </p>

                              <p className="mt-0.5 text-xs text-slate-400">
                                {
                                  row.sectionName
                                }
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-4 text-sm text-slate-500">
                          {row.student
                            ?.studentId ??
                            "—"}
                        </td>

                        <td className="px-3 py-4">
                          <span className="text-sm font-medium text-slate-700">
                            {
                              row.className
                            }
                          </span>
                        </td>

                        <td className="px-3 py-4">
                          <span
                            className={[
                              "inline-flex items-center rounded-lg border px-2.5 py-1.5 text-xs font-semibold",
                              getStatusClasses(
                                row.record
                                  .status,
                              ),
                            ].join(
                              " ",
                            )}
                          >
                            {getStatusLabel(
                              row.record
                                .status,
                            )}
                          </span>
                        </td>

                        <td className="px-3 py-4 text-sm text-slate-500">
                          {row.record
                            .notes ||
                            "—"}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {/* Bottom status */}

      {!loadingHistory &&
        filteredRows.length >
          0 && (
          <div className="mt-4 flex flex-col gap-2 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p>
              Showing{" "}
              <span className="font-semibold text-slate-600">
                {
                  filteredRows.length
                }
              </span>{" "}
              attendance record
              {filteredRows.length ===
              1
                ? ""
                : "s"}
            </p>

            <p>
              {startDate &&
                endDate &&
                `${formatDate(
                  startDate,
                )} – ${formatDate(
                  endDate,
                )}`}
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