import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  GraduationCap,
  Loader2,
  Megaphone,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";
import { useSchool } from "../context/SchoolContext";
import { supabase } from "../lib/supabase";

interface Teacher {
  id: string;
  teacher_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  email: string | null;
  photo_url: string | null;
  status: string | null;
}

interface Assignment {
  id: string;
  academic_year_id: string;
  class_id: string;
  subject_id: string;
  className: string;
  subjectName: string;
  academicYearName: string;
}

interface TimetableEntry {
  id: string;
  class_id: string;
  subject_id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  className: string;
  subjectName: string;
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  class_id: string;
  status: string;
}

interface Announcement {
  id: string;
  title: string | null;
  created_at: string;
}

interface Assessment {
  id: string;
  title: string;
  assessment_type: string | null;
  assessment_date: string;
  max_marks: number;
  subject_id: string;
  class_id: string;
  status: "Draft" | "Published" | string;
  className: string;
  subjectName: string;
}

interface TeacherStats {
  classes: number;
  subjects: number;
  students: number;
  attendanceRecorded: number;
  attendanceRate: number;
}

const initialStats: TeacherStats = {
  classes: 0,
  subjects: 0,
  students: 0,
  attendanceRecorded: 0,
  attendanceRate: 0,
};

function getToday() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function getDayName(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);
}

function formatTime(value: string) {
  if (!value) return "";
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min${diffMinutes === 1 ? "" : "s"} ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr${diffHours === 1 ? "" : "s"} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;

  return formatDate(value.slice(0, 10));
}



