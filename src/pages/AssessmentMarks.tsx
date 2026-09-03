import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Save,
  Eye,
  Users,
} from "lucide-react";

import { supabase } from "../lib/supabase";
import { useSchool } from "../context/SchoolContext";

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
};

type Student = {
  id: string;
  student_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  status: string;
};

type Enrollment = {
  student_id: string;
};

type Result = {
  id: string;
  assessment_id: string;
  student_id: string;
  marks: number | null;
  grade: string | null;
  remarks: string | null;
};

type StudentMark = {
  studentId: string;
  marks: string;
  grade: string;
  remarks: string;
};

type ClassInfo = {
  id: string;
  name: string;
};

type SubjectInfo = {
  id: string;
  name: string;
  code: string | null;
};

type AcademicYearInfo = {
  id: string;
  name: string;
};

export default function AssessmentMarks() {
  const { id: assessmentId } = useParams<{
    id: string;
  }>();

  const navigate = useNavigate();
  const { school } = useSchool();

  const [assessment, setAssessment] = useState<Assessment | null>(null);

  const [students, setStudents] = useState<Student[]>([]);

  const [marks, setMarks] = useState<Record<string, StudentMark>>({});

  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);

  const [subjectInfo, setSubjectInfo] = useState<SubjectInfo | null>(null);

  const [academicYearInfo, setAcademicYearInfo] =
    useState<AcademicYearInfo | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /*
   * ----------------------------------------------------------
   * LOAD ASSESSMENT
   * ----------------------------------------------------------
   */

  useEffect(() => {
    if (!school?.id || !assessmentId) return;

    loadAssessment();
  }, [school?.id, assessmentId]);

  async function loadAssessment() {
    if (!school?.id || !assessmentId) return;

    setLoading(true);
    setError("");
    setSuccess("");

    const { data, error } = await supabase
      .from("assessments")
      .select("*")
      .eq("id", assessmentId)
      .eq("school_id", school.id)
      .single();

    if (error) {
      console.error(error);
      setError("Unable to load this assessment.");
      setLoading(false);
      return;
    }

    const assessmentData = data as Assessment;

    setAssessment(assessmentData);

    /*
     * Load students first.
     *
     * Then load results.
     *
     * This order is important because loadStudents()
     * initializes the marks state.
     */

    await Promise.all([
      loadClass(assessmentData.class_id),
      loadSubject(assessmentData.subject_id),
      loadAcademicYear(assessmentData.academic_year_id),
    ]);

    await loadStudents(assessmentData);

    await loadResults(assessmentData.id);

    setLoading(false);
  }

  /*
   * ----------------------------------------------------------
   * LOAD CLASS
   * ----------------------------------------------------------
   */

  async function loadClass(classId: string) {
    const { data, error } = await supabase
      .from("classes")
      .select("id, name")
      .eq("id", classId)
      .single();

    if (error) {
      console.error(error);
      return;
    }

    setClassInfo(data as ClassInfo);
  }

  /*
   * ----------------------------------------------------------
   * LOAD SUBJECT
   * ----------------------------------------------------------
   */

  async function loadSubject(subjectId: string) {
    const { data, error } = await supabase
      .from("subjects")
      .select("id, name, code")
      .eq("id", subjectId)
      .single();

    if (error) {
      console.error(error);
      return;
    }

    setSubjectInfo(data as SubjectInfo);
  }

  /*
   * ----------------------------------------------------------
   * LOAD ACADEMIC YEAR
   * ----------------------------------------------------------
   */

  async function loadAcademicYear(academicYearId: string) {
    const { data, error } = await supabase
      .from("academic_years")
      .select("id, name")
      .eq("id", academicYearId)
      .single();

    if (error) {
      console.error(error);
      return;
    }

    setAcademicYearInfo(data as AcademicYearInfo);
  }

  /*
   * ----------------------------------------------------------
   * LOAD STUDENTS THROUGH ENROLLMENTS
   * ----------------------------------------------------------
   */

  async function loadStudents(assessmentData: Assessment) {
    if (!school?.id) return;

    /*
     * Find students enrolled in this class
     * during this academic year.
     */

    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from("enrollments")
      .select("student_id")
      .eq("school_id", school.id)
      .eq("academic_year_id", assessmentData.academic_year_id)
      .eq("class_id", assessmentData.class_id)
      .eq("status", "Active");

    if (enrollmentError) {
      console.error(enrollmentError);
      setError("Unable to load enrolled students.");
      return;
    }

    const enrollments = (enrollmentData ?? []) as Enrollment[];

    if (enrollments.length === 0) {
      setStudents([]);
      setMarks({});
      return;
    }

    const studentIds = enrollments.map((enrollment) => enrollment.student_id);

    /*
     * Load actual student records.
     */

    const { data: studentData, error: studentError } = await supabase
      .from("students")
      .select("id, student_id, first_name, middle_name, last_name, status")
      .eq("school_id", school.id)
      .in("id", studentIds)
      .order("last_name", {
        ascending: true,
      })
      .order("first_name", {
        ascending: true,
      });

    if (studentError) {
      console.error(studentError);
      setError("Unable to load students.");
      return;
    }

    const studentList = (studentData ?? []) as Student[];

    setStudents(studentList);

    /*
     * Initialize empty mark fields.
     */

    const initialMarks: Record<string, StudentMark> = {};

    studentList.forEach((student) => {
      initialMarks[student.id] = {
        studentId: student.id,
        marks: "",
        grade: "",
        remarks: "",
      };
    });

    setMarks(initialMarks);
  }

  /*
   * ----------------------------------------------------------
   * LOAD EXISTING RESULTS
   * ----------------------------------------------------------
   */

  async function loadResults(assessmentIdValue: string) {
    const { data, error } = await supabase
      .from("assessment_results")
      .select("id, assessment_id, student_id, marks, grade, remarks")
      .eq("assessment_id", assessmentIdValue);

    if (error) {
      console.error(error);
      setError("Unable to load existing marks.");
      return;
    }

    const results = (data ?? []) as Result[];

    if (results.length === 0) {
      return;
    }

    setMarks((current) => {
      const updated = { ...current };

      results.forEach((result) => {
        /*
         * Only add results for students that exist
         * in the current marks list.
         */
        if (!updated[result.student_id]) {
          return;
        }

        updated[result.student_id] = {
          studentId: result.student_id,
          marks: result.marks === null ? "" : String(result.marks),
          grade: result.grade ?? "",
          remarks: result.remarks ?? "",
        };
      });

      return updated;
    });
  }

  /*
   * ----------------------------------------------------------
   * GRADE CALCULATION
   * ----------------------------------------------------------
   *
   * Temporary grading scale:
   *
   * 80–100 = A
   * 70–79  = B
   * 60–69  = C
   * 50–59  = D
   * Below 50 = E
   *
   * We can make this configurable later.
   */

  function calculateGrade(value: string, maxMarks: number) {
    if (value === "") return "";

    const numericMarks = Number(value);

    if (Number.isNaN(numericMarks) || maxMarks <= 0) {
      return "";
    }

    const percentage = (numericMarks / maxMarks) * 100;

    if (percentage >= 80) return "A";
    if (percentage >= 70) return "B";
    if (percentage >= 60) return "C";
    if (percentage >= 50) return "D";

    return "E";
  }

  /*
   * ----------------------------------------------------------
   * UPDATE MARK
   * ----------------------------------------------------------
   */

  function updateMarks(studentId: string, value: string) {
    if (!assessment) return;

    /*
     * Allow empty input.
     */

    if (value === "") {
      setMarks((current) => ({
        ...current,
        [studentId]: {
          ...current[studentId],
          marks: "",
          grade: "",
        },
      }));

      return;
    }

    /*
     * Only numeric values and decimals.
     */

    if (!/^\d*\.?\d*$/.test(value)) {
      return;
    }

    const numericValue = Number(value);

    /*
     * Prevent marks greater than maximum.
     */

    if (numericValue > Number(assessment.max_marks)) {
      setError(`Marks cannot exceed ${assessment.max_marks}.`);

      return;
    }

    setError("");

    const grade = calculateGrade(value, Number(assessment.max_marks));

    setMarks((current) => ({
      ...current,
      [studentId]: {
        ...current[studentId],
        marks: value,
        grade,
      },
    }));
  }

  /*
   * ----------------------------------------------------------
   * UPDATE REMARK
   * ----------------------------------------------------------
   */

  function updateRemarks(studentId: string, value: string) {
    setMarks((current) => ({
      ...current,
      [studentId]: {
        ...current[studentId],
        remarks: value,
      },
    }));
  }

  /*
   * ----------------------------------------------------------
   * SAVE MARKS
   * ----------------------------------------------------------
   */

  async function handleSaveMarks() {
    if (!assessment) return;

    setError("");
    setSuccess("");
    setSaving(true);

    /*
     * Validate marks.
     */

    for (const student of students) {
      const studentMark = marks[student.id];

      if (!studentMark) continue;

      if (studentMark.marks === "") {
        continue;
      }

      const numericMarks = Number(studentMark.marks);

      if (Number.isNaN(numericMarks) || numericMarks < 0) {
        setError(`Invalid marks for ${getStudentName(student)}.`);

        setSaving(false);
        return;
      }

      if (numericMarks > Number(assessment.max_marks)) {
        setError(
          `${getStudentName(
            student,
          )} cannot have more than ${assessment.max_marks} marks.`,
        );

        setSaving(false);
        return;
      }
    }

    /*
     * Build result rows.
     */

    const rows = students
      .map((student) => {
        const studentMark = marks[student.id];

        if (!studentMark || studentMark.marks === "") {
          return null;
        }

        const numericMarks = Number(studentMark.marks);

        return {
          assessment_id: assessment.id,
          student_id: student.id,
          marks: numericMarks,
          grade:
            studentMark.grade ||
            calculateGrade(studentMark.marks, Number(assessment.max_marks)),
          remarks: studentMark.remarks.trim() || null,
        };
      })
      .filter(
        (
          row,
        ): row is {
          assessment_id: string;
          student_id: string;
          marks: number;
          grade: string;
          remarks: string | null;
        } => row !== null,
      );

    /*
     * Don't submit empty results.
     */

    if (rows.length === 0) {
      setError("Please enter at least one student's marks before saving.");

      setSaving(false);
      return;
    }

    /*
     * Upsert prevents duplicate results.
     */

    const { error } = await supabase.from("assessment_results").upsert(rows, {
      onConflict: "assessment_id,student_id",
    });

    if (error) {
      console.error(error);
      setError(error.message);
      setSaving(false);
      return;
    }

    setSuccess("Marks saved successfully.");

    setSaving(false);

    /*
     * Reload saved results.
     */

    await loadResults(assessment.id);
  }

  /*
   * ----------------------------------------------------------
   * PUBLISH ASSESSMENT
   * ----------------------------------------------------------
   */

  async function handlePublish() {
    if (!assessment || !school?.id) return;

    const confirmed = window.confirm(
      "Publish this assessment? Published assessments can still be edited, but they will be marked as published.",
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    const { error } = await supabase
      .from("assessments")
      .update({
        status: "Published",
      })
      .eq("id", assessment.id)
      .eq("school_id", school.id);

    if (error) {
      console.error(error);
      setError(error.message);
      return;
    }

    setAssessment({
      ...assessment,
      status: "Published",
    });

    setSuccess("Assessment published successfully.");
  }

  /*
   * ----------------------------------------------------------
   * STUDENT NAME
   * ----------------------------------------------------------
   */

  function getStudentName(student: Student) {
    return [student.first_name, student.middle_name, student.last_name]
      .filter(Boolean)
      .join(" ");
  }

  /*
   * ----------------------------------------------------------
   * SUMMARY
   * ----------------------------------------------------------
   */

  const enteredCount = useMemo(() => {
    return students.filter((student) => marks[student.id]?.marks !== "").length;
  }, [students, marks]);

  const remainingCount = students.length - enteredCount;

  const progress =
    students.length > 0
      ? Math.round((enteredCount / students.length) * 100)
      : 0;

  /*
   * ----------------------------------------------------------
   * LOADING
   * ----------------------------------------------------------
   */

  if (loading) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="text-sm text-slate-500">Loading assessment...</div>
        </div>
      </div>
    );
  }

  /*
   * ----------------------------------------------------------
   * ASSESSMENT NOT FOUND
   * ----------------------------------------------------------
   */

  if (!assessment) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <h2 className="text-lg font-semibold text-slate-900">
            Assessment not found
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            The assessment may have been deleted or you may not have permission
            to access it.
          </p>

          <button
            type="button"
            onClick={() => navigate("/assessments")}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <ArrowLeft size={16} />
            Back to Assessments
          </button>
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
      {/* Back */}
      <button
        type="button"
        onClick={() => navigate("/assessments")}
        className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
      >
        <ArrowLeft size={16} />
        Back to Assessments
      </button>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <ClipboardList size={22} strokeWidth={1.8} />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                  {assessment.title}
                </h1>

                {assessment.status === "Published" ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    Published
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                    Draft
                  </span>
                )}
              </div>

              <p className="mt-1 text-sm text-slate-500">
                Enter and manage student marks for this assessment.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate(`/assessments/${assessment.id}/results`)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <Eye size={17} />
            View Results
          </button>

          {assessment.status === "Draft" && (
            <button
              type="button"
              onClick={handlePublish}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <CheckCircle2 size={17} />
              Publish
            </button>
          )}

          <button
            type="button"
            onClick={handleSaveMarks}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={17} />

            {saving ? "Saving..." : "Save Marks"}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {/* Assessment Information */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoCard
          icon={<BookOpen size={18} />}
          label="Subject"
          value={subjectInfo?.name ?? "Loading..."}
          secondary={subjectInfo?.code ?? undefined}
        />

        <InfoCard
          icon={<Users size={18} />}
          label="Class"
          value={classInfo?.name ?? "Loading..."}
        />

        <InfoCard
          icon={<CalendarDays size={18} />}
          label="Assessment Date"
          value={formatDate(assessment.assessment_date)}
          secondary={academicYearInfo?.name}
        />

        <InfoCard
          icon={<ClipboardList size={18} />}
          label="Maximum Marks"
          value={String(assessment.max_marks)}
          secondary={assessment.assessment_type}
        />
      </div>

      {/* Progress */}
      <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              Marks Entry Progress
            </div>

            <div className="mt-1 text-xs text-slate-500">
              {enteredCount} of {students.length} students have marks entered.
            </div>
          </div>

          <div className="text-sm font-semibold text-slate-700">
            {progress}%
          </div>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all"
            style={{
              width: `${progress}%`,
            }}
          />
        </div>

        <div className="mt-2 text-xs text-slate-400">
          {remainingCount > 0
            ? `${remainingCount} student${
                remainingCount === 1 ? "" : "s"
              } remaining`
            : "All students have marks entered"}
        </div>
      </div>

      {/* Marks Table */}
      <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-slate-500" />

            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Student Marks
              </h2>

              <p className="mt-0.5 text-xs text-slate-500">
                Enter marks out of {assessment.max_marks}.
              </p>
            </div>
          </div>
        </div>

        {students.length === 0 ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center px-5 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Users size={22} />
            </div>

            <h3 className="mt-4 text-sm font-semibold text-slate-900">
              No enrolled students
            </h3>

            <p className="mt-1 max-w-md text-sm text-slate-500">
              There are no active students enrolled in this class for the
              selected academic year.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="w-12 px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    #
                  </th>

                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Student
                  </th>

                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Student ID
                  </th>

                  <th className="w-36 px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Marks / {assessment.max_marks}
                  </th>

                  <th className="w-28 px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Grade
                  </th>

                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Remarks
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {students.map((student, index) => {
                  const studentMark = marks[student.id] ?? {
                    studentId: student.id,
                    marks: "",
                    grade: "",
                    remarks: "",
                  };

                  return (
                    <tr
                      key={student.id}
                      className="transition hover:bg-slate-50/70"
                    >
                      <td className="px-4 py-4 text-center text-sm text-slate-400">
                        {index + 1}
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-900">
                          {getStudentName(student)}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-500">
                        {student.student_id}
                      </td>

                      <td className="px-5 py-4">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={studentMark.marks}
                          onChange={(event) =>
                            updateMarks(student.id, event.target.value)
                          }
                          placeholder="—"
                          className="h-10 w-28 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        />
                      </td>

                      <td className="px-5 py-4">
                        {studentMark.grade ? (
                          <span
                            className={[
                              "inline-flex min-w-[36px] justify-center rounded-full px-2.5 py-1 text-xs font-bold",
                              getGradeClass(studentMark.grade),
                            ].join(" ")}
                          >
                            {studentMark.grade}
                          </span>
                        ) : (
                          <span className="text-sm text-slate-300">—</span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <input
                          type="text"
                          value={studentMark.remarks}
                          onChange={(event) =>
                            updateRemarks(student.id, event.target.value)
                          }
                          placeholder="Optional"
                          className="h-10 w-full min-w-[220px] rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom Save */}
      {students.length > 0 && (
        <div className="mt-5 flex items-center justify-end">
          <button
            type="button"
            onClick={handleSaveMarks}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={17} />

            {saving ? "Saving..." : "Save Marks"}
          </button>
        </div>
      )}
    </div>
  );
}

/*
 * ============================================================
 * INFO CARD
 * ============================================================
 */

function InfoCard({
  icon,
  label,
  value,
  secondary,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  secondary?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          {icon}
        </div>

        <div className="min-w-0">
          <div className="text-xs font-medium text-slate-500">{label}</div>

          <div className="mt-0.5 truncate text-sm font-semibold text-slate-900">
            {value}
          </div>

          {secondary && (
            <div className="mt-0.5 text-xs text-slate-400">{secondary}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/*
 * ============================================================
 * GRADE CLASS
 * ============================================================
 */

function getGradeClass(grade: string) {
  switch (grade) {
    case "A":
      return "bg-emerald-50 text-emerald-700";

    case "B":
      return "bg-blue-50 text-blue-700";

    case "C":
      return "bg-indigo-50 text-indigo-700";

    case "D":
      return "bg-amber-50 text-amber-700";

    case "E":
      return "bg-red-50 text-red-700";

    default:
      return "bg-slate-100 text-slate-600";
  }
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
