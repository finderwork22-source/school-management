import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  MoreHorizontal,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";

import { useSchool } from "../context/SchoolContext";
import { supabase } from "../lib/supabase";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";

type Role =
  | "Owner"
  | "CEO"
  | "Principal"
  | "Head of Academics"
  | "Secretary"
  | "Teacher";

type MemberStatus = "Active" | "Pending" | "Suspended";

interface SchoolMember {
  id: string;
  school_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

interface UserRow {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: Role;
  status: MemberStatus;
  joinedAt: string;
  isCurrentUser: boolean;
}

interface RoleDefinition {
  role: Role;
  description: string;
  access: string[];
  finance: "Full" | "Limited" | "None";
}

const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    role: "Owner",
    description: "Full system ownership and unrestricted school access.",
    access: ["School", "Academics", "Finance", "Users & Roles", "Settings"],
    finance: "Full",
  },
  {
    role: "CEO",
    description: "Full system access and school-wide oversight.",
    access: ["School", "Academics", "Finance", "Users & Roles", "Settings"],
    finance: "Full",
  },
  {
    role: "Principal",
    description: "Full school access and operational oversight.",
    access: ["School", "Academics", "Finance", "Users & Roles", "Settings"],
    finance: "Full",
  },
  {
    role: "Head of Academics",
    description: "Manages academic operations without financial access.",
    access: ["Students", "Teachers", "Academics", "Attendance", "Assessments"],
    finance: "None",
  },
  {
    role: "Secretary",
    description: "School operations with limited payment recording.",
    access: ["Students", "Parents", "Admissions", "Payments"],
    finance: "Limited",
  },
  {
    role: "Teacher",
    description: "Teaching, attendance, assessments and student support.",
    access: ["Students", "Academics", "Attendance", "Assessments"],
    finance: "None",
  },
];

const ROLE_OPTIONS: Role[] = [
  "Owner",
  "CEO",
  "Principal",
  "Head of Academics",
  "Secretary",
  "Teacher",
];

