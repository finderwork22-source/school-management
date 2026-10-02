import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  GraduationCap,
  Info,
  Play,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  School,
  Settings2,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import PrintableTimetable from "../components/timetable/PrintableTimetable";
import { normalizeRole } from "../lib/permissions";

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
interface Subject {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean;
}
interface Teacher {
  id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  email: string | null;
  status: string | null;
}
interface TeacherAssignment {
  id: string;
  teacher_id: string;
  academic_year_id: string;
  class_id: string;
  subject_id: string;
  teacherName: string;
  subjectName: string;
  className: string;
}
interface LessonRequirement {
  id?: string;
  class_id: string;
  subject_id: string;
  teacher_assignment_id: string | null;
  teacher_id: string | null;
  lessons_per_week: number;
  priority_level: "normal" | "preferred" | "fixed";
  preferred_day: string | null;
  preferred_period: number | null;
}
interface BreakRule {
  id?: string;
  name: string;
  after_period: number;
  duration_minutes: number;
}
interface BlockedPeriod {
  id?: string;
  day_of_week: string;
  period_number: number;
  reason: string;
}
interface TimetableSettings {
  study_days: string[];
  periods_per_day: number;
  period_duration_minutes: number;
  gap_minutes: number;
  first_period_start: string;
}
interface AssignmentRow {
  key: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  teacherAssignmentId: string | null;
  teacherId: string | null;
  teacherName: string;
  lessonsPerWeek: number;
  priorityLevel: "normal" | "preferred" | "fixed";
  preferredDay: string;
  preferredPeriod: string;
}
interface GeneratedEntry {
  id?: string;
  school_id: string;
  academic_year_id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string;
  day_of_week: string;
  period_number: number;
  start_time: string;
  end_time: string;
  className: string;
  subjectName: string;
  teacherName: string;
}

interface ValidationCheck {
  key: string;
  label: string;
  passed: boolean;
  summary: string;
  details: string[];
}
interface TimetableValidationReport {
  checks: ValidationCheck[];
  allPassed: boolean;
}
interface GenerationPreflightResult {
  valid: boolean;
  issues: string[];
  guidance: string[];
}
type GenerationStatus = "idle" | "valid" | "invalid";
type ValidationEntry = GeneratedEntry & { validationPeriod: number };
type PeriodSlot = {
  period: number;
  start: string;
  end: string;
};
type DisplayScheduleItem =
  | { kind: "period"; slot: PeriodSlot }
  | { kind: "break"; name: string; start: string; end: string; afterPeriod: number };

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const DEFAULT_SETTINGS: TimetableSettings = {
  study_days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
  periods_per_day: 8,
  period_duration_minutes: 40,
  gap_minutes: 5,
  first_period_start: "08:00",
};
const DEFAULT_BREAKS: BreakRule[] = [
  { name: "Morning Break", after_period: 3, duration_minutes: 30 },
  { name: "Lunch Break", after_period: 5, duration_minutes: 50 },
];

function getFullName(person: {
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
}) {
  return [person.first_name, person.middle_name, person.last_name]
    .filter(Boolean)
    .join(" ");
}
function formatTime(value: string) {
  if (!value) return "";
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value;
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}
function minutesFromTime(value: string) {
  const [h, m] = value.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}
function timeFromMinutes(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function getPriorityLabel(value: AssignmentRow["priorityLevel"]) {
  return value === "fixed"
    ? "Fixed"
    : value === "preferred"
      ? "Preferred"
      : "Normal";
}
function getPriorityClasses(value: AssignmentRow["priorityLevel"]) {
  if (value === "fixed") return "border-red-200 bg-red-50 text-red-700";
  if (value === "preferred")
    return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}
function getErrorMessage(
  error: { message?: string; details?: string; hint?: string } | null,
) {
  return (
    error?.message?.trim() ||
    error?.details?.trim() ||
    error?.hint?.trim() ||
    "Something went wrong. Please try again."
  );
}
function safeText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  if (typeof value === "object") {
    const candidate = value as Record<string, unknown>;
    const nested = candidate.name ?? candidate.label ?? candidate.title;
    if (typeof nested === "string") return nested;
  }
  return String(value);
}

function classGroupName(name: unknown) {
  const trimmed = safeText(name).trim();
  const sectionMatch = trimmed.match(/^(.*?)[\s-]+[A-Za-z]$/);
  return sectionMatch?.[1]?.trim() || trimmed;
}

function getValidationPeriodNumber(
  entry: GeneratedEntry,
  settings: TimetableSettings,
  breaks: BreakRule[],
) {
  if (Number(entry.period_number) > 0) return Number(entry.period_number);
  const breakMap = new Map(
    breaks.map((item) => [Number(item.after_period), item]),
  );
  let current = minutesFromTime(settings.first_period_start);
  for (let period = 1; period <= settings.periods_per_day; period += 1) {
    const start = current;
    const end = start + Math.max(1, settings.period_duration_minutes);
    if (entry.start_time?.slice(0, 5) === timeFromMinutes(start)) return period;
    current = end + Math.max(0, settings.gap_minutes);
    const breakRule = breakMap.get(period);
    if (breakRule)
      current +=
        Math.max(0, breakRule.duration_minutes) +
        Math.max(0, settings.gap_minutes);
  }
  return 0;
}

function buildTimetableValidationReport({
  entries,
  assignmentRows,
  requirements,
  blockedPeriods,
  settings,
  breaks,
}: {
  entries: GeneratedEntry[];
  assignmentRows: AssignmentRow[];
  requirements: LessonRequirement[];
  blockedPeriods: BlockedPeriod[];
  settings: TimetableSettings;
  breaks: BreakRule[];
}): TimetableValidationReport {
  const expectedTotal = assignmentRows.reduce(
    (sum, row) => sum + Math.max(0, row.lessonsPerWeek),
    0,
  );
  const scheduledTotal = entries.length;
  const blockedSet = new Set(
    blockedPeriods.map((item) => `${item.day_of_week}:${item.period_number}`),
  );
  const normalizedEntries: ValidationEntry[] = entries.map((entry) => ({
    ...entry,
    validationPeriod: getValidationPeriodNumber(entry, settings, breaks),
  }));

  const teacherGroups = new Map<string, ValidationEntry[]>();
  const classGroups = new Map<string, ValidationEntry[]>();
  normalizedEntries.forEach((entry) => {
    const teacherKey = `${entry.teacher_id}:${entry.day_of_week}:${entry.validationPeriod}`;
    const classKey = `${entry.class_id}:${entry.day_of_week}:${entry.validationPeriod}`;
    if (!teacherGroups.has(teacherKey)) teacherGroups.set(teacherKey, []);
    if (!classGroups.has(classKey)) classGroups.set(classKey, []);
    teacherGroups.get(teacherKey)!.push(entry);
    classGroups.get(classKey)!.push(entry);
  });

  const teacherConflicts = Array.from(teacherGroups.values()).filter(
    (group) => group.length > 1,
  );
  const classConflicts = Array.from(classGroups.values()).filter(
    (group) => group.length > 1,
  );
  const blockedViolations = normalizedEntries.filter((entry) =>
    blockedSet.has(`${entry.day_of_week}:${entry.validationPeriod}`),
  );
  const studyDayViolations = normalizedEntries.filter(
    (entry) => !settings.study_days.includes(entry.day_of_week),
  );

  const fixedRequirements = requirements.filter(
    (item) =>
      item.priority_level === "fixed" &&
      item.lessons_per_week > 0 &&
      item.preferred_day &&
      item.preferred_period,
  );
  const fixedViolations = fixedRequirements.filter(
    (requirement) =>
      !normalizedEntries.some(
        (entry) =>
          entry.class_id === requirement.class_id &&
          entry.subject_id === requirement.subject_id &&
          entry.day_of_week === requirement.preferred_day &&
          entry.validationPeriod === Number(requirement.preferred_period),
      ),
  );

  const subjectMismatches = assignmentRows
    .filter((row) => row.lessonsPerWeek > 0)
    .map((row) => {
      const actual = normalizedEntries.filter(
        (entry) =>
          entry.class_id === row.classId && entry.subject_id === row.subjectId,
      ).length;
      return { row, actual };
    })
    .filter(({ row, actual }) => actual !== row.lessonsPerWeek);

  const checks: ValidationCheck[] = [
    {
      key: "total-lessons",
      label: "Total lessons",
      passed: scheduledTotal === expectedTotal,
      summary: `${scheduledTotal} scheduled / ${expectedTotal} required`,
      details:
        scheduledTotal === expectedTotal
          ? []
          : [
              `The generator is missing or has extra lessons by ${Math.abs(expectedTotal - scheduledTotal)}.`,
            ],
    },
    {
      key: "teacher-conflicts",
      label: "Teacher conflicts",
      passed: teacherConflicts.length === 0,
      summary:
        teacherConflicts.length === 0
          ? "No teacher is double-booked."
          : `${teacherConflicts.length} conflict${teacherConflicts.length === 1 ? "" : "s"}`,
      details: teacherConflicts
        .slice(0, 10)
        .map(
          (group) =>
            `${group[0].teacherName || "Unknown teacher"} · ${group[0].day_of_week} · Period ${group[0].validationPeriod}: ${group.map((entry) => `${entry.className} (${entry.subjectName})`).join(" + ")}`,
        ),
    },
    {
      key: "class-conflicts",
      label: "Class conflicts",
      passed: classConflicts.length === 0,
      summary:
        classConflicts.length === 0
          ? "No class has two lessons in the same period."
          : `${classConflicts.length} conflict${classConflicts.length === 1 ? "" : "s"}`,
      details: classConflicts
        .slice(0, 10)
        .map(
          (group) =>
            `${group[0].className} · ${group[0].day_of_week} · Period ${group[0].validationPeriod}: ${group.map((entry) => entry.subjectName).join(" + ")}`,
        ),
    },
    {
      key: "blocked-periods",
      label: "Blocked periods",
      passed: blockedViolations.length === 0,
      summary:
        blockedViolations.length === 0
          ? "No blocked period is used."
          : `${blockedViolations.length} violation${blockedViolations.length === 1 ? "" : "s"}`,
      details: blockedViolations
        .slice(0, 10)
        .map(
          (entry) =>
            `${entry.className} · ${entry.subjectName} · ${entry.day_of_week} · Period ${entry.validationPeriod}`,
        ),
    },
    {
      key: "fixed-lessons",
      label: "Fixed lessons",
      passed: fixedViolations.length === 0,
      summary:
        fixedViolations.length === 0
          ? "All fixed lesson slots are respected."
          : `${fixedViolations.length} fixed lesson${fixedViolations.length === 1 ? "" : "s"} not in its required slot`,
      details: fixedViolations.slice(0, 10).map((requirement) => {
        const row = assignmentRows.find(
          (item) =>
            item.classId === requirement.class_id &&
            item.subjectId === requirement.subject_id,
        );
        return `${row?.className ?? "Class"} · ${row?.subjectName ?? "Subject"} → ${requirement.preferred_day}, Period ${requirement.preferred_period}`;
      }),
    },
    {
      key: "study-days",
      label: "Study-day violations",
      passed: studyDayViolations.length === 0,
      summary:
        studyDayViolations.length === 0
          ? "All lessons are on configured study days."
          : `${studyDayViolations.length} violation${studyDayViolations.length === 1 ? "" : "s"}`,
      details: studyDayViolations
        .slice(0, 10)
        .map(
          (entry) =>
            `${entry.className} · ${entry.subjectName} · ${entry.day_of_week}`,
        ),
    },
    {
      key: "subject-counts",
      label: "Subject lesson counts",
      passed: subjectMismatches.length === 0,
      summary:
        subjectMismatches.length === 0
          ? "Every subject matches its weekly requirement."
          : `${subjectMismatches.length} subject count${subjectMismatches.length === 1 ? "" : "s"} do not match`,
      details: subjectMismatches
        .slice(0, 20)
        .map(
          ({ row, actual }) =>
            `${row.className} · ${row.subjectName}: ${actual} scheduled / ${row.lessonsPerWeek} required`,
        ),
    },
  ];
  return { checks, allPassed: checks.every((check) => check.passed) };
}

interface TimetableQuality {
  score: number;
  label: string;
  repeatedSubjectPeriods: number;
  consecutiveSubjectDays: number;
  sameDaySubjectPairs: number;
  adjacentSubjectPeriods: number;
}

function calculateTimetableQuality({
  entries,
  assignmentRows,
  settings,
}: {
  entries: GeneratedEntry[];
  assignmentRows: AssignmentRow[];
  settings: TimetableSettings;
}): TimetableQuality {
  if (entries.length === 0) {
    return {
      score: 0,
      label: "Not generated",
      repeatedSubjectPeriods: 0,
      consecutiveSubjectDays: 0,
      sameDaySubjectPairs: 0,
      adjacentSubjectPeriods: 0,
    };
  }

  const dayIndex = new Map(settings.study_days.map((day, index) => [day, index]));
  const rowByKey = new Map(
    assignmentRows.map((row) => [`${row.classId}:${row.subjectId}`, row]),
  );
  const byClassSubject = new Map<string, GeneratedEntry[]>();

  for (const entry of entries) {
    const key = `${entry.class_id}:${entry.subject_id}`;
    if (!byClassSubject.has(key)) byClassSubject.set(key, []);
    byClassSubject.get(key)!.push(entry);
  }

  let repeatedSubjectPeriods = 0;
  let consecutiveSubjectDays = 0;
  let sameDaySubjectPairs = 0;
  let adjacentSubjectPeriods = 0;
  let penalty = 0;

  for (const [key, subjectEntries] of byClassSubject) {
    const row = rowByKey.get(key);
    const preferredPeriod = row?.preferredPeriod ? Number(row.preferredPeriod) : null;

    for (let i = 0; i < subjectEntries.length; i += 1) {
      for (let j = i + 1; j < subjectEntries.length; j += 1) {
        const a = subjectEntries[i];
        const b = subjectEntries[j];
        const aDay = dayIndex.get(a.day_of_week) ?? -99;
        const bDay = dayIndex.get(b.day_of_week) ?? -99;

        if (a.period_number === b.period_number) {
          repeatedSubjectPeriods += 1;
          penalty += 18;
          if (Math.abs(aDay - bDay) === 1) penalty += 14;
        }

        if (a.day_of_week === b.day_of_week) {
          sameDaySubjectPairs += 1;
          penalty += 12;
          if (Math.abs(a.period_number - b.period_number) === 1) {
            adjacentSubjectPeriods += 1;
            penalty += 7;
          }
        } else if (Math.abs(aDay - bDay) === 1) {
          consecutiveSubjectDays += 1;
          penalty += 8;
        }
      }
    }

    if (preferredPeriod) {
      const preferredCount = subjectEntries.filter(
        (entry) => entry.period_number === preferredPeriod,
      ).length;
      penalty += Math.max(0, preferredCount - 1) * 2;
    }
  }

  const classDayCounts = new Map<string, Map<string, number>>();
  for (const entry of entries) {
    if (!classDayCounts.has(entry.class_id)) classDayCounts.set(entry.class_id, new Map());
    const counts = classDayCounts.get(entry.class_id)!;
    counts.set(entry.day_of_week, (counts.get(entry.day_of_week) ?? 0) + 1);
  }

  for (const counts of classDayCounts.values()) {
    const values = settings.study_days.map((day) => counts.get(day) ?? 0);
    if (values.length > 1) {
      const min = Math.min(...values);
      const max = Math.max(...values);
      penalty += Math.max(0, max - min) * 2;
    }
  }

  const score = Math.max(0, Math.round(100 - penalty));
  const label =
    score >= 90
      ? "Excellent"
      : score >= 75
        ? "Good"
        : score >= 60
          ? "Fair"
          : "Needs improvement";

  return {
    score,
    label,
    repeatedSubjectPeriods,
    consecutiveSubjectDays,
    sameDaySubjectPairs,
    adjacentSubjectPeriods,
  };
}

