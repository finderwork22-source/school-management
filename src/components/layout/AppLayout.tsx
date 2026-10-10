import { useEffect, useRef, useState } from "react";

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

  ChevronLeft,

  ChevronRight,

  Bell,

  ShieldCheck,

  History,

  UserCheck,

  Receipt,

  CreditCard,

  BarChart3,

  LogOut,

  Menu,

  X,

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

  allowedRoles?: string[];

};



type NavigationSection = {

  label: string;

  items: NavigationItem[];

  allowedRoles?: string[];

};



const navigation: NavigationSection[] = [

  {

    label: "Overview",

    allowedRoles: [

      "Owner",

      "Principal",

      "Head of Academics",

      "Secretary",

      "Teacher",

      "Librarian",

    ],

    items: [

      {

        label: "Dashboard",

        icon: LayoutDashboard,

        path: "/",

      },

    ],

  },



  {

    label: "Parent",

    allowedRoles: ["Parent"],

    items: [

      {

        label: "My Children",

        icon: Users,

        path: "/",

      },

      {

        label: "Pickup Authorisations",

        icon: ShieldCheck,

        path: "/pickup-authorisations",

      },

      {

        label: "Announcements",

        icon: Megaphone,

        path: "/announcements",

      },

      {

        label: "My Profile",

        icon: UserCheck,

        path: "/profile",

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

        allowedRoles: ["Owner", "Principal", "Head of Academics", "Secretary", "Teacher"],

      },

      {

        label: "Teachers",

        icon: GraduationCap,

        path: "/teachers",

        allowedRoles: ["Owner", "Principal", "Head of Academics", "Secretary"],

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

    allowedRoles: ["Owner", "Principal"],

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

    allowedRoles: [

      "Owner",

      "Principal",

      "Head of Academics",

      "Secretary",

      "Teacher",

      "Librarian",

    ],

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



const MODULE_ROUTE_RULES: Array<{ prefix: string; moduleKey: string }> = [
  { prefix: "/admissions", moduleKey: "admissions" },
  { prefix: "/students", moduleKey: "students" },
  { prefix: "/parents", moduleKey: "parents" },
  { prefix: "/teachers", moduleKey: "teachers" },
  { prefix: "/pickup-desk", moduleKey: "pickup" },
  { prefix: "/pickup-history", moduleKey: "pickup" },
  { prefix: "/pickup-authorisations", moduleKey: "pickup" },
  { prefix: "/academics", moduleKey: "academics" },
  { prefix: "/academic-years", moduleKey: "academics" },
  { prefix: "/timetable", moduleKey: "timetable" },
  { prefix: "/attendance", moduleKey: "attendance" },
  { prefix: "/assessments", moduleKey: "assessments" },
  { prefix: "/student-results", moduleKey: "student_results" },
  { prefix: "/finance", moduleKey: "finance" },
  { prefix: "/announcements", moduleKey: "announcements" },
  { prefix: "/communications", moduleKey: "announcements" },
  { prefix: "/library", moduleKey: "library" },
  { prefix: "/transport", moduleKey: "transport" },
  { prefix: "/ai-assistant", moduleKey: "ai_assistant" },
];

function getRequiredModule(pathname: string): string | null {
  const match = MODULE_ROUTE_RULES.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  return match?.moduleKey ?? null;
}

function Sidebar({

  mobileOpen,

  onClose,

  collapsed,

  onToggleCollapse,

}: {

  mobileOpen: boolean;

  onClose: () => void;

  collapsed: boolean;

  onToggleCollapse: () => void;

}) {

  const navigate = useNavigate();

  const { membership, isModuleEnabled } = useSchool();

  const role = normalizeRole(membership?.role);



  async function handleLogout() {

    await supabase.auth.signOut();

    navigate("/login");

    onClose();

  }



  const sidebarContent = (

    <>

      <div className="flex h-16 shrink-0 items-center border-b border-slate-200 px-3 sm:px-4">

        <div className={collapsed ? "mx-auto w-10 shrink-0 overflow-hidden" : "min-w-0"}>

          <div className={collapsed ? "w-[180px] shrink-0" : "w-[180px] shrink-0"}>

            <img

              src="/MojaSchool.svg"

              alt="MojaSchool"

              className="h-auto w-[180px]"

            />

          </div>

        </div>



        <button

          type="button"

          onClick={onClose}

          aria-label="Close navigation"

          className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-MojaSchool-500 focus-visible:ring-offset-2 lg:hidden"

        >

          <X size={19} />

        </button>

      </div>



      <div className={"min-h-0 flex-1 overflow-y-auto overscroll-contain py-5 " + (collapsed ? "px-2" : "px-3")}>

        {navigation.map((section) => {

          if (section.allowedRoles && !section.allowedRoles.includes(role)) {

            return null;

          }



          const visibleItems = section.items
            .map((item) => {
              const roleExplicitlyAllowed =
                !item.allowedRoles || item.allowedRoles.includes(role);
              if (!roleExplicitlyAllowed) return null;

              const parentModule = getRequiredModule(item.path);
              const parentModuleAllowed =
                !parentModule || isModuleEnabled(parentModule);

              if (!item.children?.length) {
                if (!canAccessPath(role, item.path) || !parentModuleAllowed) return null;
                return item;
              }

              const visibleChildren = item.children.filter((child) => {
                if (!canAccessPath(role, child.path)) return false;
                const requiredModule = getRequiredModule(child.path) ?? parentModule;
                return !requiredModule || isModuleEnabled(requiredModule);
              });

              if (visibleChildren.length === 0) return null;

              return {
                ...item,
                children: visibleChildren,
                path:
                  parentModuleAllowed && canAccessPath(role, item.path)
                    ? item.path
                    : visibleChildren[0].path,
              };
            })
            .filter(Boolean) as NavigationItem[];

          if (visibleItems.length === 0) return null;



          return (

            <div key={section.label} className="mb-6 last:mb-2">

              {!collapsed && (

                <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-MojaSchool-text-muted">

                  {section.label}

                </div>

              )}



              <nav className="space-y-1">

                {visibleItems.map((item) => {

                  const Icon = item.icon;



                  if (item.children && item.children.length > 0) {

                    if (collapsed) {

                      return (

                        <NavLink

                          key={item.path}

                          to={item.path}

                          end={item.path === "/"}

                          onClick={onClose}

                          title={item.label}

                          className={({ isActive }) =>

                            [

                              "flex min-h-11 items-center justify-center rounded-lg px-2 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-MojaSchool-500 focus-visible:ring-offset-1",

                              isActive

                                ? "bg-MojaSchool-50 text-MojaSchool-700"

                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",

                            ].join(" ")

                          }

                        >

                          <Icon size={18} strokeWidth={1.8} />

                        </NavLink>

                      );

                    }



                    return (

                      <div key={item.path}>

                        <NavLink

                          to={item.path}

                          end={item.path === "/"}

                          onClick={onClose}

                          className={({ isActive }) =>

                            [

                              "flex min-h-11 items-center gap-3 rounded-lg border-l-2 border-transparent px-3 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-MojaSchool-500 focus-visible:ring-offset-1",

                              isActive

                                ? "border-MojaSchool-600 bg-MojaSchool-50 text-MojaSchool-700 shadow-sm"

                                : "text-slate-600 hover:border-MojaSchool-200 hover:bg-slate-50 hover:text-slate-900",

                            ].join(" ")

                          }

                        >

                          <Icon size={18} strokeWidth={1.8} />

                          <span className="min-w-0 flex-1 truncate">

                            {item.label}

                          </span>

                          <ChevronDown

                            size={14}

                            strokeWidth={1.8}

                            className="shrink-0 text-slate-400"

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

                                onClick={onClose}

                                className={({ isActive }) =>

                                  [

                                    "flex min-h-10 items-center gap-2 rounded-lg border-l-2 border-transparent px-3 py-2 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-MojaSchool-500 focus-visible:ring-offset-1",

                                    isActive

                                      ? "border-MojaSchool-600 bg-MojaSchool-50 text-MojaSchool-700"

                                      : "text-slate-500 hover:border-MojaSchool-200 hover:bg-slate-50 hover:text-slate-900",

                                  ].join(" ")

                                }

                              >

                                <ChildIcon size={15} strokeWidth={1.8} />

                                <span className="min-w-0 truncate">

                                  {child.label}

                                </span>

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

                      onClick={onClose}

                      title={collapsed ? item.label : undefined}

                      className={({ isActive }) =>

                        [

                          "flex min-h-11 items-center rounded-lg border-l-2 border-transparent py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-MojaSchool-500 focus-visible:ring-offset-1",

                          collapsed ? "justify-center px-2" : "gap-3 px-3",

                          isActive

                            ? "border-MojaSchool-600 bg-MojaSchool-50 text-MojaSchool-700 shadow-sm"

                            : "text-slate-600 hover:border-MojaSchool-200 hover:bg-slate-50 hover:text-slate-900",

                        ].join(" ")

                      }

                    >

                      <Icon size={18} strokeWidth={1.8} />

                      {!collapsed && (

                        <span className="min-w-0 truncate">{item.label}</span>

                      )}

                    </NavLink>

                  );

                })}

              </nav>

            </div>

          );

        })}

      </div>



      <div className={"shrink-0 border-t border-slate-200 p-3 " + (collapsed ? "px-2" : "")}>

        <button

          type="button"

          onClick={() => void handleLogout()}

          title={collapsed ? "Logout" : undefined}

          className={"flex min-h-11 w-full items-center rounded-lg py-2.5 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1 " + (collapsed ? "justify-center px-2" : "gap-3 px-3")}

        >

          <LogOut size={18} strokeWidth={1.8} />

          {!collapsed && <span>Logout</span>}

        </button>

      </div>



      <button

        type="button"

        onClick={onToggleCollapse}

        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}

        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}

        className="absolute -right-3 top-[76px] z-10 hidden h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:text-slate-800 lg:flex"

      >

        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}

      </button>

    \</>

  );



  return (

    <>

      {/* Desktop sidebar */}

      <aside

        className={[

          "relative hidden h-screen shrink-0 border-r border-slate-200 bg-white transition-[width] duration-200 lg:flex lg:flex-col",

          collapsed ? "w-[78px]" : "w-64",

        ].join(" ")}

      >

        {sidebarContent}

      </aside>



      {/* Mobile sidebar */}

      {mobileOpen && (

        <div className="fixed inset-0 z-50 lg:hidden">

          <button

            type="button"

            aria-label="Close navigation"

            onClick={onClose}

            className="absolute inset-0 bg-slate-950/35 backdrop-blur-[1px]"

          />



          <aside className="relative flex h-full w-[min(86vw,20rem)] max-w-full flex-col border-r border-slate-200 bg-white shadow-2xl">

            {sidebarContent}

          </aside>

        </div>

      )}

    \</>

  );

}



type SchoolNotification = {

  id: string;

  title: string;

  description: string;

  createdAt: string;

};



function getNotificationReadStorageKey(userId: string | undefined) {

  return userId ? `mojaSchool.notificationReads.${userId}` : null;

}



function readNotificationIdsFromStorage(userId: string | undefined) {

  const key = getNotificationReadStorageKey(userId);



  if (!key) return new Set<string>();



  try {

    const value = window.localStorage.getItem(key);



    if (!value) return new Set<string>();



    const parsed = JSON.parse(value);



    if (!Array.isArray(parsed)) return new Set<string>();



    return new Set(parsed.filter((item): item is string => typeof item === "string"));

  } catch (error) {

    console.warn("Failed to read notification state:", error);

    return new Set<string>();

  }

}



function saveNotificationIdsToStorage(

  userId: string | undefined,

  ids: Set<string>,

) {

  const key = getNotificationReadStorageKey(userId);



  if (!key) return;



  try {

    window.localStorage.setItem(key, JSON.stringify(Array.from(ids)));

  } catch (error) {

    console.warn("Failed to save notification state:", error);

  }

}



function formatNotificationTime(value: string) {

  const date = new Date(value);



  if (Number.isNaN(date.getTime())) {

    return "";

  }



  const diffMinutes = Math.max(

    0,

    Math.floor((Date.now() - date.getTime()) / 60000),

  );



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



function Header({ onOpenNavigation }: { onOpenNavigation: () => void }) {

  const { school, membership } = useSchool();

  const { user } = useAuth();

  const navigate = useNavigate();

  const role = normalizeRole(membership?.role);



  const [notifications, setNotifications] = useState<SchoolNotification[]>([]);

  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(

    () => readNotificationIdsFromStorage(user?.id),

  );

  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const [notificationsError, setNotificationsError] = useState("");



  const notificationsRef = useRef<HTMLDivElement | null>(null);



  const unreadNotificationCount = notifications.reduce(

    (count, notification) =>

      readNotificationIds.has(notification.id) ? count : count + 1,

    0,

  );



  useEffect(() => {

    setReadNotificationIds(readNotificationIdsFromStorage(user?.id));

  }, [user?.id]);



  function markNotificationAsRead(notificationId: string) {

    setReadNotificationIds((current) => {

      if (current.has(notificationId)) return current;



      const next = new Set(current);

      next.add(notificationId);

      saveNotificationIdsToStorage(user?.id, next);

      return next;

    });

  }



  const metadataFirstName = user?.user_metadata?.first_name ?? "";

  const metadataLastName = user?.user_metadata?.last_name ?? "";



  const [parentFirstName, setParentFirstName] = useState("");

  const [parentLastName, setParentLastName] = useState("");



  useEffect(() => {

    if (role !== "Parent") {

      setParentFirstName("");

      setParentLastName("");

      return;

    }



    let cancelled = false;



    async function loadParentIdentity() {

      const { data, error } = await supabase.rpc("get_my_parent_membership");



      if (cancelled) return;



      if (error) {

        console.error("Failed to load parent identity:", error);

        return;

      }



      const identity = data as {

        first_name?: string | null;

        last_name?: string | null;

      } | null;



      setParentFirstName(identity?.first_name?.trim() ?? "");

      setParentLastName(identity?.last_name?.trim() ?? "");

    }



    void loadParentIdentity();



    return () => {

      cancelled = true;

    };

  }, [role]);



  const firstName =

    role === "Parent"

      ? parentFirstName || metadataFirstName

      : metadataFirstName;

  const lastName =

    role === "Parent" ? parentLastName || metadataLastName : metadataLastName;



  const fullName = `${firstName} ${lastName}`.trim() || "School Admin";



  const initials =

    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "SA";



  useEffect(() => {

    /*

     \* Parent announcements are loaded through the same RPC used by the

     \* Parent Announcements page. The RPC resolves the authenticated parent

     \* from auth.uid()/email, so the notification bell does not depend on

     \* reading the announcements table directly.

     \*

     \* Staff notifications still use the normal school-scoped table query.

     */

    if (role !== "Parent" && !school?.id) {

      setNotifications([]);

      setNotificationsLoading(false);

      setNotificationsError("");

      return;

    }



    const schoolId = school?.id ?? "";

    let cancelled = false;



    async function loadNotifications() {

      if (cancelled) return;



      setNotificationsLoading(true);

      setNotificationsError("");



      try {

        if (role === "Parent") {

          /*

           \* IMPORTANT:

           \* Announcements(4).tsx uses get_my_parent_announcements().

           \* Use the exact same RPC here. Do not use get_parent_announcements()

           \* with a school_id parameter because that is a different function

           \* signature and was causing the bell and announcement page to use

           \* different data paths.

           */

          const { data, error } = await supabase.rpc(

            "get_my_parent_announcements",

          );



          if (cancelled) return;



          if (error) {

            console.error(

              "Failed to load parent notifications:",

              error,

            );

            setNotifications([]);

            setNotificationsError(

              error.message || "Unable to load school notifications.",

            );

            return;

          }



          const parentAnnouncements = (data ?? [])

            .filter((item: {

              audience_type?: string | null;

              publish_date?: string | null;

              expiry_date?: string | null;

            }) => {

              if (

                !["All School", "Parents"].includes(

                  item.audience_type ?? "",

                )

              ) {

                return false;

              }



              if (

                item.publish_date &&

                new Date(item.publish_date).getTime() > Date.now()

              ) {

                return false;

              }



              if (

                item.expiry_date &&

                new Date(item.expiry_date).getTime() < Date.now()

              ) {

                return false;

              }



              return true;

            })

            .slice(0, 6);



          setNotifications(

            parentAnnouncements.map(

              (item: {

                id: string;

                title?: string | null;

                content?: string | null;

                created_at: string;

              }) => {

                const cleanContent = (item.content ?? "")

                  .replace(/\s+/g, " ")

                  .trim();



                return {

                  id: item.id,

                  title: item.title || "School announcement",

                  description:

                    cleanContent.length > 110

                      ? `${cleanContent.slice(0, 110)}...`

                      : cleanContent || "New school announcement",

                  createdAt: item.created_at,

                };

              },

            ),

          );



          return;

        }



        /*

         \* Staff users continue to use the normal announcements query.

         */

        const now = new Date().toISOString();



        const { data, error } = await supabase

          .from("announcements")

          .select(

            "id, title, content, created_at, status, audience_type, publish_date, expiry_date, priority",

          )

          .eq("school_id", schoolId)

          .eq("status", "Published")

          .or(`publish_date.is.null,publish_date.lte.${now}`)

          .order("created_at", { ascending: false })

          .limit(50);



        if (cancelled) return;



        if (error) {

          console.error("Failed to load notifications:", error);

          setNotifications([]);

          setNotificationsError(

            error.message || "Unable to load school notifications.",

          );

          return;

        }



        const visibleAnnouncements = (data ?? [])

          .filter((item) => {

            if (

              item.expiry_date &&

              new Date(item.expiry_date).getTime() < Date.now()

            ) {

              return false;

            }



            if (role === "Teacher") {

              return ["All School", "Teachers", "Staff"].includes(

                item.audience_type ?? "",

              );

            }



            return true;

          })

          .slice(0, 6);



        setNotifications(

          visibleAnnouncements.map((item) => {

            const cleanContent = (item.content ?? "")

              .replace(/\s+/g, " ")

              .trim();



            return {

              id: item.id,

              title: item.title || "School announcement",

              description:

                cleanContent.length > 110

                  ? `${cleanContent.slice(0, 110)}...`

                  : cleanContent || "New school announcement",

              createdAt: item.created_at,

            };

          }),

        );

      } catch (error) {

        if (cancelled) return;



        console.error("Notification loading failed:", error);

        setNotifications([]);

        setNotificationsError(

          error instanceof Error

            ? error.message

            : "Unable to load school notifications.",

        );

      } finally {

        if (!cancelled) {

          setNotificationsLoading(false);

        }

      }

    }



    function refreshNotifications() {

      void loadNotifications();

    }



    void loadNotifications();



    /*

     \* Realtime and periodic refresh are useful for staff. For parents, the

     \* RPC remains the source of truth; the same refresh triggers are still

     \* harmless and keep the bell current while the parent is logged in.

     */

    let channel: ReturnType<typeof supabase.channel> | null = null;



    if (schoolId) {

      channel = supabase

        .channel(`school-announcements-${schoolId}-${role}`)

        .on(

          "postgres_changes",

          {

            event: "\*",

            schema: "public",

            table: "announcements",

            filter: `school_id=eq.${schoolId}`,

          },

          () => {

            refreshNotifications();

          },

        )

        .subscribe();

    }



    const intervalId = window.setInterval(refreshNotifications, 30_000);



    window.addEventListener("focus", refreshNotifications);



    return () => {

      cancelled = true;

      window.clearInterval(intervalId);

      window.removeEventListener("focus", refreshNotifications);



      if (channel) {

        void supabase.removeChannel(channel);

      }

    };

  }, [school?.id, role]);



  useEffect(() => {

    if (!notificationsOpen) return;



    function handleOutsideClick(event: MouseEvent) {

      if (

        notificationsRef.current &&

        !notificationsRef.current.contains(event.target as Node)

      ) {

        setNotificationsOpen(false);

      }

    }



    document.addEventListener("mousedown", handleOutsideClick);



    return () => {

      document.removeEventListener("mousedown", handleOutsideClick);

    };

  }, [notificationsOpen]);



  function openNotifications() {

    setNotificationsOpen((current) => !current);

  }



  function openAnnouncement(announcementId?: string) {

    if (announcementId) {

      markNotificationAsRead(announcementId);

    }



    setNotificationsOpen(false);



    if (announcementId) {

      navigate(`/announcements?id=${encodeURIComponent(announcementId)}`);

      return;

    }



    navigate("/announcements");

  }



  return (

    <header className="relative z-40 flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 sm:min-h-20 sm:px-5 lg:px-8">

      <div className="flex min-w-0 items-center gap-2.5">

        <button

          type="button"

          onClick={onOpenNavigation}

          aria-label="Open navigation"

          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-MojaSchool-500 focus-visible:ring-offset-2 lg:hidden"

        >

          <Menu size={20} />

        </button>



        <div className="min-w-0">

          <div className="text-xs text-MojaSchool-text-muted sm:text-sm">School</div>



          <div className="mt-0.5 max-w-[52vw] truncate text-sm font-semibold text-slate-900 sm:max-w-[60vw]">

            {school?.name ?? "School"}

          </div>

        </div>

      </div>



      <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">

        <div ref={notificationsRef} className="relative">

          <button

            type="button"

            aria-label="Notifications"

            aria-expanded={notificationsOpen}

            aria-haspopup="true"

            onClick={openNotifications}

            className={[

              "relative flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-MojaSchool-500 focus-visible:ring-offset-2",

              notificationsOpen

                ? "bg-MojaSchool-50 text-MojaSchool-700"

                : "hover:bg-slate-100",

            ].join(" ")}

          >

            {unreadNotificationCount > 0 && (

              <span

                aria-hidden="true"

                className="absolute right-0.5 top-0.5 z-10 h-2.5 w-2.5 rounded-full bg-blue-600 ring-2 ring-white"

              />

            )}

            <Bell size={18} strokeWidth={1.8} />

          </button>



          {notificationsOpen && (

            <div className="absolute right-0 top-12 z-50 w-[min(92vw,22rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">

              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">

                <div>

                  <h2 className="text-sm font-semibold text-slate-900">

                    Notifications

                  </h2>

                  <p className="mt-0.5 text-xs text-slate-500">

                    Recent school announcements

                  </p>

                </div>



                <button

                  type="button"

                  onClick={() => setNotificationsOpen(false)}

                  aria-label="Close notifications"

                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-MojaSchool-500 focus-visible:ring-offset-1"

                >

                  <X size={16} />

                </button>

              </div>



              <div className="max-h-[min(65vh,24rem)] overflow-y-auto">

                {notificationsLoading ? (

                  <div className="px-4 py-8 text-center text-sm text-slate-500">

                    Loading notifications...

                  </div>

                ) : notificationsError ? (

                  <div className="px-4 py-6 text-center text-sm text-red-600">

                    {notificationsError}

                  </div>

                ) : notifications.length === 0 ? (

                  <div className="px-4 py-8 text-center">

                    <Bell

                      size={22}

                      className="mx-auto text-slate-300"

                      strokeWidth={1.6}

                    />

                    <p className="mt-3 text-sm font-medium text-slate-700">

                      No notifications

                    </p>

                    <p className="mt-1 text-xs text-slate-500">

                      New school announcements will appear here.

                    </p>

                  </div>

                ) : (

                  <div className="divide-y divide-slate-100">

                    {notifications.map((notification) => {

                      const isRead = readNotificationIds.has(notification.id);



                      return (

                        <button

                          key={notification.id}

                          type="button"

                          onClick={() => openAnnouncement(notification.id)}

                          className={`flex w-full gap-3 px-4 py-3.5 text-left transition focus:outline-none focus-visible:bg-MojaSchool-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-MojaSchool-500 ${

                            isRead ? "bg-white hover:bg-slate-50" : "bg-MojaSchool-50/35 hover:bg-MojaSchool-50/70"

                          }`}

                        >

                          <span

                            aria-hidden="true"

                            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${

                              isRead ? "bg-transparent" : "bg-blue-600"

                            }`}

                          />



                          <span className="min-w-0">

                            <span

                              className={`block break-words text-sm text-slate-900 ${

                                isRead ? "font-medium" : "font-semibold"

                              }`}

                            >

                              {notification.title}

                            </span>

                          <span className="mt-0.5 block text-xs text-slate-500">

                            {notification.description}

                          </span>

                            <span className="mt-1 block text-[11px] text-slate-400">

                              {formatNotificationTime(notification.createdAt)}

                            </span>

                          </span>

                        </button>

                      );

                    })}

                  </div>

                )}

              </div>



              <div className="border-t border-slate-200 p-2">

                {unreadNotificationCount > 0 && (

                  <div className="px-2 pb-2 text-center text-[11px] font-medium text-blue-600">

                    {unreadNotificationCount} unread notification{unreadNotificationCount === 1 ? "" : "s"}

                  </div>

                )}

                <button

                  type="button"

                  onClick={() => openAnnouncement()}

                  className="flex w-full items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-MojaSchool-600 transition hover:bg-MojaSchool-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-MojaSchool-500"

                >

                  View all announcements

                </button>

              </div>

            </div>

          )}

        </div>



        <button

          type="button"

          onClick={() => navigate("/profile")}

          aria-label="Open my profile"

          className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-MojaSchool-500 focus-visible:ring-offset-2 sm:gap-3"

        >

          <div className="hidden text-right md:block">

            <div className="max-w-[180px] truncate text-sm font-semibold text-slate-900">

              {fullName}

            </div>



            <div className="text-xs capitalize text-slate-500">

              {membership?.role ?? "Administrator"}

            </div>

          </div>



          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-MojaSchool-100 text-sm font-semibold text-MojaSchool-700 ring-1 ring-MojaSchool-200">

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

        <h1 className="mt-4 text-xl font-semibold text-slate-900">

          Access denied

        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-500">

          You do not have permission to access this section of MojaSchool.

        </p>

        <NavLink

          to="/"

          className="mt-5 inline-flex items-center justify-center rounded-lg bg-MojaSchool-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-MojaSchool-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-MojaSchool-500 focus-visible:ring-offset-2"

        >

          Back to dashboard

        </NavLink>

      </div>

    </div>

  );

}



export default function AppLayout() {

  const { membership, loading: schoolLoading, isModuleEnabled } = useSchool();

  const location = useLocation();

  const role = normalizeRole(membership?.role);

  const hasLoadedRole = Boolean(membership?.role);
  const roleAllowed = !hasLoadedRole || canAccessPath(role, location.pathname);
  const requiredModule = getRequiredModule(location.pathname);
  const moduleAllowed = !requiredModule || isModuleEnabled(requiredModule);
  const allowed = roleAllowed && moduleAllowed;



  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);



  useEffect(() => {

    setMobileNavigationOpen(false);

  }, [location.pathname]);



  useEffect(() => {

    if (!mobileNavigationOpen) return;



    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";



    return () => {

      document.body.style.overflow = previousOverflow;

    };

  }, [mobileNavigationOpen]);



  return (

    <div className="flex h-screen overflow-hidden bg-MojaSchool-background">

      <Sidebar

        mobileOpen={mobileNavigationOpen}

        onClose={() => setMobileNavigationOpen(false)}

        collapsed={sidebarCollapsed}

        onToggleCollapse={() => setSidebarCollapsed((value) => !value)}

      />



      <div className="flex min-h-0 min-w-0 flex-1 flex-col">

        <Header onOpenNavigation={() => setMobileNavigationOpen(true)} />



        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 lg:p-8">

          {schoolLoading ? (
            <div className="flex min-h-[60vh] items-center justify-center">
              <p className="text-sm text-slate-500">Loading school configuration...</p>
            </div>
          ) : allowed ? (
            <Outlet />
          ) : (
            <AccessDenied />
          )}

        </main>

      </div>

    </div>

  );

}
