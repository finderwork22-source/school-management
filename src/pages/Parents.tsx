import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Users,
  UserPlus,
  Phone,
  Mail,
  ChevronRight,
  X,
  Plus,
  Trash2,
  Loader2,
  Send,
  CheckCircle2,
  Edit3,
  Save,
} from "lucide-react";

import { useSchool } from "../context/SchoolContext";
import { supabase } from "../lib/supabase";
import { getClasses, type SchoolClass } from "../lib/classes";
import {
  getParents,
  getStudentsForParent,
  createParent,
  updateParent,
  type Parent,
  type CreateParentChild,
} from "../lib/parents";

import Card from "../components/ui/Card";
import Avatar from "../components/ui/Avatar";
import PageHeader from "../components/ui/PageHeader";

export default function Parents() {
  const { school } = useSchool();

  const [parents, setParents] = useState<Parent[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

  const [selectedParent, setSelectedParent] = useState<Parent | null>(null);

  const [showAddParent, setShowAddParent] = useState(false);

  const [editingParent, setEditingParent] = useState<Parent | null>(null);

  const [invitingParentId, setInvitingParentId] = useState<string | null>(null);

  const [inviteMessage, setInviteMessage] = useState("");

  async function handleInviteParent(parent: Parent) {
    setError("");
    setInviteMessage("");

    if (!parent.email?.trim()) {
      setError(
        `${parent.name} does not have an email address. Add an email address before sending the invitation.`,
      );
      return;
    }

    if (parent.user_id) {
      setError(`${parent.name} already has an active account.`);
      return;
    }

    if (!school) {
      setError("No school is currently selected.");
      return;
    }

    setInvitingParentId(parent.id);

    try {
      const { data, error: functionError } =
        await supabase.functions.invoke("invite-parent", {
          body: {
            parentId: parent.id,
          },
        });

      if (functionError) {
        console.error(
          "Parent invitation function error:",
          functionError,
        );

        throw new Error(
          functionError.message ||
            "We could not send the parent invitation.",
        );
      }

      if (!data?.success) {
        throw new Error(
          data?.error ||
            "We could not send the parent invitation.",
        );
      }

      setInviteMessage(
        `Invitation sent successfully to ${parent.email}.`,
      );

      const {
        data: refreshedParents,
        error: refreshError,
      } = await getParents(school.id);

      if (refreshError) {
        console.error(
          "Failed to refresh parents after invitation:",
          refreshError,
        );
      } else {
        setParents(refreshedParents);

        const refreshedParent = refreshedParents.find(
          (item) => item.id === parent.id,
        );

        if (refreshedParent) {
          setSelectedParent(refreshedParent);
        }
      }
    } catch (caughtError) {
      console.error(
        "Failed to invite parent:",
        caughtError,
      );

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "We could not send the parent invitation.",
      );
    } finally {
      setInvitingParentId(null);
    }
  }

  useEffect(() => {
    async function loadParents() {
      if (!school) {
        setParents([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      const { data, error: parentsError } = await getParents(school.id);

      if (parentsError) {
        console.error("Failed to load parents:", parentsError);

        setError(parentsError.message);
        setParents([]);
      } else {
        setParents(data);
      }

      setLoading(false);
    }

    loadParents();
  }, [school]);

  const filteredParents = useMemo(() => {
    const query = search.toLowerCase().trim();

    if (!query) {
      return parents;
    }

    return parents.filter((parent) => {
      return (
        parent.name.toLowerCase().includes(query) ||
        parent.phone?.toLowerCase().includes(query) ||
        parent.email?.toLowerCase().includes(query) ||
        parent.children.some(
          (child) =>
            child.name.toLowerCase().includes(query) ||
            child.studentId.toLowerCase().includes(query),
        )
      );
    });
  }, [parents, search]);

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          eyebrow="School"
          title="Parents"
          description="Manage parents and guardians linked to your students."
        />

        <button
          type="button"
          onClick={() => setShowAddParent(true)}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
        >
          <UserPlus size={17} />
          Add parent
        </button>
      </div>

      <Card className="overflow-hidden">
        {/* Search */}
        <div className="border-b border-slate-200 p-4">
          <div className="relative max-w-xl">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search parents or students..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        {/* Summary */}
        <div className="border-b border-slate-200 px-5 py-3">
          <p className="text-sm text-slate-500">
            Showing{" "}
            <span className="font-medium text-slate-900">
              {filteredParents.length}
            </span>{" "}
            parents
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="border-b border-red-100 bg-red-50 px-5 py-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {inviteMessage && (
          <div className="border-b border-emerald-100 bg-emerald-50 px-5 py-3">
            <div className="flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 size={16} />
              <span>{inviteMessage}</span>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <p className="text-sm text-slate-500">Loading parents...</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredParents.map((parent) => (
              <div
                key={parent.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedParent(parent)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedParent(parent);
                  }
                }}
                className="group flex w-full cursor-pointer items-center gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
              >
                <Avatar name={parent.name} />

                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-900 group-hover:text-indigo-700">
                    {parent.name}
                  </div>

                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    {parent.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone size={12} />
                        {parent.phone}
                      </span>
                    )}

                    {parent.email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail size={12} />
                        {parent.email}
                      </span>
                    )}
                  </div>
                </div>

                <div className="hidden items-center gap-4 sm:flex">
                  <div className="flex items-center gap-2">
                    <Users size={15} className="text-slate-400" />

                    <span className="text-sm text-slate-600">
                      {parent.childrenCount}{" "}
                      {parent.childrenCount === 1 ? "child" : "children"}
                    </span>
                  </div>

                  {parent.user_id ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      <CheckCircle2 size={13} />
                      Active
                    </span>
                  ) : parent.email ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleInviteParent(parent);
                      }}
                      disabled={invitingParentId === parent.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {invitingParentId === parent.id ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send size={13} />
                          Invite Parent
                        </>
                      )}
                    </button>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                      No email
                    </span>
                  )}
                </div>

                <ChevronRight
                  size={17}
                  className="text-slate-300 transition group-hover:text-indigo-500"
                />
              </div>
            ))}

            {filteredParents.length === 0 && (
              <div className="px-5 py-16 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <Users size={18} />
                </div>

                <h3 className="mt-3 text-sm font-semibold text-slate-900">
                  No parents found
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Try changing your search.
                </p>
              </div>
            )}
          </div>
        )}
      </Card>

      {showAddParent && school && (
        <AddParentModal
          schoolId={school.id}
          onClose={() => setShowAddParent(false)}
          onSaved={async () => {
            setShowAddParent(false);
            setLoading(true);
            const { data, error: refreshError } = await getParents(school.id);

            if (refreshError) {
              setError(refreshError.message);
            } else {
              setParents(data);
            }

            setLoading(false);
          }}
        />
      )}

      {selectedParent && (
        <ParentDetails
          parent={selectedParent}
          onClose={() => setSelectedParent(null)}
          onEdit={() => setEditingParent(selectedParent)}
        />
      )}

      {editingParent && school && (
        <EditParentModal
          parent={editingParent}
          schoolId={school.id}
          onClose={() => setEditingParent(null)}
          onSaved={(updatedParent) => {
            setParents((current) =>
              current.map((parent) =>
                parent.id === updatedParent.id
                  ? updatedParent
                  : parent,
              ),
            );
            setSelectedParent(updatedParent);
            setEditingParent(null);
            setInviteMessage("");
            setError("");
          }}
        />
      )}
    </div>
  );
}

