import {
  Users,
  GraduationCap,
  School,
  UserCheck,
} from "lucide-react";

import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import PageHeader from "../components/ui/PageHeader";
import StatCard from "../components/ui/StatCard";

const stats = [
  {
    label: "Students",
    value: "524",
    change: "+8.2%",
    trend: "up" as const,
    icon: Users,
  },
  {
    label: "Teachers",
    value: "48",
    change: "+2.1%",
    trend: "up" as const,
    icon: GraduationCap,
  },
  {
    label: "Classes",
    value: "24",
    trend: "neutral" as const,
    icon: School,
  },
  {
    label: "Attendance",
    value: "95.2%",
    change: "+1.4%",
    trend: "up" as const,
    icon: UserCheck,
  },
];

const activities = [
  {
    title: "New student enrolled",
    description: "John Doe · G5 Blue",
    time: "12 min ago",
  },
  {
    title: "Payment verified",
    description: "Jane Doe · 100,000 RWF",
    time: "34 min ago",
  },
  {
    title: "Grades submitted",
    description: "Mathematics · G6 Blue",
    time: "1 hr ago",
  },
  {
    title: "New announcement",
    description: "Term 1 examination schedule",
    time: "2 hrs ago",
  },
];

export default function Dashboard() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        eyebrow="Overview"
        title="Good morning, Admin"
        description="Here's what's happening at your school today."
        actions={
          <Button>
            + Add student
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="p-6 xl:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Attendance overview
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Today's attendance across the school.
              </p>
            </div>

            <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
              View details
            </button>
          </div>

          <div className="mt-8">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-4xl font-semibold tracking-tight text-slate-900">
                  95.2%
                </div>

                <div className="mt-1 text-sm text-slate-500">
                  498 of 524 students present
                </div>
              </div>

              <div className="hidden text-right text-sm text-slate-500 sm:block">
                <div>
                  Present{" "}
                  <strong className="text-slate-900">498</strong>
                </div>

                <div>
                  Absent{" "}
                  <strong className="text-slate-900">18</strong>
                </div>

                <div>
                  Late{" "}
                  <strong className="text-slate-900">8</strong>
                </div>
              </div>
            </div>

            <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-indigo-600"
                style={{ width: "95.2%" }}
              />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Recent activity
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Latest updates from your school.
            </p>
          </div>

          <div className="mt-6 space-y-5">
            {activities.map((activity) => (
              <div
                key={activity.title}
                className="flex gap-3"
              >
                <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-600" />

                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900">
                    {activity.title}
                  </div>

                  <div className="mt-0.5 text-xs text-slate-500">
                    {activity.description}
                  </div>

                  <div className="mt-1 text-[11px] text-slate-400">
                    {activity.time}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-6">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Quick actions
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Common tasks for school administration.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button size="sm">Add student</Button>

          <Button size="sm" variant="secondary">
            Create announcement
          </Button>

          <Button size="sm" variant="secondary">
            View payments
          </Button>

          <Button size="sm" variant="secondary">
            Attendance
          </Button>
        </div>
      </Card>
    </div>
  );
}