function preValidateGeneration({
  yearClasses,
  assignmentRows,
  settings,
  blockedPeriods,
}: {
  yearClasses: SchoolClass[];
  assignmentRows: AssignmentRow[];
  settings: TimetableSettings;
  blockedPeriods: BlockedPeriod[];
}): GenerationPreflightResult {
  const issues: string[] = [];
  const guidance: string[] = [];
  const studyDays = new Set(settings.study_days);
  const periodsPerDay = Math.max(0, Number(settings.periods_per_day) || 0);
  const blockedSet = new Set<string>();

  if (settings.study_days.length === 0) {
    issues.push("No study days are configured.");
    guidance.push("Configure at least one study day in Step 3.");
  }
  if (periodsPerDay < 1) {
    issues.push("The school schedule has no usable periods per day.");
    guidance.push("Set at least 1 period per day in Step 3.");
  }

  for (const blocked of blockedPeriods) {
    const period = Number(blocked.period_number);
    const key = `${blocked.day_of_week}:${period}`;
    if (blockedSet.has(key)) {
      issues.push(
        `Blocked period duplicated: ${blocked.day_of_week}, Period ${period}.`,
      );
    }
    blockedSet.add(key);
    if (!studyDays.has(blocked.day_of_week)) {
      issues.push(
        `Blocked period ${blocked.day_of_week}, Period ${period} is outside the configured study days.`,
      );
    }
    if (period < 1 || period > periodsPerDay) {
      issues.push(
        `Blocked period ${blocked.day_of_week}, Period ${period} is outside the configured period range.`,
      );
    }
  }

  const usablePeriodsPerWeek = Math.max(
    0,
    settings.study_days.length * periodsPerDay -
      Array.from(blockedSet).filter((key) => {
        const [day, rawPeriod] = key.split(":");
        const period = Number(rawPeriod);
        return studyDays.has(day) && period >= 1 && period <= periodsPerDay;
      }).length,
  );

  const classLoads = new Map<string, number>();
  const teacherLoads = new Map<string, number>();
  const teacherNames = new Map<string, string>();
  const classNames = new Map<string, string>();

  for (const row of assignmentRows) {
    if (row.lessonsPerWeek <= 0) continue;
    classLoads.set(
      row.classId,
      (classLoads.get(row.classId) ?? 0) + row.lessonsPerWeek,
    );
    classNames.set(row.classId, row.className);

    if (!row.teacherId) {
      issues.push(
        `${row.className} — ${row.subjectName} has ${row.lessonsPerWeek} lesson${row.lessonsPerWeek === 1 ? "" : "s"} configured but no teacher is assigned.`,
      );
    } else {
      teacherLoads.set(
        row.teacherId,
        (teacherLoads.get(row.teacherId) ?? 0) + row.lessonsPerWeek,
      );
      teacherNames.set(row.teacherId, row.teacherName || "Unknown teacher");
    }
  }

  for (const schoolClass of yearClasses) {
    const load = classLoads.get(schoolClass.id) ?? 0;
    if (load > usablePeriodsPerWeek) {
      issues.push(
        `${schoolClass.name} needs ${load} lessons but only ${usablePeriodsPerWeek} usable periods are available in the configured school week.`,
      );
      guidance.push(
        `Reduce the weekly load for ${schoolClass.name}, add study periods, or remove unnecessary blocked periods.`,
      );
    }
  }

  for (const [teacherId, load] of teacherLoads) {
    if (load > usablePeriodsPerWeek) {
      issues.push(
        `${teacherNames.get(teacherId) ?? "Teacher"} is assigned ${load} lessons but only ${usablePeriodsPerWeek} teacher slots are available in the configured school week.`,
      );
      guidance.push(
        `Reduce ${teacherNames.get(teacherId) ?? "the teacher"}'s weekly load or assign some lessons to another teacher.`,
      );
    }
  }

  type FixedSlot = {
    row: AssignmentRow;
    day: string;
    period: number;
  };
  const fixedSlots: FixedSlot[] = [];

  for (const row of assignmentRows) {
    if (row.priorityLevel !== "fixed" || row.lessonsPerWeek <= 0) continue;

    if (!row.preferredDay || !row.preferredPeriod) {
      issues.push(
        `${row.className} — ${row.subjectName} is Fixed but has no required day and period.`,
      );
      guidance.push(
        `Choose a day and period for ${row.className} — ${row.subjectName}, or change its priority to Preferred/Normal.`,
      );
      continue;
    }

    const period = Number(row.preferredPeriod);
    const slot: FixedSlot = {
      row,
      day: row.preferredDay,
      period,
    };
    fixedSlots.push(slot);

    if (!studyDays.has(slot.day)) {
      issues.push(
        `${row.className} — ${row.subjectName} is Fixed to ${slot.day}, Period ${slot.period}, but ${slot.day} is not a study day.`,
      );
      guidance.push(
        `Move ${row.className} — ${row.subjectName} to a configured study day or enable ${slot.day}.`,
      );
    }
    if (period < 1 || period > periodsPerDay) {
      issues.push(
        `${row.className} — ${row.subjectName} is Fixed to Period ${period}, but the school has only ${periodsPerDay} periods per day.`,
      );
      guidance.push(
        `Choose a period from 1 to ${periodsPerDay} for ${row.className} — ${row.subjectName}.`,
      );
    }
    if (blockedSet.has(`${slot.day}:${slot.period}`)) {
      issues.push(
        `${row.className} — ${row.subjectName} is Fixed to ${slot.day}, Period ${slot.period}, which is blocked.`,
      );
      guidance.push(
        `Unblock ${slot.day}, Period ${slot.period}, or move the fixed lesson.`,
      );
    }
    if (!row.teacherId) {
      issues.push(
        `${row.className} — ${row.subjectName} is Fixed but has no teacher.`,
      );
    }
  }

  const classFixedGroups = new Map<string, FixedSlot[]>();
  const teacherFixedGroups = new Map<string, FixedSlot[]>();
  for (const fixed of fixedSlots) {
    const classKey = `${fixed.row.classId}:${fixed.day}:${fixed.period}`;
    if (!classFixedGroups.has(classKey)) classFixedGroups.set(classKey, []);
    classFixedGroups.get(classKey)!.push(fixed);

    if (fixed.row.teacherId) {
      const teacherKey = `${fixed.row.teacherId}:${fixed.day}:${fixed.period}`;
      if (!teacherFixedGroups.has(teacherKey)) teacherFixedGroups.set(teacherKey, []);
      teacherFixedGroups.get(teacherKey)!.push(fixed);
    }
  }

  for (const group of classFixedGroups.values()) {
    if (group.length <= 1) continue;
    const first = group[0];
    const lessons = group
      .map((item) => `${item.row.className} — ${item.row.subjectName}`)
      .join(" + ");
    issues.push(
      `Class conflict at ${first.day}, Period ${first.period}: ${lessons}.`,
    );
    guidance.push(
      `A class cannot have two fixed lessons at ${first.day}, Period ${first.period}. Move one fixed lesson or make one Preferred.`,
    );
  }

  for (const group of teacherFixedGroups.values()) {
    if (group.length <= 1) continue;
    const first = group[0];
    const teacher = first.row.teacherName || "Unknown teacher";
    const lessons = group
      .map((item) => `${item.row.className} — ${item.row.subjectName}`)
      .join(" + ");
    issues.push(
      `Teacher conflict at ${first.day}, Period ${first.period}: ${teacher} is fixed to ${lessons}.`,
    );
    guidance.push(
      `Keep only one of these lessons fixed at ${first.day}, Period ${first.period}, or assign one lesson to another teacher.`,
    );
  }

  // Remove duplicate guidance while keeping the order useful to a school administrator.
  const uniqueGuidance = Array.from(new Set(guidance));
  if (issues.length > 0 && uniqueGuidance.length === 0) {
    uniqueGuidance.push(
      "Review the failed constraints, then regenerate. The existing valid timetable will not be replaced while this result is invalid.",
    );
  }

  return {
    valid: issues.length === 0,
    issues: Array.from(new Set(issues)),
    guidance: uniqueGuidance,
  };
}

