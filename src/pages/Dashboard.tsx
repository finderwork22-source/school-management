import { useEffect, useMemo, useState } from "react";
import {
  Users,
  GraduationCap,
  School,
  UserCheck,
  Plus,
  Megaphone,
  Wallet,
  ClipboardCheck,
  ArrowUpRight,
  Loader2,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  UserPlus,
  TrendingUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";
import { supabase } from "../lib/supabase";
import { useSchool } from "../context/SchoolContext";
import { normalizeRole } from "../lib/permissions";
import TeacherDashboard from "./TeacherDashboard";
import PrincipalDashboard from "./PrincipalDashboard";
import SecretaryDashboard from "./SecretaryDashboard";

interface DashboardStats {
  students: number;
  teachers: number;
  classes: number;
  subjects: number;
  attendanceRate: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceRecorded: number;
  assessments: number;
  draftAssessments: number;
  assignedTeachers: number;
  coveredClasses: number;
  enrolledStudents: number;
}

interface ActivityItem {
  title: string;
  description: string;
  time: string;
  createdAt: string;
}

const initialStats: DashboardStats = {
  students: 0,
  teachers: 0,
  classes: 0,
  subjects: 0,
  attendanceRate: 0,
  present: 0,
  absent: 0,
  late: 0,
  excused: 0,
  attendanceRecorded: 0,
  assessments: 0,
  draftAssessments: 0,
  assignedTeachers: 0,
  coveredClasses: 0,
  enrolledStudents: 0,
};

function getToday() {
  const date = new Date();

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatRelativeTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) {
    return `${diffMinutes} min${diffMinutes === 1 ? "" : "s"} ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours} hr${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);

  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

interface AssessmentItem {
  id: string;
  title: string;
  assessmentType: string;
  assessmentDate: string;
  maxMarks: number;
  status: string;
  className: string;
  subjectName: string;
}

interface AnnouncementItem {
  id: string;
  title: string;
  createdAt: string;
}

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getFirstNameFromUser(user: {
  user_metadata?: Record<string, unknown>;
  email?: string | null;
}) {
  const firstName = user.user_metadata?.first_name;

  if (typeof firstName === "string" && firstName.trim()) {
    return firstName.trim();
  }

  const fullName = user.user_metadata?.full_name;

  if (typeof fullName === "string" && fullName.trim()) {
    return fullName.trim().split(/\s+/)[0];
  }

  const email = user.email?.trim();

  if (email) {
    return email.split("@")[0] || "there";
  }

  return "there";
}

function mapJoinedName(value: unknown, fallback: string) {
  const joined = Array.isArray(value) ? value[0] : value;

  if (joined && typeof joined === "object") {
    const name = (joined as { name?: unknown }).name;

    if (typeof name === "string" && name.trim()) {
      return name.trim();
    }
  }

  return fallback;
}

function AdminDashboard() {
  const navigate = useNavigate();
  const { school } = useSchool();

  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    if (!school?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const today = getToday();

    try {
      const [
        studentsResult,
        teachersResult,
        classesResult,
        attendanceResult,
        recentStudentsResult,
        recentPaymentsResult,
        recentAnnouncementsResult,
      ] = await Promise.all([
        supabase
          .from("students")
          .select("id", { count: "exact", head: true })
          .eq("school_id", school.id),

        supabase
          .from("teachers")
          .select("id", { count: "exact", head: true })
          .eq("school_id", school.id),

        supabase
          .from("classes")
          .select("id", { count: "exact", head: true })
          .eq("school_id", school.id)
          .eq("is_active", true),

        supabase
          .from("attendance_records")
          .select("id, student_id, status, created_at")
          .eq("school_id", school.id)
          .eq("attendance_date", today),

        supabase
          .from("students")
          .select("id, name, student_id, created_at")
          .eq("school_id", school.id)
          .order("created_at", { ascending: false })
          .limit(3),

        supabase
          .from("payments")
          .select("id, amount, created_at, student_id")
          .eq("school_id", school.id)
          .order("created_at", { ascending: false })
          .limit(3),

        supabase
          .from("announcements")
          .select("id, title, created_at")
          .eq("school_id", school.id)
          .order("created_at", { ascending: false })
          .limit(3),
      ]);

      const firstError =
        studentsResult.error ??
        teachersResult.error ??
        classesResult.error ??
        attendanceResult.error;

      if (firstError) {
        throw firstError;
      }

      const attendanceRecords = attendanceResult.data ?? [];

      const present = attendanceRecords.filter(
        (record) => record.status === "present",
      ).length;

      const absent = attendanceRecords.filter(
        (record) => record.status === "absent",
      ).length;

      const late = attendanceRecords.filter(
        (record) => record.status === "late",
      ).length;

      const excused = attendanceRecords.filter(
        (record) => record.status === "excused",
      ).length;

      const totalStudents = studentsResult.count ?? 0;
      const recordedStudents = new Set(
        attendanceRecords.map((record) => record.student_id),
      ).size;

      const attendanceRate =
        recordedStudents > 0
          ? (present / recordedStudents) * 100
          : 0;

      setStats({
        students: totalStudents,
        teachers: teachersResult.count ?? 0,
        classes: classesResult.count ?? 0,
        subjects: 0,
        attendanceRate,
        present,
        absent,
        late,
        excused,
        attendanceRecorded: recordedStudents,
        assessments: 0,
        draftAssessments: 0,
        assignedTeachers: 0,
        coveredClasses: 0,
        enrolledStudents: totalStudents,
      });

      const nextActivities: ActivityItem[] = [];

      if (!recentStudentsResult.error) {
        for (const student of recentStudentsResult.data ?? []) {
          nextActivities.push({
            title: "New student enrolled",
            description:
              student.name ||
              student.student_id ||
              "New student record",
            time: formatRelativeTime(student.created_at),
            createdAt: student.created_at,
          });
        }
      }

      if (!recentPaymentsResult.error) {
        for (const payment of recentPaymentsResult.data ?? []) {
          nextActivities.push({
            title: "Payment recorded",
            description: `${Number(payment.amount ?? 0).toLocaleString()} RWF`,
            time: formatRelativeTime(payment.created_at),
            createdAt: payment.created_at,
          });
        }
      }

      if (!recentAnnouncementsResult.error) {
        for (const announcement of recentAnnouncementsResult.data ?? []) {
          nextActivities.push({
            title: "New announcement",
            description: announcement.title || "School announcement",
            time: formatRelativeTime(announcement.created_at),
            createdAt: announcement.created_at,
          });
        }
      }

      nextActivities.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime(),
      );

      setActivities(nextActivities.slice(0, 4));
    } catch (err) {
      console.error("Failed to load dashboard:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load dashboard data.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, [school?.id]);

  const attendanceLabel = useMemo(() => {
    if (stats.attendanceRecorded === 0) {
      return "No attendance recorded yet today.";
    }

    return `${stats.present} of ${stats.attendanceRecorded} recorded students present`;
  }, [stats]);

  const statCards = [
    {
      label: "Students",
      value: loading ? "—" : String(stats.students),
      icon: Users,
    },
    {
      label: "Teachers",
      value: loading ? "—" : String(stats.teachers),
      icon: GraduationCap,
    },
    {
      label: "Classes",
      value: loading ? "—" : String(stats.classes),
      icon: School,
    },
    {
      label: "Attendance",
      value: loading ? "—" : formatPercent(stats.attendanceRate),
      icon: UserCheck,
    },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px]">
      <PageHeader
        eyebrow="Overview"
        title="Good morning, Admin"
        description="Here's what's happening at your school today."
        actions={
          <Button
            type="button"
            onClick={() => navigate("/students")}
          >
            <Plus size={16} />
            Add student
          </Button>
        }
      />

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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
              <h2 className="text-sm font-semibold text-slate-900">
                Attendance overview
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Today's attendance across the school.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/attendance")}
              className="inline-flex shrink-0 items-center gap-1 self-start text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              View details
              <ArrowUpRight size={14} />
            </button>
          </div>

          <div className="mt-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <div className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
                  {loading
                    ? "—"
                    : formatPercent(stats.attendanceRate)}
                </div>

                <div className="mt-1 text-sm text-slate-500">
                  {loading
                    ? "Loading today's attendance..."
                    : attendanceLabel}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-slate-500 sm:block sm:space-y-1 sm:text-right">
                <div>
                  Present{" "}
                  <strong className="text-slate-900">
                    {loading ? "—" : stats.present}
                  </strong>
                </div>

                <div>
                  Absent{" "}
                  <strong className="text-slate-900">
                    {loading ? "—" : stats.absent}
                  </strong>
                </div>

                <div>
                  Late{" "}
                  <strong className="text-slate-900">
                    {loading ? "—" : stats.late}
                  </strong>
                </div>

                <div>
                  Excused{" "}
                  <strong className="text-slate-900">
                    {loading ? "—" : stats.excused}
                  </strong>
                </div>
              </div>
            </div>

            <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(0, stats.attendanceRate),
                  )}%`,
                }}
              />
            </div>
          </div>
        </Card>

        <Card className="min-w-0 p-4 sm:p-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Recent activity
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Latest updates from your school.
            </p>
          </div>

          <div className="mt-6">
            {loading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
                <Loader2 size={16} className="animate-spin" />
                Loading activity...
              </div>
            ) : activities.length > 0 ? (
              <div className="space-y-5">
                {activities.map((activity, index) => (
                  <div
                    key={`${activity.title}-${activity.createdAt}-${index}`}
                    className="flex min-w-0 gap-3"
                  >
                    <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-600" />

                    <div className="min-w-0">
                      <div className="break-words text-sm font-medium text-slate-900">
                        {activity.title}
                      </div>

                      <div className="mt-0.5 break-words text-xs text-slate-500">
                        {activity.description}
                      </div>

                      <div className="mt-1 text-[11px] text-slate-400">
                        {activity.time}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                No recent activity yet.
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-6 min-w-0 p-4 sm:p-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Quick actions
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Common tasks for school administration.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          <Button
            size="sm"
            type="button"
            onClick={() => navigate("/students")}
          >
            <Plus size={15} />
            Add student
          </Button>

          <Button
            size="sm"
            variant="secondary"
            type="button"
            onClick={() => navigate("/announcements")}
          >
            <Megaphone size={15} />
            Create announcement
          </Button>

          <Button
            size="sm"
            variant="secondary"
            type="button"
            onClick={() => navigate("/finance/payments")}
          >
            <Wallet size={15} />
            View payments
          </Button>

          <Button
            size="sm"
            variant="secondary"
            type="button"
            onClick={() => navigate("/attendance")}
          >
            <ClipboardCheck size={15} />
            Attendance
          </Button>
        </div>
      </Card>
    </div>
  );
}



interface CEOFeeSummary {
  billed: number;
  collected: number;
  outstanding: number;
  collectionRate: number;
  invoiceCount: number;
}

interface CEOAdmissionSummary {
  total: number;
  pending: number;
  underReview: number;
  accepted: number;
  enrolled: number;
}

interface CEOActivityItem {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  time: string;
}

interface CEOAnnouncementItem {
  id: string;
  title: string;
  createdAt: string;
}

interface CEOAttendanceTrendPoint {
  label: string;
  rate: number;
  present: number;
}

interface CEOFeeTrendPoint {
  label: string;
  collected: number;
}

interface CEOAdmissionTrendPoint {
  label: string;
  applications: number;
  accepted: number;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-RW", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getCEOAdmissionName(application: {
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
}) {
  return [
    application.first_name,
    application.middle_name,
    application.last_name,
  ]
    .filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    )
    .join(" ");
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonth(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1);
}

