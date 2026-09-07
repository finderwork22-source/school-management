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
import { getStudents, type Student } from "../lib/students";
import { getClasses, type SchoolClass } from "../lib/classes";
import { supabase } from "../lib/supabase";

import Button from "../components/ui/Button";
import Card from "../components/ui/Card";
import Badge from "../components/ui/Badge";
import Avatar from "../components/ui/Avatar";
import PageHeader from "../components/ui/PageHeader";

interface AcademicYear {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
}

interface AcademicSection {
  id: string;
  academic_year_id: string;
  name: string;
  display_order: number;
  is_active: boolean;
}

const statuses = ["All statuses", "Active", "Inactive"];

export default function Students() {
  const navigate = useNavigate();
  const { school } = useSchool();

  const [students, setStudents] = useState<Student[]>([]);
  const [schoolClasses, setSchoolClasses] = useState<SchoolClass[]>([]);

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState("");
  const [academicSections, setAcademicSections] = useState<AcademicSection[]>(
    [],
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("All sections");
  const [classFilter, setClassFilter] = useState("All classes");
  const [statusFilter, setStatusFilter] = useState("All statuses");

  const [showAddModal, setShowAddModal] = useState(false);

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

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
      { data: studentsData, error: studentsError },
      { data: classesData, error: classesError },
      { data: academicYearsData, error: academicYearsError },
      { data: sectionsData, error: sectionsError },
    ] = await Promise.all([
      getStudents(school.id),
      getClasses(school.id),
      supabase
        .from("academic_years")
        .select("id, name, start_date, end_date, is_active")
        .eq("school_id", school.id)
        .order("name", { ascending: false }),
      supabase
        .from("academic_sections")
        .select("id, academic_year_id, name, display_order, is_active")
        .eq("school_id", school.id)
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
    ]);

    if (studentsError) {
      console.error("Failed to load students:", studentsError);

      setError(studentsError.message);
      setStudents([]);
    } else {
      setStudents(studentsData);
    }

    if (classesError) {
      console.error("Failed to load classes:", classesError);

      setError(classesError.message);
      setSchoolClasses([]);
    } else {
      setSchoolClasses(classesData);
    }

    if (sectionsError) {
      console.error("Failed to load academic sections:", sectionsError);
      setError(sectionsError.message);
      setAcademicSections([]);
    } else {
      setAcademicSections((sectionsData ?? []) as AcademicSection[]);
    }

    if (academicYearsError) {
      console.error("Failed to load academic years:", academicYearsError);

      setError(academicYearsError.message);
      setAcademicYears([]);
    } else {
      const loadedAcademicYears = academicYearsData ?? [];
      setAcademicYears(loadedAcademicYears);

      // New student enrollment always uses the single active academic year.
      const activeYear = loadedAcademicYears.find((year) => year.is_active);

      setSelectedAcademicYearId(activeYear?.id ?? "");
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, [school]);

  const activeAcademicYear = useMemo(
    () => academicYears.find((year) => year.is_active) ?? null,
    [academicYears],
  );

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

  const sectionsForSelectedYear = useMemo(() => {
    // Only show active sections belonging to the active academic year.
    // Deduplicate by section name as an extra safeguard against duplicate
    // records in the database.
    const unique = new Map<string, AcademicSection>();

    academicSections
      .filter(
        (section) =>
          section.is_active &&
          section.academic_year_id === activeAcademicYear?.id,
      )
      .sort((a, b) => a.display_order - b.display_order)
      .forEach((section) => {
        const key = section.name.trim().toLowerCase();

        if (!unique.has(key)) {
          unique.set(key, section);
        }
      });

    return Array.from(unique.values());
  }, [academicSections, activeAcademicYear?.id]);

  const sections = useMemo(
    () => ["All sections", ...sectionsForSelectedYear.map((item) => item.name)],
    [sectionsForSelectedYear],
  );

  const classesForSelectedSection = useMemo(() => {
    if (sectionFilter === "All sections") return classesForSelectedYear;
    const section = sectionsForSelectedYear.find(
      (item) => item.name === sectionFilter,
    );
    return classesForSelectedYear.filter(
      (item) => item.academic_section_id === section?.id,
    );
  }, [classesForSelectedYear, sectionFilter, sectionsForSelectedYear]);

  const classes = useMemo(
    () => [
      "All classes",
      ...classesForSelectedSection.map((item) => item.name),
    ],
    [classesForSelectedSection],
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
        student.studentId.toLowerCase().includes(query) ||
        student.parent.toLowerCase().includes(query);

      const matchesSection =
        sectionFilter === "All sections" ||
        student.sectionName === sectionFilter;

      const matchesClass =
        classFilter === "All classes" || student.className === classFilter;

      const matchesStatus =
        statusFilter === "All statuses" || student.status === statusFilter;

      return (
        matchesAcademicYear &&
        matchesSearch &&
        matchesSection &&
        matchesClass &&
        matchesStatus
      );
    });
  }, [
    students,
    search,
    sectionFilter,
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
          <Button onClick={() => setShowAddModal(true)}>
            <Plus size={16} />
            Add student
          </Button>
        }
      />

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
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, student ID or parent..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                value={sectionFilter}
                onChange={(event) => {
                  setSectionFilter(event.target.value);
                  setClassFilter("All classes");
                }}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                {sections.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>

              <select
                value={classFilter}
                onChange={(event) => setClassFilter(event.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                {classes.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              >
                {statuses.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>

              <Button variant="secondary" size="md">
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
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <div className="text-sm text-slate-500">Loading students...</div>
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
                      Section
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
                  {filteredStudents.map((student) => (
                    <tr
                      key={student.id}
                      className="group transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <button
                          onClick={() => navigate(`/students/${student.id}`)}
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
                          {student.sectionName}
                        </span>
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
                            student.status === "Active" ? "success" : "default"
                          }
                        >
                          {student.status}
                        </Badge>
                      </td>

                      <td className="px-5 py-4">
                        <button
                          onClick={() => setSelectedStudent(student)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 group-hover:opacity-100"
                        >
                          <MoreHorizontal size={17} />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {filteredStudents.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-16 text-center">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                          <UserRound size={18} />
                        </div>

                        <h3 className="mt-3 text-sm font-semibold text-slate-900">
                          No students found
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          Try changing your search or filters.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
              <p className="text-xs text-slate-500">Page 1 of 1</p>

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
          academicYear={activeAcademicYear}
          sections={sectionsForSelectedYear}
          classes={schoolClasses}
          schoolId={school?.id ?? ""}
          onClose={() => setShowAddModal(false)}
          onCreated={async () => {
            setShowAddModal(false);
            await loadData();
          }}
        />
      )}

      {selectedStudent && (
        <StudentDetails
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  );
}

interface AddStudentModalProps {
  academicYear: AcademicYear | null;
  sections: AcademicSection[];
  classes: SchoolClass[];
  schoolId: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}

function AddStudentModal({
  academicYear,
  sections,
  classes,
  schoolId,
  onClose,
  onCreated,
}: AddStudentModalProps) {
  const [firstName, setFirstName] = useState("");

  const [lastName, setLastName] = useState("");

  const [dateOfBirth, setDateOfBirth] = useState("");

  const [nationality, setNationality] = useState("Rwandan");

  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const [photoPreview, setPhotoPreview] = useState("");

  const [sectionId, setSectionId] = useState("");

  const [classId, setClassId] = useState("");

  const [parent, setParent] = useState("");

  const [parentPhone, setParentPhone] = useState("");

  const [gender, setGender] = useState<"Male" | "Female">("Male");

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  const classesForSection = useMemo(() => {
    if (!sectionId) return [];
    return classes.filter(
      (schoolClass) =>
        schoolClass.academic_section_id === sectionId &&
        schoolClass.is_active &&
        schoolClass.academic_year_id === academicYear?.id,
    );
  }, [classes, sectionId, academicYear?.id]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!schoolId) {
      setError("No school is associated with your account.");
      return;
    }

    if (!academicYear) {
      setError("No active academic year is configured.");
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

    if (!sectionId) {
      setError("Please select a section.");
      return;
    }

    if (!classId) {
      setError("Please select a class.");
      return;
    }

    if (!parent.trim()) {
      setError("Parent or guardian name is required.");
      return;
    }

    setSaving(true);
    setError("");

    let uploadedPhotoUrl = "";

    if (photoFile) {
      const extension = photoFile.name.split(".").pop()?.toLowerCase() || "jpg";

      const filePath = `${schoolId}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("student-photos")
        .upload(filePath, photoFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: photoFile.type,
        });

      if (uploadError) {
        console.error("Failed to upload student photo:", uploadError);

        setError(`Photo upload failed: ${uploadError.message}`);
        setSaving(false);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("student-photos").getPublicUrl(filePath);

      uploadedPhotoUrl = publicUrl;
    }

    const { data, error: createError } = await supabase.rpc("create_student", {
      p_school_id: schoolId,
      p_first_name: firstName.trim(),
      p_last_name: lastName.trim(),
      p_gender: gender,
      p_class_id: classId,
      p_date_of_birth: dateOfBirth || null,
      p_nationality: nationality.trim() || null,
      p_photo_url: uploadedPhotoUrl || null,
      p_parent_name: parent.trim(),
      p_parent_phone: parentPhone.trim() || "",
    });

    if (createError) {
      console.error("Failed to create student:", createError);

      setError(createError.message);
      setSaving(false);
      return;
    }

    if (!data) {
      setError("Student was not created.");
      setSaving(false);
      return;
    }

    await onCreated();

    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
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

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-6">
            {error && (
              <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3">
                <p className="text-sm text-red-600">{error}</p>
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
                      setGender(event.target.value as "Male" | "Female")
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="Male">Male</option>

                    <option value="Female">Female</option>
                  </select>
                </div>

                {/* ACTIVE ACADEMIC YEAR */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Academic Year
                  </label>

                  <div className="flex h-10 items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
                    <span>
                      {academicYear?.name ?? "No active academic year"}
                    </span>

                    {academicYear && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        Active
                      </span>
                    )}
                  </div>
                </div>

                {/* SECTION */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Section
                  </label>

                  <select
                    value={sectionId}
                    onChange={(event) => {
                      setSectionId(event.target.value);
                      setClassId("");

                    }}
                    required
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">Select section</option>

                    {sections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* CLASS */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-700">
                    Class
                  </label>

                  <select
                    value={classId}
                    onChange={(event) => {
                      setClassId(event.target.value);

                    }}
                    required
                    disabled={!sectionId}
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none disabled:bg-slate-50 disabled:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  >
                    <option value="">
                      {sectionId ? "Select class" : "Select section first"}
                    </option>

                    {classesForSection.map((schoolClass) => (
                      <option key={schoolClass.id} value={schoolClass.id}>
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
                        <UserRound size={28} className="text-slate-300" />
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
                            const file = event.target.files?.[0] ?? null;

                            if (!file) return;

                            if (file.size > 5 * 1024 * 1024) {
                              setError("Photo must be 5 MB or smaller.");
                              return;
                            }

                            setError("");
                            setPhotoFile(file);

                            const previewUrl = URL.createObjectURL(file);
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
          <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>

            <Button type="submit" disabled={saving}>
              {saving ? "Creating..." : "Add student"}
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
        onChange={(event) => onChange(event.target.value)}
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

function StudentDetails({ student, onClose }: StudentDetailsProps) {
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
              <Avatar name={student.name} size="lg" />
            )}

            <div>
              <h2 className="font-semibold text-slate-900">{student.name}</h2>

              <p className="mt-1 text-sm text-slate-500">{student.studentId}</p>
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
          <InfoItem label="Section" value={student.sectionName} />

          <InfoItem label="Class" value={student.className} />

          <InfoItem label="Gender" value={student.gender} />

          <InfoItem
            label="Date of birth"
            value={student.dateOfBirth ? formatDate(student.dateOfBirth) : "—"}
          />

          <InfoItem
            label="Age"
            value={
              student.age === null
                ? "—"
                : `${student.age} ${student.age === 1 ? "year" : "years"}`
            }
          />

          <InfoItem label="Nationality" value={student.nationality || "—"} />

          <InfoItem label="Parent" value={student.parent} />

          <InfoItem label="Phone" value={student.parentPhone} />

          <InfoItem label="Status" value={student.status} />

          <InfoItem label="Enrolled" value={student.enrolledDate} />
        </div>

        <div className="flex justify-end border-t border-slate-200 p-4">
          <Button variant="secondary" onClick={onClose}>
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

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </div>

      <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
    </div>
  );
}