function normalizeRole(value: string): Role {
  const normalized = value.trim().toLowerCase();

  if (normalized === "owner") return "Owner";
  if (normalized === "ceo") return "CEO";
  if (normalized === "principal") return "Principal";
  if (normalized === "head of academics" || normalized === "head_of_academics") {
    return "Head of Academics";
  }
  if (normalized === "secretary") return "Secretary";
  if (normalized === "teacher") return "Teacher";

  return "Teacher";
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "U";
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function getRoleDescription(role: Role) {
  return (
    ROLE_DEFINITIONS.find((item) => item.role === role)?.description ??
    "SchoolOS user."
  );
}

export default function UsersRoles() {
  const { school } = useSchool();

  const [members, setMembers] = useState<SchoolMember[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [currentUserName, setCurrentUserName] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All roles");

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showRoles, setShowRoles] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState("");

  async function loadData() {
    if (!school) {
      setMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be signed in to manage users.");
      setLoading(false);
      return;
    }

    setCurrentUserId(user.id);
    setCurrentUserEmail(user.email ?? "");

    const metadata = user.user_metadata ?? {};
    const firstName = typeof metadata.first_name === "string" ? metadata.first_name : "";
    const lastName = typeof metadata.last_name === "string" ? metadata.last_name : "";

    setCurrentUserName(
      `${firstName} ${lastName}`.trim() ||
        (typeof metadata.full_name === "string" ? metadata.full_name : "") ||
        user.email ||
        "Current user",
    );

    const { data, error: membersError } = await supabase
      .from("school_members")
      .select("id, school_id, user_id, role, created_at")
      .eq("school_id", school.id)
      .order("created_at", { ascending: true });

    if (membersError) {
      setError(membersError.message);
      setMembers([]);
      setLoading(false);
      return;
    }

    setMembers((data ?? []) as SchoolMember[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, [school]);

  const users = useMemo<UserRow[]>(() => {
    return members.map((member) => {
      const isCurrentUser = member.user_id === currentUserId;

      return {
        id: member.id,
        userId: member.user_id,
        name: isCurrentUser ? currentUserName : "School user",
        email: isCurrentUser ? currentUserEmail : "User account",
        role: normalizeRole(member.role),
        status: "Active",
        joinedAt: member.created_at,
        isCurrentUser,
      };
    });
  }, [members, currentUserEmail, currentUserId, currentUserName]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !query ||
        user.name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.role.toLowerCase().includes(query);

      const matchesRole =
        roleFilter === "All roles" || user.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  const roleCounts = useMemo(() => {
    const counts: Record<Role, number> = {
      Owner: 0,
      CEO: 0,
      Principal: 0,
      "Head of Academics": 0,
      Secretary: 0,
      Teacher: 0,
    };

    users.forEach((user) => {
      counts[user.role] += 1;
    });

    return counts;
  }, [users]);

  function openRole(role: Role) {
    setSelectedRole(role);
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <ShieldCheck size={19} />
            </div>

            <div>
              <h1 className="text-xl font-semibold text-slate-900">
                Users &amp; Roles
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Manage school users and control what each role can access.
              </p>
            </div>
          </div>
        </div>

        <Button onClick={() => setShowInviteModal(true)}>
          <Plus size={16} />
          Invite user
        </Button>
      </div>

      {error && (
        <div className="mb-5 flex items-center justify-between rounded-xl border border-red-100 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-600">{error}</p>

          <button
            type="button"
            onClick={() => setError("")}
            className="text-red-400 hover:text-red-600"
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Total users"
          value={users.length}
          icon={<Users size={18} />}
        />

        <SummaryCard
          label="Teachers"
          value={roleCounts.Teacher}
          icon={<UserRound size={18} />}
        />

        <SummaryCard
          label="Administrators"
          value={
            roleCounts.Owner +
            roleCounts.CEO +
            roleCounts.Principal +
            roleCounts["Head of Academics"]
          }
          icon={<ShieldCheck size={18} />}
        />

        <SummaryCard
          label="Operational"
          value={roleCounts.Secretary}
          icon={<UserRound size={18} />}
        />
      </div>

      <Card className="mb-5">
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              School users
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Each user receives access based on their assigned role.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-[260px]">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search users..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option>All roles</option>
              {ROLE_OPTIONS.map((role) => (
                <option key={role}>{role}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center border-t border-slate-100">
            <p className="text-sm text-slate-500">Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="border-t border-slate-100 p-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
              <Users size={22} />
            </div>

            <h3 className="mt-4 text-sm font-semibold text-slate-800">
              No users found
            </h3>

            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
              {users.length === 0
                ? "Invite staff members to give them access to SchoolOS."
                : "Try a different search or role filter."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border-t border-slate-100">
            <table className="w-full min-w-[850px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-left">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    User
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Role
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Joined
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700">
                          {getInitials(user.name)}
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-900">
                            {user.name}
                            {user.isCurrentUser && (
                              <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700">
                                You
                              </span>
                            )}
                          </div>

                          <div className="truncate text-xs text-slate-500">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => openRole(user.role)}
                        className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                      >
                        {user.role}
                      </button>
                    </td>

                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        {user.status}
                      </span>
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-500">
                      {formatDate(user.joinedAt)}
                    </td>

                    <td className="px-5 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => openRole(user.role)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        aria-label={`View ${user.role} permissions`}
                      >
                        <MoreHorizontal size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <button
          type="button"
          onClick={() => setShowRoles((current) => !current)}
          className="flex w-full items-center justify-between px-5 py-4 text-left"
        >
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Role access
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              High Gate's predefined SchoolOS roles and their access levels.
            </p>
          </div>

          <ChevronDown
            size={17}
            className={[
              "text-slate-400 transition-transform",
              showRoles ? "rotate-180" : "",
            ].join(" ")}
          />
        </button>

        {showRoles && (
          <div className="border-t border-slate-100 p-5">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {ROLE_DEFINITIONS.map((definition) => (
                <button
                  key={definition.role}
                  type="button"
                  onClick={() => openRole(definition.role)}
                  className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-indigo-200 hover:bg-indigo-50/40"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        {definition.role}
                      </h3>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {definition.description}
                      </p>
                    </div>

                    <span
                      className={[
                        "shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold",
                        definition.finance === "Full"
                          ? "bg-emerald-50 text-emerald-700"
                          : definition.finance === "Limited"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-100 text-slate-500",
                      ].join(" ")}
                    >
                      Finance: {definition.finance}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {definition.access.map((item) => (
                      <span
                        key={item}
                        className="rounded-md bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-600"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {inviteSuccess && (
        <div className="mb-5 flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
          <p className="text-sm text-emerald-700">{inviteSuccess}</p>
          <button
            type="button"
            onClick={() => setInviteSuccess("")}
            className="text-emerald-500 hover:text-emerald-700"
            aria-label="Dismiss success message"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {showInviteModal && (
        <InviteUserModal
          onClose={() => setShowInviteModal(false)}
          onCreated={(message) => {
            setShowInviteModal(false);
            setInviteSuccess(message);
            void loadData();
          }}
        />
      )}

      {selectedRole && (
        <RoleDetailsModal
          role={selectedRole}
          onClose={() => setSelectedRole(null)}
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {label}
          </p>

          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {value}
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          {icon}
        </div>
      </div>
    </Card>
  );
}

function RoleDetailsModal({
  role,
  onClose,
}: {
  role: Role;
  onClose: () => void;
}) {
  const definition =
    ROLE_DEFINITIONS.find((item) => item.role === role) ??
    ROLE_DEFINITIONS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">
              Role permissions
            </p>

            <h2 className="mt-1 text-lg font-semibold text-slate-900">
              {definition.role}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-5">
          <p className="text-sm leading-6 text-slate-500">
            {definition.description}
          </p>

          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Finance access
            </p>

            <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">
                {definition.finance}
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                {definition.finance === "Full"
                  ? "Can access and manage the finance area."
                  : definition.finance === "Limited"
                    ? "Can record operational payments and view basic student payment information, but cannot manage accounting controls."
                    : "Finance is not available to this role."}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Main access
            </p>

            <div className="mt-2 space-y-2">
              {definition.access.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2.5"
                >
                  <Check size={15} className="text-emerald-600" />
                  <span className="text-sm text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-100 px-5 py-4">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function InviteUserModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (message: string) => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("Teacher");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanFirstName || !cleanLastName || !cleanEmail) {
      setError("Please complete all required fields.");
      return;
    }

    setSaving(true);
    setError("");

    const { data, error: functionError } = await supabase.functions.invoke(
      "invite-school-user",
      {
        body: {
          firstName: cleanFirstName,
          lastName: cleanLastName,
          email: cleanEmail,
          role,
        },
      },
    );

    if (functionError) {
      setError(functionError.message || "Unable to send the invitation.");
      setSaving(false);
      return;
    }

    if (!data?.success) {
      setError(data?.error || "Unable to send the invitation.");
      setSaving(false);
      return;
    }

    onCreated(
      `Invitation sent to ${cleanEmail}. They were assigned the ${role} role.`,
    );
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Invite user
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Create an access request for a school staff member.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="First name"
                value={firstName}
                onChange={setFirstName}
                required
              />

              <Field
                label="Last name"
                value={lastName}
                onChange={setLastName}
                required
              />
            </div>

            <Field
              label="Email address"
              value={email}
              onChange={setEmail}
              type="email"
              placeholder="name@school.com"
              required
            />

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                Role
              </label>

              <select
                value={role}
                onChange={(event) => setRole(event.target.value as Role)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                {ROLE_OPTIONS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                {getRoleDescription(role)}
              </p>
            </div>

            {error && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
              <p className="text-xs font-semibold text-indigo-900">
                What happens next?
              </p>

              <p className="mt-1 text-xs leading-5 text-indigo-700">
                The staff member will receive a secure Supabase invitation email.
                Their SchoolOS account will be created with the selected role and
                linked to this school.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-3 border-t border-slate-100 bg-white px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Sending invitation..." : "Send invitation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-700">
        {label}
      </span>

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />
    </label>
  );
}
