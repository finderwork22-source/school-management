import {
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  BookOpen,
  Check,
  ChevronRight,
  Edit3,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";

import { supabase } from "../lib/supabase";
import { useSchool } from "../context/SchoolContext";

import Card from "../components/ui/Card";
import Button from "../components/ui/Button";

interface SchoolClass {
  id: string;
  name: string;
  section: string | null;
  academic_year: string | null;
  capacity: number | null;
  is_active: boolean;
}

interface Subject {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  is_active: boolean;
}

interface ClassSubject {
  id: string;
  class_id: string;
  subject_id: string;
}

type Tab = "classes" | "subjects";

export default function ClassesSubjects() {
  const { school } = useSchool();

  const [activeTab, setActiveTab] =
    useState<Tab>("classes");

  const [classes, setClasses] =
    useState<SchoolClass[]>([]);

  const [subjects, setSubjects] =
    useState<Subject[]>([]);

  const [classSubjects, setClassSubjects] =
    useState<ClassSubject[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [showClassModal, setShowClassModal] =
    useState(false);

  const [showSubjectModal, setShowSubjectModal] =
    useState(false);

  const [editingClass, setEditingClass] =
    useState<SchoolClass | null>(null);

  const [editingSubject, setEditingSubject] =
    useState<Subject | null>(null);

  const [selectedClass, setSelectedClass] =
    useState<SchoolClass | null>(null);

  const [showSubjectsModal, setShowSubjectsModal] =
    useState(false);

  async function loadData() {
    if (!school) {
      setClasses([]);
      setSubjects([]);
      setClassSubjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const [
      classesResult,
      subjectsResult,
      classSubjectsResult,
    ] = await Promise.all([
      supabase
        .from("classes")
        .select(`
          id,
          name,
          grade,
          section,
          academic_year,
          capacity,
          is_active
        `)
        .eq("school_id", school.id)
        .order("name"),

      supabase
        .from("subjects")
        .select(`
          id,
          name,
          code,
          description,
          is_active
        `)
        .eq("school_id", school.id)
        .order("name"),

      supabase
        .from("class_subjects")
        .select(`
          id,
          class_id,
          subject_id
        `)
        .eq("school_id", school.id),
    ]);

    if (classesResult.error) {
      setError(
        classesResult.error.message,
      );
      setLoading(false);
      return;
    }

    if (subjectsResult.error) {
      setError(
        subjectsResult.error.message,
      );
      setLoading(false);
      return;
    }

    if (classSubjectsResult.error) {
      setError(
        classSubjectsResult.error.message,
      );
      setLoading(false);
      return;
    }

    setClasses(
      classesResult.data ?? [],
    );

    setSubjects(
      subjectsResult.data ?? [],
    );

    setClassSubjects(
      classSubjectsResult.data ?? [],
    );

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [school]);

  const filteredClasses = useMemo(() => {
    const query = search
      .toLowerCase()
      .trim();

    if (!query) return classes;

    return classes.filter((item) =>
      [
        item.name,
        item.section ?? "",
        item.academic_year ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [classes, search]);

  const filteredSubjects = useMemo(() => {
    const query = search
      .toLowerCase()
      .trim();

    if (!query) return subjects;

    return subjects.filter((item) =>
      [
        item.name,
        item.code ?? "",
        item.description ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [subjects, search]);

  function openCreateClass() {
    setEditingClass(null);
    setShowClassModal(true);
    setError("");
  }

  function openEditClass(
    schoolClass: SchoolClass,
  ) {
    setEditingClass(schoolClass);
    setShowClassModal(true);
    setError("");
  }

  function openCreateSubject() {
    setEditingSubject(null);
    setShowSubjectModal(true);
    setError("");
  }

  function openEditSubject(
    subject: Subject,
  ) {
    setEditingSubject(subject);
    setShowSubjectModal(true);
    setError("");
  }

  function openClassSubjects(
    schoolClass: SchoolClass,
  ) {
    setSelectedClass(schoolClass);
    setShowSubjectsModal(true);
    setError("");
  }

  async function toggleClassStatus(
    schoolClass: SchoolClass,
  ) {
    setError("");

    const { error: updateError } =
      await supabase
        .from("classes")
        .update({
          is_active:
            !schoolClass.is_active,
        })
        .eq("id", schoolClass.id)
        .eq("school_id", school?.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setClasses((current) =>
      current.map((item) =>
        item.id === schoolClass.id
          ? {
              ...item,
              is_active:
                !item.is_active,
            }
          : item,
      ),
    );
  }

  async function toggleSubjectStatus(
    subject: Subject,
  ) {
    setError("");

    const { error: updateError } =
      await supabase
        .from("subjects")
        .update({
          is_active:
            !subject.is_active,
        })
        .eq("id", subject.id)
        .eq("school_id", school?.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSubjects((current) =>
      current.map((item) =>
        item.id === subject.id
          ? {
              ...item,
              is_active:
                !item.is_active,
            }
          : item,
      ),
    );
  }

  function getSubjectCount(
    classId: string,
  ) {
    return classSubjects.filter(
      (item) =>
        item.class_id === classId,
    ).length;
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen
              size={20}
              className="text-indigo-600"
            />

            <h1 className="text-xl font-semibold text-slate-900">
              Classes & Subjects
            </h1>
          </div>

          <p className="mt-1 text-sm text-slate-500">
            Manage your school's classes, subjects,
            and curriculum structure.
          </p>
        </div>

        {activeTab === "classes" ? (
          <Button onClick={openCreateClass}>
            <Plus size={16} />
            Add class
          </Button>
        ) : (
          <Button onClick={openCreateSubject}>
            <Plus size={16} />
            Add subject
          </Button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-5 flex items-center justify-between rounded-xl border border-red-100 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-600">
            {error}
          </p>

          <button
            type="button"
            onClick={() => setError("")}
            className="text-red-400 hover:text-red-600"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Tabs + Search */}
      <Card className="mb-5">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-5 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab("classes");
                setSearch("");
              }}
              className={[
                "relative pb-3 text-sm font-medium",
                activeTab === "classes"
                  ? "text-indigo-600"
                  : "text-slate-500 hover:text-slate-800",
              ].join(" ")}
            >
              Classes
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px]">
                {classes.length}
              </span>

              {activeTab === "classes" && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-indigo-600" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("subjects");
                setSearch("");
              }}
              className={[
                "relative pb-3 text-sm font-medium",
                activeTab === "subjects"
                  ? "text-indigo-600"
                  : "text-slate-500 hover:text-slate-800",
              ].join(" ")}
            >
              Subjects
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px]">
                {subjects.length}
              </span>

              {activeTab === "subjects" && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-indigo-600" />
              )}
            </button>
          </div>

          <div className="relative mb-3 sm:mb-2 sm:w-72">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder={
                activeTab === "classes"
                  ? "Search classes..."
                  : "Search subjects..."
              }
              className="h-9 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">
            Loading...
          </div>
        ) : activeTab === "classes" ? (
          <ClassesTable
            classes={filteredClasses}
            getSubjectCount={getSubjectCount}
            onEdit={openEditClass}
            onToggle={toggleClassStatus}
            onSubjects={openClassSubjects}
            onCreate={openCreateClass}
          />
        ) : (
          <SubjectsTable
            subjects={filteredSubjects}
            onEdit={openEditSubject}
            onToggle={toggleSubjectStatus}
            onCreate={openCreateSubject}
          />
        )}
      </Card>

      {/* Class modal */}
      {showClassModal && (
        <ClassModal
          schoolId={school?.id ?? ""}
          editingClass={editingClass}
          onClose={() =>
            setShowClassModal(false)
          }
          onSaved={() => {
            setShowClassModal(false);
            loadData();
          }}
        />
      )}

      {/* Subject modal */}
      {showSubjectModal && (
        <SubjectModal
          schoolId={school?.id ?? ""}
          editingSubject={editingSubject}
          onClose={() =>
            setShowSubjectModal(false)
          }
          onSaved={() => {
            setShowSubjectModal(false);
            loadData();
          }}
        />
      )}

      {/* Assign subjects modal */}
      {showSubjectsModal &&
        selectedClass && (
          <ClassSubjectsModal
            schoolId={school?.id ?? ""}
            schoolClass={selectedClass}
            subjects={subjects}
            classSubjects={classSubjects}
            onClose={() => {
              setShowSubjectsModal(false);
              setSelectedClass(null);
            }}
            onSaved={() => {
              setShowSubjectsModal(false);
              setSelectedClass(null);
              loadData();
            }}
          />
        )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Classes table                                                               */
/* -------------------------------------------------------------------------- */

function ClassesTable({
  classes,
  getSubjectCount,
  onEdit,
  onToggle,
  onSubjects,
  onCreate,
}: {
  classes: SchoolClass[];
  getSubjectCount: (
    classId: string,
  ) => number;
  onEdit: (
    schoolClass: SchoolClass,
  ) => void;
  onToggle: (
    schoolClass: SchoolClass,
  ) => void;
  onSubjects: (
    schoolClass: SchoolClass,
  ) => void;
  onCreate: () => void;
}) {
  if (classes.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No classes yet"
        description="Create your first class to start organizing students and subjects."
        action="Add class"
        onAction={onCreate}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px]">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/70">
            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Class
            </th>

            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Academic year
            </th>

            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Capacity
            </th>

            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Subjects
            </th>

            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Status
            </th>

            <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Actions
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {classes.map((schoolClass) => (
            <tr
              key={schoolClass.id}
              className="hover:bg-slate-50"
            >
              <td className="px-5 py-4">
                <div className="text-sm font-medium text-slate-900">
                  {schoolClass.name}
                </div>

                {schoolClass.section && (
                  <div className="mt-1 text-xs text-slate-500">
                    Section {schoolClass.section}
                  </div>
                )}
              </td>

              <td className="px-5 py-4 text-sm text-slate-600">
                {schoolClass.academic_year ||
                  "—"}
              </td>

              <td className="px-5 py-4 text-sm text-slate-600">
                {schoolClass.capacity ?? "—"}
              </td>

              <td className="px-5 py-4">
                <button
                  type="button"
                  onClick={() =>
                    onSubjects(schoolClass)
                  }
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                >
                  {getSubjectCount(
                    schoolClass.id,
                  )}{" "}
                  assigned
                  <ChevronRight size={13} />
                </button>
              </td>

              <td className="px-5 py-4">
                <button
                  type="button"
                  onClick={() =>
                    onToggle(schoolClass)
                  }
                  className={[
                    "rounded-full px-2.5 py-1 text-[11px] font-medium",
                    schoolClass.is_active
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-500",
                  ].join(" ")}
                >
                  {schoolClass.is_active
                    ? "Active"
                    : "Inactive"}
                </button>
              </td>

              <td className="px-5 py-4 text-right">
                <button
                  type="button"
                  onClick={() =>
                    onEdit(schoolClass)
                  }
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Edit3 size={15} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Subjects table                                                              */
/* -------------------------------------------------------------------------- */

function SubjectsTable({
  subjects,
  onEdit,
  onToggle,
  onCreate,
}: {
  subjects: Subject[];
  onEdit: (
    subject: Subject,
  ) => void;
  onToggle: (
    subject: Subject,
  ) => void;
  onCreate: () => void;
}) {
  if (subjects.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No subjects yet"
        description="Create subjects that can be assigned to your classes."
        action="Add subject"
        onAction={onCreate}
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px]">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/70">
            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Subject
            </th>

            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Code
            </th>

            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Description
            </th>

            <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Status
            </th>

            <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Actions
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {subjects.map((subject) => (
            <tr
              key={subject.id}
              className="hover:bg-slate-50"
            >
              <td className="px-5 py-4">
                <div className="text-sm font-medium text-slate-900">
                  {subject.name}
                </div>
              </td>

              <td className="px-5 py-4 text-sm text-slate-600">
                {subject.code || "—"}
              </td>

              <td className="max-w-md px-5 py-4 text-sm text-slate-500">
                <div className="truncate">
                  {subject.description ||
                    "No description"}
                </div>
              </td>

              <td className="px-5 py-4">
                <button
                  type="button"
                  onClick={() =>
                    onToggle(subject)
                  }
                  className={[
                    "rounded-full px-2.5 py-1 text-[11px] font-medium",
                    subject.is_active
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-500",
                  ].join(" ")}
                >
                  {subject.is_active
                    ? "Active"
                    : "Inactive"}
                </button>
              </td>

              <td className="px-5 py-4 text-right">
                <button
                  type="button"
                  onClick={() =>
                    onEdit(subject)
                  }
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <Edit3 size={15} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Class modal                                                                 */
/* -------------------------------------------------------------------------- */

function ClassModal({
  schoolId,
  editingClass,
  onClose,
  onSaved,
}: {
  schoolId: string;
  editingClass: SchoolClass | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(
    editingClass?.name ?? "",
  );

  const [section, setSection] = useState(
    editingClass?.section ?? "",
  );

  const [academicYear, setAcademicYear] =
    useState(
      editingClass?.academic_year ?? "",
    );

  const [capacity, setCapacity] =
    useState(
      editingClass?.capacity?.toString() ?? "",
    );

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Class name is required.");
      return;
    }

    if (!section) {
      setError("Please select a section.");
      return;
    }

    if (!academicYear.trim()) {
      setError(
        "Academic year is required.",
      );
      return;
    }

    if (!capacity) {
      setError("Capacity is required.");
      return;
    }

    const numericCapacity =
      Number(capacity);

    if (
      !Number.isInteger(
        numericCapacity,
      ) ||
      numericCapacity <= 0
    ) {
      setError(
        "Capacity must be a positive number.",
      );
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      name: name.trim(),
      section,
      academic_year:
        academicYear.trim(),
      capacity: numericCapacity,
      school_id: schoolId,
    };

    if (editingClass) {
      const { error: updateError } =
        await supabase
          .from("classes")
          .update(payload)
          .eq("id", editingClass.id)
          .eq("school_id", schoolId);

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }
    } else {
      const { error: insertError } =
        await supabase
          .from("classes")
          .insert(payload);

      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    onSaved();
  }

  return (
    <Modal
      title={
        editingClass
          ? "Edit class"
          : "Add class"
      }
      onClose={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        {error && (
          <ErrorBox message={error} />
        )}

        {/* Class name */}
        <Input
          label="Class name"
          value={name}
          onChange={setName}
          placeholder="e.g. Little Stars"
          required
        />

        {/* Section + Academic Year */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Section
              <span className="ml-1 text-red-500">
                *
              </span>
            </label>

            <select
              value={section}
              onChange={(event) =>
                setSection(
                  event.target.value,
                )
              }
              required
              className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">
                Select section
              </option>

              <option value="Creche">
                Creche
              </option>

              <option value="Nursery">
                Nursery
              </option>

              <option value="Primary">
                Primary
              </option>

              <option value="Lower Secondary">
                Lower Secondary
              </option>
            </select>
          </div>

          <Input
            label="Academic year"
            value={academicYear}
            onChange={setAcademicYear}
            placeholder="e.g. 2026"
            required
          />
        </div>

        {/* Capacity */}
        <Input
          label="Capacity"
          value={capacity}
          onChange={setCapacity}
          placeholder="e.g. 20"
          type="number"
          min="1"
          required
        />

        <ModalActions
          onClose={onClose}
          saving={saving}
          label={
            editingClass
              ? "Save changes"
              : "Create class"
          }
        />
      </form>
    </Modal>
  );
}
/* -------------------------------------------------------------------------- */
/* Subject modal                                                               */
/* -------------------------------------------------------------------------- */

function SubjectModal({
  schoolId,
  editingSubject,
  onClose,
  onSaved,
}: {
  schoolId: string;
  editingSubject: Subject | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] =
    useState(editingSubject?.name ?? "");

  const [code, setCode] =
    useState(editingSubject?.code ?? "");

  const [description, setDescription] =
    useState(
      editingSubject?.description ?? "",
    );

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!name.trim()) {
      setError(
        "Subject name is required.",
      );
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      name: name.trim(),
      code: code.trim() || null,
      description:
        description.trim() || null,
      school_id: schoolId,
    };

    if (editingSubject) {
      const { error: updateError } =
        await supabase
          .from("subjects")
          .update(payload)
          .eq("id", editingSubject.id)
          .eq("school_id", schoolId);

      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }
    } else {
      const { error: insertError } =
        await supabase
          .from("subjects")
          .insert(payload);

      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    onSaved();
  }

  return (
    <Modal
      title={
        editingSubject
          ? "Edit subject"
          : "Add subject"
      }
      onClose={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        {error && (
          <ErrorBox message={error} />
        )}

        <Input
          label="Subject name"
          value={name}
          onChange={setName}
          placeholder="e.g. Mathematics"
          required
        />

        <Input
          label="Subject code"
          value={code}
          onChange={setCode}
          placeholder="e.g. MATH"
        />

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Description
          </label>

          <textarea
            value={description}
            onChange={(event) =>
              setDescription(
                event.target.value,
              )
            }
            rows={4}
            placeholder="Optional description"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        </div>

        <ModalActions
          onClose={onClose}
          saving={saving}
          label={
            editingSubject
              ? "Save changes"
              : "Create subject"
          }
        />
      </form>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Assign subjects                                                             */
/* -------------------------------------------------------------------------- */

function ClassSubjectsModal({
  schoolId,
  schoolClass,
  subjects,
  classSubjects,
  onClose,
  onSaved,
}: {
  schoolId: string;
  schoolClass: SchoolClass;
  subjects: Subject[];
  classSubjects: ClassSubject[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const assignedIds = new Set(
    classSubjects
      .filter(
        (item) =>
          item.class_id ===
          schoolClass.id,
      )
      .map(
        (item) => item.subject_id,
      ),
  );

  const [selectedIds, setSelectedIds] =
    useState<string[]>(
      Array.from(assignedIds),
    );

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  function toggleSubject(
    subjectId: string,
  ) {
    setSelectedIds((current) =>
      current.includes(subjectId)
        ? current.filter(
            (id) => id !== subjectId,
          )
        : [...current, subjectId],
    );
  }

  async function saveAssignments() {
    setSaving(true);
    setError("");

    const { error: deleteError } =
      await supabase
        .from("class_subjects")
        .delete()
        .eq(
          "class_id",
          schoolClass.id,
        )
        .eq("school_id", schoolId);

    if (deleteError) {
      setError(deleteError.message);
      setSaving(false);
      return;
    }

    if (selectedIds.length > 0) {
      const rows = selectedIds.map(
        (subjectId) => ({
          school_id: schoolId,
          class_id: schoolClass.id,
          subject_id: subjectId,
        }),
      );

      const { error: insertError } =
        await supabase
          .from("class_subjects")
          .insert(rows);

      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    onSaved();
  }

  return (
    <Modal
      title={`Subjects for ${schoolClass.name}`}
      onClose={onClose}
      maxWidth="max-w-xl"
    >
      <div>
        <p className="mb-4 text-sm text-slate-500">
          Select the subjects taught in this class.
        </p>

        {error && (
          <div className="mb-4">
            <ErrorBox message={error} />
          </div>
        )}

        {subjects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
            <BookOpen
              size={22}
              className="mx-auto text-slate-300"
            />

            <p className="mt-2 text-sm font-medium text-slate-700">
              No subjects available
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Create subjects first, then assign them
              to this class.
            </p>
          </div>
        ) : (
          <div className="max-h-[420px] space-y-2 overflow-y-auto">
            {subjects.map((subject) => {
              const selected =
                selectedIds.includes(
                  subject.id,
                );

              return (
                <button
                  key={subject.id}
                  type="button"
                  onClick={() =>
                    toggleSubject(
                      subject.id,
                    )
                  }
                  className={[
                    "flex w-full items-center gap-3 rounded-xl border p-4 text-left transition",
                    selected
                      ? "border-indigo-300 bg-indigo-50"
                      : "border-slate-200 hover:bg-slate-50",
                    !subject.is_active
                      ? "opacity-60"
                      : "",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                      selected
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-300 bg-white",
                    ].join(" ")}
                  >
                    {selected && (
                      <Check size={13} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900">
                      {subject.name}
                    </div>

                    {subject.code && (
                      <div className="mt-1 text-xs text-slate-500">
                        {subject.code}
                      </div>
                    )}
                  </div>

                  {!subject.is_active && (
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-500">
                      Inactive
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4">
          <p className="text-xs text-slate-500">
            {selectedIds.length}{" "}
            {selectedIds.length === 1
              ? "subject"
              : "subjects"}{" "}
            selected
          </p>

          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>

            <Button
              onClick={saveAssignments}
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : "Save subjects"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Reusable UI                                                                 */
/* -------------------------------------------------------------------------- */

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  onAction,
}: {
  icon: typeof Users;
  title: string;
  description: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="p-12 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
        <Icon size={22} />
      </div>

      <h3 className="mt-4 text-sm font-semibold text-slate-800">
        {title}
      </h3>

      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
        {description}
      </p>

      <Button
        className="mt-5"
        onClick={onAction}
      >
        <Plus size={15} />
        {action}
      </Button>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
  maxWidth = "max-w-lg",
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        className={[
          "w-full rounded-2xl bg-white shadow-xl",
          maxWidth,
        ].join(" ")}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <h2 className="text-base font-semibold text-slate-900">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={17} />
          </button>
        </div>

        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  type = "text",
  min,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  min?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </label>

      <input
        type={type}
        min={min}
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        required={required}
        className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />
    </div>
  );
}

function ErrorBox({
  message,
}: {
  message: string;
}) {
  return (
    <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2.5">
      <p className="text-xs text-red-600">
        {message}
      </p>
    </div>
  );
}

function ModalActions({
  onClose,
  saving,
  label,
}: {
  onClose: () => void;
  saving: boolean;
  label: string;
}) {
  return (
    <div className="flex justify-end gap-2 border-t border-slate-200 pt-5">
      <Button
        type="button"
        variant="secondary"
        onClick={onClose}
        disabled={saving}
      >
        Cancel
      </Button>

      <Button
        type="submit"
        disabled={saving}
      >
        {saving ? "Saving..." : label}
      </Button>
    </div>
  );
}