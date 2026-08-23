import { Outlet, NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  GraduationCap,
  Users,
  UserRound,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  Wallet,
  FileText,
  Megaphone,
  Settings,
  ChevronDown,
} from "lucide-react";

const navigation = [
  {
    label: "Overview",
    items: [
      {
        label: "Dashboard",
        icon: LayoutDashboard,
        path: "/",
      },
    ],
  },
  {
    label: "School",
    items: [
      {
        label: "Admissions",
        icon: GraduationCap,
        path: "/admissions",
      },
      {
        label: "Students",
        icon: Users,
        path: "/students",
      },
      {
        label: "Parents",
        icon: UserRound,
        path: "/parents",
      },
      {
        label: "Teachers",
        icon: GraduationCap,
        path: "/teachers",
      },
    ],
  },
  {
    label: "Academics",
    items: [
      {
        label: "Classes & Subjects",
        icon: BookOpen,
        path: "/academics",
      },
      {
        label: "Timetable",
        icon: CalendarDays,
        path: "/timetable",
      },
      {
        label: "Attendance",
        icon: ClipboardCheck,
        path: "/attendance",
      },
      {
        label: "Assessments",
        icon: FileText,
        path: "/assessments",
      },
    ],
  },
  {
    label: "Finance",
    items: [
      {
        label: "Fees & Payments",
        icon: Wallet,
        path: "/finance",
      },
    ],
  },
  {
    label: "Communication",
    items: [
      {
        label: "Announcements",
        icon: Megaphone,
        path: "/communications",
      },
    ],
  },
];

function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
      <div className="flex h-20 items-center border-b border-slate-200 px-6">
        <div>
          <div className="text-lg font-bold tracking-tight text-slate-900">
            School<span className="text-indigo-600">OS</span>
          </div>
          <div className="text-xs text-slate-500">School Management</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-5">
        {navigation.map((section) => (
          <div key={section.label} className="mb-6">
            <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {section.label}
            </div>

            <nav className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === "/"}
                    className={({ isActive }) =>
                      [
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                        isActive
                          ? "bg-indigo-50 text-indigo-700"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                      ].join(" ")
                    }
                  >
                    <Icon size={18} strokeWidth={1.8} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-200 p-3">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            [
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
              isActive
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-600 hover:bg-slate-50",
            ].join(" ")
          }
        >
          <Settings size={18} strokeWidth={1.8} />
          Settings
        </NavLink>
      </div>
    </aside>
  );
}

function Header() {
  return (
    <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8">
      <div>
        <div className="text-sm text-slate-500">School</div>
        <button className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-slate-900">
          High Gate International Academy
          <ChevronDown size={15} />
        </button>
      </div>

      <div className="flex items-center gap-4">
        <button className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100">
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-indigo-600" />
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
        </button>

        <button className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="text-sm font-semibold text-slate-900">
              School Admin
            </div>
            <div className="text-xs text-slate-500">Administrator</div>
          </div>

          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
            SA
          </div>
        </button>
      </div>
    </header>
  );
}

export default function AppLayout() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header />

        <main className="flex-1 overflow-auto p-5 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}