export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { school } = useSchool();

  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [, setAttendance] = useState<AttendanceRecord[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [stats, setStats] = useState<TeacherStats>(initialStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    if (!school?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;
      if (!user?.email) {
        throw new Error("Your account does not have an email address.");
      }

      const { data: teacherData, error: teacherError } = await supabase
        .from("teachers")
        .select(
          "id, teacher_id, first_name, middle_name, last_name, email, photo_url, status",
        )
        .eq("school_id", school.id)
        .ilike("email", user.email)
        .maybeSingle();

      if (teacherError) throw teacherError;

      if (!teacherData) {
        setTeacher(null);
        setAssignments([]);
        setTimetable([]);
        setAttendance([]);
        setAssessments([]);
        setStats(initialStats);
        setError(
          "Your account is not linked to a teacher profile yet. Please ask the school administrator to make sure your school email matches your teacher record.",
        );
        setLoading(false);
        return;
      }

      const teacherRecord = teacherData as Teacher;
      setTeacher(teacherRecord);

      const { data: assignmentData, error: assignmentError } = await supabase
        .from("teacher_assignments")
        .select(
          `
            id,
            academic_year_id,
            class_id,
            subject_id,
            academic_years ( name ),
            classes ( name ),
            subjects ( name )
          `,
        )
        .eq("school_id", school.id)
        .eq("teacher_id", teacherRecord.id);

      if (assignmentError) throw assignmentError;

      const mappedAssignments: Assignment[] = (assignmentData ?? []).map((item: any) => {
        const year = Array.isArray(item.academic_years) ? item.academic_years[0] : item.academic_years;
        const schoolClass = Array.isArray(item.classes) ? item.classes[0] : item.classes;
        const subject = Array.isArray(item.subjects) ? item.subjects[0] : item.subjects;

        return {
          id: item.id,
          academic_year_id: item.academic_year_id,
          class_id: item.class_id,
          subject_id: item.subject_id,
          className: schoolClass?.name ?? "Unknown class",
          subjectName: subject?.name ?? "Unknown subject",
          academicYearName: year?.name ?? "Unknown academic year",
        };
      });

      setAssignments(mappedAssignments);

      const activeYearId =
        mappedAssignments.find((assignment) => assignment.academic_year_id)?.academic_year_id ?? null;

      const classIds = Array.from(new Set(mappedAssignments.map((assignment) => assignment.class_id)));
      const subjectIds = Array.from(new Set(mappedAssignments.map((assignment) => assignment.subject_id)));

      const [
        timetableResult,
        attendanceResult,
        announcementsResult,
        assessmentsResult,
        enrollmentResult,
      ] = await Promise.all([
        activeYearId
          ? supabase
              .from("timetable_entries")
              .select(`
                id,
                class_id,
                subject_id,
                day_of_week,
                start_time,
                end_time,
                classes ( name ),
                subjects ( name )
              `)
              .eq("school_id", school.id)
              .eq("academic_year_id", activeYearId)
              .eq("teacher_id", teacherRecord.id)
              .order("start_time", { ascending: true })
          : Promise.resolve({ data: [], error: null }),

        classIds.length > 0
          ? supabase
              .from("attendance_records")
              .select("id, student_id, class_id, status")
              .eq("school_id", school.id)
              .eq("attendance_date", getToday())
              .in("class_id", classIds)
          : Promise.resolve({ data: [], error: null }),

        supabase
          .from("announcements")
          .select("id, title, created_at")
          .eq("school_id", school.id)
          .order("created_at", { ascending: false })
          .limit(4),

        activeYearId && classIds.length > 0 && subjectIds.length > 0
          ? supabase
              .from("assessments")
              .select(
                "id, title, assessment_type, assessment_date, max_marks, subject_id, class_id, status",
              )
              .eq("school_id", school.id)
              .eq("academic_year_id", activeYearId)
              .in("class_id", classIds)
              .in("subject_id", subjectIds)
              .order("assessment_date", { ascending: false })
              .limit(6)
          : Promise.resolve({ data: [], error: null }),

        activeYearId && classIds.length > 0
          ? supabase
              .from("enrollments")
              .select("id, student_id, class_id, status")
              .eq("school_id", school.id)
              .eq("academic_year_id", activeYearId)
              .eq("status", "Active")
              .in("class_id", classIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const firstError =
        timetableResult.error ??
        attendanceResult.error ??
        announcementsResult.error ??
        assessmentsResult.error ??
        enrollmentResult.error;

      if (firstError) throw firstError;

      const mappedTimetable: TimetableEntry[] = (timetableResult.data ?? []).map((item: any) => {
        const schoolClass = Array.isArray(item.classes) ? item.classes[0] : item.classes;
        const subject = Array.isArray(item.subjects) ? item.subjects[0] : item.subjects;

        return {
          id: item.id,
          class_id: item.class_id,
          subject_id: item.subject_id,
          day_of_week: item.day_of_week,
          start_time: item.start_time,
          end_time: item.end_time,
          className: schoolClass?.name ?? "Unknown class",
          subjectName: subject?.name ?? "Unknown subject",
        };
      });

      setTimetable(mappedTimetable);
      setAttendance((attendanceResult.data ?? []) as AttendanceRecord[]);
      setAnnouncements((announcementsResult.data ?? []) as Announcement[]);

      const assignmentMap = new Map(
        mappedAssignments.map((assignment) => [
          `${assignment.class_id}:${assignment.subject_id}`,
          assignment,
        ]),
      );

      const mappedAssessments: Assessment[] = (assessmentsResult.data ?? []).map((item: any) => {
        const assignment = assignmentMap.get(`${item.class_id}:${item.subject_id}`);
        return {
          id: item.id,
          title: item.title,
          assessment_type: item.assessment_type,
          assessment_date: item.assessment_date,
          max_marks: Number(item.max_marks ?? 0),
          subject_id: item.subject_id,
          class_id: item.class_id,
          status: item.status,
          className: assignment?.className ?? "Unknown class",
          subjectName: assignment?.subjectName ?? "Unknown subject",
        };
      });

      setAssessments(mappedAssessments);

      const uniqueClassIds = new Set(classIds);
      const uniqueSubjectIds = new Set(subjectIds);
      const uniqueStudentIds = new Set(
        (enrollmentResult.data ?? []).map((enrollment: any) => enrollment.student_id),
      );
      const attendanceRecords = (attendanceResult.data ?? []) as AttendanceRecord[];
      const recordedStudents = new Set(attendanceRecords.map((record) => record.student_id));
      const present = attendanceRecords.filter((record) => record.status === "present").length;

      setStats({
        classes: uniqueClassIds.size,
        subjects: uniqueSubjectIds.size,
        students: uniqueStudentIds.size,
        attendanceRecorded: recordedStudents.size,
        attendanceRate: recordedStudents.size > 0 ? (present / recordedStudents.size) * 100 : 0,
      });
    } catch (err) {
      console.error("Failed to load teacher dashboard:", err);
      setError(err instanceof Error ? err.message : "Unable to load teacher dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, [school?.id]);

  const today = getDayName();

  const todayLessons = useMemo(
    () =>
      timetable
        .filter((entry) => entry.day_of_week.toLowerCase() === today.toLowerCase())
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [timetable, today],
  );

  const upcomingLessons = useMemo(
    () => timetable.filter((entry) => entry.day_of_week.toLowerCase() !== today.toLowerCase()).slice(0, 5),
    [timetable, today],
  );

  const attendanceLabel =
    stats.attendanceRecorded > 0
      ? `${stats.attendanceRecorded} students recorded today`
      : "No attendance recorded yet today";

  const statCards = [
    { label: "My classes", value: loading ? "—" : String(stats.classes), icon: GraduationCap },
    { label: "Subjects", value: loading ? "—" : String(stats.subjects), icon: BookOpen },
    { label: "Students", value: loading ? "—" : String(stats.students), icon: Users },
    {
      label: "Attendance",
      value: loading ? "—" : `${stats.attendanceRate.toFixed(1)}%`,
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px]">
      <PageHeader
        eyebrow="Teacher workspace"
        title={teacher ? `Good morning, ${teacher.first_name}` : "Teacher dashboard"}
        description="Your classes, timetable, attendance and academic work in one place."
        actions={
          <Button type="button" onClick={() => navigate("/attendance")}>
            <ClipboardCheck size={16} />
            Take attendance
          </Button>
        }
      />

      {error && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-3">
        <Card className="min-w-0 p-4 sm:p-6 xl:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">Today's classes</h2>
              <p className="mt-1 text-sm text-slate-500">Your scheduled lessons for {today}.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/timetable")}
              className="inline-flex shrink-0 items-center gap-1 self-start text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              Full timetable
              <ArrowUpRight size={14} />
            </button>
          </div>

          <div className="mt-6 space-y-3">
            {loading ? (
              <div className="flex items-center gap-2 py-5 text-sm text-slate-500">
                <Loader2 size={16} className="animate-spin" />
                Loading today's classes...
              </div>
            ) : todayLessons.length > 0 ? (
              todayLessons.map((lesson) => (
                <div
                  key={lesson.id}
                  className="flex min-w-0 flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <Clock3 size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-sm font-semibold text-slate-900">{lesson.subjectName}</p>
                      <span className="text-xs text-slate-400">•</span>
                      <p className="text-xs font-medium text-slate-500">{lesson.className}</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatTime(lesson.start_time)} – {formatTime(lesson.end_time)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    type="button"
                    onClick={() => navigate("/attendance")}
                  >
                    Attendance
                  </Button>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
                <CalendarDays size={22} className="mx-auto text-slate-300" />
                <p className="mt-2 text-sm font-medium text-slate-700">No classes scheduled today</p>
                <p className="mt-1 text-xs text-slate-400">Your timetable does not contain a lesson for today.</p>
              </div>
            )}
          </div>
        </Card>

        <Card className="min-w-0 p-4 sm:p-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">My teaching assignments</h2>
            <p className="mt-1 text-sm text-slate-500">Classes and subjects assigned to you.</p>
          </div>

          <div className="mt-5 space-y-3">
            {loading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
                <Loader2 size={16} className="animate-spin" />
                Loading assignments...
              </div>
            ) : assignments.length > 0 ? (
              assignments.slice(0, 6).map((assignment) => (
                <div key={assignment.id} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-sm font-medium text-slate-900">{assignment.className}</p>
                  <p className="mt-1 text-xs text-slate-500">{assignment.subjectName}</p>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                No teaching assignments found.
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-2">
        <Card className="min-w-0 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">Attendance today</h2>
              <p className="mt-1 text-sm text-slate-500">Attendance recorded for your assigned classes.</p>
            </div>
            <ClipboardCheck size={20} className="shrink-0 text-indigo-500" />
          </div>

          <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-4xl font-semibold tracking-tight text-slate-900">
                {loading ? "—" : `${stats.attendanceRate.toFixed(1)}%`}
              </div>
              <p className="mt-1 text-sm text-slate-500">{loading ? "Loading..." : attendanceLabel}</p>
            </div>
            <Button size="sm" type="button" onClick={() => navigate("/attendance")}>
              Open attendance
            </Button>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, stats.attendanceRate))}%` }}
            />
          </div>
        </Card>

        <Card className="min-w-0 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">Recent assessments</h2>
              <p className="mt-1 text-sm text-slate-500">Assessments linked to your classes and subjects.</p>
            </div>
            <BookOpen size={20} className="shrink-0 text-indigo-500" />
          </div>

          <div className="mt-5 space-y-3">
            {loading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
                <Loader2 size={16} className="animate-spin" />
                Loading assessments...
              </div>
            ) : assessments.length > 0 ? (
              assessments.slice(0, 4).map((assessment) => (
                <div key={assessment.id} className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <BookOpen size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{assessment.title}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {assessment.subjectName} • {assessment.className}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] font-medium text-slate-400">
                    {formatDate(assessment.assessment_date)}
                  </span>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                No assessments found for your current assignments.
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => navigate("/assessments")}
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            Open assessments
            <ArrowUpRight size={14} />
          </button>
        </Card>
      </div>

      <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-3">
        <Card className="min-w-0 p-4 sm:p-6 xl:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">Upcoming timetable</h2>
              <p className="mt-1 text-sm text-slate-500">Other lessons from your current timetable.</p>
            </div>
            <CalendarDays size={20} className="shrink-0 text-indigo-500" />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {upcomingLessons.length > 0 ? (
              upcomingLessons.map((lesson) => (
                <div key={lesson.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold text-indigo-600">{lesson.day_of_week}</p>
                    <p className="text-[11px] text-slate-400">
                      {formatTime(lesson.start_time)} – {formatTime(lesson.end_time)}
                    </p>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-900">{lesson.subjectName}</p>
                  <p className="mt-1 text-xs text-slate-500">{lesson.className}</p>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500 sm:col-span-2">
                No additional lessons found.
              </div>
            )}
          </div>
        </Card>

        <Card className="min-w-0 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">School announcements</h2>
              <p className="mt-1 text-sm text-slate-500">Latest messages from the school.</p>
            </div>
            <Megaphone size={20} className="shrink-0 text-indigo-500" />
          </div>

          <div className="mt-5 space-y-4">
            {announcements.length > 0 ? (
              announcements.map((announcement) => (
                <div key={announcement.id} className="min-w-0 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                  <p className="break-words text-sm font-medium text-slate-900">
                    {announcement.title || "School announcement"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{formatRelativeTime(announcement.created_at)}</p>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                No announcements yet.
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => navigate("/announcements")}
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            View announcements
            <ArrowUpRight size={14} />
          </button>
        </Card>
      </div>

      <Card className="mt-6 min-w-0 p-4 sm:p-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Quick actions</h2>
          <p className="mt-1 text-sm text-slate-500">Common tasks for your teaching workflow.</p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <Button type="button" size="sm" onClick={() => navigate("/attendance")}>
            <ClipboardCheck size={15} />
            Take attendance
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => navigate("/assessments")}>
            <BookOpen size={15} />
            Manage assessments
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => navigate("/student-results")}>
            <GraduationCap size={15} />
            Student results
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={() => navigate("/timetable")}>
            <CalendarDays size={15} />
            View timetable
          </Button>
        </div>
      </Card>
    </div>
  );
}
