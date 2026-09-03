import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileBarChart,
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
}

interface StudentReport {
  student: Student;
  className: string;
  sectionName: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  recordedDays: number;
  attendancePercentage: number;
}

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

function getCurrentMonth() {
  return new Date().getMonth() + 1;
}

function getStatusClasses(
  percentage: number,
) {
  if (percentage >= 90) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (percentage >= 75) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  return "bg-red-50 text-red-700 border-red-200";
}

export default function AttendanceReports() {
  const { school } = useSchool();

  const [academicYears, setAcademicYears] =
    useState<AcademicYear[]>([]);

  const [sections, setSections] =
    useState<AcademicSection[]>([]);

  const [schoolClasses, setSchoolClasses] =
    useState<SchoolClass[]>([]);

  const [students, setStudents] =
    useState<Student[]>([]);

  const [attendanceRecords, setAttendanceRecords] =
    useState<AttendanceRecord[]>([]);

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

  const [selectedMonth, setSelectedMonth] =
    useState(getCurrentMonth());

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [loadingReport, setLoadingReport] =
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
   *
   * Uses the existing student helper because class_id does not live
   * directly on the students table.
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
   * Calculate month range
   * --------------------------------------------------------------------------
   */

  const monthRange =
    useMemo(() => {
      if (!selectedAcademicYearId) {
        return null;
      }

      const year =
        academicYears.find(
          (academicYear) =>
            academicYear.id ===
            selectedAcademicYearId,
        );

      if (!year) {
        return null;
      }

      /*
       * Academic years can cross calendar years.
       *
       * Example:
       * 2026–2027 → September 2026 is 2026,
       *              January 2027 is 2027.
       *
       * We determine the calendar year based on the academic
       * year's start month.
       */
      const startDate = year.start_date
        ? new Date(
            `${year.start_date}T00:00:00`,
          )
        : new Date();

      const academicStartYear =
        startDate.getFullYear();

      const academicStartMonth =
        startDate.getMonth() + 1;

      const calendarYear =
        selectedMonth >=
        academicStartMonth
          ? academicStartYear
          : academicStartYear + 1;

      const firstDay = `${calendarYear}-${String(
        selectedMonth,
      ).padStart(2, "0")}-01`;

      const lastDayDate =
        new Date(
          calendarYear,
          selectedMonth,
          0,
        );

      const lastDay =
        `${calendarYear}-${String(
          selectedMonth,
        ).padStart(2, "0")}-${String(
          lastDayDate.getDate(),
        ).padStart(2, "0")}`;

      return {
        firstDay,
        lastDay,
        calendarYear,
      };
    }, [
      academicYears,
      selectedAcademicYearId,
      selectedMonth,
    ]);

  /*
   * --------------------------------------------------------------------------
   * Load attendance records
   * --------------------------------------------------------------------------
   */

  async function loadReport() {
    if (
      !school ||
      !selectedAcademicYearId ||
      !monthRange
    ) {
      setAttendanceRecords([]);
      return;
    }

    setLoadingReport(true);
    setError("");

    let query = supabase
      .from("attendance_records")
      .select(
        "id, student_id, academic_year_id, class_id, attendance_date, status, notes",
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
        monthRange.firstDay,
      )
      .lte(
        "attendance_date",
        monthRange.lastDay,
      );

    if (selectedClassId) {
      query = query.eq(
        "class_id",
        selectedClassId,
      );
    }

    const {
      data,
      error: recordsError,
    } = await query;

    if (recordsError) {
      setError(
        recordsError.message,
      );

      setAttendanceRecords([]);
      setLoadingReport(false);

      return;
    }

    setAttendanceRecords(
      data ?? [],
    );

    setLoadingReport(false);
  }

  useEffect(() => {
    loadReport();
  }, [
    school,
    selectedAcademicYearId,
    selectedClassId,
    monthRange?.firstDay,
    monthRange?.lastDay,
  ]);

  /*
   * --------------------------------------------------------------------------
   * Build report
   * --------------------------------------------------------------------------
   */

  const reportRows =
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

      /*
       * Group attendance by student.
       */
      const grouped =
        new Map<
          string,
          AttendanceRecord[]
        >();

      attendanceRecords.forEach(
        (record) => {
          const current =
            grouped.get(
              record.student_id,
            ) ?? [];

          current.push(record);

          grouped.set(
            record.student_id,
            current,
          );
        },
      );

      /*
       * Determine which students should appear.
       *
       * If a class is selected, only students from that class
       * appear.
       *
       * If no class is selected, students from the selected
       * academic year appear when they have attendance records.
       */
      const reportStudentIds =
        new Set<string>();

      attendanceRecords.forEach(
        (record) => {
          reportStudentIds.add(
            record.student_id,
          );
        },
      );

      /*
       * When a specific class is selected, include all active
       * students in that class, even if they have no records yet.
       */
      if (selectedClassId) {
        const selectedClass =
          schoolClasses.find(
            (schoolClass) =>
              schoolClass.id ===
              selectedClassId,
          );

        if (selectedClass) {
          students
            .filter(
              (student) =>
                student.status ===
                  "Active" &&
                student.academicYearId ===
                  selectedAcademicYearId &&
                student.className ===
                  selectedClass.name,
            )
            .forEach(
              (student) => {
                reportStudentIds.add(
                  student.id,
                );
              },
            );
        }
      }

      const rows: StudentReport[] =
        Array.from(
          reportStudentIds,
        )
          .map(
            (studentId) => {
              const student =
                studentMap.get(
                  studentId,
                );

              if (!student) {
                return null;
              }

              const records =
                grouped.get(
                  studentId,
                ) ?? [];

              const present =
                records.filter(
                  (record) =>
                    record.status ===
                    "present",
                ).length;

              const absent =
                records.filter(
                  (record) =>
                    record.status ===
                    "absent",
                ).length;

              const late =
                records.filter(
                  (record) =>
                    record.status ===
                    "late",
                ).length;

              const excused =
                records.filter(
                  (record) =>
                    record.status ===
                    "excused",
                ).length;

              /*
               * One attendance record represents one student/day.
               *
               * Use unique dates to avoid accidentally counting
               * duplicate records twice.
               */
              const uniqueDates =
                new Set(
                  records.map(
                    (record) =>
                      record.attendance_date,
                  ),
                );

              const recordedDays =
                uniqueDates.size;

              const attendancePercentage =
                recordedDays > 0
                  ? Math.round(
                      (present /
                        recordedDays) *
                        100,
                    )
                  : 0;

              const schoolClass =
                records.length > 0
                  ? classMap.get(
                      records[0]
                        .class_id,
                    )
                  : schoolClasses.find(
                      (schoolClass) =>
                        schoolClass.name ===
                          student.className &&
                        schoolClass.academic_year_id ===
                          selectedAcademicYearId,
                    );

              const section =
                schoolClass
                  ? sectionMap.get(
                      schoolClass.academic_section_id ??
                        "",
                    )
                  : undefined;

              return {
                student,
                className:
                  schoolClass?.name ??
                  student.className,
                sectionName:
                  section?.name ??
                  "—",
                present,
                absent,
                late,
                excused,
                recordedDays,
                attendancePercentage,
              };
            },
          )
          .filter(
            (
              row,
            ): row is StudentReport =>
              row !== null,
          );

      return rows.sort(
        (a, b) =>
          a.student.name.localeCompare(
            b.student.name,
          ),
      );
    }, [
      students,
      schoolClasses,
      sections,
      attendanceRecords,
      selectedAcademicYearId,
      selectedClassId,
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
        return reportRows;
      }

      return reportRows.filter(
        (row) =>
          row.student.name
            .toLowerCase()
            .includes(query) ||
          row.student.studentId
            .toLowerCase()
            .includes(query) ||
          row.className
            .toLowerCase()
            .includes(query),
      );
    }, [
      reportRows,
      search,
    ]);

  /*
   * --------------------------------------------------------------------------
   * Overall summary
   * --------------------------------------------------------------------------
   */

  const summary =
    useMemo(() => {
      const totalStudents =
        filteredRows.length;

      const totalPresent =
        filteredRows.reduce(
          (sum, row) =>
            sum + row.present,
          0,
        );

      const totalAbsent =
        filteredRows.reduce(
          (sum, row) =>
            sum + row.absent,
          0,
        );

      const totalLate =
        filteredRows.reduce(
          (sum, row) =>
            sum + row.late,
          0,
        );

      const totalExcused =
        filteredRows.reduce(
          (sum, row) =>
            sum + row.excused,
          0,
        );

      const totalRecordedDays =
        filteredRows.reduce(
          (sum, row) =>
            sum + row.recordedDays,
          0,
        );

      const attendancePercentage =
        totalRecordedDays > 0
          ? Math.round(
              (totalPresent /
                totalRecordedDays) *
                100,
            )
          : 0;

      return {
        totalStudents,
        totalPresent,
        totalAbsent,
        totalLate,
        totalExcused,
        totalRecordedDays,
        attendancePercentage,
      };
    }, [
      filteredRows,
    ]);

  /*
   * --------------------------------------------------------------------------
   * Selected values
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

  const selectedMonthLabel =
    MONTHS.find(
      (month) =>
        month.value ===
        selectedMonth,
    )?.label ?? "";

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
            Loading attendance reports...
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
              <FileBarChart
                size={21}
                className="text-indigo-600"
              />

              <h1 className="text-xl font-semibold text-slate-900">
                Attendance Reports
              </h1>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Review monthly student attendance
              performance.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
            <CalendarDays
              size={14}
            />

            {selectedMonthLabel}{" "}
            {monthRange?.calendarYear ??
              ""}
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
            Report filters
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Select the academic year, month, section and
            class.
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
              onChange={(event) => {
                setSelectedAcademicYearId(
                  event.target.value,
                );

                setSelectedSectionId("");
                setSelectedClassId("");
              }}
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

          {/* Month */}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Month
            </label>

            <select
              value={
                selectedMonth
              }
              onChange={(event) =>
                setSelectedMonth(
                  Number(
                    event.target
                      .value,
                  ),
                )
              }
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              {MONTHS.map(
                (month) => (
                  <option
                    key={
                      month.value
                    }
                    value={
                      month.value
                    }
                  >
                    {
                      month.label
                    }
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
              onChange={(event) => {
                setSelectedSectionId(
                  event.target.value,
                );

                setSelectedClassId("");
              }}
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
          label="Students"
          value={
            summary.totalStudents
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
            summary.totalPresent
          }
        />

        <SummaryCard
          icon={
            <X size={18} />
          }
          label="Absent"
          value={
            summary.totalAbsent
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
            summary.totalLate
          }
        />

        <SummaryCard
          icon={
            <UserCheck
              size={18}
            />
          }
          label="Attendance"
          value={`${summary.attendancePercentage}%`}
        />
      </div>

      {/* Report */}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Report header */}

        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Monthly attendance report
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              {selectedYear?.name ??
                "No academic year"}

              {" • "}

              {selectedMonthLabel}{" "}
              {monthRange?.calendarYear ??
                ""}

              {selectedSection
                ? ` • ${selectedSection.name}`
                : ""}

              {selectedClass
                ? ` • ${selectedClass.name}`
                : ""}
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

        {loadingReport && (
          <div className="flex min-h-[280px] items-center justify-center">
            <div className="text-sm text-slate-500">
              Loading attendance report...
            </div>
          </div>
        )}

        {/* Empty */}

        {!loadingReport &&
          filteredRows.length ===
            0 && (
            <div className="flex min-h-[320px] flex-col items-center justify-center px-5 text-center">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                <FileBarChart
                  size={22}
                />
              </div>

              <h3 className="text-sm font-semibold text-slate-900">
                No attendance data
              </h3>

              <p className="mt-1 max-w-sm text-sm text-slate-500">
                No attendance records were found for the
                selected month and filters.
              </p>
            </div>
          )}

        {/* Table */}

        {!loadingReport &&
          filteredRows.length >
            0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="w-[55px] px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      #
                    </th>

                    <th className="min-w-[260px] px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Student
                    </th>

                    <th className="w-[140px] px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Student ID
                    </th>

                    <th className="w-[150px] px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Class
                    </th>

                    <th className="w-[90px] px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Present
                    </th>

                    <th className="w-[90px] px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Absent
                    </th>

                    <th className="w-[80px] px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Late
                    </th>

                    <th className="w-[90px] px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Excused
                    </th>

                    <th className="w-[120px] px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Recorded
                    </th>

                    <th className="w-[150px] px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Attendance
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRows.map(
                    (
                      row,
                      index,
                    ) => (
                      <tr
                        key={
                          row.student.id
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
                              {row.student.name
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
                                  row.student
                                    .name
                                }
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
                          {
                            row.student
                              .studentId
                          }
                        </td>

                        <td className="px-3 py-4 text-sm font-medium text-slate-700">
                          {
                            row.className
                          }
                        </td>

                        <td className="px-3 py-4 text-center text-sm font-semibold text-emerald-700">
                          {
                            row.present
                          }
                        </td>

                        <td className="px-3 py-4 text-center text-sm font-semibold text-red-700">
                          {
                            row.absent
                          }
                        </td>

                        <td className="px-3 py-4 text-center text-sm font-semibold text-amber-700">
                          {
                            row.late
                          }
                        </td>

                        <td className="px-3 py-4 text-center text-sm font-semibold text-blue-700">
                          {
                            row.excused
                          }
                        </td>

                        <td className="px-3 py-4 text-center text-sm text-slate-600">
                          {
                            row.recordedDays
                          }
                        </td>

                        <td className="px-3 py-4 text-center">
                          <span
                            className={[
                              "inline-flex min-w-[72px] items-center justify-center rounded-lg border px-2.5 py-1.5 text-xs font-semibold",
                              getStatusClasses(
                                row.attendancePercentage,
                              ),
                            ].join(
                              " ",
                            )}
                          >
                            {
                              row.attendancePercentage
                            }
                            %
                          </span>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {/* Footer information */}

      {!loadingReport &&
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
              student
              {filteredRows.length ===
              1
                ? ""
                : "s"}
            </p>

            <p>
              Attendance is calculated from recorded
              attendance days.
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