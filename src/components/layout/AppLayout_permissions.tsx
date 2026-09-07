import { Outlet, NavLink, useLocation, useNavigate } from "react-router-dom";
import { normalizeRole, canAccessPath } from "../../lib/permissions";
import { useAuth } from "../../context/AuthContext";
import { useSchool } from "../../context/SchoolContext";
import { supabase } from "../../lib/supabase";

import {
  LayoutDashboard,
  GraduationCap,
  Users,
  UserRound,
  Building2,
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  Wallet,
  FileText,
  FileBarChart,
  Megaphone,
  ChevronDown,
  Bell,
  ShieldCheck,
  History,
  Receipt,
  CreditCard,
  BarChart3,
  LogOut,
  type LucideIcon,
} from "lucide-react";

type NavigationChild = {
  label: string;
  icon: LucideIcon;
  path: string;
};

type NavigationItem = {
  label: string;
  icon: LucideIcon;
  path: string;
  children?: NavigationChild[];
};

type NavigationSection = {
  label: string;
  items: NavigationItem[];
};

const navigation: NavigationSection[] = [
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
        label: "Pickup Desk",
        icon: ShieldCheck,
        path: "/pickup-desk",
      },
      {
        label: "Pickup History",
        icon: History,
        path: "/pickup-history",
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
        children: [
          {
            label: "Attendance History",
            icon: History,
            path: "/attendance/history",
          },
          {
            label: "Attendance Reports",
            icon: FileBarChart,
            path: "/attendance/reports",
          },
        ],
      },

      {
        label: "Assessments",
        icon: FileText,
        path: "/assessments",
        children: [
          {
            label: "Student Results",
            icon: ClipboardCheck,
            path: "/student-results",
          },
        ],
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
        children: [
          {
            label: "Fee Structure",
            icon: FileText,
            path: "/finance",
          },
          {
            label: "Student Billing",
            icon: Receipt,
            path: "/finance/billing",
          },
          {
            label: "Payments",
            icon: CreditCard,
            path: "/finance/payments",
          },
          {
            label: "Receipts",
            icon: Receipt,
            path: "/finance/receipts",
          },
          {
            label: "Finance Reports",
            icon: BarChart3,
            path: "/finance/reports",
          },
        ],
      },
    ],
  },

  {
    label: "Communication",
    items: [
      {
        label: "Announcements",
        icon: Megaphone,
        path: "/announcements",
      },
    ],
  },

  {
    label: "Settings",
    items: [
      {
        label: "School Profile",
        icon: Building2,
        path: "/settings/school-profile",
      },
      {
        label: "Academic Settings",
        icon: CalendarDays,
        path: "/settings/academic",
      },
      {
        label: "Users & Roles",
        icon: ShieldCheck,
        path: "/settings/users",
      },
    ],
  },
];

function Sidebar() {
  const navigate = useNavigate();
  const { membership } = useSchool();
  const role = normalizeRole(membership?.role);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <aside className="hidden h-screen w-64 shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col">
      <div className="flex h-20 items-center border-b border-slate-200 px-6">
        <div>
          <div className="text-lg font-bold tracking-tight text-slate-900">
            School<span className="text-indigo-600">OS</span>
          </div>
          <div className="text-xs text-slate-500">School Management</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-5">
        {navigation.map((section) => {
          const visibleItems = section.items
            .map((item) => {
              if (!item.children?.length) {
                return canAccessPath(role, item.path) ? item : null;
              }

              const visibleChildren = item.children.filter((child) =>
                canAccessPath(role, child.path),
              );

              if (visibleChildren.length === 0) return null;

              return {
                ...item,
                children: visibleChildren,
                path: canAccessPath(role, item.path)
                  ? item.path
                  : visibleChildren[0].path,
              };
            })
            .filter(Boolean) as NavigationItem[];

          if (visibleItems.length === 0) return null;

          return (
            <div key={section.label} className="mb-6">
              <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {section.label}
              </div>

              <nav className="space-y-1">
                {visibleItems.map((item) => {
                  const Icon = item.icon;

                  if (item.children && item.children.length > 0) {
                    return (
                      <div key={item.path}>
                        <NavLink
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
                          <ChevronDown
                            size={14}
                            strokeWidth={1.8}
                            className="ml-auto text-slate-400"
                          />
                        </NavLink>

                        <div className="ml-7 mt-1 space-y-1">
                          {item.children.map((child) => {
                            const ChildIcon = child.icon;
                            return (
                              <NavLink
                                key={child.path}
                                to={child.path}
                                end
                                className={({ isActive }) =>
                                  [
                                    "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition",
                                    isActive
                                      ? "bg-indigo-50 text-indigo-700"
                                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                                  ].join(" ")
                                }
                              >
                                <ChildIcon size={15} strokeWidth={1.8} />
                                <span>{child.label}</span>
                              </NavLink>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

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
          );
        })}
      </div>

      <div className="border-t border-slate-200 p-3">
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600"
        >
          <LogOut size={18} strokeWidth={1.8} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

function Header() {
  const { school, membership } = useSchool();
  const { user } = useAuth();

  const firstName = user?.user_metadata?.first_name ?? "";

  const lastName = user?.user_metadata?.last_name ?? "";

  const fullName = `${firstName} ${lastName}`.trim() || "School Admin";

  const initials =
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "SA";

  return (
    <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8">
      {/* School */}
      <div>
        <div className="text-sm text-slate-500">School</div>

        <button
          type="button"
          className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-slate-900"
        >
          {school?.name ?? "School"}

          <ChevronDown size={15} />
        </button>
      </div>

      {/* User */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
        >
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-indigo-600" />

          <Bell size={18} strokeWidth={1.8} />
        </button>

        <button type="button" className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="text-sm font-semibold text-slate-900">
              {fullName}
            </div>

            <div className="text-xs capitalize text-slate-500">
              {membership?.role ?? "Administrator"}
            </div>
          </div>

          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
            {initials}
          </div>
        </button>
      </div>
    </header>
  );
}

function AccessDenied() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
          <ShieldCheck size={22} />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">Access denied</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          You do not have permission to access this section of SchoolOS.
        </p>
        <NavLink
          to="/"
          className="mt-5 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Back to dashboard
        </NavLink>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const { membership } = useSchool();
  const location = useLocation();
  const role = normalizeRole(membership?.role);
  const hasLoadedRole = Boolean(membership?.role);
  const allowed = !hasLoadedRole || canAccessPath(role, location.pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Header />

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-5 sm:p-8">
          {allowed ? <Outlet /> : <AccessDenied />}
        </main>
      </div>
    </div>
  );
}
