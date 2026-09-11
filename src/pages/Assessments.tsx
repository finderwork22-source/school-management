import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList,
  Plus,
  Search,
  CalendarDays,
  BookOpen,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

import { supabase } from "../lib/supabase";
import { useSchool } from "../context/SchoolContext";
import { normalizeRole } from "../lib/permissions";

type AcademicYear = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  is_active: boolean;
};

type AcademicSection = {
  id: string;
  name: string;
  academic_year_id: string;
  display_order: number;
  is_active: boolean;
};

type SchoolClass = {
  id: string;
  name: string;
  academic_year_id?: string | null;
  academic_section_id?: string | null;
  section?: string | null;
  is_active?: boolean;
};

type Subject = {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
};

type Assessment = {
  id: string;
  school_id: string;
  academic_year_id: string;
  class_id: string;
  subject_id: string;
  title: string;
  assessment_type: string;
  assessment_date: string;
  max_marks: number;
  status: "Draft" | "Published";
  created_at: string;
};

type TeacherAssignment = {
  id: string;
  academic_year_id: string;
  class_id: string;
  subject_id: string;
};

type FormState = {
  title: string;
  assessment_type: string;
  assessment_date: string;
  max_marks: string;
  subject_id: string;
  class_id: string;
};

const assessmentTypes = [
  "Quiz",
  "Test",
  "Assignment",
  "Mid-Term Exam",
  "Final Exam",
  "Project",
  "Other",
];

const emptyForm: FormState = {
  title: "",
  assessment_type: "Test",
  assessment_date: new Date().toISOString().split("T")[0],
  max_marks: "100",
  subject_id: "",
  class_id: "",
};