export default function Timetable() {
  const [schoolId, setSchoolId] = useState("");
  const [role, setRole] = useState<ReturnType<typeof normalizeRole>>("Teacher");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [step, setStep] = useState(1);

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [selectedAcademicYearId, setSelectedAcademicYearId] = useState("");
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<
    TeacherAssignment[]
  >([]);
  const [classSubjectPairs, setClassSubjectPairs] = useState<
    Array<{ class_id: string; subject_id: string }>
  >([]);
  const [settings, setSettings] = useState<TimetableSettings>(DEFAULT_SETTINGS);
  const [breaks, setBreaks] = useState<BreakRule[]>(DEFAULT_BREAKS);
  const [blockedPeriods, setBlockedPeriods] = useState<BlockedPeriod[]>([]);
  const [requirements, setRequirements] = useState<LessonRequirement[]>([]);
  const [generatedEntries, setGeneratedEntries] = useState<GeneratedEntry[]>(
    [],
  );
  const [generationStatus, setGenerationStatus] =
    useState<GenerationStatus>("idle");
  const [generationIssues, setGenerationIssues] = useState<string[]>([]);
  const [generationGuidance, setGenerationGuidance] = useState<string[]>([]);

  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [assignmentGradeFilter, setAssignmentGradeFilter] = useState("all");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedPriorityKey, setSelectedPriorityKey] = useState<string | null>(
    null,
  );
  const [scheduleTab, setScheduleTab] = useState<
    "weekly" | "breaks" | "blocked" | "preview"
  >("weekly");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {},
  );
  const [reviewClassId, setReviewClassId] = useState("");

  const canManage = ["Owner", "Principal", "Head of Academics"].includes(role);
  const isTeacher = role === "Teacher";

  async function loadSetupData(
    currentSchoolId: string,
    currentYearId?: string,
    scope?: { classIds?: string[]; academicYearIds?: string[] },
  ) {
    setError("");
    const [
      yearsResult,
      classesResult,
      subjectsResult,
      teachersResult,
      assignmentsResult,
      classSubjectsResult,
    ] = await Promise.all([
      supabase
        .from("academic_years")
        .select("id, name, is_active")
        .eq("school_id", currentSchoolId)
        .order("name", { ascending: false }),
      supabase
        .from("classes")
        .select("id, name, academic_year_id, is_active")
        .eq("school_id", currentSchoolId)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("subjects")
        .select("id, name, code, is_active")
        .eq("school_id", currentSchoolId)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("teachers")
        .select("id, first_name, middle_name, last_name, email, status")
        .eq("school_id", currentSchoolId)
        .order("last_name")
        .order("first_name"),
      supabase
        .from("teacher_assignments")
        .select(
          `id, teacher_id, academic_year_id, class_id, subject_id, teachers(first_name, middle_name, last_name), subjects(name), classes(name)`,
        )
        .eq("school_id", currentSchoolId),
      supabase
        .from("class_subjects")
        .select("class_id, subject_id")
        .eq("school_id", currentSchoolId),
    ]);
    const firstError =
      yearsResult.error ??
      classesResult.error ??
      subjectsResult.error ??
      teachersResult.error ??
      assignmentsResult.error ??
      classSubjectsResult.error;
    if (firstError) {
      setError(getErrorMessage(firstError));
      return;
    }
    const loadedYears = (yearsResult.data ?? []) as AcademicYear[];
    const loadedClasses = (classesResult.data ?? []) as SchoolClass[];
    const classScope = scope?.classIds ? new Set(scope.classIds) : null;
    const yearScope = scope?.academicYearIds
      ? new Set(scope.academicYearIds)
      : null;
    const mappedAssignments: TeacherAssignment[] = (
      assignmentsResult.data ?? []
    )
      .filter((item: any) => !classScope || classScope.has(item.class_id))
      .filter((item: any) => !yearScope || yearScope.has(item.academic_year_id))
      .map((item: any) => {
        const teacher = Array.isArray(item.teachers)
          ? item.teachers[0]
          : item.teachers;
        const subject = Array.isArray(item.subjects)
          ? item.subjects[0]
          : item.subjects;
        const schoolClass = Array.isArray(item.classes)
          ? item.classes[0]
          : item.classes;
        return {
          id: item.id,
          teacher_id: item.teacher_id,
          academic_year_id: item.academic_year_id,
          class_id: item.class_id,
          subject_id: item.subject_id,
          teacherName: getFullName(teacher ?? {}),
          subjectName: subject?.name ?? "Unknown subject",
          className: schoolClass?.name ?? "Unknown class",
        };
      });
    const scopedYears = yearScope
      ? loadedYears.filter((year) => yearScope.has(year.id))
      : loadedYears;
    const scopedClasses = classScope
      ? loadedClasses.filter((item) => classScope.has(item.id))
      : loadedClasses;
    setAcademicYears(scopedYears);
    setClasses(scopedClasses);
    setSubjects((subjectsResult.data ?? []) as Subject[]);
    setTeachers((teachersResult.data ?? []) as Teacher[]);
    setTeacherAssignments(mappedAssignments);
    setClassSubjectPairs(
      (classSubjectsResult.data ?? []) as Array<{
        class_id: string;
        subject_id: string;
      }>,
    );
    const usableYearId =
      currentYearId && scopedYears.some((year) => year.id === currentYearId)
        ? currentYearId
        : (scopedYears.find((year) => year.is_active)?.id ??
          scopedYears[0]?.id ??
          "");
    setSelectedAcademicYearId(usableYearId);
    if (usableYearId)
      await loadSavedConfiguration(currentSchoolId, usableYearId);
  }

  async function loadSavedConfiguration(
    currentSchoolId: string,
    yearId: string,
  ) {
    const [
      settingsResult,
      breaksResult,
      blockedResult,
      requirementsResult,
      entriesResult,
    ] = await Promise.all([
      supabase
        .from("timetable_settings")
        .select(
          "study_days, periods_per_day, period_duration_minutes, gap_minutes, first_period_start",
        )
        .eq("school_id", currentSchoolId)
        .eq("academic_year_id", yearId)
        .maybeSingle(),
      supabase
        .from("timetable_breaks")
        .select("id, name, after_period, duration_minutes")
        .eq("school_id", currentSchoolId)
        .eq("academic_year_id", yearId)
        .order("after_period"),
      supabase
        .from("timetable_blocked_periods")
        .select("id, day_of_week, period_number, reason")
        .eq("school_id", currentSchoolId)
        .eq("academic_year_id", yearId)
        .order("day_of_week")
        .order("period_number"),
      supabase
        .from("timetable_lesson_requirements")
        .select(
          "id, class_id, subject_id, teacher_assignment_id, teacher_id, lessons_per_week, priority_level, preferred_day, preferred_period",
        )
        .eq("school_id", currentSchoolId)
        .eq("academic_year_id", yearId),
      supabase
        .from("timetable_entries")
        .select(
          "id, school_id, academic_year_id, class_id, subject_id, teacher_id, day_of_week, period_number, start_time, end_time, classes(name), subjects(name), teachers(first_name, middle_name, last_name)",
        )
        .eq("school_id", currentSchoolId)
        .eq("academic_year_id", yearId)
        .order("start_time"),
    ]);
    const firstError =
      settingsResult.error ??
      breaksResult.error ??
      blockedResult.error ??
      requirementsResult.error ??
      entriesResult.error;
    if (firstError) {
      setError(getErrorMessage(firstError));
      return;
    }
    setSettings(
      settingsResult.data
        ? {
            study_days:
              settingsResult.data.study_days ?? DEFAULT_SETTINGS.study_days,
            periods_per_day: Number(
              settingsResult.data.periods_per_day ??
                DEFAULT_SETTINGS.periods_per_day,
            ),
            period_duration_minutes: Number(
              settingsResult.data.period_duration_minutes ??
                DEFAULT_SETTINGS.period_duration_minutes,
            ),
            gap_minutes: Number(
              settingsResult.data.gap_minutes ?? DEFAULT_SETTINGS.gap_minutes,
            ),
            first_period_start: String(
              settingsResult.data.first_period_start ??
                DEFAULT_SETTINGS.first_period_start,
            ).slice(0, 5),
          }
        : DEFAULT_SETTINGS,
    );
    setBreaks(
      (breaksResult.data ?? []).length
        ? (breaksResult.data as BreakRule[])
        : DEFAULT_BREAKS,
    );
    setBlockedPeriods((blockedResult.data ?? []) as BlockedPeriod[]);
    setRequirements(
      (requirementsResult.data ?? []).map((item: any) => ({
        id: item.id,
        class_id: item.class_id,
        subject_id: item.subject_id,
        teacher_assignment_id: item.teacher_assignment_id ?? null,
        teacher_id: item.teacher_id ?? null,
        lessons_per_week: Number(item.lessons_per_week ?? 0),
        priority_level: item.priority_level ?? "normal",
        preferred_day: item.preferred_day ?? null,
        preferred_period: item.preferred_period
          ? Number(item.preferred_period)
          : null,
      })),
    );
    setGeneratedEntries(
      (entriesResult.data ?? []).map((item: any) => {
        const schoolClass = Array.isArray(item.classes)
          ? item.classes[0]
          : item.classes;
        const subject = Array.isArray(item.subjects)
          ? item.subjects[0]
          : item.subjects;
        const teacher = Array.isArray(item.teachers)
          ? item.teachers[0]
          : item.teachers;
        return {
          id: item.id,
          school_id: item.school_id,
          academic_year_id: item.academic_year_id,
          class_id: item.class_id,
          subject_id: item.subject_id,
          teacher_id: item.teacher_id,
          day_of_week: item.day_of_week,
          period_number: Number(item.period_number ?? 0),
          start_time: item.start_time,
          end_time: item.end_time,
          className: schoolClass?.name ?? "",
          subjectName: subject?.name ?? "",
          teacherName: getFullName(teacher ?? {}),
        };
      }),
    );
  }

  useEffect(() => {
    async function initialize() {
      setLoading(true);
      setError("");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("You must be signed in to manage the timetable.");
        setLoading(false);
        return;
      }
      const { data: membership, error: membershipError } = await supabase
        .from("school_members")
        .select("school_id, role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (membershipError) {
        setError(getErrorMessage(membershipError));
        setLoading(false);
        return;
      }
      if (!membership?.school_id) {
        setError("No school is associated with your account.");
        setLoading(false);
        return;
      }
      const currentRole = normalizeRole(membership.role);
      setSchoolId(membership.school_id);
      setRole(currentRole);
      if (currentRole === "Teacher") {
        if (!user.email) {
          setError("Your teacher account does not have an email address.");
          setLoading(false);
          return;
        }
        const { data: teacher, error: teacherError } = await supabase
          .from("teachers")
          .select("id")
          .eq("school_id", membership.school_id)
          .ilike("email", user.email)
          .maybeSingle();
        if (teacherError) {
          setError(getErrorMessage(teacherError));
          setLoading(false);
          return;
        }
        if (!teacher?.id) {
          setError("Your teacher profile is not linked to this account.");
          setLoading(false);
          return;
        }
        const { data: teacherAssignments, error: teacherAssignmentsError } =
          await supabase
            .from("teacher_assignments")
            .select("class_id, academic_year_id")
            .eq("school_id", membership.school_id)
            .eq("teacher_id", teacher.id);
        if (teacherAssignmentsError) {
          setError(getErrorMessage(teacherAssignmentsError));
          setLoading(false);
          return;
        }
        await loadSetupData(membership.school_id, undefined, {
          classIds: Array.from(
            new Set((teacherAssignments ?? []).map((item) => item.class_id)),
          ),
          academicYearIds: Array.from(
            new Set(
              (teacherAssignments ?? []).map((item) => item.academic_year_id),
            ),
          ),
        });
      } else await loadSetupData(membership.school_id);
      setLoading(false);
    }
    void initialize();
  }, []);

  useEffect(() => {
    if (schoolId && selectedAcademicYearId)
      void loadSavedConfiguration(schoolId, selectedAcademicYearId);
  }, [schoolId, selectedAcademicYearId]);

  const yearClasses = useMemo(
    () =>
      classes.filter(
        (item) => item.academic_year_id === selectedAcademicYearId,
      ),
    [classes, selectedAcademicYearId],
  );
  const yearAssignments = useMemo(
    () =>
      teacherAssignments.filter(
        (item) => item.academic_year_id === selectedAcademicYearId,
      ),
    [teacherAssignments, selectedAcademicYearId],
  );
  const assignmentRows = useMemo<AssignmentRow[]>(() => {
    const rows = new Map<string, AssignmentRow>();

    const classById = new Map(
      yearClasses.map((schoolClass) => [schoolClass.id, schoolClass]),
    );

    const subjectById = new Map(
      subjects.map((subject) => [subject.id, subject]),
    );

    const requirementByKey = new Map(
      requirements.map((requirement) => [
        `${requirement.class_id}:${requirement.subject_id}`,
        requirement,
      ]),
    );

    /**
     * ---------------------------------------------------------
     * 1. TEACHER ASSIGNMENTS ARE THE PRIMARY SOURCE
     * ---------------------------------------------------------
     *
     * Every teacher_assignments record becomes a timetable row.
     *
     * This is important because a teacher assignment may exist
     * even when the class_subjects relationship has not been
     * created yet.
     */
    for (const assignment of yearAssignments) {
      const schoolClass = classById.get(assignment.class_id);
      const subject = subjectById.get(assignment.subject_id);

      if (!schoolClass || !subject) continue;

      const key = `${assignment.class_id}:${assignment.subject_id}`;

      const savedRequirement = requirementByKey.get(key);

      rows.set(key, {
        key,

        classId: assignment.class_id,
        className: schoolClass.name,

        subjectId: assignment.subject_id,
        subjectName: subject.name,

        teacherAssignmentId: assignment.id,
        teacherId: assignment.teacher_id,
        teacherName:
          assignment.teacherName ||
          getFullName(
            teachers.find((teacher) => teacher.id === assignment.teacher_id) ??
              {},
          ) ||
          "Not assigned",

        lessonsPerWeek: savedRequirement?.lessons_per_week ?? 0,

        priorityLevel: savedRequirement?.priority_level ?? "normal",

        preferredDay: savedRequirement?.preferred_day ?? "",

        preferredPeriod:
          savedRequirement?.preferred_period != null
            ? String(savedRequirement.preferred_period)
            : "",
      });
    }

    /**
     * ---------------------------------------------------------
     * 2. ADD CLASS/SUBJECT PAIRS WITHOUT A TEACHER
     * ---------------------------------------------------------
     *
     * class_subjects is still important because it tells us
     * that a class needs a subject even when nobody has been
     * assigned to teach it yet.
     *
     * But we only add it when teacher_assignments did not
     * already create the row.
     */
    for (const pair of classSubjectPairs) {
      const schoolClass = classById.get(pair.class_id);
      const subject = subjectById.get(pair.subject_id);

      if (!schoolClass || !subject) continue;

      const key = `${pair.class_id}:${pair.subject_id}`;

      // Teacher assignment already created this row.
      if (rows.has(key)) continue;

      const savedRequirement = requirementByKey.get(key);

      rows.set(key, {
        key,

        classId: pair.class_id,
        className: schoolClass.name,

        subjectId: pair.subject_id,
        subjectName: subject.name,

        teacherAssignmentId: savedRequirement?.teacher_assignment_id ?? null,

        teacherId: savedRequirement?.teacher_id ?? null,

        teacherName: savedRequirement?.teacher_id
          ? getFullName(
              teachers.find(
                (teacher) => teacher.id === savedRequirement.teacher_id,
              ) ?? {},
            )
          : "Not assigned",

        lessonsPerWeek: savedRequirement?.lessons_per_week ?? 0,

        priorityLevel: savedRequirement?.priority_level ?? "normal",

        preferredDay: savedRequirement?.preferred_day ?? "",

        preferredPeriod:
          savedRequirement?.preferred_period != null
            ? String(savedRequirement.preferred_period)
            : "",
      });
    }

    /**
     * ---------------------------------------------------------
     * 3. SORT FOR A CLEAN UI
     * ---------------------------------------------------------
     *
     * Class first, then subject.
     *
     * Example:
     *
     * Grade 1 A
     *   English
     *   ICT
     *   Mathematics
     *
     * Grade 1 B
     *   ICT
     *   Science
     */
    return Array.from(rows.values()).sort((a, b) => {
      const classComparison = a.className.localeCompare(
        b.className,
        undefined,
        { numeric: true },
      );

      if (classComparison !== 0) {
        return classComparison;
      }

      return a.subjectName.localeCompare(b.subjectName, undefined, {
        numeric: true,
      });
    });
  }, [
    yearClasses,
    subjects,
    yearAssignments,
    classSubjectPairs,
    requirements,
    teachers,
  ]);

  const selectedClass =
    yearClasses.find((item) => item.id === selectedClassId) ?? yearClasses[0];
  const gradeGroups = useMemo(() => {
    const query = assignmentSearch.trim().toLowerCase();
    const map = new Map<string, SchoolClass[]>();
    yearClasses
      .filter((schoolClass) => {
        if (!query) return true;
        return (
          safeText(schoolClass.name).toLowerCase().includes(query) ||
          assignmentRows.some(
            (row) =>
              row.classId === schoolClass.id &&
              `${safeText(row.subjectName)} ${safeText(row.teacherName)}`
                .toLowerCase()
                .includes(query),
          )
        );
      })
      .forEach((schoolClass) => {
        const group = classGroupName(schoolClass.name);
        if (!map.has(group)) map.set(group, []);
        map.get(group)!.push(schoolClass);
      });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [yearClasses, assignmentSearch, assignmentRows]);
  const gradeNames = useMemo(
    () =>
      Array.from(
        new Set(
          yearClasses.map((schoolClass) => classGroupName(schoolClass.name)),
        ),
      ).sort(),
    [yearClasses],
  );
  const filteredGradeGroups = useMemo(
    () =>
      assignmentGradeFilter === "all"
        ? gradeGroups
        : gradeGroups.filter(([group]) => group === assignmentGradeFilter),
    [gradeGroups, assignmentGradeFilter],
  );
  const configuredClassIds = useMemo(
    () =>
      new Set(
        assignmentRows
          .filter((row) => row.lessonsPerWeek > 0)
          .map((row) => row.classId),
      ),
    [assignmentRows],
  );
  const missingTeacherCount = useMemo(
    () =>
      assignmentRows.filter((row) => row.lessonsPerWeek > 0 && !row.teacherId)
        .length,
    [assignmentRows],
  );
  const zeroLessonClassCount = useMemo(
    () =>
      yearClasses.filter(
        (schoolClass) =>
          !assignmentRows.some(
            (row) => row.classId === schoolClass.id && row.lessonsPerWeek > 0,
          ),
      ).length,
    [yearClasses, assignmentRows],
  );
  const totalWeeklyLessons = useMemo(
    () => assignmentRows.reduce((sum, row) => sum + row.lessonsPerWeek, 0),
    [assignmentRows],
  );
  const assignedSubjectCount = useMemo(
    () =>
      new Set(
        yearAssignments.map((item) => `${item.class_id}:${item.subject_id}`),
      ).size,
    [yearAssignments],
  );
  const teacherAssignedCount = useMemo(
    () => new Set(yearAssignments.map((item) => item.teacher_id)).size,
    [yearAssignments],
  );
  const readinessGood =
    yearClasses.length > 0 &&
    assignmentRows.length > 0 &&
    missingTeacherCount === 0 &&
    totalWeeklyLessons > 0 &&
    zeroLessonClassCount === 0 &&
    settings.study_days.length > 0;

  useEffect(() => {
    if (!selectedClassId && yearClasses[0])
      setSelectedClassId(yearClasses[0].id);
    else if (
      selectedClassId &&
      !yearClasses.some((item) => item.id === selectedClassId)
    )
      setSelectedClassId(yearClasses[0]?.id ?? "");
  }, [yearClasses, selectedClassId]);
  useEffect(() => {
    if (!reviewClassId && yearClasses[0]) setReviewClassId(yearClasses[0].id);
    else if (
      reviewClassId &&
      !yearClasses.some((item) => item.id === reviewClassId)
    )
      setReviewClassId(yearClasses[0]?.id ?? "");
  }, [yearClasses, reviewClassId]);
  useEffect(() => {
    setStep((current) => Math.min(current, 5));
  }, [selectedAcademicYearId]);

  const periodPreview = useMemo(() => {
    const output: Array<{
      label: string;
      start: string;
      end: string;
      kind: "period" | "break";
      period?: number;
    }> = [];
    const breakMap = new Map<number, BreakRule>(
      breaks.map((item) => [item.after_period, item]),
    );
    let current = minutesFromTime(settings.first_period_start);
    for (
      let period = 1;
      period <= Math.max(0, settings.periods_per_day);
      period += 1
    ) {
      const start = current;
      const end = start + Math.max(1, settings.period_duration_minutes);
      output.push({
        label: `Period ${period}`,
        start: timeFromMinutes(start),
        end: timeFromMinutes(end),
        kind: "period",
        period,
      });
      current = end + Math.max(0, settings.gap_minutes);
      const breakRule = breakMap.get(period);
      if (breakRule) {
        const breakEnd = current + Math.max(0, breakRule.duration_minutes);
        output.push({
          label: breakRule.name,
          start: timeFromMinutes(current),
          end: timeFromMinutes(breakEnd),
          kind: "break",
        });
        current = breakEnd + Math.max(0, settings.gap_minutes);
      }
    }
    return output;
  }, [settings, breaks]);

  function getRequirement(row: AssignmentRow) {
    return requirements.find(
      (item) =>
        item.class_id === row.classId && item.subject_id === row.subjectId,
    );
  }
  function updateRequirement(
    row: AssignmentRow,
    patch: Partial<LessonRequirement>,
  ) {
    setRequirements((current) => {
      const index = current.findIndex(
        (item) =>
          item.class_id === row.classId && item.subject_id === row.subjectId,
      );
      const existing = current[index] ?? {
        class_id: row.classId,
        subject_id: row.subjectId,
        teacher_assignment_id: row.teacherAssignmentId,
        teacher_id: row.teacherId,
        lessons_per_week: row.lessonsPerWeek,
        priority_level: row.priorityLevel,
        preferred_day: row.preferredDay || null,
        preferred_period: row.preferredPeriod
          ? Number(row.preferredPeriod)
          : null,
      };
      const next = { ...existing, ...patch };
      return index === -1
        ? [...current, next]
        : current.map((item, i) => (i === index ? next : item));
    });
    setSuccess("");
  }
  function toggleStudyDay(day: string) {
    setSettings((current) => ({
      ...current,
      study_days: current.study_days.includes(day)
        ? current.study_days.filter((item) => item !== day)
        : DAYS.filter(
            (item) => current.study_days.includes(item) || item === day,
          ),
    }));
    setSuccess("");
  }
  function addBreak() {
    const nextAfter = Math.min(
      Math.max(1, settings.periods_per_day - 1),
      (breaks[breaks.length - 1]?.after_period ?? 1) + 1,
    );
    setBreaks((current) => [
      ...current,
      {
        name: `Break ${current.length + 1}`,
        after_period: nextAfter,
        duration_minutes: 30,
      },
    ]);
  }
  function addBlockedPeriod() {
    const day = settings.study_days[0] ?? "Monday";
    const used = new Set(
      blockedPeriods.map((item) => `${item.day_of_week}:${item.period_number}`),
    );
    const period =
      Array.from({ length: settings.periods_per_day }, (_, i) => i + 1).find(
        (p) => !used.has(`${day}:${p}`),
      ) ?? 1;
    setBlockedPeriods((current) => [
      ...current,
      { day_of_week: day, period_number: period, reason: "No classes" },
    ]);
  }

  async function saveSetup(showMessage = true) {
    if (!schoolId || !selectedAcademicYearId) {
      setError("Select an academic year first.");
      return false;
    }
    if (settings.study_days.length === 0) {
      setError("Select at least one study day.");
      return false;
    }
    if (settings.periods_per_day < 1 || settings.period_duration_minutes < 1) {
      setError("Periods per day and lesson duration must be at least 1.");
      return false;
    }
    const breakPeriods = breaks.map((item) => Number(item.after_period));
    if (new Set(breakPeriods).size !== breakPeriods.length) {
      setError("Each break must be placed after a different period.");
      return false;
    }
    const blockedKeys = blockedPeriods.map(
      (item) => `${item.day_of_week}:${item.period_number}`,
    );
    if (new Set(blockedKeys).size !== blockedKeys.length) {
      setError("A blocked period can only be added once for the same day.");
      return false;
    }
    setSaving(true);
    setError("");
    if (showMessage) setSuccess("");
    const settingsResult = await supabase
      .from("timetable_settings")
      .upsert(
        {
          school_id: schoolId,
          academic_year_id: selectedAcademicYearId,
          study_days: settings.study_days,
          periods_per_day: settings.periods_per_day,
          period_duration_minutes: settings.period_duration_minutes,
          gap_minutes: settings.gap_minutes,
          first_period_start: settings.first_period_start,
        },
        { onConflict: "school_id,academic_year_id" },
      );
    if (settingsResult.error) {
      setError(getErrorMessage(settingsResult.error));
      setSaving(false);
      return false;
    }
    const deleteBreak = await supabase
      .from("timetable_breaks")
      .delete()
      .eq("school_id", schoolId)
      .eq("academic_year_id", selectedAcademicYearId);
    if (deleteBreak.error) {
      setError(getErrorMessage(deleteBreak.error));
      setSaving(false);
      return false;
    }
    if (breaks.length) {
      const result = await supabase
        .from("timetable_breaks")
        .insert(
          breaks.map((item, index) => ({
            school_id: schoolId,
            academic_year_id: selectedAcademicYearId,
            name: item.name.trim() || `Break ${index + 1}`,
            after_period: Math.min(
              Math.max(1, Number(item.after_period) || 1),
              settings.periods_per_day,
            ),
            duration_minutes: Math.max(1, Number(item.duration_minutes) || 1),
          })),
        );
      if (result.error) {
        setError(getErrorMessage(result.error));
        setSaving(false);
        return false;
      }
    }
    const deleteBlocked = await supabase
      .from("timetable_blocked_periods")
      .delete()
      .eq("school_id", schoolId)
      .eq("academic_year_id", selectedAcademicYearId);
    if (deleteBlocked.error) {
      setError(getErrorMessage(deleteBlocked.error));
      setSaving(false);
      return false;
    }
    if (blockedPeriods.length) {
      const result = await supabase
        .from("timetable_blocked_periods")
        .insert(
          blockedPeriods.map((item) => ({
            school_id: schoolId,
            academic_year_id: selectedAcademicYearId,
            day_of_week: item.day_of_week,
            period_number: Math.min(
              Math.max(1, Number(item.period_number) || 1),
              settings.periods_per_day,
            ),
            reason: item.reason.trim() || "No classes",
          })),
        );
      if (result.error) {
        setError(getErrorMessage(result.error));
        setSaving(false);
        return false;
      }
    }
    const payload = assignmentRows.map((row) => {
      const requirement = getRequirement(row);
      return {
        school_id: schoolId,
        academic_year_id: selectedAcademicYearId,
        class_id: row.classId,
        subject_id: row.subjectId,
        teacher_assignment_id: row.teacherAssignmentId,
        teacher_id: row.teacherId,
        lessons_per_week: Math.max(
          0,
          Number(requirement?.lessons_per_week ?? row.lessonsPerWeek) || 0,
        ),
        priority_level: requirement?.priority_level ?? row.priorityLevel,
        preferred_day: requirement?.preferred_day || null,
        preferred_period: requirement?.preferred_period
          ? Number(requirement.preferred_period)
          : null,
      };
    });
    if (payload.length) {
      // Do not rely on an ON CONFLICT target here. The existing database may not
      // have a UNIQUE constraint on school/year/class/subject, and that made
      // saving the timetable fail with Postgres 42P10. Match existing rows by
      // id (or by class+subject when an id is not available), then update or
      // insert explicitly. This keeps the save path compatible with the
      // current schema instead of requiring a database migration just to save.
      const existingRequirementsResult = await supabase
        .from("timetable_lesson_requirements")
        .select("id, class_id, subject_id")
        .eq("school_id", schoolId)
        .eq("academic_year_id", selectedAcademicYearId);
      if (existingRequirementsResult.error) {
        setError(getErrorMessage(existingRequirementsResult.error));
        setSaving(false);
        return false;
      }

      const existingByKey = new Map<string, string>();
      (existingRequirementsResult.data ?? []).forEach((item: any) => {
        const key = `${item.class_id}:${item.subject_id}`;
        if (item.id) existingByKey.set(key, item.id);
      });

      for (const rowPayload of payload) {
        const requirement = getRequirement(
          assignmentRows.find(
            (row) =>
              row.classId === rowPayload.class_id &&
              row.subjectId === rowPayload.subject_id,
          ) ?? assignmentRows[0],
        );
        const existingId = requirement?.id ?? existingByKey.get(
          `${rowPayload.class_id}:${rowPayload.subject_id}`,
        );

        const result = existingId
          ? await supabase
              .from("timetable_lesson_requirements")
              .update(rowPayload)
              .eq("id", existingId)
          : await supabase
              .from("timetable_lesson_requirements")
              .insert(rowPayload);

        if (result.error) {
          setError(getErrorMessage(result.error));
          setSaving(false);
          return false;
        }
      }
    }
    await loadSavedConfiguration(schoolId, selectedAcademicYearId);
    if (showMessage) setSuccess("Timetable setup saved successfully.");
    setSaving(false);
    return true;
  }

  function validateForStep(target: number) {
    setError("");
    if (!selectedAcademicYearId) {
      setError("Select an academic year first.");
      return false;
    }
    if (
      target >= 2 &&
      (yearClasses.length === 0 || assignmentRows.length === 0)
    ) {
      setError(
        "Add classes, subjects and class/subject assignments before continuing.",
      );
      return false;
    }
    if (target >= 3 && (missingTeacherCount > 0 || zeroLessonClassCount > 0)) {
      setError(
        missingTeacherCount > 0
          ? `${missingTeacherCount} lesson assignment${missingTeacherCount === 1 ? "" : "s"} still need a teacher.`
          : `${zeroLessonClassCount} class${zeroLessonClassCount === 1 ? "" : "es"} still have no weekly lessons configured.`,
      );
      return false;
    }
    if (target >= 4 && settings.study_days.length === 0) {
      setError("Configure at least one study day before continuing.");
      return false;
    }
    if (target >= 5 && !readinessGood) {
      setError(
        "Complete all class lesson assignments and teacher assignments before generation.",
      );
      return false;
    }
    return true;
  }
  async function goToStep(target: number) {
    if (target < 1 || target > 5) return;
    if (target <= step || validateForStep(target)) setStep(target);
  }
  async function continueFromStep() {
    if (step < 5) {
      if (!validateForStep(step + 1)) return;
      if (step >= 2) await saveSetup(false);
      setStep(step + 1);
    }
  }

  async function generateTimetable() {
    setError("");
    setSuccess("");
    setGenerationStatus("idle");
    setGenerationIssues([]);
    setGenerationGuidance([]);

    if (!validateForStep(5)) return;

    const preflight = preValidateGeneration({
      yearClasses,
      assignmentRows,
      settings,
      blockedPeriods,
    });

    if (!preflight.valid) {
      setGenerationStatus("invalid");
      setGenerationIssues(preflight.issues);
      setGenerationGuidance(preflight.guidance);
      setError(
        "Timetable generation is INVALID. No new timetable was saved, and the last valid timetable has been preserved.",
      );
      return;
    }

    // Save only the setup/requirements first. This does NOT replace the
    // existing timetable entries, so an invalid generation can safely leave
    // the last valid timetable untouched.
    const saved = await saveSetup(false);
    if (!saved) return;

    setGenerating(true);

    try {
      type Slot = { day: string; period: number };
      type Occurrence = { row: AssignmentRow; occurrence: number };

      const blockedSet = new Set(
        blockedPeriods.map(
          (item) => `${item.day_of_week}:${Number(item.period_number)}`,
        ),
      );

      const slots: Slot[] = settings.study_days.flatMap((day) =>
        Array.from({ length: Math.max(0, settings.periods_per_day) }, (_, i) => ({
          day,
          period: i + 1,
        })),
      );

      const usableSlots = slots.filter(
        (slot) => !blockedSet.has(`${slot.day}:${slot.period}`),
      );

      const capacityByClass = new Map<string, number>();
      for (const schoolClass of yearClasses) {
        capacityByClass.set(
          schoolClass.id,
          usableSlots.length,
        );
      }

      for (const schoolClass of yearClasses) {
        const load = assignmentRows
          .filter((row) => row.classId === schoolClass.id)
          .reduce((sum, row) => sum + row.lessonsPerWeek, 0);
        const capacity = capacityByClass.get(schoolClass.id) ?? 0;

        if (load > capacity) {
          throw new Error(
            `${schoolClass.name} needs ${load} lessons but only ${capacity} usable teaching periods are available in the configured school week.`,
          );
        }
      }

      const occurrences: Occurrence[] = assignmentRows.flatMap((row) =>
        Array.from({ length: Math.max(0, row.lessonsPerWeek) }, (_, index) => ({
          row,
          occurrence: index + 1,
        })),
      );

      const periodTimes = new Map(
        Array.from({ length: Math.max(0, settings.periods_per_day) }, (_, i) => {
          const period = i + 1;
          const start = periodPreview.find(
            (item) => item.kind === "period" && item.period === period,
          );
          return [
            period,
            {
              start: start?.start ?? "",
              end: start?.end ?? "",
            },
          ];
        }),
      );

      const occupiedClass = new Set<string>();
      const occupiedTeacher = new Set<string>();
      const result: GeneratedEntry[] = [];
      const scheduledByClass = new Map<string, GeneratedEntry[]>();
      const classDayCounts = new Map<string, Map<string, number>>();
      const subjectDayCounts = new Map<string, Map<string, number>>();
      const subjectPeriodCounts = new Map<string, Map<number, number>>();
      const teacherDayCounts = new Map<string, Map<string, number>>();
      const teacherPeriodCounts = new Map<string, Map<number, number>>();

      const classKey = (classId: string, day: string, period: number) =>
        `${classId}:${day}:${period}`;
      const teacherKey = (teacherId: string, day: string, period: number) =>
        `${teacherId}:${day}:${period}`;

      const countFor = (
        map: Map<string, Map<string, number>>,
        id: string,
        day: string,
      ) => map.get(id)?.get(day) ?? 0;

      const bump = (
        map: Map<string, Map<string, number>>,
        id: string,
        day: string,
        amount: number,
      ) => {
        if (!map.has(id)) map.set(id, new Map());
        const inner = map.get(id)!;
        inner.set(day, (inner.get(day) ?? 0) + amount);
      };

      const isAdjacentSameSubject = (
        row: AssignmentRow,
        day: string,
        period: number,
      ) =>
        (scheduledByClass.get(row.classId) ?? []).some(
          (entry) =>
            entry.day_of_week === day &&
            Math.abs(entry.period_number - period) === 1 &&
            entry.subject_id === row.subjectId,
        );

      const canPlace = (row: AssignmentRow, slot: Slot) => {
        if (!row.teacherId) return false;
        if (!settings.study_days.includes(slot.day)) return false;
        if (blockedSet.has(`${slot.day}:${slot.period}`)) return false;
        if (!periodTimes.get(slot.period)?.start) return false;
        if (
          occupiedClass.has(classKey(row.classId, slot.day, slot.period)) ||
          occupiedTeacher.has(
            teacherKey(row.teacherId, slot.day, slot.period),
          )
        ) {
          return false;
        }
        return true;
      };

      const place = (row: AssignmentRow, slot: Slot) => {
        if (!canPlace(row, slot)) return false;

        const times = periodTimes.get(slot.period);
        if (!times?.start || !row.teacherId) return false;

        const entry: GeneratedEntry = {
          school_id: schoolId,
          academic_year_id: selectedAcademicYearId,
          class_id: row.classId,
          subject_id: row.subjectId,
          teacher_id: row.teacherId,
          day_of_week: slot.day,
          period_number: slot.period,
          start_time: times.start,
          end_time: times.end,
          className: row.className,
          subjectName: row.subjectName,
          teacherName: row.teacherName,
        };

        result.push(entry);
        occupiedClass.add(classKey(row.classId, slot.day, slot.period));
        occupiedTeacher.add(teacherKey(row.teacherId, slot.day, slot.period));
        bump(classDayCounts, row.classId, slot.day, 1);
        bump(
          subjectDayCounts,
          `${row.classId}:${row.subjectId}`,
          slot.day,
          1,
        );
        const subjectKey = `${row.classId}:${row.subjectId}`;
        if (!subjectPeriodCounts.has(subjectKey)) {
          subjectPeriodCounts.set(subjectKey, new Map());
        }
        const subjectPeriods = subjectPeriodCounts.get(subjectKey)!;
        subjectPeriods.set(
          slot.period,
          (subjectPeriods.get(slot.period) ?? 0) + 1,
        );
        bump(teacherDayCounts, row.teacherId, slot.day, 1);
        if (!teacherPeriodCounts.has(row.teacherId)) {
          teacherPeriodCounts.set(row.teacherId, new Map());
        }
        const teacherPeriods = teacherPeriodCounts.get(row.teacherId)!;
        teacherPeriods.set(
          slot.period,
          (teacherPeriods.get(slot.period) ?? 0) + 1,
        );

        if (!scheduledByClass.has(row.classId)) {
          scheduledByClass.set(row.classId, []);
        }
        scheduledByClass.get(row.classId)!.push(entry);
        return true;
      };

      const unplace = (row: AssignmentRow, slot: Slot) => {
        const classSlot = classKey(row.classId, slot.day, slot.period);
        const teacherSlot = teacherKey(row.teacherId ?? "", slot.day, slot.period);
        const resultIndex = result.findIndex(
          (entry) =>
            entry.class_id === row.classId &&
            entry.subject_id === row.subjectId &&
            entry.teacher_id === row.teacherId &&
            entry.day_of_week === slot.day &&
            entry.period_number === slot.period,
        );

        if (resultIndex >= 0) result.splice(resultIndex, 1);
        occupiedClass.delete(classSlot);
        occupiedTeacher.delete(teacherSlot);
        bump(classDayCounts, row.classId, slot.day, -1);
        bump(
          subjectDayCounts,
          `${row.classId}:${row.subjectId}`,
          slot.day,
          -1,
        );
        const subjectKey = `${row.classId}:${row.subjectId}`;
        const subjectPeriods = subjectPeriodCounts.get(subjectKey);
        if (subjectPeriods) {
          const nextCount = (subjectPeriods.get(slot.period) ?? 0) - 1;
          if (nextCount <= 0) subjectPeriods.delete(slot.period);
          else subjectPeriods.set(slot.period, nextCount);
        }
        bump(teacherDayCounts, row.teacherId ?? "", slot.day, -1);
        const teacherPeriods = teacherPeriodCounts.get(row.teacherId ?? "");
        if (teacherPeriods) {
          const nextCount = (teacherPeriods.get(slot.period) ?? 0) - 1;
          if (nextCount <= 0) teacherPeriods.delete(slot.period);
          else teacherPeriods.set(slot.period, nextCount);
        }

        const classEntries = scheduledByClass.get(row.classId) ?? [];
        const entryIndex = classEntries.findIndex(
          (entry) =>
            entry.subject_id === row.subjectId &&
            entry.teacher_id === row.teacherId &&
            entry.day_of_week === slot.day &&
            entry.period_number === slot.period,
        );
        if (entryIndex >= 0) classEntries.splice(entryIndex, 1);
      };

      // Fixed lessons are hard constraints. They are placed before anything
      // else, so a normal lesson can never steal a fixed slot.
      const fixedOccurrences = occurrences.filter(
        (item) => item.row.priorityLevel === "fixed" && item.occurrence === 1,
      );

      const fixedSlotKeys = new Set<string>();

      for (const item of fixedOccurrences) {
        if (!item.row.preferredDay || !item.row.preferredPeriod) {
          throw new Error(
            `Fixed lesson is missing its required slot: ${item.row.className} — ${item.row.subjectName}.`,
          );
        }

        const slot: Slot = {
          day: item.row.preferredDay,
          period: Number(item.row.preferredPeriod),
        };

        if (!place(item.row, slot)) {
          throw new Error(
            `Fixed lesson could not be placed: ${item.row.className} — ${item.row.subjectName} → ${slot.day}, Period ${slot.period}. A hard constraint is blocking this slot.`,
          );
        }
        fixedSlotKeys.add(`${item.row.classId}:${slot.day}:${slot.period}`);
      }

      const remainingOccurrences = occurrences.filter(
        (item) => !(item.row.priorityLevel === "fixed" && item.occurrence === 1),
      );

      // IMPORTANT:
      // The previous generator was greedy: it selected one candidate and moved
      // on permanently. That can leave a perfectly usable slot unused and make
      // a later PE/English/etc. lesson look impossible.
      //
      // We now use bounded backtracking with MRV (minimum remaining values).
      // At every step we choose the lesson with the fewest currently legal
      // slots, try the best slot first, and backtrack when that choice makes a
      // later lesson impossible. This allows the generator to move a flexible
      // lesson out of Monday P7 so PE can use it, for example.
      const candidateScore = (item: Occurrence, slot: Slot) => {
        const row = item.row;
        let score = 0;
        const preferred = row.priorityLevel === "preferred";

        if (row.preferredDay === slot.day) score += preferred ? 700 : 80;
        if (row.preferredPeriod && Number(row.preferredPeriod) === slot.period) {
          score += preferred ? 700 : 80;
        }
        if (
          row.preferredDay === slot.day &&
          row.preferredPeriod &&
          Number(row.preferredPeriod) === slot.period
        ) {
          score += 500;
        }

        // Spread a subject across the week rather than producing
        // English/English/English on consecutive days when alternatives exist.
        const subjectKey = `${row.classId}:${row.subjectId}`;
        const samePeriodCount =
          subjectPeriodCounts.get(subjectKey)?.get(slot.period) ?? 0;
        const sameDayCount = countFor(subjectDayCounts, subjectKey, slot.day);

        // Strongly discourage repeating the same subject in the same period
        // across different days. This is a soft preference, never a hard rule.
        score -= samePeriodCount * 900;

        // Spread a subject across the week instead of clustering it.
        score -= sameDayCount * 300;

        // Avoid unnecessarily repeating a teacher's period pattern too.
        score -=
          (teacherPeriodCounts.get(row.teacherId ?? "")?.get(slot.period) ?? 0) *
          45;

        // Prefer a balanced weekly distribution for each class.
        score -= countFor(classDayCounts, row.classId, slot.day) * 55;

        // Avoid concentrating a teacher on one day, but never make this a hard
        // constraint because teacher availability is already a hard constraint.
        score -= countFor(teacherDayCounts, row.teacherId ?? "", slot.day) * 12;

        // Adjacent copies are undesirable, but they are NOT a hard constraint.
        // When the school has 74 required lessons and 74 available teaching
        // slots, filling the valid slot is more important than this preference.
        if (isAdjacentSameSubject(row, slot.day, slot.period)) score -= 250;

        const subjectEntries = scheduledByClass.get(row.classId) ?? [];
        const slotDayIndex = settings.study_days.indexOf(slot.day);
        const consecutiveDaySameSubject = subjectEntries.some(
          (entry) =>
            entry.subject_id === row.subjectId &&
            Math.abs(
              settings.study_days.indexOf(entry.day_of_week) - slotDayIndex,
            ) === 1,
        );
        if (consecutiveDaySameSubject) score -= 450;

        // Prefer earlier periods when the stronger constraints are equal.
        score -= (slot.period - 1) * 5;

        return score;
      };

      const getCandidates = (item: Occurrence) =>
        usableSlots
          .filter((slot) => canPlace(item.row, slot))
          .sort((a, b) => {
            const scoreDifference =
              candidateScore(item, b) - candidateScore(item, a);
            if (scoreDifference !== 0) return scoreDifference;
            if (a.day !== b.day) {
              return (
                settings.study_days.indexOf(a.day) -
                settings.study_days.indexOf(b.day)
              );
            }
            return a.period - b.period;
          });

      // First order is used only as a deterministic tie-breaker for MRV.
      // Highly constrained teachers/subjects naturally rise to the top.
      const occurrenceConstraintScore = (item: Occurrence) => {
        let score = 0;
        if (item.row.priorityLevel === "preferred") score += 1000;
        if (item.row.priorityLevel === "fixed") score += 2000;
        if (rowHasUniqueTeacher(item.row, assignmentRows)) score += 500;
        score += Math.max(0, 100 - item.row.lessonsPerWeek);
        return score;
      };

      function rowHasUniqueTeacher(row: AssignmentRow, rows: AssignmentRow[]) {
        if (!row.teacherId) return false;
        return rows.filter((candidate) => candidate.teacherId === row.teacherId)
          .length <= 2;
      }

      let nodes = 0;
      const maxNodes = 500_000;
      let abortedByNodeLimit = false;

      const solve = (remaining: Occurrence[]): boolean => {
        nodes += 1;
        if (nodes > maxNodes) {
          abortedByNodeLimit = true;
          return false;
        }

        if (remaining.length === 0) return true;

        // MRV is the key difference from the old greedy generator. A lesson
        // with only one or two legal slots is handled before a lesson with many
        // options, which prevents flexible lessons from consuming scarce slots.
        let selected: Occurrence | null = null;
        let selectedCandidates: Slot[] = [];
        let selectedScore = -Infinity;

        for (const item of remaining) {
          const candidates = getCandidates(item);
          if (candidates.length === 0) return false;

          const tieScore = occurrenceConstraintScore(item);
          if (
            selected === null ||
            candidates.length < selectedCandidates.length ||
            (candidates.length === selectedCandidates.length &&
              tieScore > selectedScore)
          ) {
            selected = item;
            selectedCandidates = candidates;
            selectedScore = tieScore;

            if (candidates.length === 1) break;
          }
        }

        if (!selected) return false;

        for (const slot of selectedCandidates) {
          if (!place(selected.row, slot)) continue;

          const nextRemaining = remaining.filter(
            (item) =>
              !(
                item.row.key === selected!.row.key &&
                item.occurrence === selected!.occurrence
              ),
          );

          // Forward-check every remaining lesson. This catches the exact
          // situation where using an apparently free slot makes PE impossible
          // later, and immediately tries another arrangement.
          let viable = true;
          for (const item of nextRemaining) {
            if (getCandidates(item).length === 0) {
              viable = false;
              break;
            }
          }

          if (viable && solve(nextRemaining)) return true;

          unplace(selected.row, slot);
        }

        return false;
      };

      const solved = solve(remainingOccurrences);

      if (!solved) {
        const problematic = remainingOccurrences
          .map((item) => ({ item, candidates: getCandidates(item).length }))
          .sort((a, b) => a.candidates - b.candidates)
          .slice(0, 5);

        const details = problematic.map(
          ({ item, candidates }) =>
            `${item.row.className} — ${item.row.subjectName} (lesson ${item.occurrence}) has ${candidates} currently usable slot${candidates === 1 ? "" : "s"}.`,
        );

        if (abortedByNodeLimit) {
          throw new Error(
            `The timetable search reached its safety limit before finding a complete arrangement. The generator tried multiple rearrangements but could not prove a valid ${occurrences.length}-lesson timetable within the search limit.`,
          );
        }

        throw new Error(
          `Could not build a complete timetable for ${occurrences.length} lessons. The generator tried alternative free slots and backtracked, but the remaining hard constraints are incompatible.${details.length ? ` ${details.join(" ")}` : ""}`,
        );
      }

      // A valid timetable is not automatically a good timetable. Once the
      // hard constraints are satisfied, improve the arrangement by swapping
      // flexible lessons inside the same class. This works even when every
      // teaching slot is occupied, because no empty slot is required.
      const scheduleQuality = (entries: GeneratedEntry[]) =>
        calculateTimetableQuality({ entries, assignmentRows, settings });

      let currentQuality = scheduleQuality(result).score;
      const classIds = Array.from(new Set(result.map((entry) => entry.class_id)));

      for (let pass = 0; pass < 4; pass += 1) {
        let improved = false;

        for (const classId of classIds) {
          const classEntries = result.filter((entry) => entry.class_id === classId);

          for (let i = 0; i < classEntries.length; i += 1) {
            const first = classEntries[i];
            if (fixedSlotKeys.has(`${first.class_id}:${first.day_of_week}:${first.period_number}`)) continue;

            for (let j = i + 1; j < classEntries.length; j += 1) {
              const second = classEntries[j];
              if (fixedSlotKeys.has(`${second.class_id}:${second.day_of_week}:${second.period_number}`)) continue;
              if (first.day_of_week === second.day_of_week && first.period_number === second.period_number) continue;

              const firstTeacherConflict = result.some(
                (entry) =>
                  entry !== first &&
                  entry !== second &&
                  entry.teacher_id === first.teacher_id &&
                  entry.day_of_week === second.day_of_week &&
                  entry.period_number === second.period_number,
              );
              const secondTeacherConflict = result.some(
                (entry) =>
                  entry !== first &&
                  entry !== second &&
                  entry.teacher_id === second.teacher_id &&
                  entry.day_of_week === first.day_of_week &&
                  entry.period_number === first.period_number,
              );
              if (firstTeacherConflict || secondTeacherConflict) continue;

              const firstIndex = result.indexOf(first);
              const secondIndex = result.indexOf(second);
              if (firstIndex < 0 || secondIndex < 0) continue;

              const swappedFirst: GeneratedEntry = {
                ...first,
                day_of_week: second.day_of_week,
                period_number: second.period_number,
                start_time: second.start_time,
                end_time: second.end_time,
              };
              const swappedSecond: GeneratedEntry = {
                ...second,
                day_of_week: first.day_of_week,
                period_number: first.period_number,
                start_time: first.start_time,
                end_time: first.end_time,
              };

              result[firstIndex] = swappedFirst;
              result[secondIndex] = swappedSecond;
              const candidateQuality = scheduleQuality(result).score;

              if (candidateQuality > currentQuality) {
                currentQuality = candidateQuality;
                classEntries[i] = swappedFirst;
                classEntries[j] = swappedSecond;
                improved = true;
              } else {
                result[firstIndex] = first;
                result[secondIndex] = second;
              }
            }
          }
        }

        if (!improved) break;
      }

      // Final hard validation happens before the database is touched.
      const candidateReport = buildTimetableValidationReport({
        entries: result,
        assignmentRows,
        requirements,
        blockedPeriods,
        settings,
        breaks,
      });

      if (!candidateReport.allPassed) {
        const failedDetails = candidateReport.checks
          .filter((check) => !check.passed)
          .flatMap((check) =>
            check.details.length
              ? [`${check.label}:`, ...check.details]
              : [check.summary],
          );

        const guidance = [
          "Do not use this generated result until every validation check passes.",
          "Fixed lessons are hard constraints and must never be displaced.",
          "The generator now backtracks through flexible lessons before declaring a timetable impossible.",
          "If a teacher conflict remains, review that teacher's assignments and fixed/preferred slots.",
          "If a subject count is short, increase its weekly lesson count only if the school actually requires it.",
        ];

        setGenerationStatus("invalid");
        setGenerationIssues(failedDetails);
        setGenerationGuidance(guidance);
        setError(
          "Timetable generation is INVALID. The last valid timetable was preserved.",
        );
        return;
      }

      const payload = result.map((entry) => ({
        school_id: entry.school_id,
        academic_year_id: entry.academic_year_id,
        class_id: entry.class_id,
        subject_id: entry.subject_id,
        teacher_id: entry.teacher_id,
        day_of_week: entry.day_of_week,
        period_number: entry.period_number,
        start_time: entry.start_time,
        end_time: entry.end_time,
      }));

      // IMPORTANT: timetable_entries commonly has a UNIQUE constraint on
      // school/year/class/day/period. Keep a backup, replace only after the
      // candidate has passed all hard validation, and restore on save failure.
      const previousEntriesResult = await supabase
        .from("timetable_entries")
        .select(
          "school_id, academic_year_id, class_id, subject_id, teacher_id, day_of_week, period_number, start_time, end_time",
        )
        .eq("school_id", schoolId)
        .eq("academic_year_id", selectedAcademicYearId);

      if (previousEntriesResult.error) throw previousEntriesResult.error;

      const previousEntries = previousEntriesResult.data ?? [];

      const deletePreviousResult = await supabase
        .from("timetable_entries")
        .delete()
        .eq("school_id", schoolId)
        .eq("academic_year_id", selectedAcademicYearId);

      if (deletePreviousResult.error) throw deletePreviousResult.error;

      let insertedIds: string[] = [];
      try {
        const insertResult = await supabase
          .from("timetable_entries")
          .insert(payload)
          .select("id");

        if (insertResult.error) throw insertResult.error;

        insertedIds = (insertResult.data ?? [])
          .map((item: { id?: string }) => item.id)
          .filter((id): id is string => Boolean(id));

        if (insertedIds.length !== payload.length) {
          throw new Error(
            "The database did not return all timetable entry IDs after saving the new timetable.",
          );
        }
      } catch (saveError) {
        if (insertedIds.length > 0) {
          await supabase
            .from("timetable_entries")
            .delete()
            .in("id", insertedIds);
        } else {
          await supabase
            .from("timetable_entries")
            .delete()
            .eq("school_id", schoolId)
            .eq("academic_year_id", selectedAcademicYearId);
        }

        if (previousEntries.length > 0) {
          const restoreResult = await supabase
            .from("timetable_entries")
            .insert(previousEntries);

          if (restoreResult.error) {
            throw new Error(
              `${saveError instanceof Error ? saveError.message : "The new timetable could not be saved."} The system also could not restore the previous timetable: ${getErrorMessage(restoreResult.error)}`,
            );
          }
        }

        throw new Error(
          `${saveError instanceof Error ? saveError.message : "The new timetable could not be saved."} The previous valid timetable was restored.`,
        );
      }

      await loadSavedConfiguration(schoolId, selectedAcademicYearId);
      setGeneratedEntries(
        result.map((entry, index) => ({
          ...entry,
          id: insertedIds[index],
        })),
      );
      setGenerationStatus("valid");
      setGenerationIssues([]);
      setGenerationGuidance([]);
      const finalQuality = scheduleQuality(result);
      setSuccess(
        `Timetable generated successfully: ${result.length} lessons across ${yearClasses.length} class${yearClasses.length === 1 ? "" : "es"}. Quality: ${finalQuality.label} (${finalQuality.score}/100).`,
      );
      setStep(5);
    } catch (generationError) {
      setGenerationStatus("invalid");
      setGenerationIssues([
        generationError instanceof Error
          ? generationError.message
          : "The timetable could not be generated.",
      ]);
      setGenerationGuidance([
        "No replacement timetable was accepted.",
        "The generator now checks alternative free slots before declaring a lesson impossible.",
        "Review the remaining hard constraint above and regenerate after fixing it.",
        "The last valid timetable remains available for review.",
      ]);
      setError(
        generationError instanceof Error
          ? generationError.message
          : "The timetable could not be generated.",
      );
    } finally {
      setGenerating(false);
    }
  }
  if (loading)
    return (
      <div className="mx-auto max-w-[1500px]">
        <div className="flex min-h-[360px] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
            <p className="mt-3 text-sm text-slate-500">
              Loading timetable setup...
            </p>
          </div>
        </div>
      </div>
    );
  if (!canManage)
    return (
      <TeacherTimetableView
        schoolId={schoolId}
        role={role}
        isTeacher={isTeacher}
        academicYears={academicYears}
        classes={classes}
        selectedAcademicYearId={selectedAcademicYearId}
        setSelectedAcademicYearId={setSelectedAcademicYearId}
      />
    );

  return (
    <div className="mx-auto max-w-[1500px] pb-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-600">
            Academic planning
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Timetable Setup
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Prepare the school structure, scheduling rules and constraints, then
            generate the whole-school timetable.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <SelectField
            label="Academic Year"
            value={selectedAcademicYearId}
            onChange={setSelectedAcademicYearId}
            options={academicYears.map((year) => ({
              value: year.id,
              label: `${year.name}${year.is_active ? " • Active" : ""}`,
            }))}
          />
          <button
            type="button"
            onClick={() => void saveSetup()}
            disabled={saving || !selectedAcademicYearId}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? "Saving..." : "Save Setup"}
          </button>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid min-w-[980px] grid-cols-5">
          {[
            {
              n: 1,
              title: "Academic Structure",
              desc: "Classes, subjects, teachers",
            },
            {
              n: 2,
              title: "Lesson Assignments",
              desc: "Teacher + weekly lessons",
            },
            {
              n: 3,
              title: "School Schedule",
              desc: "Days, periods and breaks",
            },
            {
              n: 4,
              title: "Priority Lessons",
              desc: "Fixed or preferred slots",
            },
            {
              n: 5,
              title: "Generate & Review",
              desc: "Whole-school timetable",
            },
          ].map((item) => (
            <Step
              key={item.n}
              number={String(item.n)}
              title={item.title}
              description={item.desc}
              active={step === item.n}
              completed={step > item.n}
              onClick={() => void goToStep(item.n)}
            />
          ))}
        </div>
      </div>
      {error && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="mt-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <Check size={18} className="mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {step === 1 && (
        <AcademicStructureStep
          yearClasses={yearClasses}
          subjects={subjects}
          teachers={teachers}
          assignedSubjectCount={assignedSubjectCount}
          teacherAssignedCount={teacherAssignedCount}
          onContinue={() => void continueFromStep()}
        />
      )}
      {step === 2 && (
        <LessonAssignmentsStep
          assignmentRows={assignmentRows}
          selectedClass={selectedClass}
          selectedClassId={selectedClass?.id ?? ""}
          setSelectedClassId={setSelectedClassId}
          assignmentSearch={assignmentSearch}
          setAssignmentSearch={setAssignmentSearch}
          assignmentGradeFilter={assignmentGradeFilter}
          setAssignmentGradeFilter={setAssignmentGradeFilter}
          gradeNames={gradeNames}
          filteredGradeGroups={filteredGradeGroups}
          configuredClassIds={configuredClassIds}
          expandedGroups={expandedGroups}
          setExpandedGroups={setExpandedGroups}
          selectedPriorityKey={selectedPriorityKey}
          setSelectedPriorityKey={setSelectedPriorityKey}
          settings={settings}
          updateRequirement={updateRequirement}
          onBack={() => setStep(1)}
          onContinue={() => void continueFromStep()}
        />
      )}
      {step === 3 && (
        <SchoolScheduleStep
          settings={settings}
          setSettings={setSettings}
          breaks={breaks}
          setBreaks={setBreaks}
          blockedPeriods={blockedPeriods}
          setBlockedPeriods={setBlockedPeriods}
          periodPreview={periodPreview}
          scheduleTab={scheduleTab}
          setScheduleTab={setScheduleTab}
          toggleStudyDay={toggleStudyDay}
          addBreak={addBreak}
          addBlockedPeriod={addBlockedPeriod}
          onBack={() => setStep(2)}
          onContinue={() => void continueFromStep()}
        />
      )}
      {step === 4 && (
        <PriorityStep
          assignmentRows={assignmentRows}
          settings={settings}
          selectedPriorityKey={selectedPriorityKey}
          setSelectedPriorityKey={setSelectedPriorityKey}
          updateRequirement={updateRequirement}
          onBack={() => setStep(3)}
          onContinue={() => void continueFromStep()}
        />
      )}
      {step === 5 && (
        <GenerateReviewStep
          yearClasses={yearClasses}
          assignmentRows={assignmentRows}
          requirements={requirements}
          settings={settings}
          breaks={breaks}
          blockedPeriods={blockedPeriods}
          missingTeacherCount={missingTeacherCount}
          zeroLessonClassCount={zeroLessonClassCount}
          totalWeeklyLessons={totalWeeklyLessons}
          readinessGood={readinessGood}
          generatedEntries={generatedEntries}
          reviewClassId={reviewClassId}
          setReviewClassId={setReviewClassId}
          onBack={() => setStep(4)}
          onGenerate={() => void generateTimetable()}
          generating={generating}
          generationStatus={generationStatus}
          generationIssues={generationIssues}
          generationGuidance={generationGuidance}
          onReload={() =>
            selectedAcademicYearId && schoolId
              ? void loadSavedConfiguration(schoolId, selectedAcademicYearId)
              : undefined
          }
        />
      )}
    </div>
  );
}

