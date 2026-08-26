import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Phone,
  UserRound,
  Users,
  GraduationCap,
  Pencil,
  X,
  Power,
  ShieldCheck,
  Plus,
} from "lucide-react";

import { supabase } from "../lib/supabase";
import { useSchool } from "../context/SchoolContext";
import { getClasses, type SchoolClass } from "../lib/classes";

import {
  getStudentPickupPersons,
  type PickupPerson,
} from "../lib/pickupPersons";

import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Avatar from "../components/ui/Avatar";

interface StudentProfileData {
  id: string;
  student_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  date_of_birth: string | null;
  gender: "Male" | "Female" | null;
  nationality: string | null;
  photo_url: string | null;
  status: "Active" | "Inactive";
  enrolled_date: string;

  enrollment: {
    class_id: string;
    class_name: string;
    academic_year_id: string | null;
    academic_year_name: string | null;
  } | null;

  parent: {
    id: string;
    name: string;
    phone: string | null;
    relationship: string | null;
  } | null;
}

export default function StudentProfile() {
  const [pickupPersons, setPickupPersons] = useState<PickupPerson[]>([]);

  const [pickupLoading, setPickupLoading] = useState(true);

  const [showPickupModal, setShowPickupModal] = useState(false);
  const { id } = useParams<{ id: string }>();
  const { school } = useSchool();

  const [student, setStudent] = useState<StudentProfileData | null>(null);

  const [classes, setClasses] = useState<SchoolClass[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showEditModal, setShowEditModal] = useState(false);

  const [showStatusModal, setShowStatusModal] = useState(false);

  async function loadPickupPersons() {
    if (!school || !id) {
      setPickupPersons([]);
      setPickupLoading(false);
      return;
    }

    setPickupLoading(true);

    const { data, error: pickupError } = await getStudentPickupPersons(
      school.id,
      id,
    );

    if (pickupError) {
      console.error("Failed to load pickup persons:", pickupError);

      setPickupPersons([]);
    } else {
      setPickupPersons(data);
    }

    setPickupLoading(false);
  }

  async function loadStudent() {
    if (!school || !id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const { data, error: studentError } = await supabase
      .from("students")
      .select(
        `
          id,
          student_id,
          first_name,
          middle_name,
          last_name,
          date_of_birth,
          gender,
          nationality,
          photo_url,
          status,
          enrolled_date,

          enrollments (
            class_id,
            academic_year_id,
            classes (
              id,
              name
            ),
            academic_years (
              id,
              name
            )
          ),

          student_parents (
            relationship,
            is_primary,
            parents (
              id,
              first_name,
              last_name,
              phone
            )
          )
        `,
      )
      .eq("id", id)
      .eq("school_id", school.id)
      .maybeSingle();

    if (studentError) {
      console.error("Failed to load student:", studentError);

      setError(studentError.message);
      setStudent(null);
      setLoading(false);
      return;
    }

    if (!data) {
      setError("Student not found.");
      setStudent(null);
      setLoading(false);
      return;
    }

    const enrollment = Array.isArray(data.enrollments)
      ? data.enrollments[0]
      : data.enrollments;

    const classData = Array.isArray(enrollment?.classes)
      ? enrollment.classes[0]
      : enrollment?.classes;

    const academicYear = Array.isArray(enrollment?.academic_years)
      ? enrollment.academic_years[0]
      : enrollment?.academic_years;

    const primaryParent = Array.isArray(data.student_parents)
      ? (data.student_parents.find((item) => item.is_primary) ??
        data.student_parents[0])
      : data.student_parents;

    const parentData = Array.isArray(primaryParent?.parents)
      ? primaryParent.parents[0]
      : primaryParent?.parents;

    setStudent({
      id: data.id,
      student_id: data.student_id,

      first_name: data.first_name,
      middle_name: data.middle_name,
      last_name: data.last_name,

      date_of_birth: data.date_of_birth,
      gender: data.gender,
      nationality: data.nationality,

      photo_url: data.photo_url,

      status: data.status,
      enrolled_date: data.enrolled_date,

      enrollment: enrollment
        ? {
            class_id: enrollment.class_id,
            class_name: classData?.name ?? "Unassigned",
            academic_year_id: enrollment.academic_year_id,
            academic_year_name: academicYear?.name ?? null,
          }
        : null,

      parent: parentData
        ? {
            id: parentData.id,
            name: `${parentData.first_name} ${parentData.last_name}`,
            phone: parentData.phone,
            relationship: primaryParent?.relationship ?? null,
          }
        : null,
    });

    setLoading(false);
  }

  async function loadClasses() {
    if (!school) return;

    const { data, error: classesError } = await getClasses(school.id);

    if (classesError) {
      console.error("Failed to load classes:", classesError);
      return;
    }

    setClasses(data);
  }

  useEffect(() => {
    loadStudent();
    loadClasses();
    loadPickupPersons();
  }, [school, id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <div className="flex min-h-[400px] items-center justify-center">
          <p className="text-sm text-slate-500">Loading student...</p>
        </div>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <Link
          to="/students"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          Back to students
        </Link>

        <Card className="mt-6 p-8">
          <div className="text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-500">
              <UserRound size={18} />
            </div>

            <h1 className="mt-3 text-base font-semibold text-slate-900">
              Unable to load student
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {error || "Student not found."}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const fullName = [student.first_name, student.middle_name, student.last_name]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* Back */}
      <Link
        to="/students"
        className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
      >
        <ArrowLeft size={16} />
        Back to students
      </Link>

      {/* Profile header */}
      <Card className="overflow-hidden">
        <div className="p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              {student.photo_url ? (
                <img
                  src={student.photo_url}
                  alt={fullName}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <Avatar name={fullName} size="lg" />
              )}

              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-xl font-semibold text-slate-900">
                    {fullName}
                  </h1>

                  <Badge
                    variant={
                      student.status === "Active" ? "success" : "default"
                    }
                  >
                    {student.status}
                  </Badge>
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                  <span>{student.student_id}</span>

                  {student.enrollment?.class_name && (
                    <span>{student.enrollment.class_name}</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => setShowStatusModal(true)}
              >
                <Power size={15} />
                Change status
              </Button>

              <Button
                variant="secondary"
                onClick={() => setShowEditModal(true)}
              >
                <Pencil size={15} />
                Edit student
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-t border-slate-200 px-6 sm:px-8">
          <div className="flex gap-6 overflow-x-auto">
            <button className="border-b-2 border-indigo-600 py-3 text-sm font-medium text-indigo-700">
              Overview
            </button>

            <button className="border-b-2 border-transparent py-3 text-sm font-medium text-slate-500 hover:text-slate-900">
              Attendance
            </button>

            <button className="border-b-2 border-transparent py-3 text-sm font-medium text-slate-500 hover:text-slate-900">
              Assessments
            </button>

            <button className="border-b-2 border-transparent py-3 text-sm font-medium text-slate-500 hover:text-slate-900">
              Payments
            </button>
          </div>
        </div>
      </Card>

      {/* Content */}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {/* Personal Information */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center gap-2">
            <UserRound size={18} className="text-indigo-600" />

            <h2 className="text-sm font-semibold text-slate-900">
              Personal information
            </h2>
          </div>

          <div className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <InfoItem label="First name" value={student.first_name} />

            <InfoItem label="Last name" value={student.last_name} />

            <InfoItem
              label="Date of birth"
              value={
                student.date_of_birth
                  ? formatDate(student.date_of_birth)
                  : "Not provided"
              }
            />

            <InfoItem label="Gender" value={student.gender ?? "Not provided"} />

            <InfoItem
              label="Nationality"
              value={student.nationality ?? "Not provided"}
            />

            <InfoItem
              label="Enrolled date"
              value={formatDate(student.enrolled_date)}
            />
          </div>
        </Card>

        {/* Enrollment */}
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <GraduationCap size={18} className="text-indigo-600" />

            <h2 className="text-sm font-semibold text-slate-900">Enrollment</h2>
          </div>

          <div className="mt-5 space-y-5">
            <InfoItem
              label="Class"
              value={student.enrollment?.class_name ?? "Not assigned"}
            />

            <InfoItem
              label="Academic year"
              value={student.enrollment?.academic_year_name ?? "Not assigned"}
            />

            <InfoItem label="Student ID" value={student.student_id} />
          </div>
        </Card>

        {/* Parent */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-indigo-600" />

            <h2 className="text-sm font-semibold text-slate-900">
              Parent / guardian
            </h2>
          </div>

          {student.parent ? (
            <div className="mt-5 flex flex-col gap-4 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-medium text-slate-900">
                  {student.parent.name}
                </div>

                <div className="mt-1 text-sm text-slate-500">
                  {student.parent.relationship ?? "Parent / Guardian"}
                </div>
              </div>

              {student.parent.phone && (
                <a
                  href={`tel:${student.parent.phone}`}
                  className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                >
                  <Phone size={15} />
                  {student.parent.phone}
                </a>
              )}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-slate-200 p-6 text-center">
              <p className="text-sm text-slate-500">
                No parent or guardian information has been added.
              </p>
            </div>
          )}
        </Card>

        {/* Authorized Pick-Up Persons */}
        {/* Authorized Pick-Up Persons */}
        <Card className="p-6 lg:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-indigo-600" />

                <h2 className="text-sm font-semibold text-slate-900">
                  Authorized pick-up persons
                </h2>
              </div>

              <p className="mt-1 text-xs text-slate-500">
                People authorized to collect this student from school.
              </p>
            </div>

            <Button
              variant="secondary"
              onClick={() => setShowPickupModal(true)}
            >
              <Plus size={15} />
              Add person
            </Button>
          </div>

          {pickupLoading ? (
            <div className="mt-5 py-6 text-center">
              <p className="text-sm text-slate-500">
                Loading authorized persons...
              </p>
            </div>
          ) : pickupPersons.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-slate-200 p-6 text-center">
              <ShieldCheck size={22} className="mx-auto text-slate-300" />

              <p className="mt-2 text-sm font-medium text-slate-700">
                No authorized pick-up persons
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Add a parent, guardian, taxi driver, nanny, or another
                authorized person.
              </p>
            </div>
          ) : (
            <div className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {pickupPersons.map((person) => (
                <PickupPersonRow
                  key={person.id}
                  person={person}
                  studentId={student.id}
                  onUpdated={loadPickupPersons}
                />
              ))}
            </div>
          )}
        </Card>

        {/* Quick information */}
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-indigo-600" />

            <h2 className="text-sm font-semibold text-slate-900">
              Quick information
            </h2>
          </div>

          <div className="mt-5 space-y-5">
            <InfoItem label="Status" value={student.status} />

            <InfoItem
              label="Enrolled"
              value={formatDate(student.enrolled_date)}
            />

            <InfoItem
              label="Class"
              value={student.enrollment?.class_name ?? "Not assigned"}
            />
          </div>
        </Card>
      </div>

      {/* Edit student */}
      {showEditModal && (
        <EditStudentModal
          student={student}
          classes={classes}
          onClose={() => setShowEditModal(false)}
          onSaved={async () => {
            setShowEditModal(false);
            await loadStudent();
          }}
        />
      )}

      {/* Change status */}
      {showStatusModal && (
        <StatusModal
          student={student}
          onClose={() => setShowStatusModal(false)}
          onSaved={async () => {
            setShowStatusModal(false);
            await loadStudent();
          }}
        />
      )}

      {showPickupModal && (
        <AddPickupPersonModal
          studentId={student.id}
          onClose={() => setShowPickupModal(false)}
          onSaved={async () => {
            setShowPickupModal(false);
            await loadPickupPersons();
          }}
        />
      )}
    </div>
  );
}

/* =========================================================
   STATUS MODAL
========================================================= */

interface StatusModalProps {
  student: StudentProfileData;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

function StatusModal({ student, onClose, onSaved }: StatusModalProps) {
  const [status, setStatus] = useState<"Active" | "Inactive">(student.status);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (status === student.status) {
      onClose();
      return;
    }

    setSaving(true);
    setError("");

    const { error: updateError } = await supabase.rpc("update_student_status", {
      p_student_id: student.id,
      p_status: status,
    });

    if (updateError) {
      console.error("Failed to update student status:", updateError);

      setError(updateError.message);
      setSaving(false);
      return;
    }

    await onSaved();

    setSaving(false);
  }

  const isDeactivating = status === "Inactive" && student.status === "Active";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Change student status
            </h2>

            <p className="mt-0.5 text-xs text-slate-500">
              Update the student's current status.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <X size={17} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5 p-6">
            {error && (
              <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="rounded-xl bg-slate-50 p-4">
              <div className="text-xs text-slate-500">Student</div>

              <div className="mt-1 font-medium text-slate-900">
                {student.first_name} {student.last_name}
              </div>

              <div className="mt-1 text-xs text-slate-500">
                {student.student_id}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-700">
                New status
              </label>

              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as "Active" | "Inactive")
                }
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="Active">Active</option>

                <option value="Inactive">Inactive</option>
              </select>
            </div>

            {isDeactivating && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm text-amber-800">
                  This will mark the student as inactive. Their records and
                  history will remain in the system.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
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
              disabled={saving || status === student.status}
            >
              {saving ? "Saving..." : "Save status"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================================================
   EDIT STUDENT MODAL
========================================================= */

interface EditStudentModalProps {
  student: StudentProfileData;
  classes: SchoolClass[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}

function EditStudentModal({
  student,
  classes,
  onClose,
  onSaved,
}: EditStudentModalProps) {
  const [firstName, setFirstName] = useState(student.first_name);

  const [lastName, setLastName] = useState(student.last_name);

  const [gender, setGender] = useState<"Male" | "Female">(
    student.gender ?? "Male",
  );

  const [dateOfBirth, setDateOfBirth] = useState(student.date_of_birth ?? "");

  const [nationality, setNationality] = useState(student.nationality ?? "");

  const [classId, setClassId] = useState(student.enrollment?.class_id ?? "");

  const [parentName, setParentName] = useState(student.parent?.name ?? "");

  const [parentPhone, setParentPhone] = useState(student.parent?.phone ?? "");

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!firstName.trim()) {
      setError("First name is required.");
      return;
    }

    if (!lastName.trim()) {
      setError("Last name is required.");
      return;
    }

    if (!classId) {
      setError("Please select a class.");
      return;
    }

    setSaving(true);
    setError("");

    const { error: updateError } = await supabase.rpc("update_student", {
      p_student_id: student.id,
      p_first_name: firstName.trim(),
      p_last_name: lastName.trim(),
      p_gender: gender,
      p_date_of_birth: dateOfBirth || null,
      p_nationality: nationality.trim() || null,
      p_class_id: classId,
      p_parent_name: parentName.trim() || null,
      p_parent_phone: parentPhone.trim() || null,
    });

    if (updateError) {
      console.error("Failed to update student:", updateError);

      setError(updateError.message);
      setSaving(false);
      return;
    }

    await onSaved();

    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Edit student
            </h2>

            <p className="mt-0.5 text-xs text-slate-500">
              Update student and guardian information.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <X size={17} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 p-6">
            {error && (
              <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <section>
              <h3 className="text-sm font-semibold text-slate-900">
                Student information
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
                  required
                />

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Gender
                  </label>

                  <select
                    value={gender}
                    onChange={(event) =>
                      setGender(event.target.value as "Male" | "Female")
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="Male">Male</option>

                    <option value="Female">Female</option>
                  </select>
                </div>

                <Field
                  label="Date of birth"
                  type="date"
                  value={dateOfBirth}
                  onChange={setDateOfBirth}
                />

                <Field
                  label="Nationality"
                  value={nationality}
                  onChange={setNationality}
                  placeholder="e.g. Rwandan"
                />

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Class
                  </label>

                  <select
                    value={classId}
                    onChange={(event) => setClassId(event.target.value)}
                    required
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">Select class</option>

                    {classes.map((schoolClass) => (
                      <option key={schoolClass.id} value={schoolClass.id}>
                        {schoolClass.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="border-t border-slate-100 pt-6">
              <h3 className="text-sm font-semibold text-slate-900">
                Parent / guardian
              </h3>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field
                  label="Parent / guardian name"
                  value={parentName}
                  onChange={setParentName}
                />

                <Field
                  label="Phone number"
                  value={parentPhone}
                  onChange={setParentPhone}
                  placeholder="+250 7XX XXX XXX"
                />
              </div>
            </section>
          </div>

          <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>

            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================================================
   FIELD
========================================================= */

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
}: FieldProps) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-700">
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />
    </div>
  );
}

interface AddPickupPersonModalProps {
  studentId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

function AddPickupPersonModal({
  studentId,
  onClose,
  onSaved,
}: AddPickupPersonModalProps) {
  const [firstName, setFirstName] = useState("");

  const [lastName, setLastName] = useState("");

  const [phone, setPhone] = useState("");

  const [relationship, setRelationship] = useState("Parent");

  const [identificationNumber, setIdentificationNumber] = useState("");

  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!firstName.trim()) {
      setError("First name is required.");
      return;
    }

    if (!lastName.trim()) {
      setError("Last name is required.");
      return;
    }

    if (!phone.trim()) {
      setError("Phone number is required.");
      return;
    }

    setSaving(true);
    setError("");

    const { error: createError } = await supabase.rpc(
      "add_student_pickup_person",
      {
        p_student_id: studentId,
        p_first_name: firstName.trim(),
        p_last_name: lastName.trim(),
        p_phone: phone.trim(),
        p_relationship: relationship,
        p_identification_number: identificationNumber.trim() || null,
        p_notes: notes.trim() || null,
      },
    );

    if (createError) {
      console.error("Failed to add pickup person:", createError);

      setError(createError.message);
      setSaving(false);
      return;
    }

    await onSaved();

    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Add authorized pick-up person
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Register someone who can collect this student.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={17} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5 p-6">
            {error && (
              <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
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

              <Field
                label="Phone number"
                value={phone}
                onChange={setPhone}
                placeholder="+250 7XX XXX XXX"
                required
              />

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">
                  Relationship / role
                </label>

                <select
                  value={relationship}
                  onChange={(event) => setRelationship(event.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="Parent">Parent</option>

                  <option value="Guardian">Guardian</option>

                  <option value="Taxi Driver">Taxi Driver</option>

                  <option value="Nanny">Nanny</option>

                  <option value="Family Member">Family Member</option>

                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <Field
                  label="ID / Identification number"
                  value={identificationNumber}
                  onChange={setIdentificationNumber}
                  placeholder="Optional"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-slate-700">
                  Notes
                </label>

                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional notes..."
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs leading-5 text-amber-800">
                Only add people who have been authorized to collect this
                student.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>

            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Add person"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================================================
   INFO ITEM
========================================================= */

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </div>

      <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
    </div>
  );
}

/* =========================================================
   DATE FORMATTER
========================================================= */

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function PickupPersonRow({
  person,
  studentId,
  onUpdated,
}: {
  person: PickupPerson;
  studentId: string;
  onUpdated: () => Promise<void>;
}) {
  const [showEdit, setShowEdit] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  async function toggleStatus() {
    setSaving(true);
    setError("");

    const { error: updateError } =
      await supabase.rpc(
        "update_student_pickup_person_status",
        {
          p_pickup_person_id: person.id,
          p_student_id: studentId,
          p_is_active: !person.isActive,
        },
      );

    if (updateError) {
      console.error(
        "Failed to update pickup person status:",
        updateError,
      );

      setError(updateError.message);
      setSaving(false);
      return;
    }

    await onUpdated();

    setSaving(false);
  }

  return (
    <>
      <div
        className={[
          "flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between",
          !person.isActive
            ? "bg-slate-50"
            : "",
        ].join(" ")}
      >
        <div className="flex items-center gap-3">
          <Avatar
            name={`${person.firstName} ${person.lastName}`}
          />

          <div>
            <div
              className={[
                "text-sm font-medium",
                person.isActive
                  ? "text-slate-900"
                  : "text-slate-400 line-through",
              ].join(" ")}
            >
              {person.firstName}{" "}
              {person.lastName}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500">
                {person.relationship}
              </span>

              <span className="text-slate-300">
                •
              </span>

              <span
                className={
                  person.isActive
                    ? "font-medium text-emerald-600"
                    : "font-medium text-slate-400"
                }
              >
                {person.isActive
                  ? "Authorized"
                  : "Inactive"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href={`tel:${person.phone}`}
            className={[
              "inline-flex items-center gap-2 text-sm",
              person.isActive
                ? "text-slate-600 hover:text-indigo-600"
                : "text-slate-400",
            ].join(" ")}
          >
            <Phone size={14} />
            {person.phone}
          </a>

          <button
            type="button"
            onClick={() =>
              setShowEdit(true)
            }
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            Edit
          </button>

          <button
            type="button"
            onClick={toggleStatus}
            disabled={saving}
            className={[
              "rounded-lg px-3 py-1.5 text-xs font-medium",
              person.isActive
                ? "text-red-600 hover:bg-red-50"
                : "text-emerald-600 hover:bg-emerald-50",
            ].join(" ")}
          >
            {saving
              ? "Saving..."
              : person.isActive
                ? "Deactivate"
                : "Activate"}
          </button>
        </div>
      </div>

      {error && (
        <div className="border-t border-red-100 bg-red-50 px-4 py-2">
          <p className="text-xs text-red-600">
            {error}
          </p>
        </div>
      )}

      {showEdit && (
        <EditPickupPersonModal
          person={person}
          onClose={() =>
            setShowEdit(false)
          }
          onSaved={async () => {
            setShowEdit(false);
            await onUpdated();
          }}
        />
      )}
    </>
  );
}

function EditPickupPersonModal({
  person,
  onClose,
  onSaved,
}: {
  person: PickupPerson;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [firstName, setFirstName] =
    useState(person.firstName);

  const [lastName, setLastName] =
    useState(person.lastName);

  const [phone, setPhone] =
    useState(person.phone);

  const [relationship, setRelationship] =
    useState(person.relationship);

  const [identificationNumber, setIdentificationNumber] =
    useState(
      person.identificationNumber ?? "",
    );

  const [notes, setNotes] =
    useState(person.notes ?? "");

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  async function handleSubmit(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (!firstName.trim()) {
      setError("First name is required.");
      return;
    }

    if (!lastName.trim()) {
      setError("Last name is required.");
      return;
    }

    if (!phone.trim()) {
      setError("Phone number is required.");
      return;
    }

    if (!relationship.trim()) {
      setError(
        "Relationship is required.",
      );
      return;
    }

    setSaving(true);
    setError("");

    const { error: updateError } =
      await supabase.rpc(
        "update_student_pickup_person",
        {
          p_pickup_person_id: person.id,
          p_first_name:
            firstName.trim(),
          p_last_name:
            lastName.trim(),
          p_phone: phone.trim(),
          p_relationship:
            relationship.trim(),
          p_identification_number:
            identificationNumber.trim() ||
            null,
          p_notes:
            notes.trim() || null,
        },
      );

    if (updateError) {
      console.error(
        "Failed to update pickup person:",
        updateError,
      );

      setError(updateError.message);
      setSaving(false);
      return;
    }

    await onSaved();

    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Edit authorized person
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Update their contact and authorization
              information.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
          >
            <X size={17} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-5 p-6">
            {error && (
              <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3">
                <p className="text-sm text-red-600">
                  {error}
                </p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
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

              <Field
                label="Phone number"
                value={phone}
                onChange={setPhone}
                required
              />

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700">
                  Relationship / role
                </label>

                <select
                  value={relationship}
                  onChange={(event) =>
                    setRelationship(
                      event.target.value,
                    )
                  }
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="Parent">
                    Parent
                  </option>

                  <option value="Guardian">
                    Guardian
                  </option>

                  <option value="Taxi Driver">
                    Taxi Driver
                  </option>

                  <option value="Nanny">
                    Nanny
                  </option>

                  <option value="Family Member">
                    Family Member
                  </option>

                  <option value="Other">
                    Other
                  </option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <Field
                  label="ID / Identification number"
                  value={
                    identificationNumber
                  }
                  onChange={
                    setIdentificationNumber
                  }
                  placeholder="Optional"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-slate-700">
                  Notes
                </label>

                <textarea
                  value={notes}
                  onChange={(event) =>
                    setNotes(
                      event.target.value,
                    )
                  }
                  rows={3}
                  placeholder="Optional notes..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
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
              {saving
                ? "Saving..."
                : "Save changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