export default function Assessments() {
  const { school, membership } = useSchool();
  const navigate = useNavigate();
  const role = normalizeRole(membership?.role);
  const isTeacher = role === "Teacher";

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [sections, setSections] = useState<AcademicSection[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classSubjects, setClassSubjects] = useState<
    { class_id: string; subject_id: string }[]
  >([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<TeacherAssignment[]>([]);
  const [teacherAssignmentsLoaded, setTeacherAssignmentsLoaded] = useState(!isTeacher);

  const [selectedAcademicYearId, setSelectedAcademicYearId] =
    useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");

  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingAssessment, setEditingAssessment] =
    useState<Assessment | null>(null);

  const [form, setForm] = useState<FormState>(emptyForm);

  const [loading, setLoading] = useState(true);
  const [loadingAssessments, setLoadingAssessments] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");

  /*
   * ----------------------------------------------------------
   * LOAD TEACHER ASSIGNMENTS
   * ----------------------------------------------------------
   */

  useEffect(() => {
    let cancelled = false;

    async function loadTeacherAssignments() {
      if (!school?.id || !isTeacher) {
        if (!cancelled) {
          setTeacherAssignments([]);
          setTeacherAssignmentsLoaded(true);
        }
        return;
      }

      setTeacherAssignmentsLoaded(false);
      setError("");

      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;
        if (!user?.email) {
          throw new Error("Your account does not have an email address.");
        }

        const { data: teacherData, error: teacherError } = await supabase
          .from("teachers")
          .select("id")
          .eq("school_id", school.id)
          .ilike("email", user.email)
          .maybeSingle();

        if (teacherError) throw teacherError;

        if (!teacherData) {
          if (!cancelled) {
            setTeacherAssignments([]);
            setTeacherAssignmentsLoaded(true);
            setError(
              "Your account is not linked to a teacher profile yet. Please ask the school administrator to match your school email with your teacher record.",
            );
          }
          return;
        }

        const { data, error: assignmentError } = await supabase
          .from("teacher_assignments")
          .select("id, academic_year_id, class_id, subject_id")
          .eq("school_id", school.id)
          .eq("teacher_id", teacherData.id);

        if (assignmentError) throw assignmentError;

        if (!cancelled) {
          setTeacherAssignments((data ?? []) as TeacherAssignment[]);
          setTeacherAssignmentsLoaded(true);
        }
      } catch (err) {
        console.error("Failed to load teacher assignments:", err);
        if (!cancelled) {
          setTeacherAssignments([]);
          setTeacherAssignmentsLoaded(true);
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your teaching assignments.",
          );
        }
      }
    }

    loadTeacherAssignments();

    return () => {
      cancelled = true;
    };
  }, [school?.id, isTeacher]);

  /*
   * ----------------------------------------------------------
   * LOAD ACADEMIC YEARS
   * ----------------------------------------------------------
   */

  useEffect(() => {
    if (!school?.id) return;

    loadAcademicYears();
  }, [school?.id]);

  async function loadAcademicYears() {
    if (!school?.id) return;

    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("academic_years")
      .select(
        "id, name, start_date, end_date, is_current, is_active"
      )
      .eq("school_id", school.id)
      .order("start_date", { ascending: false });

    if (error) {
      console.error(error);
      setError("Unable to load academic years.");
      setLoading(false);
      return;
    }

    const years = (data ?? []) as AcademicYear[];

    setAcademicYears(years);

    const current =
      years.find((year) => year.is_current && year.is_active) ??
      years.find((year) => year.is_active) ??
      years[0];

    if (current) {
      setSelectedAcademicYearId(current.id);
    }

    setLoading(false);
  }

  const teacherAssignmentKeys = useMemo(
    () =>
      new Set(
        teacherAssignments.map(
          (assignment) =>
            `${assignment.class_id}:${assignment.subject_id}`,
        ),
      ),
    [teacherAssignments],
  );

  const teacherClassIds = useMemo(
    () => new Set(teacherAssignments.map((assignment) => assignment.class_id)),
    [teacherAssignments],
  );

  const teacherAcademicYearIds = useMemo(
    () =>
      new Set(
        teacherAssignments.map((assignment) => assignment.academic_year_id),
      ),
    [teacherAssignments],
  );

  const visibleAcademicYears = useMemo(
    () =>
      isTeacher
        ? academicYears.filter((year) => teacherAcademicYearIds.has(year.id))
        : academicYears,
    [academicYears, isTeacher, teacherAcademicYearIds],
  );

  useEffect(() => {
    if (!isTeacher || !teacherAssignmentsLoaded) return;

    if (
      selectedAcademicYearId &&
      visibleAcademicYears.some((year) => year.id === selectedAcademicYearId)
    ) {
      return;
    }

    const currentAssigned =
      visibleAcademicYears.find((year) => year.is_current && year.is_active) ??
      visibleAcademicYears.find((year) => year.is_active) ??
      visibleAcademicYears[0];

    setSelectedAcademicYearId(currentAssigned?.id ?? "");
    setSelectedSectionId("");
    setSelectedClassId("");
    setSelectedSubjectId("");
  }, [
    isTeacher,
    teacherAssignmentsLoaded,
    selectedAcademicYearId,
    visibleAcademicYears,
  ]);

  /*
   * ----------------------------------------------------------
   * LOAD SECTIONS
   * ----------------------------------------------------------
   */

  useEffect(() => {
    if (!school?.id || !selectedAcademicYearId) {
      setSections([]);
      return;
    }

    loadSections();
  }, [school?.id, selectedAcademicYearId]);

  async function loadSections() {
    if (!school?.id || !selectedAcademicYearId) return;

    const { data, error } = await supabase
      .from("academic_sections")
      .select(
        "id, name, academic_year_id, display_order, is_active"
      )
      .eq("school_id", school.id)
      .eq("academic_year_id", selectedAcademicYearId)
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) {
      console.error(error);
      setError("Unable to load academic sections.");
      return;
    }

    setSections((data ?? []) as AcademicSection[]);

    setSelectedSectionId("");
    setSelectedClassId("");
    setSelectedSubjectId("");
  }

  /*
   * ----------------------------------------------------------
   * LOAD CLASSES
   * ----------------------------------------------------------
   */

  useEffect(() => {
    if (!school?.id || !selectedAcademicYearId) {
      setClasses([]);
      return;
    }

    loadClasses();
  }, [school?.id, selectedAcademicYearId]);

  async function loadClasses() {
    if (!school?.id || !selectedAcademicYearId) return;

    const { data, error } = await supabase
      .from("classes")
      .select(
        "id, name, academic_year_id, academic_section_id, section, is_active"
      )
      .eq("school_id", school.id)
      .eq("academic_year_id", selectedAcademicYearId)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
      setError("Unable to load classes.");
      return;
    }

    setClasses((data ?? []) as SchoolClass[]);
  }

  /*
   * ----------------------------------------------------------
   * FILTER CLASSES BY SECTION
   * ----------------------------------------------------------
   */

  const filteredClasses = useMemo(() => {
    let result = classes;

    if (isTeacher) {
      result = result.filter((classItem) => teacherClassIds.has(classItem.id));
    }

    if (selectedSectionId) {
      result = result.filter(
        (classItem) =>
          classItem.academic_section_id === selectedSectionId,
      );
    }

    return result;
  }, [
    classes,
    selectedSectionId,
    isTeacher,
    teacherClassIds,
  ]);

  const visibleSections = useMemo(() => {
    if (!isTeacher) return sections;

    const visibleSectionIds = new Set(
      filteredClasses
        .map((classItem) => classItem.academic_section_id)
        .filter((value): value is string => Boolean(value)),
    );

    return sections.filter((section) => visibleSectionIds.has(section.id));
  }, [sections, filteredClasses, isTeacher]);

  /*
   * ----------------------------------------------------------
   * LOAD SUBJECTS
   * ----------------------------------------------------------
   */

  useEffect(() => {
    if (!school?.id) return;

    loadSubjects();
  }, [school?.id]);

  async function loadSubjects() {
    if (!school?.id) return;

    const { data, error } = await supabase
      .from("subjects")
      .select("id, name, code, is_active")
      .eq("school_id", school.id)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      console.error(error);
      setError("Unable to load subjects.");
      return;
    }

    setSubjects((data ?? []) as Subject[]);
  }

  /*
   * ----------------------------------------------------------
   * LOAD CLASS-SUBJECT RELATIONSHIPS
   * ----------------------------------------------------------
   */

  useEffect(() => {
    if (!school?.id) return;

    loadClassSubjects();
  }, [school?.id]);

  async function loadClassSubjects() {
    if (!school?.id) return;

    const { data, error } = await supabase
      .from("class_subjects")
      .select("class_id, subject_id")
      .eq("school_id", school.id);

    if (error) {
      console.error(error);
      setError("Unable to load class subjects.");
      return;
    }

    setClassSubjects(data ?? []);
  }

  /*
   * ----------------------------------------------------------
   * SUBJECTS FOR SELECTED CLASS
   * ----------------------------------------------------------
   */

  const availableSubjects = useMemo(() => {
    if (!selectedClassId) return [];

    const subjectIds = new Set(
      classSubjects
        .filter((item) => item.class_id === selectedClassId)
        .map((item) => item.subject_id),
    );

    if (isTeacher) {
      teacherAssignments
        .filter(
          (assignment) =>
            assignment.class_id === selectedClassId &&
            assignment.academic_year_id === selectedAcademicYearId,
        )
        .forEach((assignment) => subjectIds.add(assignment.subject_id));
    }

    return subjects.filter((subject) => subjectIds.has(subject.id));
  }, [
    selectedClassId,
    selectedAcademicYearId,
    classSubjects,
    subjects,
    isTeacher,
    teacherAssignments,
  ]);

  /*
   * ----------------------------------------------------------
   * LOAD ASSESSMENTS
   * ----------------------------------------------------------
   */

  useEffect(() => {
    if (
      !school?.id ||
      !selectedAcademicYearId ||
      (isTeacher && !teacherAssignmentsLoaded)
    ) {
      setAssessments([]);
      return;
    }

    loadAssessments();
  }, [
    school?.id,
    selectedAcademicYearId,
    selectedClassId,
    selectedSubjectId,
    isTeacher,
    teacherAssignmentsLoaded,
  ]);

  async function loadAssessments() {
    if (!school?.id || !selectedAcademicYearId) return;

    setLoadingAssessments(true);
    setError("");

    let query = supabase
      .from("assessments")
      .select("*")
      .eq("school_id", school.id)
      .eq("academic_year_id", selectedAcademicYearId)
      .order("assessment_date", { ascending: false });

    if (selectedClassId) {
      query = query.eq("class_id", selectedClassId);
    }

    if (selectedSubjectId) {
      query = query.eq("subject_id", selectedSubjectId);
    }

    if (isTeacher) {
      const assignedClassIdsForYear = teacherAssignments
        .filter(
          (assignment) =>
            assignment.academic_year_id === selectedAcademicYearId,
        )
        .map((assignment) => assignment.class_id);

      if (assignedClassIdsForYear.length === 0) {
        setAssessments([]);
        setLoadingAssessments(false);
        return;
      }

      query = query.in("class_id", Array.from(new Set(assignedClassIdsForYear)));
    }

    const { data, error } = await query;

    if (error) {
      console.error(error);
      setError("Unable to load assessments.");
      setLoadingAssessments(false);
      return;
    }

    let loaded = (data ?? []) as Assessment[];

    if (isTeacher) {
      loaded = loaded.filter((assessment) =>
        teacherAssignmentKeys.has(
          `${assessment.class_id}:${assessment.subject_id}`,
        ),
      );
    }

    setAssessments(loaded);
    setLoadingAssessments(false);
  }

  /*
   * ----------------------------------------------------------
   * HELPERS
   * ----------------------------------------------------------
   */

  function getClassName(classId: string) {
    return (
      classes.find((item) => item.id === classId)?.name ??
      "Unknown class"
    );
  }

  function getSubjectName(subjectId: string) {
    return (
      subjects.find((subject) => subject.id === subjectId)?.name ??
      "Unknown subject"
    );
  }

  function getSubjectCode(subjectId: string) {
    return (
      subjects.find((subject) => subject.id === subjectId)?.code ??
      ""
    );
  }

  const filteredAssessments = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) return assessments;

    return assessments.filter((assessment) => {
      const className = getClassName(assessment.class_id);
      const subjectName = getSubjectName(assessment.subject_id);

      return (
        assessment.title.toLowerCase().includes(value) ||
        assessment.assessment_type
          .toLowerCase()
          .includes(value) ||
        className.toLowerCase().includes(value) ||
        subjectName.toLowerCase().includes(value)
      );
    });
  }, [assessments, search, classes, subjects]);

  function isAssignedPair(classId: string, subjectId: string) {
    if (!isTeacher) return true;

    return teacherAssignments.some(
      (assignment) =>
        assignment.academic_year_id === selectedAcademicYearId &&
        assignment.class_id === classId &&
        assignment.subject_id === subjectId,
    );
  }

  /*
   * ----------------------------------------------------------
   * OPEN CREATE MODAL
   * ----------------------------------------------------------
   */

  function openCreateModal() {
    if (isTeacher && (!teacherAssignmentsLoaded || filteredClasses.length === 0)) {
      return;
    }

    setEditingAssessment(null);

    setForm({
      ...emptyForm,
      class_id: selectedClassId,
      subject_id: selectedSubjectId,
    });

    setError("");
    setShowModal(true);
  }

  /*
   * ----------------------------------------------------------
   * OPEN EDIT MODAL
   * ----------------------------------------------------------
   */

  function openEditModal(assessment: Assessment) {
    if (!isAssignedPair(assessment.class_id, assessment.subject_id)) {
      return;
    }

    setEditingAssessment(assessment);

    setForm({
      title: assessment.title,
      assessment_type: assessment.assessment_type,
      assessment_date: assessment.assessment_date,
      max_marks: String(assessment.max_marks),
      subject_id: assessment.subject_id,
      class_id: assessment.class_id,
    });

    setError("");
    setShowModal(true);
  }

  /*
   * ----------------------------------------------------------
   * SAVE ASSESSMENT
   * ----------------------------------------------------------
   */

  async function handleSaveAssessment(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!school?.id) return;

    if (isTeacher && !teacherAssignmentsLoaded) {
      setError("Your teaching assignments are still loading. Please try again.");
      return;
    }

    setError("");

    if (!form.title.trim()) {
      setError("Please enter an assessment title.");
      return;
    }

    if (!form.class_id) {
      setError("Please select a class.");
      return;
    }

    if (!form.subject_id) {
      setError("Please select a subject.");
      return;
    }

    if (!isAssignedPair(form.class_id, form.subject_id)) {
      setError("You can only manage assessments for your assigned class and subject.");
      return;
    }

    const maxMarks = Number(form.max_marks);

    if (!maxMarks || maxMarks <= 0) {
      setError("Maximum marks must be greater than 0.");
      return;
    }

    setSaving(true);

    const payload = {
      school_id: school.id,
      academic_year_id: selectedAcademicYearId,
      class_id: form.class_id,
      subject_id: form.subject_id,
      title: form.title.trim(),
      assessment_type: form.assessment_type,
      assessment_date: form.assessment_date,
      max_marks: maxMarks,
    };

    if (editingAssessment) {
      const { error } = await supabase
        .from("assessments")
        .update(payload)
        .eq("id", editingAssessment.id);

      if (error) {
        console.error(error);
        setError(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase
        .from("assessments")
        .insert({
          ...payload,
          status: "Draft",
        });

      if (error) {
        console.error(error);
        setError(error.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setShowModal(false);
    setEditingAssessment(null);
    setForm(emptyForm);

    await loadAssessments();
  }

  /*
   * ----------------------------------------------------------
   * DELETE ASSESSMENT
   * ----------------------------------------------------------
   */

  async function handleDeleteAssessment(id: string) {
    const assessment = assessments.find((item) => item.id === id);

    if (
      isTeacher &&
      (!assessment ||
        !isAssignedPair(assessment.class_id, assessment.subject_id))
    ) {
      setError("You can only delete assessments for your assigned class and subject.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this assessment? Any marks recorded for it will also be deleted."
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("assessments")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      setError(error.message);
      return;
    }

    await loadAssessments();
  }

  /*
   * ----------------------------------------------------------
   * CHANGE FILTERS
   * ----------------------------------------------------------
   */

  function handleSectionChange(value: string) {
    setSelectedSectionId(value);
    setSelectedClassId("");
    setSelectedSubjectId("");
  }

  function handleClassChange(value: string) {
    setSelectedClassId(value);
    setSelectedSubjectId("");
  }

  /*
   * ----------------------------------------------------------
   * SUMMARY
   * ----------------------------------------------------------
   */

  const totalAssessments = assessments.length;

  const draftAssessments = assessments.filter(
    (assessment) => assessment.status === "Draft"
  ).length;

  const publishedAssessments = assessments.filter(
    (assessment) => assessment.status === "Published"
  ).length;

  /*
   * ----------------------------------------------------------
   * LOADING
   * ----------------------------------------------------------
   */

  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="text-sm text-slate-500">
            Loading assessments...
          </div>
        </div>
      </div>
    );
  }

  /*
   * ----------------------------------------------------------
   * UI
   * ----------------------------------------------------------
   */

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <ClipboardList size={21} strokeWidth={1.8} />
            </div>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                Assessments
              </h1>

              <p className="mt-0.5 text-sm text-slate-500">
                {isTeacher
                  ? "Create and manage assessments for your assigned classes and subjects."
                  : "Create and manage tests, exams and other assessments."}
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          disabled={isTeacher && (!teacherAssignmentsLoaded || filteredClasses.length === 0)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={17} />
          Create Assessment
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {isTeacher && (
        <div className="mb-5 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
          You are viewing and managing assessments only for classes and subjects assigned to you.
        </div>
      )}

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {/* Academic Year */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Academic Year
            </label>

            <select
              value={selectedAcademicYearId}
              onChange={(event) => {
                setSelectedAcademicYearId(event.target.value);
                setSelectedSectionId("");
                setSelectedClassId("");
                setSelectedSubjectId("");
              }}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              {visibleAcademicYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.name}
                </option>
              ))}
            </select>
          </div>

          {/* Section */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Section
            </label>

            <select
              value={selectedSectionId}
              onChange={(event) =>
                handleSectionChange(event.target.value)
              }
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">All Sections</option>

              {visibleSections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>
          </div>

          {/* Class */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Class
            </label>

            <select
              value={selectedClassId}
              onChange={(event) =>
                handleClassChange(event.target.value)
              }
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">All Classes</option>

              {filteredClasses.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Subject
            </label>

            <select
              value={selectedSubjectId}
              onChange={(event) =>
                setSelectedSubjectId(event.target.value)
              }
              disabled={!selectedClassId}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="">
                {selectedClassId
                  ? "All Subjects"
                  : "Select class first"}
              </option>

              {availableSubjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                  {subject.code ? ` (${subject.code})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="mt-4">
          <div className="relative max-w-md">
            <Search
              size={17}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />

            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search assessments..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          icon={<ClipboardList size={18} />}
          label="Total Assessments"
          value={totalAssessments}
        />

        <SummaryCard
          icon={<CalendarDays size={18} />}
          label="Draft"
          value={draftAssessments}
        />

        <SummaryCard
          icon={<BookOpen size={18} />}
          label="Published"
          value={publishedAssessments}
        />
      </div>

      {/* Table */}
      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Assessment List
            </h2>

            <p className="mt-0.5 text-xs text-slate-500">
              {filteredAssessments.length} assessment
              {filteredAssessments.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        {loadingAssessments ? (
          <div className="flex min-h-[220px] items-center justify-center">
            <div className="text-sm text-slate-500">
              Loading assessments...
            </div>
          </div>
        ) : filteredAssessments.length === 0 ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center px-5 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <ClipboardList size={22} />
            </div>

            <h3 className="mt-4 text-sm font-semibold text-slate-900">
              No assessments found
            </h3>

            <p className="mt-1 max-w-sm text-sm text-slate-500">
              {isTeacher
                ? "Create an assessment for one of your assigned classes and subjects to start recording student marks."
                : "Create an assessment for a class and subject to start recording student marks."}
            </p>

            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Plus size={16} />
              Create Assessment
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Assessment
                  </th>

                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Class
                  </th>

                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Subject
                  </th>

                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Type
                  </th>

                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Date
                  </th>

                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Marks
                  </th>

                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Status
                  </th>

                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredAssessments.map((assessment) => (
                  <tr
                    key={assessment.id}
                    className="transition hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900">
                        {assessment.title}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-600">
                      {getClassName(assessment.class_id)}
                    </td>

                    <td className="px-5 py-4">
                      <div className="text-sm font-medium text-slate-700">
                        {getSubjectName(assessment.subject_id)}
                      </div>

                      {getSubjectCode(assessment.subject_id) && (
                        <div className="mt-0.5 text-xs text-slate-400">
                          {getSubjectCode(assessment.subject_id)}
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-600">
                      {assessment.assessment_type}
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-600">
                      {formatDate(assessment.assessment_date)}
                    </td>

                    <td className="px-5 py-4">
                      <span className="text-sm font-semibold text-slate-700">
                        {assessment.max_marks}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge status={assessment.status} />
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">
                        {/* Enter Marks */}
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/assessments/${assessment.id}/marks`
                            )
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-indigo-500 transition hover:bg-indigo-50 hover:text-indigo-700"
                          title="Enter marks"
                        >
                          <ClipboardList size={16} />
                        </button>

                        {/* Edit */}
                        {(!isTeacher ||
                          isAssignedPair(
                            assessment.class_id,
                            assessment.subject_id,
                          )) && (
                          <button
                            type="button"
                            onClick={() => openEditModal(assessment)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                            title="Edit assessment"
                          >
                            <Pencil size={16} />
                          </button>
                        )}

                        {/* Delete */}
                        {(!isTeacher ||
                          isAssignedPair(
                            assessment.class_id,
                            assessment.subject_id,
                          )) && (
                          <button
                            type="button"
                            onClick={() => handleDeleteAssessment(assessment.id)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                            title="Delete assessment"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingAssessment
                    ? "Edit Assessment"
                    : "Create Assessment"}
                </h2>

                <p className="mt-0.5 text-xs text-slate-500">
                  Add the basic details for this assessment.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowModal(false);
                  setError("");
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveAssessment}>
              <div className="space-y-5 px-6 py-5">
                {/* Title */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Assessment Title
                  </label>

                  <input
                    type="text"
                    value={form.title}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    placeholder="e.g. Mathematics Test 1"
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                {/* Class + Subject */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Class */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Class
                    </label>

                    <select
                      value={form.class_id}
                      onChange={(event) => {
                        setForm((current) => ({
                          ...current,
                          class_id: event.target.value,
                          subject_id: "",
                        }));
                      }}
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    >
                      <option value="">Select class</option>

                      {filteredClasses.map((classItem) => (
                        <option
                          key={classItem.id}
                          value={classItem.id}
                        >
                          {classItem.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Subject */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Subject
                    </label>

                    <select
                      value={form.subject_id}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          subject_id: event.target.value,
                        }))
                      }
                      disabled={!form.class_id}
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    >
                      <option value="">
                        {form.class_id
                          ? "Select subject"
                          : "Select class first"}
                      </option>

                      {availableSubjects
                        .filter((subject) => {
                          if (!isTeacher) return true;

                          return teacherAssignments.some(
                            (assignment) =>
                              assignment.academic_year_id === selectedAcademicYearId &&
                              assignment.class_id === form.class_id &&
                              assignment.subject_id === subject.id,
                          );
                        })
                        .map((subject) => (
                          <option key={subject.id} value={subject.id}>
                            {subject.name}
                            {subject.code ? ` (${subject.code})` : ""}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Type + Max Marks */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {/* Type */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Assessment Type
                    </label>

                    <select
                      value={form.assessment_type}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          assessment_type: event.target.value,
                        }))
                      }
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    >
                      {assessmentTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Maximum Marks */}
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Maximum Marks
                    </label>

                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={form.max_marks}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          max_marks: event.target.value,
                        }))
                      }
                      className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                </div>

                {/* Date */}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                    Assessment Date
                  </label>

                  <input
                    type="date"
                    value={form.assessment_date}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        assessment_date: event.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>

                {/* Error inside modal */}
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                    {error}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setError("");
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving
                    ? "Saving..."
                    : editingAssessment
                      ? "Save Changes"
                      : "Create Assessment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/*
 * ============================================================
 * SUMMARY CARD
 * ============================================================
 */

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          {icon}
        </div>

        <div>
          <div className="text-xs font-medium text-slate-500">
            {label}
          </div>

          <div className="mt-0.5 text-xl font-semibold text-slate-900">
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

/*
 * ============================================================
 * STATUS BADGE
 * ============================================================
 */

function StatusBadge({
  status,
}: {
  status: "Draft" | "Published";
}) {
  if (status === "Published") {
    return (
      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        Published
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
      Draft
    </span>
  );
}

/*
 * ============================================================
 * DATE FORMATTER
 * ============================================================
 */

function formatDate(value: string) {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00`);

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}