function monthLabel(date: Date) {
  return date.toLocaleDateString("en-GB", {
    month: "short",
  });
}

function shortDayLabel(date: Date) {
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
  }).slice(0, 3);
}

function buildAttendanceTrend(
  records: Array<{
    attendance_date: string;
    student_id: string;
    status: string;
  }>,
) {
  const today = new Date();
  const points: CEOAttendanceTrendPoint[] = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - offset,
    );
    const key = formatDateKey(date);
    const dayRecords = records.filter(
      (record) => record.attendance_date === key,
    );
    const studentIds = new Set(dayRecords.map((record) => record.student_id));
    const present = dayRecords.filter((record) => record.status === "present").length;

    points.push({
      label: shortDayLabel(date),
      rate: studentIds.size > 0 ? (present / studentIds.size) * 100 : 0,
      present,
    });
  }

  return points;
}

function buildFeeTrend(
  payments: Array<{ payment_date: string; amount: number | string | null }>,
) {
  const currentMonth = startOfMonth(new Date());
  const points: CEOFeeTrendPoint[] = [];

  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = shiftMonth(currentMonth, -offset);
    const year = date.getFullYear();
    const month = date.getMonth();

    const collected = payments.reduce((sum, payment) => {
      const paymentDate = new Date(`${payment.payment_date.slice(0, 10)}T00:00:00`);

      if (
        paymentDate.getFullYear() === year &&
        paymentDate.getMonth() === month
      ) {
        return sum + Number(payment.amount ?? 0);
      }

      return sum;
    }, 0);

    points.push({
      label: monthLabel(date),
      collected,
    });
  }

  return points;
}

function buildAdmissionTrend(
  applications: Array<{ application_date: string; status: string }>,
) {
  const currentMonth = startOfMonth(new Date());
  const points: CEOAdmissionTrendPoint[] = [];

  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = shiftMonth(currentMonth, -offset);
    const year = date.getFullYear();
    const month = date.getMonth();

    const monthApplications = applications.filter((application) => {
      const applicationDate = new Date(
        `${application.application_date.slice(0, 10)}T00:00:00`,
      );

      return (
        applicationDate.getFullYear() === year &&
        applicationDate.getMonth() === month
      );
    });

    points.push({
      label: monthLabel(date),
      applications: monthApplications.length,
      accepted: monthApplications.filter(
        (application) =>
          application.status === "Accepted" || application.status === "Enrolled",
      ).length,
    });
  }

  return points;
}

function CEOSummaryCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="min-w-0 p-5">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {label}
          </p>
          <p className="mt-2 break-words text-2xl font-semibold tracking-tight text-slate-900">
            {value}
          </p>
          <p className="mt-1 break-words text-xs leading-5 text-slate-500">
            {helper}
          </p>
        </div>

        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-wiser-50 text-wiser-600">
          {icon}
        </div>
      </div>
    </Card>
  );
}

function CEOProgressRow({
  label,
  value,
  percent,
  description,
}: {
  label: string;
  value: string;
  percent: number;
  description?: string;
}) {
  const safePercent = Math.min(100, Math.max(0, percent));

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-700">{label}</p>
          {description && (
            <p className="mt-0.5 text-xs text-slate-400">{description}</p>
          )}
        </div>

        <span className="shrink-0 text-sm font-semibold text-slate-900">
          {value}
        </span>
      </div>

      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-wiser-600 transition-all duration-500"
          style={{ width: `${safePercent}%` }}
        />
      </div>
    </div>
  );
}

function CEOQuickAccessCard({
  title,
  description,
  icon,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-wiser-200 hover:bg-wiser-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wiser-500 focus-visible:ring-offset-2"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-wiser-50 text-wiser-600">
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <h3 className="break-words text-sm font-semibold text-slate-900">
            {title}
          </h3>
          <ArrowUpRight
            size={14}
            className="mt-0.5 shrink-0 text-slate-400 transition group-hover:text-wiser-600"
          />
        </div>

        <p className="mt-1 break-words text-xs leading-5 text-slate-500">
          {description}
        </p>
      </div>
    </button>
  );
}

