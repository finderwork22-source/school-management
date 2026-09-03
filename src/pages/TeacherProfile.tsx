import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Edit3,
  Mail,
  Phone,
  Plus,
  UserRound,
  X,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

interface Teacher {
  id: string;
  teacher_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  nationality: string | null;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
  status: "Active" | "Inactive";
  joined_date: string;
}

interface Assignment {
  id: string;
  academic_year_id: string;
  class_id: string;
  subject_id: string;
  academicYearName: string;
  className: string;
  subjectName: string;
}

interface AcademicYear {
  id: string;
  name: string;
  is_active: boolean;
}

interface SchoolClass {
  id: string;
  name: string;
  academic_year_id: string | null;
  is_active: boolean;
}

interface ClassSubject {
  class_id: string;
  subject_id: string;
  subjectName: string;
  subjectActive: boolean;
}

function fullName(teacher: Teacher) {
  return [teacher.first_name, teacher.middle_name, teacher.last_name]
    .filter(Boolean)
    .join(" ");
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function TeacherProfile() {
  const { id: routeId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [schoolId, setSchoolId] = useState("");
  const [teacher, setTeacher] = useState<Teacher | null>(null);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAssignmentModal, setShowAssignmentModal] =
    useState(false);

  const [savingAssignment, setSavingAssignment] =
    useState(false);

  const [removingAssignmentId, setRemovingAssignmentId] =
    useState("");

  const [assignmentError, setAssignmentError] =
    useState("");

  const [selectedAcademicYearId, setSelectedAcademicYearId] =
    useState("");

  const [selectedClassId, setSelectedClassId] =
    useState("");

  const [selectedSubjectId, setSelectedSubjectId] =
    useState("");

  /*
   * Find teacher.
   *
   * We support BOTH:
   *
   * 1. teachers.id       → UUID
   * 2. teachers.teacher_id → human-readable ID such as T-001
   *
   * Once found, the real UUID is stored in teacher.id
   * and used for teacher_assignments.
   */
  async function findTeacher(
    currentSchoolId: string,
    identifier: string,
  ) {
    const byUuid = await supabase
      .from("teachers")
      .select(`
        id,
        teacher_id,
        first_name,
        middle_name,
        last_name,
        date_of_birth,
        gender,
        nationality,
        phone,
        email,
        photo_url,
        status,
        joined_date
      `)
      .eq("id", identifier)
      .eq("school_id", currentSchoolId)
      .maybeSingle();

    if (byUuid.error) {
      return byUuid;
    }

    if (byUuid.data) {
      return byUuid;
    }

    /*
     * Fallback to Teacher ID.
     */
    return supabase
      .from("teachers")
      .select(`
        id,
        teacher_id,
        first_name,
        middle_name,
        last_name,
        date_of_birth,
        gender,
        nationality,
        phone,
        email,
        photo_url,
        status,
        joined_date
      `)
      .eq("teacher_id", identifier)
      .eq("school_id", currentSchoolId)
      .maybeSingle();
  }

  /*
   * Load teacher profile and related academic data.
   */
  async function loadProfile() {
    if (!routeId) {
      setError("Teacher was not found.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError(
        "You must be signed in to view this teacher.",
      );

      setLoading(false);
      return;
    }

    /*
     * Find the school belonging to the logged-in user.
     */
    const {
      data: membership,
      error: membershipError,
    } = await supabase
      .from("school_members")
      .select("school_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (
      membershipError ||
      !membership?.school_id
    ) {
      setError(
        membershipError?.message ??
          "No school is associated with your account.",
      );

      setLoading(false);
      return;
    }

    const currentSchoolId =
      membership.school_id;

    setSchoolId(currentSchoolId);

    /*
     * IMPORTANT:
     * Find the teacher first.
     */
    const teacherResult =
      await findTeacher(
        currentSchoolId,
        routeId,
      );

    if (
      teacherResult.error ||
      !teacherResult.data
    ) {
      setError(
        teacherResult.error?.message ??
          `Teacher "${routeId}" could not be found.`,
      );

      setTeacher(null);
      setLoading(false);
      return;
    }

    const teacherData =
      teacherResult.data as Teacher;

    /*
     * Store the actual teacher record.
     */
    setTeacher(teacherData);

    /*
     * Now load all related data using the
     * teacher UUID: teacherData.id
     */
    const [
      assignmentResult,
      academicYearsResult,
      classesResult,
      classSubjectsResult,
    ] = await Promise.all([
      /*
       * Teacher assignments
       */
      supabase
        .from("teacher_assignments")
        .select(`
          id,
          academic_year_id,
          class_id,
          subject_id,
          academic_years ( name ),
          classes ( name ),
          subjects ( name )
        `)
        .eq(
          "teacher_id",
          teacherData.id,
        )
        .eq(
          "school_id",
          currentSchoolId,
        ),

      /*
       * Academic years
       */
      supabase
        .from("academic_years")
        .select(
          "id, name, is_active",
        )
        .eq(
          "school_id",
          currentSchoolId,
        )
        .order(
          "name",
          { ascending: false },
        ),

      /*
       * Classes
       */
      supabase
        .from("classes")
        .select(
          "id, name, academic_year_id, is_active",
        )
        .eq(
          "school_id",
          currentSchoolId,
        )
        .eq(
          "is_active",
          true,
        )
        .order("name"),

      /*
       * Subjects assigned to classes
       */
      supabase
        .from("class_subjects")
        .select(`
          class_id,
          subject_id,
          subjects (
            name,
            is_active
          )
        `)
        .eq(
          "school_id",
          currentSchoolId,
        ),
    ]);

    if (assignmentResult.error) {
      setError(
        assignmentResult.error.message,
      );

      setAssignments([]);
      setLoading(false);
      return;
    }

    if (academicYearsResult.error) {
      setError(
        academicYearsResult.error.message,
      );

      setLoading(false);
      return;
    }

    if (classesResult.error) {
      setError(
        classesResult.error.message,
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

    setAcademicYears(
      (academicYearsResult.data ??
        []) as AcademicYear[],
    );

    setClasses(
      (classesResult.data ??
        []) as SchoolClass[],
    );

    /*
     * Map class subjects.
     */
    const mappedClassSubjects:
      ClassSubject[] =
      (classSubjectsResult.data ??
        []).map((item) => {
          const subject =
            Array.isArray(item.subjects)
              ? item.subjects[0]
              : item.subjects;

          return {
            class_id:
              item.class_id,

            subject_id:
              item.subject_id,

            subjectName:
              subject?.name ??
              "Unknown subject",

            subjectActive:
              subject?.is_active ??
              false,
          };
        });

    setClassSubjects(
      mappedClassSubjects,
    );

    /*
     * Map teacher assignments.
     */
    const mappedAssignments:
      Assignment[] =
      (assignmentResult.data ??
        []).map((item) => {
          const year =
            Array.isArray(
              item.academic_years,
            )
              ? item.academic_years[0]
              : item.academic_years;

          const classData =
            Array.isArray(
              item.classes,
            )
              ? item.classes[0]
              : item.classes;

          const subject =
            Array.isArray(
              item.subjects,
            )
              ? item.subjects[0]
              : item.subjects;

          return {
            id: item.id,

            academic_year_id:
              item.academic_year_id,

            class_id:
              item.class_id,

            subject_id:
              item.subject_id,

            academicYearName:
              year?.name ??
              "Unknown academic year",

            className:
              classData?.name ??
              "Unknown class",

            subjectName:
              subject?.name ??
              "Unknown subject",
          };
        });

    setAssignments(
      mappedAssignments,
    );

    setLoading(false);
  }

  useEffect(() => {
    void loadProfile();
  }, [routeId]);

  /*
   * Classes belonging to selected academic year.
   */
  const availableClasses =
    useMemo(
      () =>
        classes.filter(
          (schoolClass) =>
            schoolClass.academic_year_id ===
              selectedAcademicYearId &&
            schoolClass.is_active,
        ),
      [
        classes,
        selectedAcademicYearId,
      ],
    );

  /*
   * Subjects already assigned to selected class.
   */
  const availableSubjects =
    useMemo(
      () =>
        classSubjects.filter(
          (item) =>
            item.class_id ===
              selectedClassId &&
            item.subjectActive,
        ),
      [
        classSubjects,
        selectedClassId,
      ],
    );

  /*
   * Group assignments by academic year + class.
   */
  const groupedAssignments =
    useMemo(() => {
      const groups = new Map<
        string,
        {
          academicYearName: string;
          className: string;
          classId: string;
          academicYearId: string;
          subjects: {
            id: string;
            subjectId: string;
            name: string;
          }[];
        }
      >();

      assignments.forEach(
        (assignment) => {
          const key =
            `${assignment.academic_year_id}-${assignment.class_id}`;

          const existing =
            groups.get(key);

          if (existing) {
            if (
              !existing.subjects.some(
                (subject) =>
                  subject.id ===
                  assignment.id,
              )
            ) {
              existing.subjects.push({
                id: assignment.id,
                subjectId:
                  assignment.subject_id,
                name:
                  assignment.subjectName,
              });
            }
          } else {
            groups.set(key, {
              academicYearName:
                assignment.academicYearName,

              className:
                assignment.className,

              classId:
                assignment.class_id,

              academicYearId:
                assignment.academic_year_id,

              subjects: [
                {
                  id: assignment.id,
                  subjectId:
                    assignment.subject_id,
                  name:
                    assignment.subjectName,
                },
              ],
            });
          }
        },
      );

      return Array.from(
        groups.values(),
      );
    }, [assignments]);

  /*
   * Open fresh assignment modal.
   */
  function openAssignmentModal() {
    const activeYear =
      academicYears.find(
        (year) =>
          year.is_active,
      ) ??
      academicYears[0];

    setSelectedAcademicYearId(
      activeYear?.id ?? "",
    );

    setSelectedClassId("");

    setSelectedSubjectId("");

    setAssignmentError("");

    setShowAssignmentModal(
      true,
    );
  }

  /*
   * Add another subject to an existing class.
   */
  function openAddSubject(
    academicYearId: string,
    classId: string,
  ) {
    setSelectedAcademicYearId(
      academicYearId,
    );

    setSelectedClassId(
      classId,
    );

    setSelectedSubjectId("");

    setAssignmentError("");

    setShowAssignmentModal(
      true,
    );
  }

  /*
   * Save teacher assignment.
   */
  async function saveAssignment(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!teacher || !schoolId) {
      setAssignmentError(
        "Teacher information is not available.",
      );

      return;
    }

    if (
      !selectedAcademicYearId ||
      !selectedClassId ||
      !selectedSubjectId
    ) {
      setAssignmentError(
        "Academic year, class and subject are required.",
      );

      return;
    }

    const selectedClass =
      classes.find(
        (item) =>
          item.id ===
          selectedClassId,
      );

    if (
      !selectedClass ||
      selectedClass.academic_year_id !==
        selectedAcademicYearId
    ) {
      setAssignmentError(
        "The selected class does not belong to the selected academic year.",
      );

      return;
    }

    const selectedSubject =
      availableSubjects.find(
        (item) =>
          item.subject_id ===
          selectedSubjectId,
      );

    if (!selectedSubject) {
      setAssignmentError(
        "The selected subject is not assigned to this class.",
      );

      return;
    }

    /*
     * Prevent duplicate teacher assignment.
     */
    const alreadyAssigned =
      assignments.some(
        (assignment) =>
          assignment.academic_year_id ===
            selectedAcademicYearId &&
          assignment.class_id ===
            selectedClassId &&
          assignment.subject_id ===
            selectedSubjectId,
      );

    if (alreadyAssigned) {
      setAssignmentError(
        "This teacher is already assigned to this class and subject.",
      );

      return;
    }

    setSavingAssignment(
      true,
    );

    setAssignmentError("");

    /*
     * IMPORTANT:
     * Use teacher.id, NOT teacher.teacher_id.
     */
    const {
      data,
      error: insertError,
    } = await supabase
      .from("teacher_assignments")
      .insert({
        school_id:
          schoolId,

        teacher_id:
          teacher.id,

        academic_year_id:
          selectedAcademicYearId,

        class_id:
          selectedClassId,

        subject_id:
          selectedSubjectId,
      })
      .select("id")
      .single();

    if (insertError) {
      setAssignmentError(
        insertError.message,
      );

      setSavingAssignment(
        false,
      );

      return;
    }

    const academicYear =
      academicYears.find(
        (year) =>
          year.id ===
          selectedAcademicYearId,
      );

    setAssignments(
      (current) => [
        ...current,

        {
          id: data.id,

          academic_year_id:
            selectedAcademicYearId,

          class_id:
            selectedClassId,

          subject_id:
            selectedSubjectId,

          academicYearName:
            academicYear?.name ??
            "Unknown academic year",

          className:
            selectedClass.name,

          subjectName:
            selectedSubject.subjectName,
        },
      ],
    );

    setSavingAssignment(
      false,
    );

    setShowAssignmentModal(
      false,
    );
  }

  /*
   * Remove a teacher assignment.
   */
  async function removeAssignment(
    assignmentId: string,
  ) {
    if (!schoolId) return;

    const confirmed =
      window.confirm(
        "Remove this teaching assignment?",
      );

    if (!confirmed) {
      return;
    }

    setRemovingAssignmentId(
      assignmentId,
    );

    setError("");

    const {
      error: deleteError,
    } = await supabase
      .from("teacher_assignments")
      .delete()
      .eq(
        "id",
        assignmentId,
      )
      .eq(
        "school_id",
        schoolId,
      );

    if (deleteError) {
      setError(
        deleteError.message,
      );

      setRemovingAssignmentId(
        "",
      );

      return;
    }

    setAssignments(
      (current) =>
        current.filter(
          (assignment) =>
            assignment.id !==
            assignmentId,
        ),
    );

    setRemovingAssignmentId(
      "",
    );
  }

  /*
   * Loading state.
   */
  if (loading) {
    return (
      <div className="mx-auto max-w-[1100px]">
        <div className="flex min-h-[300px] items-center justify-center">
          <p className="text-sm text-slate-500">
            Loading teacher profile...
          </p>
        </div>
      </div>
    );
  }

  /*
   * Teacher not found.
   */
  if (!teacher) {
    return (
      <div className="mx-auto max-w-[1100px]">
        <button
          type="button"
          onClick={() =>
            navigate("/teachers")
          }
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft size={16} />
          Teachers
        </button>

        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ||
            "Teacher was not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px]">

      {/* Back */}
      <button
        type="button"
        onClick={() =>
          navigate("/teachers")
        }
        className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft size={16} />
        Teachers
      </button>

      {/* Error */}
      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* =====================================================
          PROFILE CARD
      ===================================================== */}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        {/* Header */}
        <div className="flex flex-col gap-5 border-b border-slate-200 p-6 sm:flex-row sm:items-center sm:justify-between">

          <div className="flex items-center gap-4">

            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100">

              {teacher.photo_url ? (
                <img
                  src={
                    teacher.photo_url
                  }
                  alt={fullName(
                    teacher,
                  )}
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserRound
                  size={30}
                  className="text-slate-400"
                />
              )}

            </div>

            <div>

              <div className="flex flex-wrap items-center gap-2">

                <h1 className="text-2xl font-semibold text-slate-900">
                  {fullName(
                    teacher,
                  )}
                </h1>

                <span
                  className={[
                    "rounded-full px-2.5 py-1 text-[11px] font-medium",
                    teacher.status ===
                    "Active"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-slate-100 text-slate-500",
                  ].join(" ")}
                >
                  {teacher.status}
                </span>

              </div>

              <p className="mt-1 text-sm text-slate-500">
                Teacher ID:{" "}
                <span className="font-medium text-slate-700">
                  {teacher.teacher_id}
                </span>
              </p>

            </div>

          </div>

          <button
            type="button"
            onClick={() =>
              navigate("/teachers")
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Edit3 size={15} />
            Edit
          </button>

        </div>

        {/* =================================================
            INFORMATION
        ================================================= */}

        <div className="grid gap-6 p-6 lg:grid-cols-2">

          <InfoSection title="Personal Information">

            <InfoRow
              label="Date of birth"
              value={formatDate(
                teacher.date_of_birth,
              )}
            />

            <InfoRow
              label="Gender"
              value={
                teacher.gender ||
                "—"
              }
            />

            <InfoRow
              label="Nationality"
              value={
                teacher.nationality ||
                "—"
              }
            />

          </InfoSection>

          <InfoSection title="Contact Information">

            <InfoRow
              label="Phone"
              value={
                teacher.phone ? (
                  <span className="inline-flex items-center gap-2">
                    <Phone size={14} />
                    {teacher.phone}
                  </span>
                ) : (
                  "—"
                )
              }
            />

            <InfoRow
              label="Email"
              value={
                teacher.email ? (
                  <span className="inline-flex items-center gap-2">
                    <Mail size={14} />
                    {teacher.email}
                  </span>
                ) : (
                  "—"
                )
              }
            />

          </InfoSection>

          <InfoSection title="Employment">

            <InfoRow
              label="Teacher ID"
              value={
                teacher.teacher_id
              }
            />

            <InfoRow
              label="Joined date"
              value={formatDate(
                teacher.joined_date,
              )}
            />

            <InfoRow
              label="Status"
              value={
                teacher.status
              }
            />

          </InfoSection>

        </div>

        {/* =================================================
            TEACHING ASSIGNMENTS
        ================================================= */}

        <div className="border-t border-slate-200 p-6">

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <h2 className="text-base font-semibold text-slate-900">
                Teaching Assignments
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Classes and subjects assigned to this teacher.
              </p>

            </div>

            <button
              type="button"
              onClick={
                openAssignmentModal
              }
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus size={15} />
              Assign Class & Subject
            </button>

          </div>

          {groupedAssignments.length ===
          0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">

              <p className="text-sm font-medium text-slate-700">
                No teaching assignments yet
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Use “Assign Class & Subject” to add this teacher to a class.
              </p>

            </div>
          ) : (
            <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">

              <div className="overflow-x-auto">

                <table className="w-full min-w-[760px]">

                  <thead className="border-b border-slate-200 bg-slate-50">

                    <tr>

                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Academic Year
                      </th>

                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Class
                      </th>

                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Subjects
                      </th>

                      <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                        Actions
                      </th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-slate-100">

                    {groupedAssignments.map(
                      (assignment) => (
                        <tr
                          key={`${assignment.academicYearId}-${assignment.classId}`}
                        >

                          <td className="px-5 py-4 text-sm text-slate-600">
                            {
                              assignment.academicYearName
                            }
                          </td>

                          <td className="px-5 py-4 text-sm font-medium text-slate-800">
                            {
                              assignment.className
                            }
                          </td>

                          <td className="px-5 py-4">

                            <div className="flex flex-wrap gap-2">

                              {assignment.subjects.map(
                                (subject) => (
                                  <span
                                    key={
                                      subject.id
                                    }
                                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
                                  >

                                    {
                                      subject.name
                                    }

                                    <button
                                      type="button"
                                      onClick={() =>
                                        void removeAssignment(
                                          subject.id,
                                        )
                                      }
                                      disabled={
                                        removingAssignmentId ===
                                        subject.id
                                      }
                                      className="rounded-full p-0.5 text-slate-400 hover:bg-red-100 hover:text-red-600 disabled:opacity-50"
                                      title="Remove assignment"
                                    >
                                      <X
                                        size={
                                          11
                                        }
                                      />
                                    </button>

                                  </span>
                                ),
                              )}

                            </div>

                          </td>

                          <td className="px-5 py-4 text-right">

                            <button
                              type="button"
                              onClick={() =>
                                openAddSubject(
                                  assignment.academicYearId,
                                  assignment.classId,
                                )
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                            >
                              <Plus
                                size={13}
                              />
                              Add subject
                            </button>

                          </td>

                        </tr>
                      ),
                    )}

                  </tbody>

                </table>

              </div>

            </div>
          )}

        </div>

      </div>

      {/* =====================================================
          ASSIGNMENT MODAL
      ===================================================== */}

      {showAssignmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">

          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">

            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">

              <div>

                <h2 className="text-lg font-semibold text-slate-900">
                  Assign Class & Subject
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Assign this teacher to a class and subject.
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setShowAssignmentModal(
                    false,
                  )
                }
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>

            </div>

            {/* Form */}
            <form
              onSubmit={
                saveAssignment
              }
              className="space-y-5 p-6"
            >

              {assignmentError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {assignmentError}
                </div>
              )}

              {/* Academic Year */}
              <SelectField
                label="Academic Year"
                value={
                  selectedAcademicYearId
                }
                onChange={(value) => {
                  setSelectedAcademicYearId(
                    value,
                  );

                  setSelectedClassId(
                    "",
                  );

                  setSelectedSubjectId(
                    "",
                  );
                }}
                options={academicYears.map(
                  (year) => ({
                    value:
                      year.id,

                    label:
                      `${year.name}${
                        year.is_active
                          ? " • Active"
                          : ""
                      }`,
                  }),
                )}
              />

              {/* Class */}
              <SelectField
                label="Class"
                value={
                  selectedClassId
                }
                onChange={(value) => {
                  setSelectedClassId(
                    value,
                  );

                  setSelectedSubjectId(
                    "",
                  );
                }}
                options={availableClasses.map(
                  (
                    schoolClass,
                  ) => ({
                    value:
                      schoolClass.id,

                    label:
                      schoolClass.name,
                  }),
                )}
                disabled={
                  !selectedAcademicYearId
                }
              />

              {/* Subject */}
              <SelectField
                label="Subject"
                value={
                  selectedSubjectId
                }
                onChange={
                  setSelectedSubjectId
                }
                options={availableSubjects
                  .filter(
                    (subject) =>
                      !assignments.some(
                        (assignment) =>
                          assignment.class_id ===
                            selectedClassId &&
                          assignment.subject_id ===
                            subject.subject_id,
                      ),
                  )
                  .map(
                    (
                      subject,
                    ) => ({
                      value:
                        subject.subject_id,

                      label:
                        subject.subjectName,
                    }),
                  )}
                disabled={
                  !selectedClassId
                }
              />

              {selectedClassId &&
                availableSubjects.length ===
                  0 && (
                  <p className="text-xs text-amber-600">
                    No subjects are assigned to this class yet. Add subjects
                    to the class in Classes & Subjects first.
                  </p>
                )}

              {/* Actions */}
              <div className="flex justify-end gap-3 border-t border-slate-100 pt-5">

                <button
                  type="button"
                  onClick={() =>
                    setShowAssignmentModal(
                      false,
                    )
                  }
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    savingAssignment ||
                    !selectedAcademicYearId ||
                    !selectedClassId ||
                    !selectedSubjectId
                  }
                  className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingAssignment
                    ? "Assigning..."
                    : "Assign"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}

/* =============================================================
   INFORMATION SECTION
============================================================= */

function InfoSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 p-5">

      <h2 className="text-sm font-semibold text-slate-800">
        {title}
      </h2>

      <div className="mt-4 divide-y divide-slate-100">
        {children}
      </div>

    </section>
  );
}

/* =============================================================
   INFORMATION ROW
============================================================= */

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">

      <span className="text-xs text-slate-400">
        {label}
      </span>

      <span className="text-right text-sm text-slate-700">
        {value}
      </span>

    </div>
  );
}

/* =============================================================
   SELECT FIELD
============================================================= */

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;

  options: {
    value: string;
    label: string;
  }[];

  disabled?: boolean;
}) {
  return (
    <label className="block">

      <span className="mb-1.5 block text-xs font-medium text-slate-600">
        {label}
      </span>

      <select
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
        disabled={disabled}
        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
      >

        <option value="">
          Select{" "}
          {label.toLowerCase()}
        </option>

        {options.map(
          (option) => (
            <option
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          ),
        )}

      </select>

    </label>
  );
}