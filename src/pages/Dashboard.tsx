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

interface DashboardStats {
  students: number;
  teachers: number;
  classes: number;
  attendanceRate: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceRecorded: number;
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
  attendanceRate: 0,
  present: 0,
  absent: 0,
  late: 0,
  excused: 0,
  attendanceRecorded: 0,
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
        attendanceRate,
        present,
        absent,
        late,
        excused,
        attendanceRecorded: recordedStudents,
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

export default function Dashboard() {
  const { membership } = useSchool();
  const role = normalizeRole(membership?.role);

  if (role === "Teacher") {
    return <TeacherDashboard />;
  }

  return <AdminDashboard />;
}
