import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock,
  Edit3,
  Plus,
  Printer,
  Trash2,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import PrintableTimetable from "../components/timetable/PrintableTimetable";
import { normalizeRole } from "../lib/permissions";

interface AcademicYear {
  id: string;
  name: string;
  is_active: boolean;
}

interface SchoolClass {
  id: string;
  name: string;
  academic_year_id: string | null;
  is_active: boolean;
}

interface TeacherAssignment {
  id: string;
  teacher_id: string;
  academic_year_id: string;
  class_id: string;
  subject_id: string;
  teacherName: string;
  subjectName: string;
}

interface TimetableEntry {
  id: string;
  school_id: string;
  academic_year_id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  subjectName: string;
  teacherName: string;
}

interface FormState {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  subjectId: string;
  teacherId: string;
}

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function emptyForm(): FormState {
  return {
    dayOfWeek: "Monday",
    startTime: "08:40",
    endTime: "09:20",
    subjectId: "",
    teacherId: "",
  };
}

function formatTime(value: string) {
  if (!value) return "";

  const [hours, minutes] = value
    .slice(0, 5)
    .split(":")
    .map(Number);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    return value;
  }

  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;

  return `${displayHour}:${String(minutes).padStart(
    2,
    "0",
  )} ${suffix}`;
}

function getSupabaseErrorMessage(
  error: {
    message?: string;
    details?: string;
    hint?: string;
  } | null,
) {
  if (!error) {
    return "";
  }

  const message =
    error.message?.trim();

  if (!message) {
    return "Something went wrong. Please try again.";
  }

  if (
    message.includes(
      "This class already has a lesson scheduled at this time.",
    )
  ) {
    return "This class already has a lesson scheduled at this time.";
  }

  if (
    message.includes(
      "This teacher already has a lesson scheduled at this time.",
    )
  ) {
    return "This teacher already has a lesson scheduled at this time.";
  }

  return message;
}

