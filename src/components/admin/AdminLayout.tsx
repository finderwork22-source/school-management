import { useEffect, useState } from "react";
import {
  Activity,
  BarChart3,
  Building2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileClock,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { signOut } from "../../lib/auth";
import { getPlatformAdminIdentity } from "../../lib/platformAuth";

const navigation = [
  {
    label: "Overview",
    to: "/admin",
    icon: LayoutDashboard,
    end: true,
  },
  {
    label: "Schools",
    to: "/admin/schools",
    icon: Building2,
  },
  {
    label: "School requests",
    to: "/admin/applications",
    icon: FileClock,
  },
  {
    label: "Billing",
    to: "/admin/billing",
    icon: CreditCard,
  },
  {
    label: "Analytics",
    to: "/admin/analytics",
    icon: BarChart3,
  },
  {
    label: "Audit logs",
    to: "/admin/audit",
    icon: Activity,
  },
  {
    label: "Settings",
    to: "/admin/settings",
    icon: Settings,
  },
];

function getInitials(
  firstName: string,
  lastName: string,
  email: string | null,
) {
  const initials = [firstName, lastName]
    .map((value) => value.trim().charAt(0))
    .filter(Boolean)
    .join("");

  if (initials) return initials.toUpperCase();

  return (email?.charAt(0) || "A").toUpperCase();
}

export default function AdminLayout() {
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadIdentity() {
      const { identity } = await getPlatformAdminIdentity();

      if (!mounted || !identity) return;

      setFirstName(identity.firstName);
      setLastName(identity.lastName);
      setEmail(identity.email);
    }

    void loadIdentity();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  const initials = getInitials(firstName, lastName, email);
  const displayName =
    [firstName, lastName].filter(Boolean).join(" ") ||
    email ||
    "MojaSchool Admin";

  return (
    <div className="min-h-screen bg-MojaSchoolr-background text-MojaSchoolr-text">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
        />
      )}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-MojaSchoolr-border bg-white transition-all duration-200 lg:translate-x-0",
          collapsed ? "w-[78px]" : "w-[260px]",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
      >
        <div className="flex h-16 items-center justify-between border-b border-MojaSchoolr-border px-4">
          <div className={collapsed ? "mx-auto" : ""}>
            <img
              src="/MojaSchool.svg"
              alt="MojaSchool"
              className="h-auto w-[180px]"
            />
          </div>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 text-MojaSchoolr-text-muted hover:bg-MojaSchoolr-50 hover:text-MojaSchoolr-text lg:hidden"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-MojaSchoolr-border px-3 py-4">
          <div
            className={[
              "flex items-center rounded-xl bg-MojaSchoolr-50/70",
              collapsed ? "justify-center p-2" : "gap-3 px-3 py-2.5",
            ].join(" ")}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-MojaSchoolr-600 text-xs font-semibold text-white">
              {initials}
            </div>

            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-MojaSchoolr-text">
                  {displayName}
                </p>
                <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-MojaSchoolr-600">
                  <ShieldCheck size={12} />
                  MojaSchool Admin
                </div>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {!collapsed && (
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-MojaSchoolr-text-muted">
              Platform
            </p>
          )}

          {navigation.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  [
                    "flex items-center rounded-lg text-sm font-medium transition",
                    collapsed
                      ? "justify-center px-2 py-3"
                      : "gap-3 px-3 py-2.5",
                    isActive
                      ? "bg-MojaSchoolr-50 text-MojaSchoolr-700"
                      : "text-MojaSchoolr-text-secondary hover:bg-slate-50 hover:text-MojaSchoolr-text",
                  ].join(" ")
                }
              >
                <Icon size={17} />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-MojaSchoolr-border p-3">
          <button
            type="button"
            onClick={() => void handleSignOut()}
            title={collapsed ? "Sign out" : undefined}
            className={[
              "flex w-full items-center rounded-lg text-sm font-medium text-MojaSchoolr-text-secondary transition hover:bg-red-50 hover:text-red-700",
              collapsed ? "justify-center px-2 py-3" : "gap-3 px-3 py-2.5",
            ].join(" ")}
          >
            <LogOut size={17} />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="absolute -right-3 top-[76px] hidden h-6 w-6 items-center justify-center rounded-full border border-MojaSchoolr-border bg-white text-MojaSchoolr-text-muted shadow-sm hover:text-MojaSchoolr-text lg:flex"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </aside>

      <div
        className={[
          "min-h-screen transition-[margin] duration-200",
          collapsed ? "lg:ml-[78px]" : "lg:ml-[260px]",
        ].join(" ")}
      >
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-MojaSchoolr-border bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-MojaSchoolr-text-secondary hover:bg-MojaSchoolr-50 hover:text-MojaSchoolr-text lg:hidden"
              aria-label="Open navigation"
            >
              <Menu size={20} />
            </button>

            <div className="lg:hidden">
              <img
                src="/MojaSchool.svg"
                alt="MojaSchool"
                className="h-9 w-auto"
              />
            </div>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <span className="rounded-full bg-MojaSchoolr-50 px-3 py-1.5 text-xs font-semibold text-MojaSchoolr-700">
              Platform console
            </span>
          </div>
        </header>

        <main className="min-w-0 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