function AcademicStructureStep({
  yearClasses,
  subjects,
  teachers,
  assignedSubjectCount,
  teacherAssignedCount,
  onContinue,
}: {
  yearClasses: SchoolClass[];
  subjects: Subject[];
  teachers: Teacher[];
  assignedSubjectCount: number;
  teacherAssignedCount: number;
  onContinue: () => void;
}) {
  return (
    <section className="mt-6">
      <SectionHeader
        icon={GraduationCap}
        title="Academic Structure"
        description="MojaSchool uses your existing classes, subjects and teachers. Nothing needs to be recreated here."
      />
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <SummaryCard
          icon={School}
          title="Classes"
          count={yearClasses.length}
          subtitle="Active classes in the selected academic year"
          accent="indigo"
        />
        <SummaryCard
          icon={BookOpen}
          title="Subjects"
          count={subjects.length}
          subtitle={`${assignedSubjectCount} class/subject assignments ready`}
          accent="emerald"
        />
        <SummaryCard
          icon={Users}
          title="Teachers"
          count={teachers.length}
          subtitle={`${teacherAssignedCount} teachers assigned this year`}
          accent="amber"
        />
      </div>
      <div className="mt-6 rounded-xl border border-indigo-100 bg-indigo-50/60 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-white p-2 text-indigo-600">
            <Info size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-indigo-900">
              Ready for Lesson Assignments?
            </h3>
            <p className="mt-1 text-xs leading-5 text-indigo-700">
              Classes, subjects and teacher assignments come from the existing
              school setup. The next step is where you define weekly lesson
              counts and scheduling priorities.
            </p>
          </div>
        </div>
      </div>
      <WizardFooter
        onBack={undefined}
        onContinue={onContinue}
        continueLabel="Continue to Lesson Assignments"
      />
    </section>
  );
}

