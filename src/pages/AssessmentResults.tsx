import { createPortal } from "react-dom";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Download,
  Eye,
  Pencil,
  Search,
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

function getStudentName(student: Student) {
  return [student.first_name, student.middle_name, student.last_name]
    .filter(Boolean)
    .join(" ");
}

function formatDate(value: string) {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getGradeClass(grade: string) {
  switch (grade) {
    case "A*":
    case "A":
      return "bg-emerald-50 text-emerald-700";
    case "B":
      return "bg-blue-50 text-blue-700";
    case "C":
      return "bg-indigo-50 text-indigo-700";
    case "D":
      return "bg-amber-50 text-amber-700";
    case "E":
      return "bg-orange-50 text-orange-700";
    case "F":
    case "G":
    case "U":
      return "bg-red-50 text-red-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export default function AssessmentResults() {
  const { id: assessmentId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { school } = useSchool();

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [results, setResults] = useState<Result[]>([]);

  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [subjectInfo, setSubjectInfo] = useState<SubjectInfo | null>(null);
  const [academicYearInfo, setAcademicYearInfo] =
    useState<AcademicYearInfo | null>(null);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!school?.id || !assessmentId) return;

    const schoolId = school.id;
    const id = assessmentId;
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const { data: assessmentData, error: assessmentError } =
          await supabase
            .from("assessments")
            .select("*")
            .eq("id", id)
            .eq("school_id", schoolId)
            .single();

        if (assessmentError) throw assessmentError;

        const currentAssessment = assessmentData as Assessment;

        if (cancelled) return;
        setAssessment(currentAssessment);

        const [classResponse, subjectResponse, yearResponse] = await Promise.all([
          supabase
            .from("classes")
            .select("id, name")
            .eq("id", currentAssessment.class_id)
            .single(),
          supabase
            .from("subjects")
            .select("id, name, code")
            .eq("id", currentAssessment.subject_id)
            .single(),
          supabase
            .from("academic_years")
            .select("id, name")
            .eq("id", currentAssessment.academic_year_id)
            .single(),
        ]);

        if (classResponse.data) setClassInfo(classResponse.data as ClassInfo);
        if (subjectResponse.data) setSubjectInfo(subjectResponse.data as SubjectInfo);
        if (yearResponse.data) setAcademicYearInfo(yearResponse.data as AcademicYearInfo);

        const { data: enrollmentData, error: enrollmentError } =
          await supabase
            .from("enrollments")
            .select("student_id")
            .eq("school_id", schoolId)
            .eq("academic_year_id", currentAssessment.academic_year_id)
            .eq("class_id", currentAssessment.class_id)
            .eq("status", "Active");

        if (enrollmentError) throw enrollmentError;

        const enrollments = (enrollmentData ?? []) as Enrollment[];
        const studentIds = enrollments.map((item) => item.student_id);

        if (studentIds.length > 0) {
          const { data: studentData, error: studentError } = await supabase
            .from("students")
            .select(
              "id, student_id, first_name, middle_name, last_name, status",
            )
            .eq("school_id", schoolId)
            .in("id", studentIds)
            .order("last_name", { ascending: true })
            .order("first_name", { ascending: true });

          if (studentError) throw studentError;
          if (!cancelled) setStudents((studentData ?? []) as Student[]);
        } else {
          setStudents([]);
        }

        const { data: resultData, error: resultError } = await supabase
          .from("assessment_results")
          .select("id, assessment_id, student_id, marks, grade, remarks")
          .eq("assessment_id", id);

        if (resultError) throw resultError;
        if (!cancelled) setResults((resultData ?? []) as Result[]);
      } catch (err) {
        console.error("Error loading assessment results:", err);
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load assessment results.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [school?.id, assessmentId]);

  const resultMap = useMemo(() => {
    const map = new Map<string, Result>();
    results.forEach((result) => map.set(result.student_id, result));
    return map;
  }, [results]);

  const filteredStudents = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return students;

    return students.filter((student) => {
      const name = getStudentName(student).toLowerCase();
      return (
        name.includes(query) ||
        student.student_id.toLowerCase().includes(query)
      );
    });
  }, [students, search]);

  const enteredResults = results.filter((result) => result.marks !== null);

  const average = useMemo(() => {
    if (!assessment || enteredResults.length === 0) return 0;

    const total = enteredResults.reduce((sum, result) => {
      return (
        sum +
        ((Number(result.marks) / Number(assessment.max_marks)) * 100)
      );
    }, 0);

    return total / enteredResults.length;
  }, [assessment, enteredResults]);

  const highest = useMemo(() => {
    if (!assessment || enteredResults.length === 0) return 0;

    return Math.max(
      ...enteredResults.map(
        (result) =>
          (Number(result.marks) / Number(assessment.max_marks)) * 100,
      ),
    );
  }, [assessment, enteredResults]);

  function openStudent(studentId: string) {
    if (!assessment) return;

    navigate(
      `/student-results?studentId=${encodeURIComponent(studentId)}&academicYearId=${encodeURIComponent(assessment.academic_year_id)}`,
    );
  }

  function handlePrint() {
    setPrinting(true);

    window.setTimeout(() => {
      window.print();

      window.setTimeout(() => {
        setPrinting(false);
      }, 300);
    }, 100);
  }

  if (loading) {
    return (
      <div className="flex min-h-[500px] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
          Loading assessment results...
        </div>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <h2 className="text-lg font-semibold text-slate-900">
            Assessment not found
          </h2>
          <p className="mt-2 text-sm text-slate-500">{error || "The assessment could not be loaded."}</p>
          <button
            type="button"
            onClick={() => navigate("/assessments")}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white"
          >
            <ArrowLeft size={16} />
            Back to Assessments
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-[1400px] print:hidden">
        <button
          type="button"
          onClick={() => navigate("/assessments")}
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          Back to Assessments
        </button>

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <ClipboardList size={22} />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold text-slate-900">
                  {assessment.title}
                </h1>

                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    assessment.status === "Published"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {assessment.status}
                </span>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                Assessment results and student performance.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate(`/assessments/${assessment.id}/marks`)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Pencil size={16} />
              Edit Marks
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
            >
              <Download size={17} />
              Print Results
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <InfoCard icon={<BookOpen size={18} />} label="Subject" value={subjectInfo?.name ?? "—"} secondary={subjectInfo?.code ?? undefined} />
          <InfoCard icon={<Users size={18} />} label="Class" value={classInfo?.name ?? "—"} />
          <InfoCard icon={<CalendarDays size={18} />} label="Assessment Date" value={formatDate(assessment.assessment_date)} secondary={academicYearInfo?.name} />
          <InfoCard icon={<ClipboardList size={18} />} label="Maximum Marks" value={String(assessment.max_marks)} secondary={assessment.assessment_type} />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Students" value={students.length} />
          <SummaryCard label="Results Entered" value={enteredResults.length} />
          <SummaryCard label="Pending" value={Math.max(students.length - enteredResults.length, 0)} />
          <SummaryCard label="Class Average" value={`${average.toFixed(1)}%`} />
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Performance Overview
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Highest score: {highest.toFixed(1)}%
              </p>
            </div>
            <div className="text-sm font-semibold text-indigo-600">
              Average: {average.toFixed(1)}%
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="relative max-w-md">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search students..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          {filteredStudents.length === 0 ? (
            <div className="px-5 py-14 text-center">
              <Users className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-3 text-sm text-slate-500">
                No students found.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="w-12 px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">#</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Student</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Student ID</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Marks</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Percentage</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Grade</th>
                    <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Remarks</th>
                    <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filteredStudents.map((student, index) => {
                    const result = resultMap.get(student.id);
                    const percentage =
                      result?.marks !== null && result?.marks !== undefined
                        ? (Number(result.marks) / Number(assessment.max_marks)) * 100
                        : null;
                    const grade =
                      result?.grade ??
                      (percentage === null ? "-" : getGrade(percentage));

                    return (
                      <tr
                        key={student.id}
                        onClick={() => openStudent(student.id)}
                        className="cursor-pointer transition hover:bg-indigo-50/50"
                      >
                        <td className="px-4 py-4 text-center text-sm text-slate-400">{index + 1}</td>
                        <td className="px-5 py-4">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openStudent(student.id);
                            }}
                            className="text-left"
                          >
                            <div className="font-medium text-indigo-700 hover:text-indigo-900 hover:underline">
                              {getStudentName(student)}
                            </div>
                            <div className="mt-0.5 text-xs text-slate-400">
                              View student results
                            </div>
                          </button>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-500">{student.student_id}</td>
                        <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                          {result?.marks !== null && result?.marks !== undefined
                            ? `${result.marks} / ${assessment.max_marks}`
                            : "Not entered"}
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                          {percentage !== null ? `${percentage.toFixed(1)}%` : "—"}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex min-w-[36px] justify-center rounded-full px-2.5 py-1 text-xs font-bold ${getGradeClass(grade)}`}>
                            {grade}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">{result?.remarks || "—"}</td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openStudent(student.id);
                            }}
                            title="View student results"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-indigo-500 hover:bg-indigo-50 hover:text-indigo-700"
                          >
                            <Eye size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {printing &&
        createPortal(
          <PrintableResults
            assessment={assessment}
            students={students}
            results={results}
            classInfo={classInfo}
            subjectInfo={subjectInfo}
            academicYearInfo={academicYearInfo}
            average={average}
          />,
          document.body,
        )}
    </>
  );
}

function PrintableResults({
  assessment,
  students,
  results,
  classInfo,
  subjectInfo,
  academicYearInfo,
  average,
}: {
  assessment: Assessment;
  students: Student[];
  results: Result[];
  classInfo: ClassInfo | null;
  subjectInfo: SubjectInfo | null;
  academicYearInfo: AcademicYearInfo | null;
  average: number;
}) {
  return (
    <div
      id="assessment-results-print"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        background: "white",
        color: "black",
      }}
    >
      <style>{`
        @media screen {
          #assessment-results-print { display: none !important; }
        }

        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
          body > *:not(#assessment-results-print) { display: none !important; }
          #assessment-results-print { display: block !important; position: static !important; width: 100% !important; background: white !important; color: black !important; }
          #assessment-results-print * { color: black !important; box-shadow: none !important; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #cbd5e1; }
          tr { page-break-inside: avoid; }
        }
      `}</style>

      <div style={{ width: "100%", maxWidth: "190mm", margin: "0 auto", padding: "4mm" }}>
        <div style={{ textAlign: "center", borderBottom: "2px solid #111", paddingBottom: "4mm" }}>
          <div style={{ fontSize: "18px", fontWeight: 700, textTransform: "uppercase" }}>
            High Gate International Academy
          </div>
          <div style={{ marginTop: "2mm", fontSize: "11px" }}>
            Assessment Results
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: "5mm" }}>
          <div style={{ fontSize: "16px", fontWeight: 700, textTransform: "uppercase" }}>
            {assessment.title}
          </div>
          <div style={{ fontSize: "10px", marginTop: "1mm" }}>
            {assessment.assessment_type}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2mm 8mm", marginTop: "5mm", fontSize: "10px" }}>
          <div><strong>Academic Year:</strong> {academicYearInfo?.name ?? "—"}</div>
          <div><strong>Class:</strong> {classInfo?.name ?? "—"}</div>
          <div><strong>Subject:</strong> {subjectInfo?.name ?? "—"}</div>
          <div><strong>Date:</strong> {formatDate(assessment.assessment_date)}</div>
          <div><strong>Maximum Marks:</strong> {assessment.max_marks}</div>
          <div><strong>Class Average:</strong> {average.toFixed(1)}%</div>
        </div>

        <table style={{ marginTop: "6mm", fontSize: "9px" }}>
          <thead>
            <tr>
              <th style={{ padding: "2mm" }}>#</th>
              <th style={{ padding: "2mm", textAlign: "left" }}>Student</th>
              <th style={{ padding: "2mm", textAlign: "left" }}>Student ID</th>
              <th style={{ padding: "2mm" }}>Marks</th>
              <th style={{ padding: "2mm" }}>%</th>
              <th style={{ padding: "2mm" }}>Grade</th>
              <th style={{ padding: "2mm", textAlign: "left" }}>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student, index) => {
              const result = results.find((item) => item.student_id === student.id);
              const percentage =
                result?.marks !== null && result?.marks !== undefined
                  ? (Number(result.marks) / Number(assessment.max_marks)) * 100
                  : null;

              return (
                <tr key={student.id}>
                  <td style={{ padding: "2mm", textAlign: "center" }}>{index + 1}</td>
                  <td style={{ padding: "2mm" }}>{getStudentName(student)}</td>
                  <td style={{ padding: "2mm" }}>{student.student_id}</td>
                  <td style={{ padding: "2mm", textAlign: "center" }}>
                    {result?.marks !== null && result?.marks !== undefined
                      ? `${result.marks} / ${assessment.max_marks}`
                      : "—"}
                  </td>
                  <td style={{ padding: "2mm", textAlign: "center" }}>
                    {percentage !== null ? `${percentage.toFixed(1)}%` : "—"}
                  </td>
                  <td style={{ padding: "2mm", textAlign: "center", fontWeight: 700 }}>
                    {result?.grade ?? "—"}
                  </td>
                  <td style={{ padding: "2mm" }}>{result?.remarks || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20mm", marginTop: "12mm", fontSize: "10px" }}>
          <div>
            <div style={{ borderBottom: "1px solid #111", paddingBottom: "1mm" }}>Prepared by</div>
            <div style={{ marginTop: "8mm" }}>Signature: __________________</div>
          </div>
          <div>
            <div style={{ borderBottom: "1px solid #111", paddingBottom: "1mm" }}>Approved by</div>
            <div style={{ marginTop: "8mm" }}>Signature: __________________</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function InfoCard({
  icon,
  label,
  value,
  secondary,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  secondary?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-medium text-slate-500">{label}</div>
          <div className="mt-0.5 truncate text-sm font-semibold text-slate-900">{value}</div>
          {secondary && <div className="mt-0.5 text-xs text-slate-400">{secondary}</div>}
        </div>
      </div>
    </div>
  );
}

function getGrade(percentage: number): string {
  if (percentage >= 90) return "A*";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B";
  if (percentage >= 60) return "C";
  if (percentage >= 50) return "D";
  if (percentage >= 40) return "E";
  if (percentage >= 30) return "F";
  if (percentage >= 20) return "G";
  return "U";
}