function CEODashboard() {
  const navigate = useNavigate();
  const { school } = useSchool();

  const [firstName, setFirstName] = useState("CEO");
  const [academicYearName, setAcademicYearName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [students, setStudents] = useState(0);
  const [teachers, setTeachers] = useState(0);
  const [classes, setClasses] = useState(0);
  const [attendance, setAttendance] = useState({
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    recorded: 0,
    rate: 0,
  });

  const [fees, setFees] = useState<CEOFeeSummary>({
    billed: 0,
    collected: 0,
    outstanding: 0,
    collectionRate: 0,
    invoiceCount: 0,
  });

  const [admissions, setAdmissions] = useState<CEOAdmissionSummary>({
    total: 0,
    pending: 0,
    underReview: 0,
    accepted: 0,
    enrolled: 0,
  });

  const [activities, setActivities] = useState<CEOActivityItem[]>([]);
  const [announcements, setAnnouncements] = useState<CEOAnnouncementItem[]>(
    [],
  );
  const [attendanceTrend, setAttendanceTrend] = useState<CEOAttendanceTrendPoint[]>(
    [],
  );
  const [feeTrend, setFeeTrend] = useState<CEOFeeTrendPoint[]>([]);
  const [admissionTrend, setAdmissionTrend] =
    useState<CEOAdmissionTrendPoint[]>([]);

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

      if (userError) {
        throw userError;
      }

      if (user) {
        setFirstName(getFirstNameFromUser(user));
      }

      const [
        academicYearsResult,
        studentsResult,
        teachersResult,
        classesResult,
        attendanceResult,
        invoicesResult,
        admissionsResult,
        recentStudentsResult,
        recentPaymentsResult,
        recentAnnouncementsResult,
        attendanceTrendResult,
        feeTrendResult,
        admissionTrendResult,
      ] = await Promise.all([
        supabase
          .from("academic_years")
          .select("id, name, start_date, end_date, is_active, is_current")
          .eq("school_id", school.id)
          .order("start_date", { ascending: false }),

        supabase
          .from("students")
          .select("id", { count: "exact", head: true })
          .eq("school_id", school.id),

        supabase
          .from("teachers")
          .select("id", { count: "exact", head: true })
          .eq("school_id", school.id),

        supabase
          .from("classes")
          .select("id", { count: "exact", head: true })
          .eq("school_id", school.id)
          .eq("is_active", true),

        supabase
          .from("attendance_records")
          .select("id, student_id, status")
          .eq("school_id", school.id)
          .eq("attendance_date", getToday()),

        supabase
          .from("student_invoices")
          .select(
            "id, academic_year_id, total_amount, amount_paid, balance, status, issue_date",
          )
          .eq("school_id", school.id),

        supabase
          .from("admission_applications")
          .select(
            "id, academic_year_id, first_name, middle_name, last_name, status, created_at",
          )
          .eq("school_id", school.id)
          .order("created_at", { ascending: false }),

        supabase
          .from("students")
          .select("id, name, student_id, created_at")
          .eq("school_id", school.id)
          .order("created_at", { ascending: false })
          .limit(3),

        supabase
          .from("student_payments")
          .select(
            "id, amount, payment_date, created_at, student_id",
          )
          .eq("school_id", school.id)
          .order("created_at", { ascending: false })
          .limit(3),

        supabase
          .from("announcements")
          .select("id, title, created_at")
          .eq("school_id", school.id)
          .order("created_at", { ascending: false })
          .limit(4),

        supabase
          .from("attendance_records")
          .select("attendance_date, student_id, status")
          .eq("school_id", school.id)
          .gte(
            "attendance_date",
            formatDateKey(
              new Date(
                new Date().getFullYear(),
                new Date().getMonth(),
                new Date().getDate() - 6,
              ),
            ),
          )
          .lte("attendance_date", getToday()),

        supabase
          .from("student_payments")
          .select("payment_date, amount")
          .eq("school_id", school.id)
          .gte(
            "payment_date",
            formatDateKey(
              new Date(
                new Date().getFullYear(),
                new Date().getMonth() - 5,
                1,
              ),
            ),
          )
          .lte("payment_date", getToday()),

        supabase
          .from("admission_applications")
          .select("application_date, status")
          .eq("school_id", school.id)
          .gte(
            "application_date",
            formatDateKey(
              new Date(
                new Date().getFullYear(),
                new Date().getMonth() - 5,
                1,
              ),
            ),
          )
          .lte("application_date", getToday()),
      ]);

      const firstError =
        academicYearsResult.error ??
        studentsResult.error ??
        teachersResult.error ??
        classesResult.error ??
        attendanceResult.error ??
        invoicesResult.error ??
        admissionsResult.error ??
        attendanceTrendResult.error ??
        feeTrendResult.error ??
        admissionTrendResult.error;

      if (firstError) {
        throw firstError;
      }

      const academicYears = academicYearsResult.data ?? [];
      const currentYear =
        academicYears.find((year) => year.is_current) ??
        academicYears.find((year) => year.is_active) ??
        academicYears[0] ??
        null;

      setAcademicYearName(currentYear?.name ?? "");

      const totalStudents = studentsResult.count ?? 0;
      const totalTeachers = teachersResult.count ?? 0;
      const totalClasses = classesResult.count ?? 0;

      setStudents(totalStudents);
      setTeachers(totalTeachers);
      setClasses(totalClasses);

      const attendanceRecords = attendanceResult.data ?? [];
      const present = attendanceRecords.filter(
        (record) => record.status === "present",
      ).length;
      const absent = attendanceRecords.filter(
        (record) => record.status === "absent",
      ).length;
      const late = attendanceRecords.filter(
        (record) => record.status === "late",
      ).length;
      const excused = attendanceRecords.filter(
        (record) => record.status === "excused",
      ).length;

      const recordedStudentIds = new Set(
        attendanceRecords.map((record) => record.student_id),
      );

      setAttendance({
        present,
        absent,
        late,
        excused,
        recorded: recordedStudentIds.size,
        rate:
          recordedStudentIds.size > 0
            ? (present / recordedStudentIds.size) * 100
            : 0,
      });

      const currentYearInvoices = (invoicesResult.data ?? []).filter(
        (invoice) =>
          currentYear
            ? invoice.academic_year_id === currentYear.id
            : true,
      );

      const billableInvoices = currentYearInvoices.filter(
        (invoice) => invoice.status !== "Cancelled",
      );

      const billed = billableInvoices.reduce(
        (sum, invoice) => sum + Number(invoice.total_amount ?? 0),
        0,
      );
      const collected = billableInvoices.reduce(
        (sum, invoice) => sum + Number(invoice.amount_paid ?? 0),
        0,
      );
      const outstanding = billableInvoices.reduce(
        (sum, invoice) => sum + Number(invoice.balance ?? 0),
        0,
      );

      setFees({
        billed,
        collected,
        outstanding,
        collectionRate: billed > 0 ? (collected / billed) * 100 : 0,
        invoiceCount: billableInvoices.length,
      });

      const currentYearAdmissions = (admissionsResult.data ?? []).filter(
        (application) =>
          currentYear
            ? application.academic_year_id === currentYear.id
            : true,
      );

      setAdmissions({
        total: currentYearAdmissions.length,
        pending: currentYearAdmissions.filter(
          (application) => application.status === "Pending",
        ).length,
        underReview: currentYearAdmissions.filter(
          (application) => application.status === "Under Review",
        ).length,
        accepted: currentYearAdmissions.filter(
          (application) => application.status === "Accepted",
        ).length,
        enrolled: currentYearAdmissions.filter(
          (application) => application.status === "Enrolled",
        ).length,
      });

      setAttendanceTrend(
        buildAttendanceTrend(
          (attendanceTrendResult.data ?? []) as Array<{
            attendance_date: string;
            student_id: string;
            status: string;
          }>,
        ),
      );

      setFeeTrend(
        buildFeeTrend(
          (feeTrendResult.data ?? []) as Array<{
            payment_date: string;
            amount: number | string | null;
          }>,
        ),
      );

      setAdmissionTrend(
        buildAdmissionTrend(
          (admissionTrendResult.data ?? []) as Array<{
            application_date: string;
            status: string;
          }>,
        ),
      );

      const nextActivities: CEOActivityItem[] = [];

      for (const student of recentStudentsResult.data ?? []) {
        nextActivities.push({
          id: `student-${student.id}`,
          title: "New student enrolled",
          description:
            student.name ||
            student.student_id ||
            "New student record",
          createdAt: student.created_at,
          time: formatRelativeTime(student.created_at),
        });
      }

      for (const payment of recentPaymentsResult.data ?? []) {
        nextActivities.push({
          id: `payment-${payment.id}`,
          title: "Payment recorded",
          description: `${formatMoney(Number(payment.amount ?? 0))} RWF`,
          createdAt: payment.created_at,
          time: formatRelativeTime(payment.created_at),
        });
      }

      for (const application of currentYearAdmissions.slice(0, 3)) {
        nextActivities.push({
          id: `admission-${application.id}`,
          title: "Admission application",
          description: `${getCEOAdmissionName(application)} • ${application.status}`,
          createdAt: application.created_at,
          time: formatRelativeTime(application.created_at),
        });
      }

      nextActivities.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime(),
      );

      setActivities(nextActivities.slice(0, 6));

      setAnnouncements(
        (recentAnnouncementsResult.data ?? []).map((announcement) => ({
          id: announcement.id,
          title: announcement.title || "School announcement",
          createdAt: announcement.created_at,
        })),
      );
    } catch (err) {
      console.error("Failed to load CEO dashboard:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load CEO dashboard data.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, [school?.id]);

  const attendanceTotal = attendance.present +
    attendance.absent +
    attendance.late +
    attendance.excused;

  const attendanceBreakdown = [
    {
      label: "Present",
      value: attendance.present,
      percent:
        attendanceTotal > 0
          ? (attendance.present / attendanceTotal) * 100
          : 0,
      description: "Students marked present today.",
    },
    {
      label: "Absent",
      value: attendance.absent,
      percent:
        attendanceTotal > 0
          ? (attendance.absent / attendanceTotal) * 100
          : 0,
      description: "Students marked absent today.",
    },
    {
      label: "Late",
      value: attendance.late,
      percent:
        attendanceTotal > 0
          ? (attendance.late / attendanceTotal) * 100
          : 0,
      description: "Students marked late today.",
    },
  ];

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px]">
      <PageHeader
        eyebrow="Executive overview"
        title={`Good morning, ${firstName}`}
        description={
          academicYearName
            ? `School-wide performance overview for ${academicYearName}.`
            : "School-wide performance overview for your school."
        }
        actions={
          <Button
            type="button"
            onClick={() => navigate("/students")}
          >
            <Users size={16} />
            View students
          </Button>
        }
      />

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CEOSummaryCard
          label="Students"
          value={loading ? "—" : String(students)}
          helper="All student records in this school."
          icon={<Users size={18} />}
        />

        <CEOSummaryCard
          label="Teachers"
          value={loading ? "—" : String(teachers)}
          helper="All teacher records in this school."
          icon={<GraduationCap size={18} />}
        />

        <CEOSummaryCard
          label="Active classes"
          value={loading ? "—" : String(classes)}
          helper="Currently active class records."
          icon={<School size={18} />}
        />

        <CEOSummaryCard
          label="Fee collection"
          value={
            loading
              ? "—"
              : formatPercent(fees.collectionRate)
          }
          helper={
            fees.invoiceCount > 0
              ? `${fees.invoiceCount} current-year invoices`
              : "No current-year invoices yet."
          }
          icon={<TrendingUp size={18} />}
        />
      </div>

      <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-3">
        <Card className="min-w-0 p-4 sm:p-6 xl:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">
                Attendance overview
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Today's attendance across the school.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/attendance")}
              className="inline-flex shrink-0 items-center gap-1 self-start text-sm font-medium text-wiser-600 hover:text-wiser-700"
            >
              View details
              <ArrowUpRight size={14} />
            </button>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_1fr]">
            <div className="min-w-0">
              <div className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
                {loading
                  ? "—"
                  : formatPercent(attendance.rate)}
              </div>

              <p className="mt-1 text-sm text-slate-500">
                {loading
                  ? "Loading today's attendance..."
                  : attendance.recorded > 0
                    ? `${attendance.present} of ${attendance.recorded} recorded students present`
                    : "No attendance recorded yet today."}
              </p>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Present</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {loading ? "—" : attendance.present}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Absent</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {loading ? "—" : attendance.absent}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Late</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {loading ? "—" : attendance.late}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Excused</p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {loading ? "—" : attendance.excused}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              {(loading
                ? attendanceBreakdown.map((item) => ({
                    ...item,
                    value: 0,
                    percent: 0,
                  }))
                : attendanceBreakdown
              ).map((item) => (
                <CEOProgressRow
                  key={item.label}
                  label={item.label}
                  value={loading ? "—" : String(item.value)}
                  percent={loading ? 0 : item.percent}
                  description={item.description}
                />
              ))}
            </div>
          </div>
        </Card>

        <Card className="min-w-0 p-4 sm:p-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Fee overview
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Current academic-year billing position.
            </p>
          </div>

          <div className="mt-6 space-y-5">
            <CEOProgressRow
              label="Collected"
              value={
                loading
                  ? "—"
                  : `${formatMoney(fees.collected)} RWF`
              }
              percent={loading ? 0 : fees.collectionRate}
              description="Payments credited against current-year invoices."
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Billed</p>
                <p className="mt-1 break-words text-sm font-semibold text-slate-900">
                  {loading
                    ? "—"
                    : `${formatMoney(fees.billed)} RWF`}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs text-slate-500">Outstanding</p>
                <p className="mt-1 break-words text-sm font-semibold text-slate-900">
                  {loading
                    ? "—"
                    : `${formatMoney(fees.outstanding)} RWF`}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate("/finance/payments")}
              className="inline-flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:border-wiser-200 hover:bg-wiser-50 hover:text-wiser-700"
            >
              <span className="inline-flex items-center gap-2">
                <CreditCard size={16} className="text-wiser-600" />
                Open finance
              </span>
              <ArrowUpRight size={14} className="text-slate-400" />
            </button>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-2">
        <CEOAttendanceTrendChart
          loading={loading}
          data={attendanceTrend}
          onViewDetails={() => navigate("/attendance")}
        />

        <CEOFeeTrendChart
          loading={loading}
          data={feeTrend}
          onViewDetails={() => navigate("/finance/payments")}
        />
      </div>

      <div className="mt-6">
        <CEOAdmissionsTrendChart
          loading={loading}
          data={admissionTrend}
          onViewDetails={() => navigate("/admissions")}
        />
      </div>

      <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-3">
        <Card className="min-w-0 p-4 sm:p-6 xl:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Admissions overview
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Current academic-year application pipeline.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/admissions")}
              className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-wiser-600 hover:text-wiser-700"
            >
              Open admissions
              <ArrowUpRight size={14} />
            </button>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              ["Applications", admissions.total],
              ["Pending", admissions.pending],
              ["Review", admissions.underReview],
              ["Accepted", admissions.accepted],
              ["Enrolled", admissions.enrolled],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="rounded-xl border border-slate-200 p-3"
              >
                <p className="text-xs text-slate-500">{label}</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">
                  {loading ? "—" : String(value)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <CEOProgressRow
              label="Accepted"
              value={loading ? "—" : String(admissions.accepted)}
              percent={
                loading || admissions.total === 0
                  ? 0
                  : (admissions.accepted / admissions.total) * 100
              }
              description="Applications with an accepted decision."
            />

            <CEOProgressRow
              label="Enrolled"
              value={loading ? "—" : String(admissions.enrolled)}
              percent={
                loading || admissions.total === 0
                  ? 0
                  : (admissions.enrolled / admissions.total) * 100
              }
              description="Applications converted to enrolled students."
            />
          </div>
        </Card>

        <Card className="min-w-0 p-4 sm:p-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Recent activity
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Latest school-wide operational updates.
            </p>
          </div>

          <div className="mt-6">
            {loading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
                <Loader2 size={16} className="animate-spin" />
                Loading activity...
              </div>
            ) : activities.length > 0 ? (
              <div className="space-y-4">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex min-w-0 gap-3"
                  >
                    <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-wiser-600" />

                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium text-slate-900">
                        {activity.title}
                      </p>
                      <p className="mt-0.5 break-words text-xs text-slate-500">
                        {activity.description}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {activity.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                No recent activity yet.
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-2">
        <Card className="min-w-0 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Announcements
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Latest notices published by the school.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/announcements")}
              className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-wiser-600 hover:text-wiser-700"
            >
              View all
              <ArrowUpRight size={14} />
            </button>
          </div>

          <div className="mt-6">
            {loading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
                <Loader2 size={16} className="animate-spin" />
                Loading announcements...
              </div>
            ) : announcements.length > 0 ? (
              <div className="space-y-3">
                {announcements.map((announcement) => (
                  <button
                    key={announcement.id}
                    type="button"
                    onClick={() => navigate("/announcements")}
                    className="flex w-full min-w-0 items-start gap-3 rounded-xl border border-slate-100 p-3 text-left transition hover:border-wiser-200 hover:bg-wiser-50/40"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-wiser-50 text-wiser-600">
                      <Megaphone size={16} />
                    </div>

                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium text-slate-900">
                        {announcement.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {formatRelativeTime(announcement.createdAt)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                No announcements yet.
              </div>
            )}
          </div>
        </Card>

        <Card className="min-w-0 p-4 sm:p-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Quick access
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Jump directly to major areas of school operations.
            </p>
          </div>

          <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2">
            <CEOQuickAccessCard
              title="Students"
              description="Review enrollment and student records."
              icon={<Users size={17} />}
              onClick={() => navigate("/students")}
            />

            <CEOQuickAccessCard
              title="Teachers"
              description="Review teaching staff and assignments."
              icon={<GraduationCap size={17} />}
              onClick={() => navigate("/teachers")}
            />

            <CEOQuickAccessCard
              title="Admissions"
              description="Review the current application pipeline."
              icon={<UserPlus size={17} />}
              onClick={() => navigate("/admissions")}
            />

            <CEOQuickAccessCard
              title="Finance"
              description="Review invoices, payments and balances."
              icon={<CreditCard size={17} />}
              onClick={() => navigate("/finance/payments")}
            />

            <CEOQuickAccessCard
              title="Academics"
              description="Manage classes, subjects and academic years."
              icon={<BookOpen size={17} />}
              onClick={() => navigate("/academics")}
            />

            <CEOQuickAccessCard
              title="Users & roles"
              description="Manage staff access and permissions."
              icon={<CheckCircle2 size={17} />}
              onClick={() => navigate("/settings/users")}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

function CEOChartHeader({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      <button
        type="button"
        onClick={onAction}
        className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-wiser-600 hover:text-wiser-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wiser-500 focus-visible:ring-offset-2"
      >
        {actionLabel}
        <ArrowUpRight size={14} />
      </button>
    </div>
  );
}

function CEOLineChart({
  data,
  valueKey,
  formatValue,
  height = 210,
}: {
  data: Array<{ label: string; rate?: number; present?: number }>;
  valueKey: "rate" | "present";
  formatValue: (value: number) => string;
  height?: number;
}) {
  const width = 640;
  const padding = { top: 16, right: 18, bottom: 32, left: 42 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const values = data.map((item) => Number(item[valueKey] ?? 0));
  const maxValue = Math.max(100, ...values, 1);
  const stepX = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth;

  const points = data.map((item, index) => {
    const value = Number(item[valueKey] ?? 0);
    const x = padding.left + stepX * index;
    const y = padding.top + chartHeight - (value / maxValue) * chartHeight;
    return { ...item, x, y, value };
  });

  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs text-slate-400">
        <span>{formatValue(maxValue)}</span>
        <span>Trend</span>
      </div>

      <div className="overflow-hidden rounded-xl bg-slate-50/70 p-2">
        <div className="aspect-[16/7] w-full min-w-[500px] sm:min-w-0">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-full w-full"
            preserveAspectRatio="none"
            role="img"
            aria-label="Attendance trend chart"
          >
            {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
              const y = padding.top + chartHeight * fraction;
              return (
                <line
                  key={fraction}
                  x1={padding.left}
                  x2={width - padding.right}
                  y1={y}
                  y2={y}
                  stroke="currentColor"
                  className="text-slate-200"
                  strokeWidth="1"
                />
              );
            })}

            <polyline
              fill="none"
              stroke="currentColor"
              className="text-wiser-600"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={polyline}
            />

            {points.map((point) => (
              <g key={point.label + point.x}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="4"
                  fill="currentColor"
                  className="text-wiser-600"
                />
                <text
                  x={point.x}
                  y={height - 10}
                  textAnchor="middle"
                  className="fill-slate-400 text-[11px]"
                >
                  {point.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}

function CEOBarChart({
  data,
  valueKey,
  formatValue,
  barClassName,
}: {
  data: Array<{ label: string; collected?: number; applications?: number; accepted?: number }>;
  valueKey: "collected" | "applications";
  formatValue: (value: number) => string;
  barClassName: string;
}) {
  const maxValue = Math.max(...data.map((item) => Number(item[valueKey] ?? 0)), 1);

  return (
    <div className="mt-5 overflow-x-auto pb-1">
      <div className="flex min-w-[520px] items-end gap-3 px-1" style={{ height: 230 }}>
        {data.map((item) => {
          const value = Number(item[valueKey] ?? 0);
          const height = Math.max(4, (value / maxValue) * 180);

          return (
            <div key={item.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
              <span className="text-[11px] font-medium text-slate-500">
                {formatValue(value)}
              </span>
              <div className="flex w-full items-end justify-center" style={{ height: 180 }}>
                <div
                  className={`w-full max-w-14 rounded-t-lg transition-all duration-500 ${barClassName}`}
                  style={{ height }}
                  title={`${item.label}: ${formatValue(value)}`}
                />
              </div>
              <span className="text-[11px] font-medium text-slate-400">{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CEOAdmissionsTrendChart({
  loading,
  data,
  onViewDetails,
}: {
  loading: boolean;
  data: CEOAdmissionTrendPoint[];
  onViewDetails: () => void;
}) {
  const maxValue = Math.max(...data.map((item) => item.applications), 1);

  return (
    <Card className="min-w-0 p-4 sm:p-6">
      <CEOChartHeader
        title="Admissions trend"
        description="Applications received over the last six months."
        actionLabel="Open admissions"
        onAction={onViewDetails}
      />

      {loading ? (
        <div className="mt-6 flex h-[250px] items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Loading admissions trend...
        </div>
      ) : data.length === 0 ? (
        <div className="mt-6 flex h-[250px] items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500">
          No admissions data available for the last six months.
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <div className="min-w-[680px]">
            <div className="grid grid-cols-6 gap-3">
              {data.map((item) => (
                <div key={item.label} className="space-y-3">
                  <div className="flex h-[180px] items-end justify-center gap-1.5 rounded-xl bg-slate-50/70 px-2">
                    <div
                      className="w-5 rounded-t-md bg-wiser-600 transition-all duration-500"
                      style={{
                        height: `${Math.max(4, (item.applications / maxValue) * 150)}px`,
                      }}
                      title={`${item.applications} applications`}
                    />
                    <div
                      className="w-5 rounded-t-md bg-slate-300 transition-all duration-500"
                      style={{
                        height: `${Math.max(4, (item.accepted / maxValue) * 150)}px`,
                      }}
                      title={`${item.accepted} accepted/enrolled`}
                    />
                  </div>
                  <div className="text-center">
                    <p className="text-[11px] font-medium text-slate-400">{item.label}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-800">{item.applications} applications</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-wiser-600" />
                Applications
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-slate-300" />
                Accepted / enrolled
              </span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function CEOAttendanceTrendChart({
  loading,
  data,
  onViewDetails,
}: {
  loading: boolean;
  data: CEOAttendanceTrendPoint[];
  onViewDetails: () => void;
}) {
  return (
    <Card className="min-w-0 p-4 sm:p-6">
      <CEOChartHeader
        title="Attendance trend"
        description="Daily attendance rate across the last seven days."
        actionLabel="View attendance"
        onAction={onViewDetails}
      />

      {loading ? (
        <div className="mt-6 flex h-[250px] items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Loading attendance trend...
        </div>
      ) : data.length === 0 ? (
        <div className="mt-6 flex h-[250px] items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500">
          No attendance data available for the last seven days.
        </div>
      ) : (
        <>
          <CEOLineChart
            data={data}
            valueKey="rate"
            formatValue={(value) => `${value.toFixed(0)}%`}
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>Daily attendance rate</span>
            <span>
              Today: <strong className="text-slate-800">{data[data.length - 1]?.rate.toFixed(1)}%</strong>
            </span>
          </div>
        </>
      )}
    </Card>
  );
}

function CEOFeeTrendChart({
  loading,
  data,
  onViewDetails,
}: {
  loading: boolean;
  data: CEOFeeTrendPoint[];
  onViewDetails: () => void;
}) {
  return (
    <Card className="min-w-0 p-4 sm:p-6">
      <CEOChartHeader
        title="Fee collection trend"
        description="Payments received over the last six months."
        actionLabel="Open finance"
        onAction={onViewDetails}
      />

      {loading ? (
        <div className="mt-6 flex h-[250px] items-center justify-center gap-2 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" />
          Loading fee trend...
        </div>
      ) : data.length === 0 ? (
        <div className="mt-6 flex h-[250px] items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500">
          No payment data available for the last six months.
        </div>
      ) : (
        <>
          <CEOBarChart
            data={data}
            valueKey="collected"
            formatValue={(value) => formatMoney(value)}
            barClassName="bg-wiser-600"
          />
          <div className="mt-3 text-xs text-slate-500">
            Monthly payment collection in RWF.
          </div>
        </>
      )}
    </Card>
  );
}

function HeadOfAcademicsDashboard() {
  const navigate = useNavigate();
  const { school } = useSchool();

  const [firstName, setFirstName] = useState("Head of Academics");
  const [academicYearName, setAcademicYearName] = useState("");
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [assessments, setAssessments] = useState<AssessmentItem[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
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

      if (userError) {
        throw userError;
      }

      if (user) {
        setFirstName(getFirstNameFromUser(user));
      }

      const [
        academicYearsResult,
        studentsResult,
        teachersResult,
        subjectsResult,
        classesResult,
        attendanceResult,
      ] = await Promise.all([
        supabase
          .from("academic_years")
          .select("id, name, is_active, is_current, start_date, end_date")
          .eq("school_id", school.id)
          .order("start_date", { ascending: false }),
        supabase
          .from("students")
          .select("id", { count: "exact", head: true })
          .eq("school_id", school.id),
        supabase
          .from("teachers")
          .select("id, status", { count: "exact" })
          .eq("school_id", school.id),
        supabase
          .from("subjects")
          .select("id", { count: "exact", head: true })
          .eq("school_id", school.id)
          .eq("is_active", true),
        supabase
          .from("classes")
          .select("id, name, academic_year_id, is_active")
          .eq("school_id", school.id)
          .eq("is_active", true),
        supabase
          .from("attendance_records")
          .select("id, student_id, class_id, status")
          .eq("school_id", school.id)
          .eq("attendance_date", getToday()),
      ]);

      const firstError =
        academicYearsResult.error ??
        studentsResult.error ??
        teachersResult.error ??
        subjectsResult.error ??
        classesResult.error ??
        attendanceResult.error;

      if (firstError) {
        throw firstError;
      }

      const academicYears = academicYearsResult.data ?? [];
      const currentYear =
        academicYears.find((year) => year.is_current) ??
        academicYears.find((year) => year.is_active) ??
        academicYears[0] ??
        null;

      setAcademicYearName(currentYear?.name ?? "");

      const activeClasses = (classesResult.data ?? []).filter((item) =>
        currentYear ? item.academic_year_id === currentYear.id : true,
      );

      const attendanceRecords = attendanceResult.data ?? [];
      const present = attendanceRecords.filter(
        (record) => record.status === "present",
      ).length;
      const absent = attendanceRecords.filter(
        (record) => record.status === "absent",
      ).length;
      const late = attendanceRecords.filter(
        (record) => record.status === "late",
      ).length;
      const excused = attendanceRecords.filter(
        (record) => record.status === "excused",
      ).length;
      const attendanceRecorded = new Set(
        attendanceRecords.map((record) => record.student_id),
      ).size;

      const teachers = teachersResult.data ?? [];
      const activeTeacherCount = teachers.filter(
        (teacher) => teacher.status !== "Inactive",
      ).length;

      let assignments: any[] = [];
      let assessmentData: any[] = [];
      let enrollmentData: any[] = [];

      if (currentYear) {
        const [assignmentsResult, assessmentsResult, enrollmentsResult] =
          await Promise.all([
            supabase
              .from("teacher_assignments")
              .select(
                `
                  id,
                  teacher_id,
                  class_id,
                  subject_id,
                  teachers ( first_name, last_name ),
                  classes ( name ),
                  subjects ( name )
                `,
              )
              .eq("school_id", school.id)
              .eq("academic_year_id", currentYear.id),
            supabase
              .from("assessments")
              .select(
                `
                  id,
                  title,
                  assessment_type,
                  assessment_date,
                  max_marks,
                  status,
                  class_id,
                  subject_id,
                  classes ( name ),
                  subjects ( name )
                `,
              )
              .eq("school_id", school.id)
              .eq("academic_year_id", currentYear.id)
              .order("assessment_date", { ascending: true })
              .limit(30),
            supabase
              .from("enrollments")
              .select("id, student_id, class_id, status")
              .eq("school_id", school.id)
              .eq("academic_year_id", currentYear.id)
              .eq("status", "Active"),
          ]);

        const academicError =
          assignmentsResult.error ??
          assessmentsResult.error ??
          enrollmentsResult.error;

        if (academicError) {
          throw academicError;
        }

        assignments = assignmentsResult.data ?? [];
        assessmentData = assessmentsResult.data ?? [];
        enrollmentData = enrollmentsResult.data ?? [];
      }

      const assignedTeachers = new Set(
        assignments.map((item) => item.teacher_id),
      ).size;
      const coveredClasses = new Set(
        assignments.map((item) => item.class_id),
      ).size;
      const draftAssessments = assessmentData.filter(
        (item) => item.status === "Draft",
      ).length;

      setStats({
        students: studentsResult.count ?? 0,
        teachers: activeTeacherCount,
        classes: activeClasses.length,
        subjects: subjectsResult.count ?? 0,
        attendanceRate:
          attendanceRecorded > 0 ? (present / attendanceRecorded) * 100 : 0,
        present,
        absent,
        late,
        excused,
        attendanceRecorded,
        assessments: assessmentData.length,
        draftAssessments,
        assignedTeachers,
        coveredClasses,
        enrolledStudents: new Set(
          enrollmentData.map((item) => item.student_id),
        ).size,
      });

      const mappedAssessments: AssessmentItem[] = assessmentData
        .map((item) => ({
          id: item.id,
          title: item.title ?? "Untitled assessment",
          assessmentType: item.assessment_type ?? "Assessment",
          assessmentDate: item.assessment_date,
          maxMarks: Number(item.max_marks ?? 0),
          status: item.status ?? "Draft",
          className: mapJoinedName(item.classes, "Unknown class"),
          subjectName: mapJoinedName(item.subjects, "Unknown subject"),
        }))
        .sort(
          (a, b) =>
            new Date(a.assessmentDate).getTime() -
            new Date(b.assessmentDate).getTime(),
        )
        .slice(0, 6);

      setAssessments(mappedAssessments);

      const { data: announcementData, error: announcementsError } =
        await supabase
          .from("announcements")
          .select("id, title, created_at")
          .eq("school_id", school.id)
          .order("created_at", { ascending: false })
          .limit(4);

      if (!announcementsError) {
        setAnnouncements(
          (announcementData ?? []).map((item) => ({
            id: item.id,
            title: item.title ?? "School announcement",
            createdAt: item.created_at,
          })),
        );
      } else {
        setAnnouncements([]);
      }
    } catch (err) {
      console.error("Failed to load Head of Academics dashboard:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load academic dashboard data.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, [school?.id]);

  const statCards = [
    { label: "Students", value: loading ? "—" : String(stats.students), icon: Users },
    { label: "Teachers", value: loading ? "—" : String(stats.teachers), icon: GraduationCap },
    { label: "Classes", value: loading ? "—" : String(stats.classes), icon: School },
    { label: "Subjects", value: loading ? "—" : String(stats.subjects), icon: BookOpen },
    { label: "Attendance today", value: loading ? "—" : formatPercent(stats.attendanceRate), icon: CheckCircle2 },
    { label: "Assessments", value: loading ? "—" : String(stats.assessments), icon: ClipboardCheck },
  ];

  const assignmentCoverage =
    stats.teachers > 0 ? (stats.assignedTeachers / stats.teachers) * 100 : 0;
  const classCoverage =
    stats.classes > 0 ? (stats.coveredClasses / stats.classes) * 100 : 0;
  const attendanceCoverage =
    stats.enrolledStudents > 0
      ? (stats.attendanceRecorded / stats.enrolledStudents) * 100
      : 0;

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px]">
      <PageHeader
        eyebrow={academicYearName || "Academic overview"}
        title={`Good morning, ${firstName}`}
        description="Monitor teaching, attendance, classes, assessments and academic progress across the school."
        actions={
          <Button type="button" onClick={() => navigate("/academics")}>
            <BookOpen size={16} />
            Manage academics
          </Button>
        }
      />

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !academicYearName && (
        <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
          <p className="text-sm font-semibold text-slate-800">
            No academic year is configured yet
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Academic figures will become more useful once the school has an active academic year, classes and teaching assignments configured.
          </p>
        </div>
      )}

      <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {statCards.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-3">
        <Card className="min-w-0 p-4 sm:p-6 xl:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">Attendance today</h2>
              <p className="mt-1 text-sm text-slate-500">School-wide attendance across today's active classes.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/attendance")}
              className="inline-flex shrink-0 items-center gap-1 self-start text-sm font-medium text-wiser-600 hover:text-wiser-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wiser-500 focus-visible:ring-offset-2"
            >
              Open attendance
              <ArrowUpRight size={14} />
            </button>
          </div>

          <div className="mt-7 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
                {loading ? "—" : formatPercent(stats.attendanceRate)}
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {loading
                  ? "Loading attendance..."
                  : `${stats.present} present · ${stats.absent} absent · ${stats.late} late · ${stats.excused} excused`}
              </p>
            </div>

            <div className="w-full max-w-xs">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Recorded</span>
                <span>{loading ? "—" : `${stats.attendanceRecorded} students`}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-wiser-600 transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, attendanceCoverage))}%` }}
                />
              </div>
            </div>
          </div>
        </Card>

        <Card className="min-w-0 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Assessment pipeline</h2>
              <p className="mt-1 text-sm text-slate-500">Current academic year's assessment workload.</p>
            </div>
            <ClipboardCheck size={20} className="shrink-0 text-wiser-600" />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{loading ? "—" : stats.assessments}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Drafts</p>
              <p className="mt-2 text-2xl font-semibold text-amber-900">{loading ? "—" : stats.draftAssessments}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate("/assessments")}
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-wiser-600 hover:text-wiser-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wiser-500 focus-visible:ring-offset-2"
          >
            Open assessments
            <ArrowUpRight size={14} />
          </button>
        </Card>
      </div>

      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-2">
        <Card className="min-w-0 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">Academic coverage</h2>
              <p className="mt-1 text-sm text-slate-500">A quick view of teacher and class assignment coverage.</p>
            </div>
            <GraduationCap size={20} className="shrink-0 text-wiser-600" />
          </div>

          <div className="mt-6 space-y-5">
            <CoverageRow
              label="Teachers assigned"
              value={loading ? "—" : `${stats.assignedTeachers} of ${stats.teachers}`}
              percent={assignmentCoverage}
            />
            <CoverageRow
              label="Classes covered"
              value={loading ? "—" : `${stats.coveredClasses} of ${stats.classes}`}
              percent={classCoverage}
            />
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" type="button" onClick={() => navigate("/teachers")}>
              Manage teachers
            </Button>
            <Button size="sm" variant="secondary" type="button" onClick={() => navigate("/academics")}>
              Classes & subjects
            </Button>
          </div>
        </Card>

        <Card className="min-w-0 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">Upcoming assessments</h2>
              <p className="mt-1 text-sm text-slate-500">The next assessments scheduled for the academic year.</p>
            </div>
            <CalendarDays size={20} className="shrink-0 text-wiser-600" />
          </div>

          <div className="mt-5 space-y-3">
            {loading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
                <Loader2 size={16} className="animate-spin" />
                Loading assessments...
              </div>
            ) : assessments.length > 0 ? (
              assessments.map((assessment) => (
                <div key={assessment.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{assessment.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {assessment.subjectName} · {assessment.className}
                      </p>
                    </div>
                    <span className="shrink-0 text-[11px] font-medium text-slate-400">
                      {formatDate(assessment.assessmentDate)}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600">
                      {assessment.assessmentType}
                    </span>
                    <span
                      className={
                        assessment.status === "Published"
                          ? "rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700"
                          : "rounded-full bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-700"
                      }
                    >
                      {assessment.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                No assessments found for the current academic year.
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-2">
        <Card className="min-w-0 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Academic actions</h2>
              <p className="mt-1 text-sm text-slate-500">Open the areas you use to coordinate academic work.</p>
            </div>
            <BookOpen size={20} className="shrink-0 text-wiser-600" />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <ActionButton label="Classes & subjects" icon={<BookOpen size={15} />} onClick={() => navigate("/academics")} />
            <ActionButton label="Timetable" icon={<CalendarDays size={15} />} onClick={() => navigate("/timetable")} />
            <ActionButton label="Attendance" icon={<ClipboardCheck size={15} />} onClick={() => navigate("/attendance")} />
            <ActionButton label="Assessments" icon={<CheckCircle2 size={15} />} onClick={() => navigate("/assessments")} />
            <ActionButton label="Student results" icon={<GraduationCap size={15} />} onClick={() => navigate("/student-results")} />
            <ActionButton label="Teachers" icon={<Users size={15} />} onClick={() => navigate("/teachers")} />
          </div>
        </Card>

        <Card className="min-w-0 p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">School notices</h2>
              <p className="mt-1 text-sm text-slate-500">Latest announcements available to academic leadership.</p>
            </div>
            <School size={20} className="shrink-0 text-wiser-600" />
          </div>

          <div className="mt-5 space-y-4">
            {announcements.length > 0 ? (
              announcements.map((announcement) => (
                <div key={announcement.id} className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                  <p className="break-words text-sm font-medium text-slate-900">{announcement.title}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatRelativeTime(announcement.createdAt)}</p>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                No school notices yet.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function CoverageRow({
  label,
  value,
  percent,
}: {
  label: string;
  value: string;
  percent: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="font-medium text-slate-900">{value}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-wiser-600 transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
    </div>
  );
}

function ActionButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-10 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:border-wiser-200 hover:bg-wiser-50 hover:text-wiser-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wiser-500 focus-visible:ring-offset-2"
    >
      <span className="inline-flex min-w-0 items-center gap-2">
        <span className="text-wiser-600">{icon}</span>
        <span className="truncate">{label}</span>
      </span>
      <ArrowUpRight size={14} className="shrink-0 text-slate-400" />
    </button>
  );
}


export default function Dashboard() {
  const { membership } = useSchool();
  const role = normalizeRole(membership?.role);

  if (role === "Teacher") {
    return <TeacherDashboard />;
  }

  if (role === "Head of Academics") {
    return <HeadOfAcademicsDashboard />;
  }

  if (role === "CEO") {
    return <CEODashboard />;
  }

  if (role === "Principal") {
    return <PrincipalDashboard />;
  }

  if (role === "Secretary") {
    return <SecretaryDashboard />;
  }

  return <AdminDashboard />;
}
