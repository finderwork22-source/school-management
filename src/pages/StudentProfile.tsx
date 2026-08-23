import {
  ArrowLeft,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  FileText,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import Avatar from "../components/ui/Avatar";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Card from "../components/ui/Card";

const student = {
  name: "John Doe",
  studentId: "HGA-2026-001",
  gender: "Male",
  dateOfBirth: "14 March 2016",
  className: "G5 Blue",
  section: "Primary",
  status: "Active",
  admissionDate: "12 January 2026",

  parent: {
    name: "Jane Doe",
    relationship: "Mother",
    phone: "+250 788 123 456",
    email: "jane.doe@example.com",
  },

  address: "Kigali, Rwanda",

  emergency: {
    name: "Michael Doe",
    relationship: "Father",
    phone: "+250 789 123 456",
  },
};

const tabs = [
  {
    label: "Overview",
    value: "overview",
  },
  {
    label: "Attendance",
    value: "attendance",
  },
  {
    label: "Academics",
    value: "academics",
  },
  {
    label: "Finance",
    value: "finance",
  },
  {
    label: "Documents",
    value: "documents",
  },
];

export default function StudentProfile() {
  const navigate = useNavigate();
  const { id } = useParams();

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* Back */}
      <button
        onClick={() => navigate("/students")}
        className="mb-5 flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
      >
        <ArrowLeft size={16} />
        Back to students
      </button>

      {/* Profile header */}
      <Card className="overflow-hidden">
        <div className="p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <Avatar name={student.name} size="lg" />

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                    {student.name}
                  </h1>

                  <Badge variant="success">
                    {student.status}
                  </Badge>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                  <span>{student.studentId}</span>
                  <span>{student.className}</span>
                  <span>{student.section}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="secondary">
                Edit student
              </Button>

              <Button>
                More actions
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-t border-slate-200 px-6">
          <div className="flex gap-6 overflow-x-auto">
            {tabs.map((tab, index) => (
              <button
                key={tab.value}
                className={[
                  "relative whitespace-nowrap py-3.5 text-sm font-medium",
                  index === 0
                    ? "text-indigo-600"
                    : "text-slate-500 hover:text-slate-900",
                ].join(" ")}
              >
                {tab.label}

                {index === 0 && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-indigo-600" />
                )}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Main */}
      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        {/* Personal information */}
        <Card className="p-6 xl:col-span-2">
          <SectionTitle
            icon={UserRound}
            title="Personal information"
          />

          <div className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2">
            <Info
              label="Full name"
              value={student.name}
            />

            <Info
              label="Student ID"
              value={student.studentId}
            />

            <Info
              label="Gender"
              value={student.gender}
            />

            <Info
              label="Date of birth"
              value={student.dateOfBirth}
            />

            <Info
              label="Class"
              value={student.className}
            />

            <Info
              label="Section"
              value={student.section}
            />

            <Info
              label="Admission date"
              value={student.admissionDate}
            />

            <Info
              label="Address"
              value={student.address}
            />
          </div>
        </Card>

        {/* Parent */}
        <Card className="p-6">
          <SectionTitle
            icon={UserRound}
            title="Primary guardian"
          />

          <div className="mt-5 flex items-center gap-3">
            <Avatar name={student.parent.name} />

            <div>
              <div className="text-sm font-semibold text-slate-900">
                {student.parent.name}
              </div>

              <div className="mt-0.5 text-xs text-slate-500">
                {student.parent.relationship}
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <Contact
              icon={Phone}
              value={student.parent.phone}
            />

            <Contact
              icon={Mail}
              value={student.parent.email}
            />
          </div>
        </Card>

        {/* Attendance */}
        <Card className="p-6">
          <SectionTitle
            icon={ClipboardCheck}
            title="Attendance"
            action="View"
          />

          <div className="mt-6">
            <div className="text-3xl font-semibold tracking-tight text-slate-900">
              96%
            </div>

            <div className="mt-1 text-sm text-slate-500">
              Attendance this term
            </div>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: "96%" }}
              />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Metric label="Present" value="48" />
              <Metric label="Absent" value="1" />
              <Metric label="Late" value="2" />
            </div>
          </div>
        </Card>

        {/* Academic */}
        <Card className="p-6">
          <SectionTitle
            icon={GraduationCap}
            title="Academic performance"
            action="View"
          />

          <div className="mt-6">
            <div className="text-3xl font-semibold tracking-tight text-slate-900">
              86.4%
            </div>

            <div className="mt-1 text-sm text-slate-500">
              Current term average
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <Subject name="Mathematics" score="82%" />
            <Subject name="English" score="89%" />
            <Subject name="Science" score="76%" />
            <Subject name="French" score="91%" />
          </div>
        </Card>

        {/* Finance */}
        <Card className="p-6">
          <SectionTitle
            icon={CreditCard}
            title="Finance"
            action="View"
          />

          <div className="mt-6">
            <div className="text-3xl font-semibold tracking-tight text-slate-900">
              158,333
            </div>

            <div className="mt-1 text-sm text-slate-500">
              RWF outstanding
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <FinanceRow
              label="Term fees"
              value="258,333 RWF"
            />

            <FinanceRow
              label="Paid"
              value="100,000 RWF"
            />

            <FinanceRow
              label="Balance"
              value="158,333 RWF"
              highlight
            />
          </div>
        </Card>

        {/* Emergency contact */}
        <Card className="p-6">
          <SectionTitle
            icon={Phone}
            title="Emergency contact"
          />

          <div className="mt-5">
            <div className="text-sm font-semibold text-slate-900">
              {student.emergency.name}
            </div>

            <div className="mt-1 text-xs text-slate-500">
              {student.emergency.relationship}
            </div>

            <div className="mt-4 flex items-center gap-2 text-sm text-slate-600">
              <Phone size={15} />
              {student.emergency.phone}
            </div>
          </div>
        </Card>

        {/* Documents */}
        <Card className="p-6 xl:col-span-2">
          <SectionTitle
            icon={FileText}
            title="Documents"
            action="View all"
          />

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Document
              name="Birth Certificate"
              date="12 Jan 2026"
            />

            <Document
              name="Admission Form"
              date="12 Jan 2026"
            />

            <Document
              name="Previous School Report"
              date="12 Jan 2026"
            />

            <Document
              name="Parent ID"
              date="12 Jan 2026"
            />
          </div>
        </Card>

        {/* Timeline */}
        <Card className="p-6">
          <SectionTitle
            icon={CalendarDays}
            title="Recent activity"
          />

          <div className="mt-6 space-y-5">
            <Activity
              title="Payment verified"
              description="100,000 RWF"
              time="Today"
            />

            <Activity
              title="Attendance recorded"
              description="Present"
              time="Today"
            />

            <Activity
              title="Grade submitted"
              description="Mathematics · 82%"
              time="Yesterday"
            />

            <Activity
              title="Document uploaded"
              description="Birth Certificate"
              time="12 Jan"
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- Components ---------------- */