export default function Timetable() {
  const [schoolId, setSchoolId] =
    useState<string>("");

  const [role, setRole] = useState<ReturnType<typeof normalizeRole>>(
    "Teacher",
  );


  const [teacherAssignedClassIds, setTeacherAssignedClassIds] =
    useState<string[]>([]);

  const [teacherAssignedAcademicYearIds, setTeacherAssignedAcademicYearIds] =
    useState<string[]>([]);

  const [
    academicYears,
    setAcademicYears,
  ] = useState<AcademicYear[]>([]);

  const [classes, setClasses] =
    useState<SchoolClass[]>([]);

  const [
    assignments,
    setAssignments,
  ] = useState<TeacherAssignment[]>(
    [],
  );

  const [entries, setEntries] =
    useState<TimetableEntry[]>([]);

  const [
    selectedAcademicYearId,
    setSelectedAcademicYearId,
  ] = useState<string>("");

  const [
    selectedClassId,
    setSelectedClassId,
  ] = useState<string>("");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [
    showModal,
    setShowModal,
  ] = useState(false);

  const [
    editingEntry,
    setEditingEntry,
  ] = useState<TimetableEntry | null>(
    null,
  );

  const [form, setForm] =
    useState<FormState>(
      emptyForm(),
    );

  /*
   * =========================================================
   * LOAD SCHOOL
   * =========================================================
   */

  useEffect(() => {
    async function loadInitialData() {
      setLoading(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError(
          "You must be signed in to view the timetable.",
        );
        setLoading(false);
        return;
      }

      const {
        data: membership,
        error: membershipError,
      } = await supabase
        .from("school_members")
        .select("school_id, role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (membershipError) {
        setError(membershipError.message);
        setLoading(false);
        return;
      }

      if (!membership?.school_id) {
        setError(
          "No school is associated with your account.",
        );
        setLoading(false);
        return;
      }

      const currentSchoolId = membership.school_id;
      const currentRole = normalizeRole(membership.role);
      const currentIsTeacher = currentRole === "Teacher";

      setSchoolId(currentSchoolId);
      setRole(currentRole);

      let assignedClassIds: string[] = [];
      let assignedAcademicYearIds: string[] = [];

      if (currentIsTeacher) {
        if (!user.email) {
          setError(
            "Your account does not have an email address, so your teaching assignments could not be loaded.",
          );
          setTeacherAssignedClassIds([]);
          setTeacherAssignedAcademicYearIds([]);
          setLoading(false);
          return;
        }

        const {
          data: teacher,
          error: teacherError,
        } = await supabase
          .from("teachers")
          .select("id")
          .eq("school_id", currentSchoolId)
          .ilike("email", user.email)
          .maybeSingle();

        if (teacherError) {
          setError(teacherError.message);
          setLoading(false);
          return;
        }

        if (!teacher?.id) {
            setTeacherAssignedClassIds([]);
          setTeacherAssignedAcademicYearIds([]);
          setError(
            "Your teacher profile could not be matched to this account. Please ask a school administrator to verify your school email.",
          );
          setLoading(false);
          return;
        }

        const {
          data: teacherAssignments,
          error: teacherAssignmentsError,
        } = await supabase
          .from("teacher_assignments")
          .select("class_id, academic_year_id")
          .eq("school_id", currentSchoolId)
          .eq("teacher_id", teacher.id);

        if (teacherAssignmentsError) {
          setError(teacherAssignmentsError.message);
          setLoading(false);
          return;
        }

        assignedClassIds = Array.from(
          new Set(
            (teacherAssignments ?? [])
              .map((item) => item.class_id)
              .filter(Boolean),
          ),
        );

        assignedAcademicYearIds = Array.from(
          new Set(
            (teacherAssignments ?? [])
              .map((item) => item.academic_year_id)
              .filter(Boolean),
          ),
        );

        setTeacherAssignedClassIds(assignedClassIds);
        setTeacherAssignedAcademicYearIds(assignedAcademicYearIds);
      } else {
        setTeacherAssignedClassIds([]);
        setTeacherAssignedAcademicYearIds([]);
      }

      const [yearsResult, classesResult] = await Promise.all([
        supabase
          .from("academic_years")
          .select("id, name, is_active")
          .eq("school_id", currentSchoolId)
          .order("name", { ascending: false }),

        supabase
          .from("classes")
          .select("id, name, academic_year_id, is_active")
          .eq("school_id", currentSchoolId)
          .eq("is_active", true)
          .order("name"),
      ]);

      if (yearsResult.error) {
        setError(
          getSupabaseErrorMessage(yearsResult.error),
        );
        setLoading(false);
        return;
      }

      if (classesResult.error) {
        setError(
          getSupabaseErrorMessage(classesResult.error),
        );
        setLoading(false);
        return;
      }

      const allYears = (yearsResult.data ?? []) as AcademicYear[];
      const allClasses = (classesResult.data ?? []) as SchoolClass[];

      const loadedYears = currentIsTeacher
        ? allYears.filter((year) =>
            assignedAcademicYearIds.includes(year.id),
          )
        : allYears;

      const loadedClasses = currentIsTeacher
        ? allClasses.filter((schoolClass) =>
            assignedClassIds.includes(schoolClass.id),
          )
        : allClasses;

      setAcademicYears(loadedYears);
      setClasses(loadedClasses);

      const activeYear =
        loadedYears.find((year) => year.is_active) ??
        loadedYears.find((year) =>
          loadedClasses.some(
            (schoolClass) => schoolClass.academic_year_id === year.id,
          ),
        ) ??
        loadedYears[0];

      if (activeYear) {
        setSelectedAcademicYearId(activeYear.id);

        const firstClass = loadedClasses.find(
          (schoolClass) =>
            schoolClass.academic_year_id === activeYear.id,
        );

        setSelectedClassId(firstClass?.id ?? "");
      } else {
        setSelectedAcademicYearId("");
        setSelectedClassId("");
      }

      setLoading(false);
    }

    void loadInitialData();
  }, []);

  /*
   * =========================================================
   * LOAD TEACHER ASSIGNMENTS
   * =========================================================
   */

  useEffect(() => {
    async function loadAssignments() {
      if (
        !schoolId ||
        !selectedAcademicYearId ||
        !selectedClassId
      ) {
        setAssignments([]);
        return;
      }

      const {
        data,
        error: assignmentError,
      } = await supabase
        .from("teacher_assignments")
        .select(`
          id,
          teacher_id,
          academic_year_id,
          class_id,
          subject_id,
          teachers (
            first_name,
            middle_name,
            last_name
          ),
          subjects (
            name
          )
        `)
        .eq(
          "school_id",
          schoolId,
        )
        .eq(
          "academic_year_id",
          selectedAcademicYearId,
        )
        .eq(
          "class_id",
          selectedClassId,
        );

      if (assignmentError) {
        setError(
          getSupabaseErrorMessage(
            assignmentError,
          ),
        );
        setAssignments([]);
        return;
      }

      const mapped: TeacherAssignment[] =
        (data ?? []).map(
          (item: any) => {
            const teacher =
              Array.isArray(
                item.teachers,
              )
                ? item.teachers[0]
                : item.teachers;

            const subject =
              Array.isArray(
                item.subjects,
              )
                ? item.subjects[0]
                : item.subjects;

            return {
              id: item.id,
              teacher_id:
                item.teacher_id,
              academic_year_id:
                item.academic_year_id,
              class_id:
                item.class_id,
              subject_id:
                item.subject_id,

              teacherName: [
                teacher?.first_name,
                teacher?.middle_name,
                teacher?.last_name,
              ]
                .filter(Boolean)
                .join(" "),

              subjectName:
                subject?.name ??
                "Unknown subject",
            };
          },
        );

      setAssignments(
        mapped,
      );
    }

    void loadAssignments();
  }, [
    schoolId,
    selectedAcademicYearId,
    selectedClassId,
  ]);

  /*
   * =========================================================
   * LOAD TIMETABLE
   * =========================================================
   */

  useEffect(() => {
    void loadCurrentTimetable();
  }, [
    schoolId,
    selectedAcademicYearId,
    selectedClassId,
  ]);

  async function loadCurrentTimetable() {
    if (
      !schoolId ||
      !selectedAcademicYearId ||
      !selectedClassId
    ) {
      setEntries([]);
      return;
    }

    const {
      data,
      error: timetableError,
    } = await supabase
      .from("timetable_entries")
      .select(`
        id,
        school_id,
        academic_year_id,
        class_id,
        subject_id,
        teacher_id,
        day_of_week,
        start_time,
        end_time,
        subjects (
          name
        ),
        teachers (
          first_name,
          middle_name,
          last_name
        )
      `)
      .eq(
        "school_id",
        schoolId,
      )
      .eq(
        "academic_year_id",
        selectedAcademicYearId,
      )
      .eq(
        "class_id",
        selectedClassId,
      )
      .order(
        "start_time",
        {
          ascending: true,
        },
      );

    if (timetableError) {
      setError(
        getSupabaseErrorMessage(
          timetableError,
        ),
      );
      setEntries([]);
      return;
    }

    const mapped: TimetableEntry[] =
      (data ?? []).map(
        (item: any) => {
          const subject =
            Array.isArray(
              item.subjects,
            )
              ? item.subjects[0]
              : item.subjects;

          const teacher =
            Array.isArray(
              item.teachers,
            )
              ? item.teachers[0]
              : item.teachers;

          return {
            id: item.id,
            school_id:
              item.school_id,
            academic_year_id:
              item.academic_year_id,
            class_id:
              item.class_id,
            subject_id:
              item.subject_id,
            teacher_id:
              item.teacher_id,
            day_of_week:
              item.day_of_week,
            start_time:
              item.start_time,
            end_time:
              item.end_time,

            subjectName:
              subject?.name ??
              "Unknown subject",

            teacherName: [
              teacher?.first_name,
              teacher?.middle_name,
              teacher?.last_name,
            ]
              .filter(Boolean)
              .join(" "),
          };
        },
      );

    setEntries(
      mapped,
    );
  }

  const isTeacher = role === "Teacher";

  /*
   * =========================================================
   * AVAILABLE CLASSES
   * =========================================================
   */

  const availableClasses =
    useMemo(
      () =>
        classes.filter(
          (schoolClass) =>
            schoolClass.academic_year_id ===
              selectedAcademicYearId &&
            schoolClass.is_active &&
            (!isTeacher ||
              teacherAssignedClassIds.includes(schoolClass.id)),
        ),
      [
        classes,
        selectedAcademicYearId,
        isTeacher,
        teacherAssignedClassIds,
      ],
    );

  /*
   * =========================================================
   * AVAILABLE SUBJECTS
   * =========================================================
   */

  const availableSubjects =
    useMemo(() => {
      const map =
        new Map<
          string,
          string
        >();

      assignments.forEach(
        (assignment) => {
          map.set(
            assignment.subject_id,
            assignment.subjectName,
          );
        },
      );

      return Array.from(
        map.entries(),
      ).map(
        ([id, name]) => ({
          id,
          name,
        }),
      );
    }, [assignments]);

  /*
   * =========================================================
   * AVAILABLE TEACHERS
   * =========================================================
   */

  const availableTeachers =
    useMemo(
      () =>
        assignments.filter(
          (assignment) =>
            assignment.subject_id ===
            form.subjectId,
        ),
      [
        assignments,
        form.subjectId,
      ],
    );

  /*
   * =========================================================
   * ENTRIES BY DAY
   * =========================================================
   */

  const entriesByDay =
    useMemo(() => {
      const result: Record<
        string,
        TimetableEntry[]
      > = {};

      DAYS.forEach(
        (day) => {
          result[day] =
            entries
              .filter(
                (entry) =>
                  entry.day_of_week ===
                  day,
              )
              .sort(
                (a, b) =>
                  a.start_time.localeCompare(
                    b.start_time,
                  ),
              );
        },
      );

      return result;
    }, [entries]);

  /*
   * =========================================================
   * FORM
   * =========================================================
   */

  function updateForm<
    K extends keyof FormState,
  >(
    field: K,
    value: FormState[K],
  ) {
    setForm(
      (current) => ({
        ...current,
        [field]: value,
      }),
    );

    setError("");
  }

  /*
   * =========================================================
   * OPEN CREATE
   * =========================================================
   */

  function openCreate() {
    if (isTeacher) return;

    setEditingEntry(null);
    setForm(
      emptyForm(),
    );
    setError("");
    setShowModal(true);
  }

  /*
   * =========================================================
   * OPEN EDIT
   * =========================================================
   */

  function openEdit(
    entry: TimetableEntry,
  ) {
    if (isTeacher) return;

    setEditingEntry(
      entry,
    );

    setForm({
      dayOfWeek:
        entry.day_of_week,

      startTime:
        entry.start_time.slice(
          0,
          5,
        ),

      endTime:
        entry.end_time.slice(
          0,
          5,
        ),

      subjectId:
        entry.subject_id,

      teacherId:
        entry.teacher_id,
    });

    setError("");
    setShowModal(true);
  }

  /*
   * =========================================================
   * CLIENT-SIDE TEACHER CONFLICT CHECK
   * =========================================================
   */

  function hasTeacherConflict() {
    if (
      !form.startTime ||
      !form.endTime ||
      !form.teacherId
    ) {
      return false;
    }

    return entries.some(
      (entry) => {
        if (
          editingEntry &&
          entry.id ===
            editingEntry.id
        ) {
          return false;
        }

        if (
          entry.day_of_week !==
          form.dayOfWeek
        ) {
          return false;
        }

        if (
          entry.teacher_id !==
          form.teacherId
        ) {
          return false;
        }

        return (
          form.startTime <
            entry.end_time &&
          form.endTime >
            entry.start_time
        );
      },
    );
  }

  /*
   * =========================================================
   * SAVE ENTRY
   * =========================================================
   */

  async function saveEntry(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (isTeacher) {
      setError("Teachers can view the timetable but cannot create or edit lessons.");
      return;
    }

    setError("");

    if (
      !schoolId ||
      !selectedAcademicYearId ||
      !selectedClassId
    ) {
      setError(
        "School, academic year and class are required.",
      );
      return;
    }

    if (
      !form.dayOfWeek ||
      !form.startTime ||
      !form.endTime ||
      !form.subjectId ||
      !form.teacherId
    ) {
      setError(
        "Day, time, subject and teacher are required.",
      );
      return;
    }

    if (
      form.endTime <=
      form.startTime
    ) {
      setError(
        "End time must be after start time.",
      );
      return;
    }

    const selectedAssignment =
      assignments.find(
        (assignment) =>
          assignment.subject_id ===
            form.subjectId &&
          assignment.teacher_id ===
            form.teacherId,
      );

    if (!selectedAssignment) {
      setError(
        "The selected teacher is not assigned to this subject for this class.",
      );
      return;
    }

    if (
      hasTeacherConflict()
    ) {
      setError(
        "This teacher already has a lesson scheduled at this time.",
      );
      return;
    }

    setSaving(true);

    const payload = {
      school_id:
        schoolId,

      academic_year_id:
        selectedAcademicYearId,

      class_id:
        selectedClassId,

      subject_id:
        form.subjectId,

      teacher_id:
        form.teacherId,

      day_of_week:
        form.dayOfWeek,

      start_time:
        form.startTime,

      end_time:
        form.endTime,
    };

    const result =
      editingEntry
        ? await supabase
            .from(
              "timetable_entries",
            )
            .update(
              payload,
            )
            .eq(
              "id",
              editingEntry.id,
            )
            .eq(
              "school_id",
              schoolId,
            )
        : await supabase
            .from(
              "timetable_entries",
            )
            .insert(
              payload,
            );

    if (result.error) {
      setError(
        getSupabaseErrorMessage(
          result.error,
        ),
      );

      setSaving(false);
      return;
    }

    setSaving(false);
    setShowModal(false);
    setEditingEntry(null);
    setForm(
      emptyForm(),
    );

    await loadCurrentTimetable();
  }

  /*
   * =========================================================
   * DELETE ENTRY
   * =========================================================
   */

  async function deleteEntry(
    entry: TimetableEntry,
  ) {
    if (isTeacher || !schoolId) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete ${entry.subjectName} from the timetable?`,
      );

    if (!confirmed) {
      return;
    }

    setError("");

    const {
      error: deleteError,
    } = await supabase
      .from(
        "timetable_entries",
      )
      .delete()
      .eq(
        "id",
        entry.id,
      )
      .eq(
        "school_id",
        schoolId,
      );

    if (deleteError) {
      setError(
        getSupabaseErrorMessage(
          deleteError,
        ),
      );
      return;
    }

    setEntries(
      (current) =>
        current.filter(
          (item) =>
            item.id !==
            entry.id,
        ),
    );
  }

  /*
   * =========================================================
   * PRINT
   * =========================================================
   */

  function handlePrint() {
    setError("");

    if (!selectedClassId) {
      setError(
        "Please select a class first.",
      );
      return;
    }

    window.print();
  }

  /*
   * =========================================================
   * SELECT CLASS
   * =========================================================
   */

  function handleAcademicYearChange(
    value: string,
  ) {
    setSelectedAcademicYearId(
      value,
    );

    const firstClass =
      classes.find(
        (schoolClass) =>
          schoolClass.academic_year_id ===
          value &&
          schoolClass.is_active,
      );

    setSelectedClassId(
      firstClass?.id ?? "",
    );

    setError("");
  }

  /*
   * =========================================================
   * LOADING
   * =========================================================
   */

  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <div className="flex min-h-[300px] items-center justify-center">
          <p className="text-sm text-slate-500">
            Loading timetable...
          </p>
        </div>
      </div>
    );
  }

  const selectedClass =
    classes.find(
      (schoolClass) =>
        schoolClass.id ===
        selectedClassId,
    );

  const selectedAcademicYear =
    academicYears.find(
      (year) =>
        year.id ===
        selectedAcademicYearId,
    );

  return (
    <div className="mx-auto max-w-[1400px]">

      {/* ===================================================
          SCREEN HEADER
      =================================================== */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Timetable
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            {isTeacher
              ? "View the timetable assigned to your teaching responsibilities."
              : "Manage the weekly timetable for each class."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">

          <button
            type="button"
            onClick={
              handlePrint
            }
            disabled={
              !selectedClassId
            }
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Printer
              size={16}
            />

            Print Timetable
          </button>

          {!isTeacher && (
            <button
              type="button"
              onClick={openCreate}
              disabled={!selectedClassId}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={16} />
              Add Lesson
            </button>
          )}

        </div>

      </div>

      {/* ===================================================
          FILTERS
      =================================================== */}

      <div className="mt-6 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">

        <SelectField
          label="Academic Year"
          value={
            selectedAcademicYearId
          }
          onChange={
            handleAcademicYearChange
          }
          options={academicYears
            .filter(
              (year) =>
                !isTeacher ||
                teacherAssignedAcademicYearIds.includes(year.id),
            )
            .map(
              (year) => ({
                value: year.id,
                label:
                  `${year.name}${
                    year.is_active
                      ? " • Active"
                      : ""
                  }`,
              }),
            )}
        />

        <SelectField
          label="Class"
          value={
            selectedClassId
          }
          onChange={
            setSelectedClassId
          }
          options={availableClasses.map(
            (schoolClass) => ({
              value:
                schoolClass.id,
              label:
                schoolClass.name,
            }),
          )}
          disabled={
            !selectedAcademicYearId
          }
        />

      </div>

      {isTeacher && (
        <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
          <p className="text-sm font-medium text-indigo-900">Teaching view</p>
          <p className="mt-1 text-xs text-indigo-700">
            The timetable is prepared by the Head of Academics. You can view the lessons assigned to your classes, but you cannot create, edit, or delete timetable entries.
          </p>
        </div>
      )}

      {/* ===================================================
          ERROR
      =================================================== */}

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ===================================================
          SCREEN TIMETABLE
      =================================================== */}

      {!selectedClassId ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center">

          <CalendarDays
            size={28}
            className="mx-auto text-slate-400"
          />

          <p className="mt-3 text-sm font-medium text-slate-700">
            Select a class
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Select an academic year and class to view its timetable.
          </p>

        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

          <div className="overflow-x-auto">

            <div className="grid min-w-[1200px] grid-cols-6 divide-x divide-slate-200">

              {DAYS.map(
                (day) => (
                  <div
                    key={day}
                    className="min-h-[520px]"
                  >

                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">

                      <p className="text-sm font-semibold text-slate-800">
                        {day}
                      </p>

                      <p className="mt-0.5 text-xs text-slate-400">
                        {
                          entriesByDay[
                            day
                          ]?.length ??
                          0
                        }{" "}
                        lessons
                      </p>

                    </div>

                    <div className="space-y-3 p-3">

                      {entriesByDay[
                        day
                      ]?.length ===
                      0 ? (
                        <div className="py-10 text-center">

                          <Clock
                            size={20}
                            className="mx-auto text-slate-300"
                          />

                          <p className="mt-2 text-xs text-slate-400">
                            No lessons
                          </p>

                        </div>
                      ) : (
                        entriesByDay[
                          day
                        ].map(
                          (entry) => (
                            <div
                              key={
                                entry.id
                              }
                              className="group rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-indigo-200 hover:shadow"
                            >

                              <div className="flex items-start justify-between gap-2">

                                <div>

                                  <p className="text-xs font-semibold text-indigo-600">
                                    {formatTime(
                                      entry.start_time,
                                    )}
                                    {" – "}
                                    {formatTime(
                                      entry.end_time,
                                    )}
                                  </p>

                                  <p className="mt-2 text-sm font-semibold text-slate-800">
                                    {
                                      entry.subjectName
                                    }
                                  </p>

                                  <p className="mt-1 text-xs text-slate-500">
                                    {
                                      entry.teacherName
                                    }
                                  </p>

                                </div>

                                {!isTeacher && (
                                  <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">

                                  <button
                                    type="button"
                                    onClick={() =>
                                      openEdit(
                                        entry,
                                      )
                                    }
                                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                    title="Edit"
                                  >
                                    <Edit3
                                      size={
                                        14
                                      }
                                    />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      void deleteEntry(
                                        entry,
                                      )
                                    }
                                    className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                    title="Delete"
                                  >
                                    <Trash2
                                      size={
                                        14
                                      }
                                    />
                                  </button>

                                  </div>
                                )}

                              </div>

                            </div>
                          ),
                        )
                      )}

                    </div>

                  </div>
                ),
              )}

            </div>

          </div>

        </div>
      )}

      {/* ===================================================
          ADD / EDIT MODAL
      =================================================== */}

      {!isTeacher && showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">

          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">

              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingEntry
                    ? "Edit Lesson"
                    : "Add Lesson"}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Add a subject, teacher and time to the timetable.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowModal(
                    false,
                  )
                }
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>

            </div>

            <form
              onSubmit={
                saveEntry
              }
              className="space-y-5 p-6"
            >

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <SelectField
                label="Day"
                value={
                  form.dayOfWeek
                }
                onChange={(value) =>
                  updateForm(
                    "dayOfWeek",
                    value,
                  )
                }
                options={DAYS.map(
                  (day) => ({
                    value: day,
                    label: day,
                  }),
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">

                <Field
                  label="Start time"
                  type="time"
                  value={
                    form.startTime
                  }
                  onChange={(value) =>
                    updateForm(
                      "startTime",
                      value,
                    )
                  }
                  required
                />

                <Field
                  label="End time"
                  type="time"
                  value={
                    form.endTime
                  }
                  onChange={(value) =>
                    updateForm(
                      "endTime",
                      value,
                    )
                  }
                  required
                />

              </div>

              <SelectField
                label="Subject"
                value={
                  form.subjectId
                }
                onChange={(value) => {
                  updateForm(
                    "subjectId",
                    value,
                  );

                  updateForm(
                    "teacherId",
                    "",
                  );
                }}
                options={availableSubjects.map(
                  (subject) => ({
                    value:
                      subject.id,
                    label:
                      subject.name,
                  }),
                )}
              />

              {availableSubjects.length ===
                0 && (
                <p className="text-xs text-amber-600">
                  No subjects have been assigned to this class yet. Assign subjects and teachers first.
                </p>
              )}

              <SelectField
                label="Teacher"
                value={
                  form.teacherId
                }
                onChange={(value) =>
                  updateForm(
                    "teacherId",
                    value,
                  )
                }
                options={availableTeachers.map(
                  (
                    assignment,
                  ) => ({
                    value:
                      assignment.teacher_id,
                    label:
                      assignment.teacherName,
                  }),
                )}
                disabled={
                  !form.subjectId
                }
              />

              <div className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                <strong className="font-medium text-slate-700">
                  Class:
                </strong>{" "}
                {selectedClass?.name ??
                  "—"}

                <br />

                <strong className="font-medium text-slate-700">
                  Academic year:
                </strong>{" "}
                {selectedAcademicYear?.name ??
                  "—"}
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">

                <button
                  type="button"
                  onClick={() =>
                    setShowModal(
                      false,
                    )
                  }
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    saving
                  }
                  className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingEntry
                      ? "Save changes"
                      : "Add Lesson"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

      {/* ===================================================
          PRINTABLE HIGH GATE VERSION
      =================================================== */}

      <PrintableTimetable
        schoolName="HIGH GATE INTERNATIONAL ACADEMY"
        academicYear={
          selectedAcademicYear?.name ??
          ""
        }
        className={
          selectedClass?.name ??
          ""
        }
        lessons={entries.map(
          (entry) => ({
            day:
              entry.day_of_week,
            startTime:
              entry.start_time,
            endTime:
              entry.end_time,
            subject:
              entry.subjectName,
          }),
        )}
        logoUrl="/high-gate-logo.png"
      />

    </div>
  );
}

/* =============================================================
   FIELD
============================================================= */

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">

      <span className="mb-1.5 block text-xs font-medium text-slate-600">
        {label}
      </span>

      <input
        type={type}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
        placeholder={
          placeholder
        }
        required={
          required
        }
        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />

    </label>
  );
}

/* =============================================================
   SELECT FIELD
============================================================= */

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;
  options: {
    value: string;
    label: string;
  }[];
  disabled?: boolean;
}) {
  return (
    <label className="block">

      <span className="mb-1.5 block text-xs font-medium text-slate-600">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
        disabled={
          disabled
        }
        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
      >

        <option value="">
          Select{" "}
          {label.toLowerCase()}
        </option>

        {options.map(
          (option) => (
            <option
              key={
                option.value
              }
              value={
                option.value
              }
            >
              {
                option.label
              }
            </option>
          ),
        )}

      </select>

    </label>
  );
}