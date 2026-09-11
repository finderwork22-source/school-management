import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, Search, UserCheck, Users, X } from "lucide-react";
import { useSchool } from "../context/SchoolContext";
import { getClasses, type SchoolClass } from "../lib/classes";
import { getStudents, type Student } from "../lib/students";
import { supabase } from "../lib/supabase";
import { normalizeRole } from "../lib/permissions";

 type AttendanceStatus = "present" | "absent" | "late" | "excused";

 interface AcademicYear {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  is_current?: boolean;
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

 const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "late", label: "Late" },
  { value: "excused", label: "Excused" },
 ];

 function getToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
 }

 function formatDate(value: string) {
  if (!value) return "";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
 }

 function statusClasses(status: AttendanceStatus) {
  switch (status) {
    case "present":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "absent":
      return "border-red-200 bg-red-50 text-red-700";
    case "late":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "excused":
      return "border-blue-200 bg-blue-50 text-blue-700";
  }
 }

 export default function Attendance() {
  const { school, membership } = useSchool();
  const role = normalizeRole(membership?.role);
  const isTeacher = role === "Teacher";

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teacherClassIds, setTeacherClassIds] = useState<string[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  const [academicYearId, setAcademicYearId] = useState("");
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(getToday());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});

  async function loadInitialData() {
    if (!school) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    let assignedClassIds: string[] = [];
    let assignedAcademicYearIds: string[] = [];

    if (isTeacher) {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError) {
        setError(userError.message);
      } else if (user?.email) {
        const { data: teacherData, error: teacherError } = await supabase
          .from("teachers")
          .select("id")
          .eq("school_id", school.id)
          .ilike("email", user.email)
          .maybeSingle();

        if (teacherError) {
          setError(teacherError.message);
        } else if (teacherData?.id) {
          const { data: assignmentsData, error: assignmentError } = await supabase
            .from("teacher_assignments")
            .select("class_id, academic_year_id")
            .eq("school_id", school.id)
            .eq("teacher_id", teacherData.id);

          if (assignmentError) {
            setError(assignmentError.message);
          } else {
            assignedClassIds = Array.from(
              new Set((assignmentsData ?? []).map((item) => item.class_id).filter(Boolean)),
            );
            assignedAcademicYearIds = Array.from(
              new Set((assignmentsData ?? []).map((item) => item.academic_year_id).filter(Boolean)),
            );
          }
        }
      }
    }

    setTeacherClassIds(assignedClassIds);

    const [yearsResponse, classesResponse, studentsResponse] = await Promise.all([
      supabase
        .from("academic_years")
        .select("id,name,start_date,end_date,is_active,is_current")
        .eq("school_id", school.id)
        .order("start_date", { ascending: false }),
      getClasses(school.id),
      getStudents(school.id),
    ]);

    if (yearsResponse.error) setError(yearsResponse.error.message);
    if (classesResponse.error) setError(classesResponse.error.message);
    if (studentsResponse.error) setError(studentsResponse.error.message);

    const allYears = (yearsResponse.data ?? []) as AcademicYear[];
    const years = isTeacher
      ? allYears.filter((year) => assignedAcademicYearIds.includes(year.id))
      : allYears;
    setAcademicYears(years);
    setClasses(classesResponse.data ?? []);
    setStudents(studentsResponse.data ?? []);

    const currentYear = years.find((year) => year.is_current) ?? years.find((year) => year.is_active) ?? years[0];
    if (currentYear) setAcademicYearId(currentYear.id);

    setLoading(false);
  }

  useEffect(() => {
    void loadInitialData();
  }, [school, isTeacher]);

  const classesForYear = useMemo(
    () =>
      classes.filter(
        (item) =>
          item.is_active &&
          item.academic_year_id === academicYearId &&
          (!isTeacher || teacherClassIds.includes(item.id)),
      ),
    [classes, academicYearId, isTeacher, teacherClassIds],
  );

  useEffect(() => {
    if (classesForYear.length === 0) {
      setClassId("");
      return;
    }
    if (!classesForYear.some((item) => item.id === classId)) setClassId(classesForYear[0].id);
  }, [classesForYear, classId]);

  const classStudents = useMemo(() => {
    if (!academicYearId || !classId) return [];
    return students.filter(
      (student) =>
        student.status === "Active" &&
        student.academicYearId === academicYearId &&
        student.className === classes.find((item) => item.id === classId)?.name,
    );
  }, [students, academicYearId, classId]);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return classStudents;
    return classStudents.filter(
      (student) =>
        student.name.toLowerCase().includes(query) ||
        student.studentId.toLowerCase().includes(query),
    );
  }, [classStudents, search]);

  async function loadDateRecords() {
    if (!school || !academicYearId || !classId || !date) {
      setRecords([]);
      setAttendance({});
      return;
    }

    setError("");
    const { data, error: recordsError } = await supabase
      .from("attendance_records")
      .select("id,student_id,academic_year_id,class_id,attendance_date,status,notes")
      .eq("school_id", school.id)
      .eq("academic_year_id", academicYearId)
      .eq("class_id", classId)
      .eq("attendance_date", date);

    if (recordsError) {
      setError(recordsError.message);
      setRecords([]);
      return;
    }

    const loaded = (data ?? []) as AttendanceRecord[];
    setRecords(loaded);
    setAttendance(
      Object.fromEntries(loaded.map((record) => [record.student_id, record.status])),
    );
  }

  useEffect(() => {
    void loadDateRecords();
  }, [school, academicYearId, classId, date]);

  function setStatus(studentId: string, status: AttendanceStatus) {
    setSuccess("");
    setAttendance((current) => ({ ...current, [studentId]: status }));
  }

  function markAll(status: AttendanceStatus) {
    setSuccess("");
    setAttendance((current) => {
      const next = { ...current };
      classStudents.forEach((student) => {
        next[student.id] = status;
      });
      return next;
    });
  }

  async function saveAttendance() {
    if (isTeacher && !teacherClassIds.includes(classId)) {
      setError("You can only take attendance for classes assigned to you.");
      return;
    }

    if (!school || !academicYearId || !classId || !date) {
      setError("Please select an academic year, class and date.");
      return;
    }

    if (classStudents.length === 0) {
      setError("No active students are enrolled in this class for the selected academic year.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const rows = classStudents.map((student) => ({
        school_id: school.id,
        student_id: student.id,
        academic_year_id: academicYearId,
        class_id: classId,
        attendance_date: date,
        status: attendance[student.id] ?? "present",
        notes: null,
      }));

      for (const row of rows) {
        const existing = records.find((record) => record.student_id === row.student_id);
        if (existing) {
          const { error: updateError } = await supabase
            .from("attendance_records")
            .update({ status: row.status, notes: row.notes })
            .eq("id", existing.id)
            .eq("school_id", school.id);
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase
            .from("attendance_records")
            .insert(row);
          if (insertError) throw insertError;
        }
      }

      await loadDateRecords();
      setSuccess(`Attendance saved for ${formatDate(date)}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save attendance.");
    } finally {
      setSaving(false);
    }
  }

  const summary = useMemo(() => {
    const values = classStudents.map((student) => attendance[student.id] ?? "present");
    return {
      total: values.length,
      present: values.filter((value) => value === "present").length,
      absent: values.filter((value) => value === "absent").length,
      late: values.filter((value) => value === "late").length,
      excused: values.filter((value) => value === "excused").length,
    };
  }, [classStudents, attendance]);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <div className="flex min-h-[400px] items-center justify-center text-sm text-slate-500">
          Loading attendance...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Academics</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Attendance</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isTeacher
              ? "Take attendance for the classes assigned to you."
              : "Take and manage daily attendance for each class."}
          </p>
          {isTeacher && (
            <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs text-indigo-700">
              Teaching view: you can take attendance only for your assigned classes.
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={saveAttendance}
          disabled={saving || !classId || classStudents.length === 0}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCircle2 size={17} />
          {saving ? "Saving..." : "Save Attendance"}
        </button>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Academic Year</span>
            <select value={academicYearId} onChange={(event) => setAcademicYearId(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
              {academicYears.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Class</span>
            <select value={classId} onChange={(event) => setClassId(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
              {classesForYear.length === 0 ? <option value="">No classes available</option> : classesForYear.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Attendance Date</span>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-700 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
            </div>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          ["Students", summary.total, <Users size={18} />],
          ["Present", summary.present, <CheckCircle2 size={18} />],
          ["Absent", summary.absent, <X size={18} />],
          ["Late", summary.late, <Clock3 size={18} />],
          ["Excused", summary.excused, <UserCheck size={18} />],
        ].map(([label, value, icon]) => (
          <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
              {icon}
            </div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Daily attendance</h2>
            <p className="mt-1 text-xs text-slate-500">{formatDate(date)} · {classes.find((item) => item.id === classId)?.name ?? "No class selected"}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((option) => (
              <button key={option.value} type="button" onClick={() => markAll(option.value)} className={`rounded-lg border px-3 py-2 text-xs font-semibold transition hover:opacity-80 ${statusClasses(option.value)}`}>
                Mark all {option.label.toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="border-b border-slate-100 px-5 py-3">
          <div className="relative max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student..." className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
          </div>
        </div>

        {filteredStudents.length === 0 ? (
          <div className="flex min-h-[300px] items-center justify-center px-5 text-center">
            <div>
              <Users className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-700">No students found</p>
              <p className="mt-1 text-xs text-slate-500">Check the selected academic year and class.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Student</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Student ID</th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((student) => {
                  const current = attendance[student.id] ?? "present";
                  return (
                    <tr key={student.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-4">
                        <div className="font-medium text-sm text-slate-900">{student.name}</div>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-500">{student.studentId}</td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                          {STATUS_OPTIONS.map((option) => (
                            <button key={option.value} type="button" onClick={() => setStatus(student.id, option.value)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${current === option.value ? statusClasses(option.value) + " ring-2 ring-indigo-100" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}>
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