function LessonAssignmentsStep(props: any) {
  const {
    assignmentRows,
    selectedClass,
    selectedClassId,
    setSelectedClassId,
    assignmentSearch,
    setAssignmentSearch,
    assignmentGradeFilter,
    setAssignmentGradeFilter,
    gradeNames,
    filteredGradeGroups,
    configuredClassIds,
    expandedGroups,
    setExpandedGroups,
    selectedPriorityKey,
    setSelectedPriorityKey,
    settings,
    updateRequirement,
    onBack,
    onContinue,
  } = props;
  const selectedRows = assignmentRows.filter(
    (row: AssignmentRow) => row.classId === selectedClassId,
  );
  return (
    <section className="mt-6">
      <SectionHeader
        icon={Settings2}
        title="Lesson Assignments"
        description="Select one class at a time. Configure its subjects, teachers, weekly lesson load and priorities without scrolling through the entire school."
        badge={
          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
            {assignmentRows.reduce(
              (sum: number, row: AssignmentRow) => sum + row.lessonsPerWeek,
              0,
            )}{" "}
            lessons/week configured
          </span>
        }
      />
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid lg:grid-cols-[280px_1fr]">
          <aside className="border-b border-slate-200 bg-slate-50/70 lg:border-b-0 lg:border-r">
            <div className="p-4">
              <input
                value={assignmentSearch}
                onChange={(e) => setAssignmentSearch(e.target.value)}
                placeholder="Search class, subject..."
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-indigo-500"
              />
              <select
                value={assignmentGradeFilter}
                onChange={(e) => setAssignmentGradeFilter(e.target.value)}
                className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="all">All grades / groups</option>
                {gradeNames.map((name: string) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="max-h-[620px] overflow-y-auto px-2 pb-3">
              {filteredGradeGroups.map(
                ([group, groupClasses]: [string, SchoolClass[]]) => {
                  const open = expandedGroups[group] ?? true;
                  return (
                    <div key={group} className="mb-1">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedGroups(
                            (current: Record<string, boolean>) => ({
                              ...current,
                              [group]: !open,
                            }),
                          )
                        }
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-600 hover:bg-white"
                      >
                        {" "}
                        <span>{group}</span>
                        {open ? (
                          <ChevronDown size={14} />
                        ) : (
                          <ChevronRight size={14} />
                        )}
                      </button>
                      {open &&
                        groupClasses.map((schoolClass) => {
                          const active = schoolClass.id === selectedClassId;
                          const configured = configuredClassIds.has(
                            schoolClass.id,
                          );
                          return (
                            <button
                              key={schoolClass.id}
                              type="button"
                              onClick={() => setSelectedClassId(schoolClass.id)}
                              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm ${active ? "bg-indigo-600 text-white" : "text-slate-700 hover:bg-white"}`}
                            >
                              <span className="truncate">
                                {schoolClass.name}
                              </span>
                              <span
                                className={`ml-2 text-[10px] font-semibold ${active ? "text-indigo-100" : configured ? "text-emerald-600" : "text-slate-400"}`}
                              >
                                {configured ? "✓" : "○"}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  );
                },
              )}
            </div>
          </aside>
          <div className="min-w-0">
            <div className="border-b border-slate-200 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-medium text-indigo-600">
                    Selected class
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-900">
                    {selectedClass?.name ?? "No class selected"}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {selectedRows.length} subjects · configure weekly lessons
                    below
                  </p>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {
                    selectedRows.filter(
                      (row: AssignmentRow) => row.lessonsPerWeek > 0,
                    ).length
                  }
                  /{selectedRows.length} subjects configured
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70">
                    <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide text-slate-400">
                      Subject
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide text-slate-400">
                      Teacher
                    </th>
                    <th className="px-4 py-3 text-center text-[11px] uppercase tracking-wide text-slate-400">
                      Lessons / week
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide text-slate-400">
                      Priority
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] uppercase tracking-wide text-slate-400">
                      Preferred slot
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRows.map((row: AssignmentRow) => {
                    const open = selectedPriorityKey === row.key;
                    return (
                      <tr
                        key={row.key}
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="px-4 py-4">
                          <p className="text-sm font-medium text-slate-800">
                            {row.subjectName}
                          </p>
                          {!row.teacherId && (
                            <p className="mt-1 text-[11px] text-amber-600">
                              Teacher not assigned
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600">
                          {row.teacherName || "Not assigned"}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <input
                            type="number"
                            min={0}
                            max={
                              settings.periods_per_day *
                              Math.max(settings.study_days.length, 1)
                            }
                            value={row.lessonsPerWeek}
                            onChange={(e) =>
                              updateRequirement(row, {
                                lessons_per_week: Math.max(
                                  0,
                                  Number(e.target.value) || 0,
                                ),
                              })
                            }
                            className="h-9 w-20 rounded-lg border border-slate-200 text-center text-sm font-semibold outline-none focus:border-indigo-500"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedPriorityKey(open ? null : row.key)
                            }
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getPriorityClasses(row.priorityLevel)}`}
                          >
                            {getPriorityLabel(row.priorityLevel)}
                            <ChevronDown size={12} />
                          </button>
                          {open && (
                            <div className="relative z-20 mt-2 w-[270px] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                              {(["normal", "preferred", "fixed"] as const).map(
                                (value) => (
                                  <button
                                    key={value}
                                    type="button"
                                    onClick={() => {
                                      updateRequirement(row, {
                                        priority_level: value,
                                        ...(value === "normal"
                                          ? {
                                              preferred_day: null,
                                              preferred_period: null,
                                            }
                                          : {}),
                                      });
                                      setSelectedPriorityKey(null);
                                    }}
                                    className={`mb-2 w-full rounded-lg border px-3 py-2 text-left text-xs ${getPriorityClasses(value)}`}
                                  >
                                    <span className="font-semibold">
                                      {getPriorityLabel(value)}
                                    </span>
                                    <span className="mt-0.5 block opacity-80">
                                      {value === "fixed"
                                        ? "Must use the selected slot."
                                        : value === "preferred"
                                          ? "Try the selected slot first."
                                          : "Place it wherever it fits."}
                                    </span>
                                  </button>
                                ),
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {row.priorityLevel === "normal" ? (
                            <span className="text-xs text-slate-400">
                              No preferred slot
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <select
                                value={row.preferredDay}
                                onChange={(e) =>
                                  updateRequirement(row, {
                                    preferred_day: e.target.value || null,
                                  })
                                }
                                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs"
                              >
                                <option value="">Choose day</option>
                                {DAYS.filter((day) =>
                                  settings.study_days.includes(day),
                                ).map((day) => (
                                  <option key={day} value={day}>
                                    {day}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={row.preferredPeriod}
                                onChange={(e) =>
                                  updateRequirement(row, {
                                    preferred_period: e.target.value
                                      ? Number(e.target.value)
                                      : null,
                                  })
                                }
                                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs"
                              >
                                <option value="">Any period</option>
                                {Array.from(
                                  { length: settings.periods_per_day },
                                  (_, i) => i + 1,
                                ).map((period) => (
                                  <option key={period} value={period}>
                                    Period {period}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <WizardFooter
        onBack={onBack}
        onContinue={onContinue}
        continueLabel="Continue to School Schedule"
      />
    </section>
  );
}

function SchoolScheduleStep({
  settings,
  setSettings,
  breaks,
  setBreaks,
  blockedPeriods,
  setBlockedPeriods,
  periodPreview,
  scheduleTab,
  setScheduleTab,
  toggleStudyDay,
  addBreak,
  addBlockedPeriod,
  onBack,
  onContinue,
}: any) {
  const tabs = [
    { id: "weekly", label: "Weekly Schedule" },
    { id: "breaks", label: "Breaks" },
    { id: "blocked", label: "Blocked Periods" },
    { id: "preview", label: "Preview" },
  ];
  return (
    <section className="mt-6">
      <SectionHeader
        icon={CalendarDays}
        title="School Schedule"
        description="Configure the weekly rhythm in focused tabs instead of one crowded panel."
      />
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex overflow-x-auto border-b border-slate-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setScheduleTab(tab.id)}
              className={`whitespace-nowrap border-b-2 px-5 py-3 text-sm font-semibold ${scheduleTab === tab.id ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="p-5">
          {scheduleTab === "weekly" && (
            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Study Days
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Select the days when regular classes are held.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {DAYS.map((day) => {
                    const active = settings.study_days.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleStudyDay(day)}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-3 text-left text-sm ${active ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500"}`}
                      >
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded border ${active ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300"}`}
                        >
                          {active && <Check size={11} />}
                        </span>
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Periods
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  These values calculate the daily timetable automatically.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <NumberField
                    label="Periods per day"
                    value={settings.periods_per_day}
                    onChange={(v) =>
                      setSettings((c: TimetableSettings) => ({
                        ...c,
                        periods_per_day: Math.max(1, v),
                      }))
                    }
                  />
                  <NumberField
                    label="Lesson duration (min)"
                    value={settings.period_duration_minutes}
                    onChange={(v) =>
                      setSettings((c: TimetableSettings) => ({
                        ...c,
                        period_duration_minutes: Math.max(1, v),
                      }))
                    }
                  />
                  <NumberField
                    label="Gap between periods (min)"
                    value={settings.gap_minutes}
                    onChange={(v) =>
                      setSettings((c: TimetableSettings) => ({
                        ...c,
                        gap_minutes: Math.max(0, v),
                      }))
                    }
                  />
                  <Field
                    label="First period starts"
                    type="time"
                    value={settings.first_period_start}
                    onChange={(v) =>
                      setSettings((c: TimetableSettings) => ({
                        ...c,
                        first_period_start: v,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          )}
          {scheduleTab === "breaks" && (
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Breaks
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Breaks are inserted automatically after the selected period.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addBreak}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700"
                >
                  <Plus size={14} /> Add break
                </button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {breaks.map((item: BreakRule, index: number) => (
                  <div
                    key={`${item.id ?? "new"}-${index}`}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        value={item.name}
                        onChange={(e) =>
                          setBreaks((current: BreakRule[]) =>
                            current.map((x, i) =>
                              i === index ? { ...x, name: e.target.value } : x,
                            ),
                          )
                        }
                        className="h-10 flex-1 rounded-lg border border-slate-200 px-3 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setBreaks((current: BreakRule[]) =>
                            current.filter((_, i) => i !== index),
                          )
                        }
                        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <NumberField
                        label="After period"
                        value={item.after_period}
                        onChange={(v) =>
                          setBreaks((current: BreakRule[]) =>
                            current.map((x, i) =>
                              i === index ? { ...x, after_period: v } : x,
                            ),
                          )
                        }
                      />
                      <NumberField
                        label="Duration (min)"
                        value={item.duration_minutes}
                        onChange={(v) =>
                          setBreaks((current: BreakRule[]) =>
                            current.map((x, i) =>
                              i === index ? { ...x, duration_minutes: v } : x,
                            ),
                          )
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {scheduleTab === "blocked" && (
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Free / Blocked Periods
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Tell the generator when a class period must remain unused.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addBlockedPeriod}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-2 text-xs font-semibold text-indigo-700"
                >
                  <Plus size={14} /> Add blocked period
                </button>
              </div>
              {blockedPeriods.length === 0 ? (
                <div className="mt-5 rounded-xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-400">
                  No blocked periods yet.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {blockedPeriods.map((item: BlockedPeriod, index: number) => (
                    <div
                      key={`${item.id ?? "new"}-${index}`}
                      className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[1fr_160px_1fr_auto]"
                    >
                      <select
                        value={item.day_of_week}
                        onChange={(e) =>
                          setBlockedPeriods((current: BlockedPeriod[]) =>
                            current.map((x, i) =>
                              i === index
                                ? { ...x, day_of_week: e.target.value }
                                : x,
                            ),
                          )
                        }
                        className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
                      >
                        {DAYS.filter((day) =>
                          settings.study_days.includes(day),
                        ).map((day) => (
                          <option key={day}>{day}</option>
                        ))}
                      </select>
                      <select
                        value={item.period_number}
                        onChange={(e) =>
                          setBlockedPeriods((current: BlockedPeriod[]) =>
                            current.map((x, i) =>
                              i === index
                                ? {
                                    ...x,
                                    period_number: Number(e.target.value),
                                  }
                                : x,
                            ),
                          )
                        }
                        className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
                      >
                        {Array.from(
                          { length: settings.periods_per_day },
                          (_, i) => i + 1,
                        ).map((p) => (
                          <option key={p} value={p}>
                            Period {p}
                          </option>
                        ))}
                      </select>
                      <input
                        value={item.reason}
                        onChange={(e) =>
                          setBlockedPeriods((current: BlockedPeriod[]) =>
                            current.map((x, i) =>
                              i === index
                                ? { ...x, reason: e.target.value }
                                : x,
                            ),
                          )
                        }
                        className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
                        placeholder="Reason"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setBlockedPeriods((current: BlockedPeriod[]) =>
                            current.filter((_, i) => i !== index),
                          )
                        }
                        className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {scheduleTab === "preview" && (
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Daily Period Preview
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Calculated from the current schedule settings.
                  </p>
                </div>
                <span className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                  First period: <b>{formatTime(settings.first_period_start)}</b>
                </span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                {periodPreview.map((item: any) => (
                  <div
                    key={`${item.label}-${item.start}`}
                    className={`rounded-xl border p-4 ${item.kind === "break" ? "border-amber-200 bg-amber-50" : "border-slate-100 bg-slate-50/70"}`}
                  >
                    <p className="text-xs font-semibold text-slate-700">
                      {item.label}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatTime(item.start)} – {formatTime(item.end)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <WizardFooter
        onBack={onBack}
        onContinue={onContinue}
        continueLabel="Continue to Priority Lessons"
      />
    </section>
  );
}

function PriorityStep({
  assignmentRows,
  settings,
  selectedPriorityKey,
  setSelectedPriorityKey,
  updateRequirement,
  onBack,
  onContinue,
}: any) {
  const priorityRows = assignmentRows.filter(
    (row: AssignmentRow) => row.priorityLevel !== "normal",
  );
  return (
    <section className="mt-6">
      <SectionHeader
        icon={Sparkles}
        title="Priority Lessons"
        description="Use Fixed when a lesson must occupy a particular slot. Use Preferred when the generator should try that slot first."
        badge={
          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
            {priorityRows.length} priority lessons
          </span>
        }
      />
      <div className="mt-4 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <p className="text-sm font-semibold text-slate-900">
            Configure Fixed and Preferred lessons
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Normal lessons are handled automatically by the generator.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70">
                <th className="px-4 py-3 text-left text-[11px] uppercase text-slate-400">
                  Class
                </th>
                <th className="px-4 py-3 text-left text-[11px] uppercase text-slate-400">
                  Subject
                </th>
                <th className="px-4 py-3 text-left text-[11px] uppercase text-slate-400">
                  Priority
                </th>
                <th className="px-4 py-3 text-left text-[11px] uppercase text-slate-400">
                  Preferred slot
                </th>
              </tr>
            </thead>
            <tbody>
              {priorityRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="p-10 text-center text-sm text-slate-400"
                  >
                    No priority lessons configured. Normal lessons will be
                    scheduled automatically.
                  </td>
                </tr>
              ) : (
                priorityRows.map((row: AssignmentRow) => (
                  <tr key={row.key} className="border-b border-slate-100">
                    <td className="px-4 py-4 text-sm font-medium">
                      {row.className}
                    </td>
                    <td className="px-4 py-4 text-sm">{row.subjectName}</td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedPriorityKey(
                            selectedPriorityKey === row.key ? null : row.key,
                          )
                        }
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${getPriorityClasses(row.priorityLevel)}`}
                      >
                        {getPriorityLabel(row.priorityLevel)}{" "}
                        <ChevronDown size={12} className="inline" />
                      </button>
                      {selectedPriorityKey === row.key && (
                        <div className="absolute z-30 mt-2 w-64 rounded-xl border bg-white p-3 shadow-xl">
                          {(["normal", "preferred", "fixed"] as const).map(
                            (value) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => {
                                  updateRequirement(row, {
                                    priority_level: value,
                                    ...(value === "normal"
                                      ? {
                                          preferred_day: null,
                                          preferred_period: null,
                                        }
                                      : {}),
                                  });
                                  setSelectedPriorityKey(null);
                                }}
                                className={`mb-2 w-full rounded-lg border p-2 text-left text-xs ${getPriorityClasses(value)}`}
                              >
                                {getPriorityLabel(value)}
                              </button>
                            ),
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <select
                          value={row.preferredDay}
                          onChange={(e) =>
                            updateRequirement(row, {
                              preferred_day: e.target.value || null,
                            })
                          }
                          className="h-9 rounded-lg border border-slate-200 px-2 text-xs"
                        >
                          <option value="">Choose day</option>
                          {DAYS.filter((day) =>
                            settings.study_days.includes(day),
                          ).map((day) => (
                            <option key={day}>{day}</option>
                          ))}
                        </select>
                        <select
                          value={row.preferredPeriod}
                          onChange={(e) =>
                            updateRequirement(row, {
                              preferred_period: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                          className="h-9 rounded-lg border border-slate-200 px-2 text-xs"
                        >
                          <option value="">Any period</option>
                          {Array.from(
                            { length: settings.periods_per_day },
                            (_, i) => i + 1,
                          ).map((p) => (
                            <option key={p} value={p}>
                              Period {p}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <WizardFooter
        onBack={onBack}
        onContinue={onContinue}
        continueLabel="Continue to Generate & Review"
      />
    </section>
  );
}

function GenerateReviewStep({
  yearClasses,
  assignmentRows,
  requirements,
  settings,
  breaks,
  blockedPeriods,
  missingTeacherCount,
  zeroLessonClassCount,
  totalWeeklyLessons,
  readinessGood,
  generatedEntries,
  reviewClassId,
  setReviewClassId,
  onBack,
  onGenerate,
  generating,
  generationStatus,
  generationIssues,
  generationGuidance,
  onReload,
}: {
  yearClasses: SchoolClass[];
  assignmentRows: AssignmentRow[];
  requirements: LessonRequirement[];
  settings: TimetableSettings;
  breaks: BreakRule[];
  blockedPeriods: BlockedPeriod[];
  missingTeacherCount: number;
  zeroLessonClassCount: number;
  totalWeeklyLessons: number;
  readinessGood: boolean;
  generatedEntries: GeneratedEntry[];
  reviewClassId: string;
  setReviewClassId: (value: string) => void;
  onBack: () => void;
  onGenerate: () => void;
  generating: boolean;
  generationStatus: GenerationStatus;
  generationIssues: string[];
  generationGuidance: string[];
  onReload?: () => void;
}) {
  const classEntries: GeneratedEntry[] = generatedEntries.filter(
    (entry: GeneratedEntry) => entry.class_id === reviewClassId,
  );
  const byDay = useMemo(() => {
    const map: Record<string, GeneratedEntry[]> = {};
    DAYS.slice(0, 5).forEach((day) => {
      map[day] = classEntries
        .filter((entry: GeneratedEntry) => entry.day_of_week === day)
        .sort(
          (a: GeneratedEntry, b: GeneratedEntry) =>
            a.period_number - b.period_number,
        );
    });
    return map;
  }, [classEntries]);
  const generated = generatedEntries.length > 0;
  const timetableQuality = useMemo(
    () =>
      calculateTimetableQuality({
        entries: generatedEntries,
        assignmentRows,
        settings,
      }),
    [generatedEntries, assignmentRows, settings],
  );
  const validationReport = useMemo(
    () =>
      buildTimetableValidationReport({
        entries: generatedEntries,
        assignmentRows,
        requirements,
        blockedPeriods,
        settings,
        breaks,
      }),
    [
      generatedEntries,
      assignmentRows,
      requirements,
      blockedPeriods,
      settings,
      breaks,
    ],
  );

  // Build the display rows in the same component that renders the timetable.
  // Periods and configured breaks are separate visual states.
  const displayScheduleItems: DisplayScheduleItem[] = useMemo(() => {
    const breakMap = new Map<number, BreakRule>(
      breaks.map((item: BreakRule) => [item.after_period, item]),
    );
    let current = minutesFromTime(settings.first_period_start);
    const items: DisplayScheduleItem[] = [];

    for (let period = 1; period <= Math.max(0, settings.periods_per_day); period += 1) {
      const start = current;
      const end = start + Math.max(1, settings.period_duration_minutes);
      items.push({
        kind: "period",
        slot: { period, start: timeFromMinutes(start), end: timeFromMinutes(end) },
      });

      current = end + Math.max(0, settings.gap_minutes);
      const breakRule = breakMap.get(period);
      if (breakRule) {
        const breakStart = current;
        const breakEnd = breakStart + Math.max(0, breakRule.duration_minutes);
        items.push({
          kind: "break",
          name: breakRule.name,
          start: timeFromMinutes(breakStart),
          end: timeFromMinutes(breakEnd),
          afterPeriod: period,
        });
        current = breakEnd + Math.max(0, settings.gap_minutes);
      }
    }

    return items;
  }, [settings, breaks]);

  return (
    <section className="mt-6">
      <SectionHeader
        icon={Sparkles}
        title="Generate & Review"
        description="Review readiness, generate the whole-school timetable, validate every scheduling rule, then inspect each class."
      />
      <div className="mt-4 grid gap-4 lg:grid-cols-4">
        <ReadinessCard
          icon={Check}
          label="Classes"
          value={`${yearClasses.length}`}
          good={yearClasses.length > 0}
        />
        <ReadinessCard
          icon={Users}
          label="Teacher assignments"
          value={
            missingTeacherCount === 0
              ? "Complete"
              : `${missingTeacherCount} missing`
          }
          good={missingTeacherCount === 0}
        />
        <ReadinessCard
          icon={Clock3}
          label="Weekly lesson load"
          value={`${totalWeeklyLessons} periods`}
          good={totalWeeklyLessons > 0}
        />
        <ReadinessCard
          icon={CalendarDays}
          label="Generated"
          value={generated ? `${generatedEntries.length} lessons` : "Not yet"}
          good={generated}
        />
      </div>
      {generated && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Timetable quality</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{timetableQuality.label} · {timetableQuality.score}/100</p>
              <p className="mt-1 text-xs text-slate-500">Subjects are spread across different days and periods where the hard constraints allow it.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600"><b>{timetableQuality.repeatedSubjectPeriods}</b> same-period repeats</div>
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600"><b>{timetableQuality.consecutiveSubjectDays}</b> consecutive-day repeats</div>
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600"><b>{timetableQuality.sameDaySubjectPairs}</b> same-day subject pairs</div>
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600"><b>{timetableQuality.adjacentSubjectPeriods}</b> adjacent subject periods</div>
            </div>
          </div>
        </div>
      )}
      {!readinessGood && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <b>Setup not ready.</b>{" "}
          {missingTeacherCount > 0
            ? `${missingTeacherCount} lessons need teachers. `
            : ""}
          {zeroLessonClassCount > 0
            ? `${zeroLessonClassCount} classes have no lessons. `
            : ""}
          Complete Step 2 before generating.
        </div>
      )}
      <div className="mt-5 rounded-xl border border-indigo-100 bg-indigo-50/60 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-indigo-900">
              Whole-school generation
            </h3>
            <p className="mt-1 text-xs leading-5 text-indigo-700">
              MojaSchool schedules all configured classes together, respecting
              fixed slots, preferred slots, blocked periods and teacher
              conflicts.
            </p>
          </div>
          <button
            type="button"
            onClick={onGenerate}
            disabled={!readinessGood || generating}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play size={16} />
            {generating
              ? "Generating..."
              : generated
                ? "Regenerate Timetable"
                : "Generate Timetable"}
          </button>
        </div>
      </div>

      {generationStatus === "invalid" && (
        <div className="mt-5 overflow-hidden rounded-xl border border-red-200 bg-white shadow-sm">
          <div className="border-b border-red-100 bg-red-50/70 p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-red-100 p-2 text-red-700">
                <AlertCircle size={19} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-red-900">
                  Timetable result: INVALID
                </h3>
                <p className="mt-1 text-xs leading-5 text-red-700">
                  The proposed timetable was rejected because one or more hard
                  constraints were not satisfied. The last valid timetable was
                  preserved and was not replaced.
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-5 p-5 lg:grid-cols-2">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Problems found
              </h4>
              <ul className="mt-3 space-y-2">
                {generationIssues.map((issue, index) => (
                  <li
                    key={`${issue}-${index}`}
                    className="rounded-lg border border-red-100 bg-red-50/50 px-3 py-2 text-xs leading-5 text-red-800"
                  >
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Recommended resolution
              </h4>
              <ul className="mt-3 space-y-2">
                {generationGuidance.map((item, index) => (
                  <li
                    key={`${item}-${index}`}
                    className="rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2 text-xs leading-5 text-amber-900"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {generatedEntries.length > 0 && (
            <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 text-xs text-slate-600">
              <b>Previous valid timetable:</b> still displayed below. It will
              only be replaced after a complete new timetable passes every
              validation check and is saved successfully.
            </div>
          )}
        </div>
      )}

      {generated && (
        <>
          <div
            className={`mt-5 overflow-hidden rounded-xl border shadow-sm ${validationReport.allPassed ? "border-emerald-200 bg-white" : "border-red-200 bg-white"}`}
          >
            <div
              className={`flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between ${validationReport.allPassed ? "border-emerald-100 bg-emerald-50/60" : "border-red-100 bg-red-50/60"}`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`rounded-lg p-2 ${validationReport.allPassed ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
                >
                  <ShieldCheck size={19} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Timetable Validation Report
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">
                    {validationReport.allPassed
                      ? "All required timetable checks passed."
                      : "Some timetable rules are not satisfied. Review the failed checks before using this timetable."}
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${validationReport.allPassed ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
              >
                {validationReport.checks.filter((check) => check.passed).length}
                /{validationReport.checks.length} checks passed
              </span>
            </div>
            <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
              {validationReport.checks.map((check) => (
                <div
                  key={check.key}
                  className={`rounded-xl border p-4 ${check.passed ? "border-emerald-100 bg-emerald-50/40" : "border-red-200 bg-red-50/50"}`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 rounded-full p-1.5 ${check.passed ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
                    >
                      {check.passed ? (
                        <Check size={14} />
                      ) : (
                        <AlertCircle size={14} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800">
                        {check.label}
                      </p>
                      <p
                        className={`mt-1 text-xs font-medium ${check.passed ? "text-emerald-700" : "text-red-700"}`}
                      >
                        {check.summary}
                      </p>
                    </div>
                  </div>
                  {check.details.length > 0 && (
                    <ul className="mt-3 space-y-1.5 border-t border-slate-200/70 pt-3">
                      {check.details.map((detail) => (
                        <li
                          key={detail}
                          className="text-[11px] leading-4 text-slate-600"
                        >
                          {detail}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Generated timetable
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Select a class to review its weekly schedule.
                </p>
              </div>
              <div className="flex gap-2">
                <select
                  value={reviewClassId}
                  onChange={(e) => setReviewClassId(e.target.value)}
                  className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
                >
                  {yearClasses.map((schoolClass: SchoolClass) => (
                    <option key={schoolClass.id} value={schoolClass.id}>
                      {schoolClass.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={onReload}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600"
                >
                  <RefreshCw size={14} /> Refresh
                </button>
              </div>
            </div>
            <div className="grid min-w-[1000px] grid-cols-5 divide-x divide-slate-200 overflow-x-auto">
              {DAYS.slice(0, 5).map((day) => {
                const dayEntries = byDay[day] ?? [];

                return (
                  <div key={day} className="min-h-[420px]">
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-sm font-semibold text-slate-800">
                        {day}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {dayEntries.length} {dayEntries.length === 1 ? "lesson" : "lessons"}
                      </p>
                    </div>

                    <div className="space-y-2 p-3">
                      {displayScheduleItems.map((item) => {
                        if (item.kind === "break") {
                          return (
                            <div
                              key={`${day}-break-${item.afterPeriod}`}
                              className="rounded-lg border border-amber-200 bg-amber-50 p-3"
                            >
                              <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">
                                {item.name}
                              </p>
                              <p className="mt-1 text-xs font-medium text-amber-700">
                                {formatTime(item.start)}–{formatTime(item.end)}
                              </p>
                            </div>
                          );
                        }

                        const periodSlot = item.slot;
                        const blocked = blockedPeriods.find(
                          (blockedPeriod) =>
                            blockedPeriod.day_of_week === day &&
                            Number(blockedPeriod.period_number) === periodSlot.period,
                        );
                        const entry = dayEntries.find(
                          (entryItem) => entryItem.period_number === periodSlot.period,
                        );

                        if (blocked) {
                          return (
                            <div
                              key={`${day}-P${periodSlot.period}-blocked`}
                              className="rounded-lg border border-slate-300 bg-slate-100 p-3"
                            >
                              <p className="text-[11px] font-semibold text-slate-500">
                                P{periodSlot.period} · {formatTime(periodSlot.start)}–{formatTime(periodSlot.end)}
                              </p>
                              <p className="mt-2 text-sm font-semibold text-slate-600">Blocked</p>
                              <p className="mt-1 text-[11px] text-slate-500">
                                {blocked.reason || "No classes"}
                              </p>
                            </div>
                          );
                        }

                        if (!entry) {
                          return (
                            <div
                              key={`${day}-P${periodSlot.period}-free`}
                              className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 p-3"
                            >
                              <p className="text-[11px] font-semibold text-slate-400">
                                P{periodSlot.period} · {formatTime(periodSlot.start)}–
                                {formatTime(periodSlot.end)}
                              </p>
                              <p className="mt-2 text-sm font-medium text-slate-400">
                                Free
                              </p>
                              <p className="mt-1 text-[11px] text-slate-400">
                                No lesson scheduled
                              </p>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={`${entry.day_of_week}-${entry.period_number}-${entry.subject_id}-${entry.teacher_id}`}
                            className="rounded-lg border border-slate-200 p-3"
                          >
                            <p className="text-[11px] font-semibold text-indigo-600">
                              P{entry.period_number} · {formatTime(entry.start_time)}–
                              {formatTime(entry.end_time)}
                            </p>
                            <p className="mt-1.5 text-sm font-semibold text-slate-800">
                              {entry.subjectName}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-500">
                              {entry.teacherName}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
      <WizardFooter
        onBack={onBack}
        onContinue={undefined}
        continueLabel="Done"
      />
    </section>
  );
}

function TeacherTimetableView({
  schoolId,
  role,
  isTeacher,
  academicYears,
  classes,
  selectedAcademicYearId,
  setSelectedAcademicYearId,
}: {
  schoolId: string;
  role: ReturnType<typeof normalizeRole>;
  isTeacher: boolean;
  academicYears: AcademicYear[];
  classes: SchoolClass[];
  selectedAcademicYearId: string;
  setSelectedAcademicYearId: (value: string) => void;
}) {
  const [selectedClassId, setSelectedClassId] = useState("");
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const availableClasses = useMemo(
    () =>
      classes.filter(
        (item) => item.academic_year_id === selectedAcademicYearId,
      ),
    [classes, selectedAcademicYearId],
  );
  useEffect(() => {
    if (
      !selectedClassId ||
      !availableClasses.some((item) => item.id === selectedClassId)
    )
      setSelectedClassId(availableClasses[0]?.id ?? "");
  }, [availableClasses, selectedClassId]);
  useEffect(() => {
    async function load() {
      if (!schoolId || !selectedAcademicYearId || !selectedClassId) {
        setEntries([]);
        return;
      }
      setLoading(true);
      setError("");
      const { data, error: queryError } = await supabase
        .from("timetable_entries")
        .select(
          "id, class_id, subject_id, teacher_id, day_of_week, start_time, end_time, subjects(name), teachers(first_name, middle_name, last_name)",
        )
        .eq("school_id", schoolId)
        .eq("academic_year_id", selectedAcademicYearId)
        .eq("class_id", selectedClassId)
        .order("start_time");
      if (queryError) setError(getErrorMessage(queryError));
      setEntries(data ?? []);
      setLoading(false);
    }
    void load();
  }, [schoolId, selectedAcademicYearId, selectedClassId]);
  const grouped = useMemo(() => {
    const result: Record<string, any[]> = {};
    DAYS.slice(0, 5).forEach((day) => {
      result[day] = [];
    });
    entries.forEach((entry) => {
      if (result[entry.day_of_week]) result[entry.day_of_week].push(entry);
    });
    return result;
  }, [entries]);
  return (
    <div className="mx-auto max-w-[1400px] pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Timetable</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isTeacher
              ? "View your assigned class timetable."
              : `View the school's timetable as ${role}.`}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <SelectField
            label="Academic Year"
            value={selectedAcademicYearId}
            onChange={setSelectedAcademicYearId}
            options={academicYears.map((year) => ({
              value: year.id,
              label: year.name,
            }))}
          />
          <SelectField
            label="Class"
            value={selectedClassId}
            onChange={setSelectedClassId}
            options={availableClasses.map((schoolClass) => ({
              value: schoolClass.id,
              label: schoolClass.name,
            }))}
          />
        </div>
      </div>
      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {loading ? (
        <div className="mt-6 flex min-h-[260px] items-center justify-center rounded-xl border border-slate-200 bg-white">
          <p className="text-sm text-slate-500">Loading timetable...</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="grid min-w-[1100px] grid-cols-5 divide-x divide-slate-200">
            {DAYS.slice(0, 5).map((day) => (
              <div key={day} className="min-h-[520px]">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-800">{day}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {grouped[day]?.length ?? 0} lessons
                  </p>
                </div>
                <div className="space-y-3 p-3">
                  {grouped[day]?.length ? (
                    grouped[day].map((entry) => {
                      const subject = Array.isArray(entry.subjects)
                        ? entry.subjects[0]
                        : entry.subjects;
                      const teacher = Array.isArray(entry.teachers)
                        ? entry.teachers[0]
                        : entry.teachers;
                      return (
                        <div
                          key={entry.id}
                          className="rounded-xl border border-slate-200 p-3"
                        >
                          <p className="text-xs font-semibold text-indigo-600">
                            {formatTime(entry.start_time)} –{" "}
                            {formatTime(entry.end_time)}
                          </p>
                          <p className="mt-2 text-sm font-semibold text-slate-800">
                            {subject?.name ?? "Subject"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {getFullName(teacher ?? {})}
                          </p>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-12 text-center text-xs text-slate-400">
                      No lessons
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <PrintableTimetable
        schoolName="HIGH GATE INTERNATIONAL ACADEMY"
        academicYear={
          academicYears.find((year) => year.id === selectedAcademicYearId)
            ?.name ?? ""
        }
        className={
          availableClasses.find(
            (schoolClass) => schoolClass.id === selectedClassId,
          )?.name ?? ""
        }
        lessons={entries.map((entry) => {
          const subject = Array.isArray(entry.subjects)
            ? entry.subjects[0]
            : entry.subjects;
          return {
            day: entry.day_of_week,
            startTime: entry.start_time,
            endTime: entry.end_time,
            subject: subject?.name ?? "",
          };
        })}
        logoUrl="/high-gate-logo.png"
      />
    </div>
  );
}

function WizardFooter({
  onBack,
  onContinue,
  continueLabel,
}: {
  onBack?: (() => void) | undefined;
  onContinue?: (() => void) | undefined;
  continueLabel: string;
}) {
  return (
    <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
      <button
        type="button"
        onClick={onBack}
        disabled={!onBack}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 disabled:invisible"
      >
        <ArrowLeft size={15} /> Back
      </button>
      {onContinue && (
        <button
          type="button"
          onClick={onContinue}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          {continueLabel}
          <ArrowRight size={15} />
        </button>
      )}
    </div>
  );
}
function Step({
  number,
  title,
  description,
  active,
  completed,
  onClick,
}: {
  number: string;
  title: string;
  description: string;
  active?: boolean;
  completed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-4 text-left ${active ? "bg-indigo-50/70" : "bg-white hover:bg-slate-50"}`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${active ? "bg-indigo-600 text-white" : completed ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
      >
        {completed ? <Check size={16} /> : number}
      </div>
      <div className="min-w-0">
        <p
          className={`text-xs font-semibold ${active ? "text-indigo-700" : "text-slate-700"}`}
        >
          {title}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-slate-400">
          {description}
        </p>
      </div>
      {active && <div className="ml-auto h-1 w-7 rounded-full bg-indigo-500" />}
    </button>
  );
}
function SectionHeader({
  icon: Icon,
  title,
  description,
  badge,
}: {
  icon: typeof CalendarDays;
  title: string;
  description: string;
  badge?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
          <Icon size={18} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
            {description}
          </p>
        </div>
      </div>
      {badge}
    </div>
  );
}
function SummaryCard({
  icon: Icon,
  title,
  count,
  subtitle,
  accent,
}: {
  icon: typeof School;
  title: string;
  count: number;
  subtitle: string;
  accent: "indigo" | "emerald" | "amber";
}) {
  const classes = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
  }[accent];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className={`rounded-lg p-2.5 ${classes}`}>
          <Icon size={20} />
        </div>
        <span className="text-2xl font-semibold text-slate-900">{count}</span>
      </div>
      <h3 className="mt-4 text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}
function ReadinessCard({
  icon: Icon,
  label,
  value,
  good,
}: {
  icon: typeof Check;
  label: string;
  value: string;
  good: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div
        className={`rounded-lg p-2 ${good ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}
      >
        <Icon size={18} />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-slate-500">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-500"
      />
    </label>
  );
}
function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-slate-500">
        {label}
      </span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-500"
      />
    </label>
  );
}
function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block min-w-[220px]">
      <span className="mb-1 block text-[11px] font-medium text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-indigo-500"
      >
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