function SectionTitle({
  icon: Icon,
  title,
  action,
}: {
  icon: typeof UserRound;
  title: string;
  action?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <Icon size={16} />
        </div>

        <h2 className="text-sm font-semibold text-slate-900">
          {title}
        </h2>
      </div>

      {action && (
        <button className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
          {action}
        </button>
      )}
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-400">
        {label}
      </div>

      <div className="mt-1 text-sm font-medium text-slate-900">
        {value}
      </div>
    </div>
  );
}

function Contact({
  icon: Icon,
  value,
}: {
  icon: typeof Phone;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-slate-600">
      <Icon size={15} className="shrink-0 text-slate-400" />
      <span className="truncate">{value}</span>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-slate-50 py-2">
      <div className="text-sm font-semibold text-slate-900">
        {value}
      </div>

      <div className="mt-0.5 text-[11px] text-slate-400">
        {label}
      </div>
    </div>
  );
}

function Subject({
  name,
  score,
}: {
  name: string;
  score: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-slate-600">{name}</span>
      <span className="text-sm font-semibold text-slate-900">
        {score}
      </span>
    </div>
  );
}

function FinanceRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>

      <span
        className={
          highlight
            ? "font-semibold text-amber-600"
            : "font-medium text-slate-900"
        }
      >
        {value}
      </span>
    </div>
  );
}

function Document({
  name,
  date,
}: {
  name: string;
  date: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
        <FileText size={16} />
      </div>

      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-slate-900">
          {name}
        </div>

        <div className="mt-0.5 text-xs text-slate-400">
          Uploaded {date}
        </div>
      </div>
    </div>
  );
}

function Activity({
  title,
  description,
  time,
}: {
  title: string;
  description: string;
  time: string;
}) {
  return (
    <div className="relative pl-5">
      <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-indigo-500" />

      <div className="text-sm font-medium text-slate-900">
        {title}
      </div>

      <div className="mt-0.5 text-xs text-slate-500">
        {description}
      </div>

      <div className="mt-1 text-[11px] text-slate-400">
        {time}
      </div>
    </div>
  );
}