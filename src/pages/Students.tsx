import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Plus,
  SlidersHorizontal,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  UserRound,
  ImagePlus,
  X,
} from "lucide-react";

import { useSchool } from "../context/SchoolContext";
import { getStudents } from "../lib/students";
import { getClasses, type SchoolClass } from "../lib/classes";
import { supabase } from "../lib/supabase";

import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Avatar from "../components/ui/Avatar";
import PageHeader from "../components/ui/PageHeader";

type StudentStatus = "Active" | "Inactive";

interface AcademicYear {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
}

interface Student {
  id: string;
  name: string;
  studentId: string;
  className: string;
  academicYearId: string | null;
  dateOfBirth: string | null;
  age: number | null;
  gender: "Male" | "Female";
  nationality: string;
  photoUrl: string | null;
  parent: string;
  parentPhone: string;
  status: StudentStatus;
  enrolledDate: string;
}

const statuses = ["All statuses", "Active", "Inactive"];

export default function Students() {
  const navigate = useNavigate();
  const { school } = useSchool();

  const [students, setStudents] = useState<Student[]>([]);
  const [schoolClasses, setSchoolClasses] = useState<SchoolClass[]>(
    [],
  );

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] =
    useState("All classes");
  const [statusFilter, setStatusFilter] =
    useState("All statuses");

  const [showAddModal, setShowAddModal] =
    useState(false);

  const [selectedStudent, setSelectedStudent] =
    useState<Student | null>(null);

  async function loadData() {
    if (!school) {
      setStudents([]);
      setSchoolClasses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const [
      {
        data: studentsData,
        error: studentsError,
      },
      {
        data: classesData,
        error: classesError,
      },
      {
        data: academicYearsData,
        error: academicYearsError,
      },
    ] = await Promise.all([
      getStudents(school.id),
      getClasses(school.id),
      supabase
        .from("academic_years")
        .select("id, name, start_date, end_date, is_active")
        .eq("school_id", school.id)
        .order("name", { ascending: false }),
    ]);

    if (studentsError) {
      console.error(
        "Failed to load students:",
        studentsError,
      );

      setError(studentsError.message);
      setStudents([]);
    } else {
      setStudents(studentsData);
    }

    if (classesError) {
      console.error(
        "Failed to load classes:",
        classesError,
      );

      setError(classesError.message);
      setSchoolClasses([]);
    } else {
      setSchoolClasses(classesData);
    }

    if (academicYearsError) {
      console.error(
        "Failed to load academic years:",
        academicYearsError,
      );

      setError(academicYearsError.message);
      setAcademicYears([]);
    } else {
      setAcademicYears(academicYearsData ?? []);

      setSelectedAcademicYearId((current) => {
        if (
          current &&
          (academicYearsData ?? []).some(
            (year) => year.id === current,
          )
        ) {
          return current;
        }

        const activeYear = (academicYearsData ?? []).find(
          (year) => year.is_active,
        );

        return (
          activeYear?.id ??
          academicYearsData?.[0]?.id ??
          ""
        );
      });
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [school]);

  const classesForSelectedYear = useMemo(
    () =>
      schoolClasses.filter(
        (item) =>
          (!selectedAcademicYearId ||
            item.academic_year_id === selectedAcademicYearId) &&
          item.is_active,
      ),
    [schoolClasses, selectedAcademicYearId],
  );

  const classes = useMemo(
    () => [
      "All classes",
      ...classesForSelectedYear.map((item) => item.name),
    ],
    [classesForSelectedYear],
  );

  const filteredStudents = useMemo(() => {
    const query = search.toLowerCase().trim();

    return students.filter((student) => {
      const matchesAcademicYear =
        !selectedAcademicYearId ||
        student.academicYearId === selectedAcademicYearId;

      const matchesSearch =
        !query ||
        student.name.toLowerCase().includes(query) ||
        student.studentId
          .toLowerCase()
          .includes(query) ||
        student.parent
          .toLowerCase()
          .includes(query);

      const matchesClass =
        classFilter === "All classes" ||
        student.className === classFilter;

      const matchesStatus =
        statusFilter === "All statuses" ||
        student.status === statusFilter;

      return (
        matchesAcademicYear &&
        matchesSearch &&
        matchesClass &&
        matchesStatus
      );
    });
  }, [
    students,
    search,
    classFilter,
    statusFilter,
    selectedAcademicYearId,
  ]);

  const activeStudents = students.filter(
    (student) => student.status === "Active",
  ).length;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        eyebrow="School"
        title="Students"
        description="Manage student records, enrollment and parent information."
        actions={
          <Button
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={16} />
            Add student
          </Button>
        }
      />

      {academicYears.length > 0 && (
        <Card className="mb-5">
          <div className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Current academic year
                  </p>

                  {academicYears.find(
                    (year) => year.id === selectedAcademicYearId,
                  )?.is_active && (
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                      Active
                    </span>
                  )}
                </div>

                <h2 className="mt-1 text-lg font-semibold text-slate-900">
                  {academicYears.find(
                    (year) => year.id === selectedAcademicYearId,
                  )?.name ?? "No academic year selected"}
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Manage students enrolled during this academic year.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  value={selectedAcademicYearId}
                  onChange={(event) => {
                    setSelectedAcademicYearId(event.target.value);
                    setClassFilter("All classes");
                  }}
                  className="h-10 min-w-[220px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  {academicYears.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                      {year.is_active ? " • Active" : ""}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => navigate("/academic-years")}
                  className="h-10 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                >
                  Manage academic years
                </button>
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        {/* Toolbar */}
        <div className="border-b border-slate-200 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search by name, student ID or parent..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                value={classFilter}
                onChange={(event) =>
                  setClassFilter(event.target.value)
                }
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                {classes.map((item) => (
                  <option key={item}>
                    {item}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                {statuses.map((item) => (
                  <option key={item}>
                    {item}
                  </option>
                ))}
              </select>

              <Button
                variant="secondary"
                size="md"
              >
                <SlidersHorizontal size={16} />
                Filters
              </Button>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <p className="text-sm text-slate-500">
            Showing{" "}
            <span className="font-medium text-slate-900">
              {filteredStudents.length}
            </span>{" "}
            students
          </p>

          <p className="hidden text-xs text-slate-400 sm:block">
            {activeStudents} active students
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="border-b border-red-100 bg-red-50 px-5 py-3">
            <p className="text-sm text-red-600">
              {error}
            </p>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <div className="text-sm text-slate-500">
              Loading students...
            </div>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-left">
                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Student
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Student ID
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Class
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Parent / Guardian
                    </th>

                    <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>

                    <th className="w-12 px-5 py-3" />
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map(
                    (student) => (
                      <tr
                        key={student.id}
                        className="group transition hover:bg-slate-50"
                      >
                        <td className="px-5 py-4">
                          <button
                            onClick={() =>
                              navigate(
                                `/students/${student.id}`,
                              )
                            }
                            className="flex items-center gap-3 text-left"
                          >
                            {student.photoUrl ? (
                              <img
                                src={student.photoUrl}
                                alt={student.name}
                                className="h-10 w-10 rounded-full object-cover"
                              />
                            ) : (
                              <Avatar name={student.name} />
                            )}

                            <div>
                              <div className="text-sm font-medium text-slate-900 group-hover:text-indigo-700">
                                {student.name}
                              </div>

                              <div className="mt-0.5 text-xs text-slate-400">
                                {student.gender}
                              </div>
                            </div>
                          </button>
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-600">
                          {student.studentId}
                        </td>

                        <td className="px-5 py-4">
                          <span className="text-sm font-medium text-slate-700">
                            {student.className}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="text-sm text-slate-700">
                            {student.parent}
                          </div>

                          <div className="mt-0.5 text-xs text-slate-400">
                            {student.parentPhone}
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <Badge
                            variant={
                              student.status ===
                              "Active"
                                ? "success"
                                : "default"
                            }
                          >
                            {student.status}
                          </Badge>
                        </td>

                        <td className="px-5 py-4">
                          <button
                            onClick={() =>
                              setSelectedStudent(
                                student,
                              )
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100"
                          >
                            <MoreHorizontal
                              size={17}
                            />
                          </button>
                        </td>
                      </tr>
                    ),
                  )}

                  {filteredStudents.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-16 text-center"
                      >
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                          <UserRound size={18} />
                        </div>

                        <h3 className="mt-3 text-sm font-semibold text-slate-900">
                          No students found
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          Try changing your search
                          or filters.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
              <p className="text-xs text-slate-500">
                Page 1 of 1
              </p>

              <div className="flex gap-1">
                <button
                  disabled
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-300"
                >
                  <ChevronLeft size={15} />
                </button>

                <button className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-xs font-medium text-white">
                  1
                </button>

                <button
                  disabled
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-300"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          </>
        )}
      </Card>

      {showAddModal && (
        <AddStudentModal
          classes={classesForSelectedYear}
          schoolId={school?.id ?? ""}
          onClose={() =>
            setShowAddModal(false)
          }
          onCreated={async () => {
            setShowAddModal(false);
            await loadData();
          }}
        />
      )}

      {selectedStudent && (
        <StudentDetails
          student={selectedStudent}
          onClose={() =>
            setSelectedStudent(null)
          }
        />
      )}
    </div>
  );
}

interface AddStudentModalProps {
  classes: SchoolClass[];
  schoolId: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}

function AddStudentModal({
  classes,
  schoolId,
  onClose,
  onCreated,
}: AddStudentModalProps) {
  const [firstName, setFirstName] =
    useState("");

  const [lastName, setLastName] =
    useState("");

  const [dateOfBirth, setDateOfBirth] =
    useState("");

  const [nationality, setNationality] =
    useState("Rwandan");

  const [photoFile, setPhotoFile] =
    useState<File | null>(null);

  const [photoPreview, setPhotoPreview] =
    useState("");

  const [classId, setClassId] =
    useState("");

  const [parent, setParent] =
    useState("");

  const [parentPhone, setParentPhone] =
    useState("");

  const [gender, setGender] =
    useState<"Male" | "Female">("Male");

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  async function handleSubmit(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (!schoolId) {
      setError(
        "No school is associated with your account.",
      );
      return;
    }

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

    if (!parent.trim()) {
      setError(
        "Parent or guardian name is required.",
      );
      return;
    }

    setSaving(true);
    setError("");

    let uploadedPhotoUrl = "";

    if (photoFile) {
      const extension =
        photoFile.name.split(".").pop()?.toLowerCase() || "jpg";

      const filePath = `${schoolId}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("student-photos")
        .upload(filePath, photoFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: photoFile.type,
        });

      if (uploadError) {
        console.error(
          "Failed to upload student photo:",
          uploadError,
        );

        setError(
          `Photo upload failed: ${uploadError.message}`,
        );
        setSaving(false);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage
        .from("student-photos")
        .getPublicUrl(filePath);

      uploadedPhotoUrl = publicUrl;
    }

    const { data, error: createError } =
      await supabase.rpc("create_student", {
        p_school_id: schoolId,
        p_first_name: firstName.trim(),
        p_last_name: lastName.trim(),
        p_gender: gender,
        p_class_id: classId,
        p_date_of_birth: dateOfBirth || null,
        p_nationality: nationality.trim() || null,
        p_photo_url: uploadedPhotoUrl || null,
        p_parent_name: parent.trim(),
        p_parent_phone:
          parentPhone.trim() || "",
      });

    if (createError) {
      console.error(
        "Failed to create student:",
        createError,
      );

      setError(createError.message);
      setSaving(false);
      return;
    }

    if (!data) {
      setError(
        "Student was not created.",
      );
      setSaving(false);
      return;
    }

    await onCreated();

    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Add student
            </h2>

            <p className="mt-0.5 text-xs text-slate-500">
              Create a new student record.
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
                <p className="text-sm text-red-600">
                  {error}
                </p>
              </div>
            )}

            {/* Student */}
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Student information
              </h3>

              <div className="mt-3 grid gap-4 sm:grid-cols-2">
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
                  label="Date of birth"
                  value={dateOfBirth}
                  onChange={setDateOfBirth}
                  type="date"
                />

                <Field
                  label="Nationality"
                  value={nationality}
                  onChange={setNationality}
                  placeholder="e.g. Rwandan"
                />

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Gender
                  </label>

                  <select
                    value={gender}
                    onChange={(event) =>
                      setGender(
                        event.target.value as
                          | "Male"
                          | "Female",
                      )
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="Male">
                      Male
                    </option>

                    <option value="Female">
                      Female
                    </option>
                  </select>
                </div>

                {/* REAL CLASS SELECT */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Class
                  </label>

                  <select
                    value={classId}
                    onChange={(event) =>
                      setClassId(
                        event.target.value,
                      )
                    }
                    required
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">
                      Select class
                    </option>

                    {classes.map((schoolClass) => (
                      <option
                        key={schoolClass.id}
                        value={schoolClass.id}
                      >
                        {schoolClass.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Profile picture
                  </label>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-dashed border-slate-300 bg-slate-50">
                      {photoPreview ? (
                        <img
                          src={photoPreview}
                          alt="Student preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <UserRound
                          size={28}
                          className="text-slate-300"
                        />
                      )}
                    </div>

                    <div>
                      <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        <ImagePlus size={16} />
                        {photoFile ? "Change photo" : "Upload photo"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(event) => {
                            const file =
                              event.target.files?.[0] ?? null;

                            if (!file) return;

                            if (file.size > 5 * 1024 * 1024) {
                              setError(
                                "Photo must be 5 MB or smaller.",
                              );
                              return;
                            }

                            setError("");
                            setPhotoFile(file);

                            const previewUrl =
                              URL.createObjectURL(file);
                            setPhotoPreview(previewUrl);
                          }}
                        />
                      </label>

                      <p className="mt-1.5 text-[11px] text-slate-400">
                        JPG, PNG or WebP • Maximum 5 MB
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Parent */}
            <div className="border-t border-slate-100 pt-5">
              <h3 className="text-sm font-semibold text-slate-900">
                Parent / guardian
              </h3>

              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field
                  label="Parent / guardian name"
                  value={parent}
                  onChange={setParent}
                  required
                />

                <Field
                  label="Phone number"
                  value={parentPhone}
                  onChange={setParentPhone}
                  placeholder="+250 7XX XXX XXX"
                />
              </div>
            </div>
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
              disabled={saving}
            >
              {saving
                ? "Creating..."
                : "Add student"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

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
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        required={required}
        className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
      />
    </div>
  );
}

interface StudentDetailsProps {
  student: Student;
  onClose: () => void;
}

function StudentDetails({
  student,
  onClose,
}: StudentDetailsProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-6">
          <div className="flex items-center gap-3">
            {student.photoUrl ? (
              <img
                src={student.photoUrl}
                alt={student.name}
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <Avatar
                name={student.name}
                size="lg"
              />
            )}

            <div>
              <h2 className="font-semibold text-slate-900">
                {student.name}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {student.studentId}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100"
          >
            <X size={17} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-px bg-slate-200">
          <InfoItem
            label="Class"
            value={student.className}
          />

          <InfoItem
            label="Gender"
            value={student.gender}
          />

          <InfoItem
            label="Date of birth"
            value={
              student.dateOfBirth
                ? formatDate(student.dateOfBirth)
                : "—"
            }
          />

          <InfoItem
            label="Age"
            value={
              student.age === null
                ? "—"
                : `${student.age} ${student.age === 1 ? "year" : "years"}`
            }
          />

          <InfoItem
            label="Nationality"
            value={student.nationality || "—"}
          />

          <InfoItem
            label="Parent"
            value={student.parent}
          />

          <InfoItem
            label="Phone"
            value={student.parentPhone}
          />

          <InfoItem
            label="Status"
            value={student.status}
          />

          <InfoItem
            label="Enrolled"
            value={student.enrolledDate}
          />
        </div>

        <div className="flex justify-end border-t border-slate-200 p-4">
          <Button
            variant="secondary"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="bg-white p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </div>

      <div className="mt-1 text-sm font-medium text-slate-900">
        {value}
      </div>
    </div>
  );
}