interface ParentStudentOption {
  id: string;
  name: string;
  studentId: string;
  className: string;
}

interface SelectedChild extends CreateParentChild {
  name: string;
  studentIdLabel: string;
  className: string;
}

function AddParentModal({
  schoolId,
  onClose,
  onSaved,
}: {
  schoolId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  const [students, setStudents] = useState<ParentStudentOption[]>([]);
  const [schoolClasses, setSchoolClasses] = useState<SchoolClass[]>([]);
  const [children, setChildren] = useState<SelectedChild[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [studentSearch, setStudentSearch] = useState("");

  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      setLoadingStudents(true);
      setLoadingClasses(true);
      setError("");

      const [
        { data: studentData, error: studentsError },
        { data: classData, error: classesError },
      ] = await Promise.all([
        getStudentsForParent(schoolId),
        getClasses(schoolId),
      ]);

      if (studentsError) {
        setError(studentsError.message);
        setStudents([]);
      } else {
        setStudents(studentData);
      }

      if (classesError) {
        setError(classesError.message);
        setSchoolClasses([]);
      } else {
        setSchoolClasses(classData.filter((item) => item.is_active));
      }

      setLoadingStudents(false);
      setLoadingClasses(false);
    }

    loadData();
  }, [schoolId]);

  const availableStudents = students.filter((student) => {
    const matchesClass =
      selectedClassId === "all" ||
      schoolClasses.some(
        (schoolClass) =>
          schoolClass.id === selectedClassId &&
          schoolClass.name === student.className,
      );

    const query = studentSearch.toLowerCase().trim();

    const matchesSearch =
      !query ||
      student.name.toLowerCase().includes(query) ||
      student.studentId.toLowerCase().includes(query);

    const notAlreadyLinked = !children.some(
      (child) => child.studentId === student.id,
    );

    return matchesClass && matchesSearch && notAlreadyLinked;
  });

  function addChild() {
    const student = students.find((item) => item.id === selectedStudentId);

    if (!student) return;

    setChildren((current) => [
      ...current,
      {
        studentId: student.id,
        name: student.name,
        studentIdLabel: student.studentId,
        className: student.className,
        relationship: "Parent / Guardian",
        isPrimary: current.length === 0,
      },
    ]);

    setSelectedStudentId("");
  }

  function removeChild(studentId: string) {
    setChildren((current) => {
      const next = current.filter((child) => child.studentId !== studentId);

      if (next.length > 0 && !next.some((child) => child.isPrimary)) {
        next[0].isPrimary = true;
      }

      return next;
    });
  }

  function updateChild(
    studentId: string,
    field: "relationship" | "isPrimary",
    value: string | boolean,
  ) {
    setChildren((current) =>
      current.map((child) => {
        if (field === "isPrimary") {
          return {
            ...child,
            isPrimary: child.studentId === studentId ? Boolean(value) : false,
          };
        }

        return child.studentId === studentId
          ? {
              ...child,
              relationship: String(value),
            }
          : child;
      }),
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!firstName.trim()) {
      setError("First name is required.");
      return;
    }

    if (!phone.trim()) {
      setError("Phone number is required.");
      return;
    }

    if (children.length === 0) {
      setError("Please link at least one student to this parent.");
      return;
    }

    setSaving(true);
    setError("");

    const result = await createParent({
      schoolId,
      firstName,
      lastName,
      phone,
      email,
      address,
      children: children.map(({ studentId, relationship, isPrimary }) => ({
        studentId,
        relationship,
        isPrimary,
      })),
    });

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    await onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <form
        onSubmit={handleSubmit}
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Add parent</h2>
            <p className="mt-1 text-sm text-slate-500">
              Create a parent or guardian and link their children.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-5 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="space-y-7 p-6">
          <section>
            <h3 className="text-sm font-semibold text-slate-900">
              Personal information
            </h3>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
              />

              <Field
                label="Phone"
                value={phone}
                onChange={setPhone}
                required
                type="tel"
              />

              <Field
                label="Email"
                value={email}
                onChange={setEmail}
                type="email"
              />

              <div className="sm:col-span-2">
                <Field
                  label="Address"
                  value={address}
                  onChange={setAddress}
                  placeholder="e.g. Kigali, Rwanda"
                />
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Children
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Link one or more existing students.
                </p>
              </div>

              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                {children.length} linked
              </span>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="grid gap-3 md:grid-cols-[220px_1fr]">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Filter by class
                  </label>

                  <select
                    value={selectedClassId}
                    onChange={(event) => {
                      setSelectedClassId(event.target.value);
                      setSelectedStudentId("");
                    }}
                    disabled={loadingClasses}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="all">
                      {loadingClasses
                        ? "Loading classes..."
                        : "All active classes"}
                    </option>

                    {schoolClasses.map((schoolClass) => (
                      <option key={schoolClass.id} value={schoolClass.id}>
                        {schoolClass.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Search student
                  </label>

                  <div className="relative">
                    <Search
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      value={studentSearch}
                      onChange={(event) => {
                        setStudentSearch(event.target.value);
                        setSelectedStudentId("");
                      }}
                      placeholder="Search by student name or ID..."
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <select
                  value={selectedStudentId}
                  onChange={(event) => setSelectedStudentId(event.target.value)}
                  disabled={loadingStudents || availableStudents.length === 0}
                  className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">
                    {loadingStudents
                      ? "Loading students..."
                      : availableStudents.length === 0
                        ? "No matching students"
                        : `${availableStudents.length} matching student${availableStudents.length === 1 ? "" : "s"} — select one`}
                  </option>

                  {availableStudents.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} — {student.studentId} • {student.className}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={addChild}
                  disabled={!selectedStudentId}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={16} />
                  Add child
                </button>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              {children.length === 0 ? (
                <div className="p-8 text-center">
                  <Users size={22} className="mx-auto text-slate-300" />
                  <p className="mt-2 text-sm font-medium text-slate-600">
                    No children linked yet
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Select a student above to add them.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {children.map((child) => (
                    <div key={child.studentId} className="p-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900">
                            {child.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {child.studentIdLabel} • {child.className}
                          </p>
                        </div>

                        <select
                          value={child.relationship}
                          onChange={(event) =>
                            updateChild(
                              child.studentId,
                              "relationship",
                              event.target.value,
                            )
                          }
                          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-indigo-500"
                        >
                          <option>Parent / Guardian</option>
                          <option>Father</option>
                          <option>Mother</option>
                          <option>Stepfather</option>
                          <option>Stepmother</option>
                          <option>Grandparent</option>
                          <option>Other</option>
                        </select>

                        <label className="flex items-center gap-2 whitespace-nowrap text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={child.isPrimary}
                            onChange={(event) =>
                              updateChild(
                                child.studentId,
                                "isPrimary",
                                event.target.checked,
                              )
                            }
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          Primary
                        </label>

                        <button
                          type="button"
                          onClick={() => removeChild(child.studentId)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          aria-label={`Remove ${child.name}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-10 rounded-lg px-4 text-sm font-medium text-slate-600 hover:bg-white"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving ? "Saving..." : "Add parent"}
          </button>
        </div>
      </form>
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
        {required && <span className="ml-1 text-red-500">*</span>}
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

function EditParentModal({
  parent,
  schoolId,
  onClose,
  onSaved,
}: {
  parent: Parent;
  schoolId: string;
  onClose: () => void;
  onSaved: (parent: Parent) => void;
}) {
  const [firstName, setFirstName] = useState(parent.name.split(" ")[0] ?? "");
  const [lastName, setLastName] = useState(
    parent.name.split(" ").slice(1).join(" "),
  );
  const [phone, setPhone] = useState(parent.phone ?? "");
  const [email, setEmail] = useState(parent.email ?? "");
  const [address, setAddress] = useState(parent.address ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const hasAccount = Boolean(parent.user_id);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!firstName.trim()) {
      setError("First name is required.");
      return;
    }

    if (!phone.trim()) {
      setError("Phone number is required.");
      return;
    }

    if (hasAccount && email.trim().toLowerCase() !== (parent.email ?? "").trim().toLowerCase()) {
      setError(
        "This parent already has an active MojaSchool account. The email cannot be changed here because it must remain synchronized with the login account.",
      );
      return;
    }

    setSaving(true);
    setError("");

    const result = await updateParent({
      schoolId,
      parentId: parent.id,
      firstName,
      lastName,
      phone,
      email,
      address,
    });

    if (result.error || !result.data) {
      setError(result.error?.message ?? "Could not update the parent.");
      setSaving(false);
      return;
    }

    onSaved(result.data);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <form
        onSubmit={handleSubmit}
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Edit parent</h2>
            <p className="mt-1 text-sm text-slate-500">
              Update the parent or guardian's contact information.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-5 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="space-y-6 p-6">
          <section>
            <h3 className="text-sm font-semibold text-slate-900">
              Contact information
            </h3>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
              />

              <Field
                label="Phone"
                value={phone}
                onChange={setPhone}
                required
                type="tel"
              />

              <Field
                label="Email address"
                value={email}
                onChange={setEmail}
                placeholder="parent@example.com"
                type="email"
              />

              <div className="sm:col-span-2">
                <Field
                  label="Address"
                  value={address}
                  onChange={setAddress}
                  placeholder="e.g. Kigali, Rwanda"
                />
              </div>
            </div>

            {hasAccount ? (
              <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs leading-5 text-emerald-700">
                This parent already has a MojaSchool account. Their email is kept
                locked here so the parent record stays synchronized with the
                login account.
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs leading-5 text-indigo-700">
                Add the parent's email address here, save it, then use
                <strong> Invite Parent</strong> from the parents list to send
                the MojaSchool invitation.
              </div>
            )}
          </section>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-10 rounded-lg px-4 text-sm font-medium text-slate-600 hover:bg-white disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ParentDetails({
  parent,
  onClose,
  onEdit,
}: {
  parent: Parent;
  onClose: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <Avatar name={parent.name} size="lg" />

            <div>
              <h2 className="font-semibold text-slate-900">{parent.name}</h2>

              <p className="mt-1 text-xs text-slate-500">
                {parent.childrenCount}{" "}
                {parent.childrenCount === 1 ? "child" : "children"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <Edit3 size={14} />
              Edit
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-sm font-medium text-slate-500 hover:text-slate-900"
            >
              Close
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Phone
              </div>

              <div className="mt-1 text-sm font-medium text-slate-900">
                {parent.phone || "Not provided"}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Email
              </div>

              <div className="mt-1 break-words text-sm font-medium text-slate-900">
                {parent.email || "Not provided"}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-900">Children</h3>

            <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {parent.children.map((child) => (
                <div
                  key={child.id}
                  className="flex items-center justify-between gap-4 p-4"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-900">
                      {child.name}
                    </div>

                    <div className="mt-1 text-xs text-slate-500">
                      {child.studentId}
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600">
                    {child.className}
                  </div>
                </div>
              ))}

              {parent.children.length === 0 && (
                <div className="p-6 text-center text-sm text-slate-500">
                  No children linked to this parent.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
