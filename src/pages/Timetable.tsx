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
  academic_section_id?: string | null;
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

interface AcademicSectionRecord {
  id: string;
  academic_year_id: string;
  name: string;
  display_order: number;
  is_active: boolean;
}

type TimetableMode = "routine" | "academic";

function canonicalSectionKey(value: string | null | undefined) {
  const normalized = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (normalized === "creche" || normalized === "crèche") return "creche";
  if (normalized === "nursery" || normalized === "preschool") return "nursery";
  if (normalized === "primary" || normalized === "primary school") return "primary";
  if (["lower secondary", "junior secondary", "lower sec"].includes(normalized)) return "lower_secondary";
  if (["upper secondary", "senior secondary", "upper sec"].includes(normalized)) return "upper_secondary";
  if (normalized === "secondary" || normalized === "secondary school") return "secondary";
  return normalized;
}

function isRoutineSectionName(value: string | null | undefined) {
  const key = canonicalSectionKey(value);
  return key === "creche" || key === "nursery";
}

function sectionTabLabel(value: string) {
  const key = canonicalSectionKey(value);
  if (key === "creche") return "Creche";
  if (key === "nursery") return "Nursery";
  if (key === "primary") return "Primary";
  if (key === "lower_secondary") return "Lower Secondary";
  if (key === "upper_secondary") return "Upper Secondary";
  if (key === "secondary") return "Secondary";
  return value;
}

function explicitSectionKeysForSchoolType(schoolType: string): Set<string> | null {
  const type = canonicalSectionKey(schoolType);
  if (type === "creche") return new Set(["creche"]);
  if (type === "nursery") return new Set(["nursery"]);
  if (["creche & nursery", "crèche & nursery"].includes(type)) return new Set(["creche", "nursery"]);
  if (type === "primary") return new Set(["primary"]);
  if (type === "secondary") return new Set(["lower_secondary", "upper_secondary", "secondary"]);
  if (["primary & secondary", "combined primary secondary"].includes(type)) {
    return new Set(["primary", "lower_secondary", "upper_secondary", "secondary"]);
  }
  return null;
}

type CrecheRoutineDefinition = {
  key: string;
  title: string;
  detail: string;
};

interface CrecheRoutineRecord {
  routine_key: string;
  start_time: string | null;
  end_time: string | null;
}

const CRECHE_ROUTINES: CrecheRoutineDefinition[] = [
  { key: "arrival", title: "Arrival & wellbeing check", detail: "Welcome children, check wellbeing and note anything important." },
  { key: "breakfast", title: "Breakfast / morning snack", detail: "Meal and feeding period; record intake in Daily Care." },
  { key: "learning_play", title: "Learning & play activities", detail: "Indoor play, guided activities and age-appropriate learning." },
  { key: "outdoor", title: "Outdoor / movement time", detail: "Supervised outdoor play or movement activities." },
  { key: "lunch_care", title: "Lunch & personal care", detail: "Lunch, hygiene and personal-care routines." },
  { key: "nap", title: "Nap & quiet rest", detail: "Rest period; record nap start/end and quality in Daily Care." },
  { key: "afternoon", title: "Afternoon care & activities", detail: "Afternoon snack, calm play and individual care needs." },
  { key: "departure", title: "Departure & handover", detail: "Prepare children for collection and note parent handover details." },
];

const NURSERY_ROUTINES: CrecheRoutineDefinition[] = [
  { key: "arrival", title: "Arrival & settling in", detail: "Welcome children, support transitions and note any important handover." },
  { key: "breakfast", title: "Breakfast / morning snack", detail: "Record the meal or snack routine and relevant notes." },
  { key: "learning_play", title: "Circle time & early learning", detail: "Language, numbers, stories and guided early-learning activities." },
  { key: "outdoor", title: "Outdoor & movement activities", detail: "Supervised outdoor play, movement and group games." },
  { key: "lunch_care", title: "Lunch & personal care", detail: "Lunch, hygiene and supported independence routines." },
  { key: "nap", title: "Quiet time / rest", detail: "A flexible quiet period; configure a fixed time only when needed." },
  { key: "afternoon", title: "Creative & afternoon activities", detail: "Art, music, imaginative play and small-group activities." },
  { key: "departure", title: "Departure & parent handover", detail: "Prepare children for collection and record relevant handover notes." },
];

function normalizeTimeInput(value: string | null | undefined) {
  return value ? value.slice(0, 5) : "";
}

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

function timeToMinutes(value: string) {
  const [hours, minutes] = value.slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
}

function timeRangesOverlap(
  firstStart: string,
  firstEnd: string,
  secondStart: string,
  secondEnd: string,
) {
  const aStart = timeToMinutes(firstStart);
  const aEnd = timeToMinutes(firstEnd);
  const bStart = timeToMinutes(secondStart);
  const bEnd = timeToMinutes(secondEnd);
  if (aStart === null || aEnd === null || bStart === null || bEnd === null) {
    return false;
  }
  return aStart < bEnd && bStart < aEnd;
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
  const [schoolType, setSchoolType] = useState("School");
  const [configuredSectionNames, setConfiguredSectionNames] = useState<string[]>([]);
  const [hasExplicitSectionConfig, setHasExplicitSectionConfig] = useState(false);
  const [academicSections, setAcademicSections] = useState<AcademicSectionRecord[]>([]);
  const [timetableMode, setTimetableMode] = useState<TimetableMode>("academic");
  const [selectedSectionId, setSelectedSectionId] = useState("");
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
      academicSectionsResult,
      schoolConfigResult,
    ] = await Promise.all([
      supabase
        .from("academic_years")
        .select("id, name, is_active")
        .eq("school_id", currentSchoolId)
        .order("name", { ascending: false }),
      supabase
        .from("classes")
        .select("id, name, academic_year_id, academic_section_id, is_active")
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
      supabase
        .from("academic_sections")
        .select("id, academic_year_id, name, display_order, is_active")
        .eq("school_id", currentSchoolId)
        .order("display_order", { ascending: true }),
      supabase
        .from("school_configurations")
        .select("school_type, sections")
        .eq("school_id", currentSchoolId)
        .maybeSingle(),
    ]);
    const firstError =
      yearsResult.error ??
      classesResult.error ??
      subjectsResult.error ??
      teachersResult.error ??
      assignmentsResult.error ??
      classSubjectsResult.error ??
      academicSectionsResult.error ??
      schoolConfigResult.error;
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
    setAcademicSections((academicSectionsResult.data ?? []) as AcademicSectionRecord[]);
    const configuration = schoolConfigResult.data as any;
    setSchoolType(String(configuration?.school_type ?? "School"));
    const rawSectionConfig = Array.isArray(configuration?.sections)
      ? configuration.sections
      : [];
    setHasExplicitSectionConfig(rawSectionConfig.length > 0);
    setConfiguredSectionNames(
      rawSectionConfig
        .filter((item: any) => item && item.enabled !== false)
        .map((item: any) => String(item.name ?? item.key ?? "").trim())
        .filter(Boolean),
    );
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
  }

  async function loadSavedConfiguration(
    currentSchoolId: string,
    yearId: string,
    sectionId: string | null = selectedSectionId || null,
  ) {
    // Academic timing, breaks and blocked periods belong to one academic
    // section. The SQL migration keeps legacy school-wide rows as null while
    // copying them into section-specific starter settings.
    let settingsQuery = supabase
      .from("timetable_settings")
      .select(
        "study_days, periods_per_day, period_duration_minutes, gap_minutes, first_period_start",
      )
      .eq("school_id", currentSchoolId)
      .eq("academic_year_id", yearId);
    settingsQuery = sectionId
      ? settingsQuery.eq("academic_section_id", sectionId)
      : settingsQuery.is("academic_section_id", null);

    let breaksQuery = supabase
      .from("timetable_breaks")
      .select("id, name, after_period, duration_minutes")
      .eq("school_id", currentSchoolId)
      .eq("academic_year_id", yearId);
    breaksQuery = sectionId
      ? breaksQuery.eq("academic_section_id", sectionId)
      : breaksQuery.is("academic_section_id", null);

    let blockedQuery = supabase
      .from("timetable_blocked_periods")
      .select("id, day_of_week, period_number, reason")
      .eq("school_id", currentSchoolId)
      .eq("academic_year_id", yearId);
    blockedQuery = sectionId
      ? blockedQuery.eq("academic_section_id", sectionId)
      : blockedQuery.is("academic_section_id", null);

    const sectionClassIds = sectionId
      ? new Set(
          classes
            .filter(
              (item) =>
                item.academic_year_id === yearId &&
                item.academic_section_id === sectionId,
            )
            .map((item) => item.id),
        )
      : null;

    const [
      settingsResult,
      breaksResult,
      blockedResult,
      requirementsResult,
      entriesResult,
    ] = await Promise.all([
      settingsQuery.maybeSingle(),
      breaksQuery.order("after_period"),
      blockedQuery.order("day_of_week").order("period_number"),
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
      (requirementsResult.data ?? [])
        .filter((item: any) => !sectionClassIds || sectionClassIds.has(item.class_id))
        .map((item: any) => ({
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
      (entriesResult.data ?? [])
        .filter((item: any) => !sectionClassIds || sectionClassIds.has(item.class_id))
        .map((item: any) => {
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

  const yearSections = useMemo(
    () =>
      academicSections
        .filter((section) => section.academic_year_id === selectedAcademicYearId && section.is_active !== false)
        .sort((a, b) => a.display_order - b.display_order),
    [academicSections, selectedAcademicYearId],
  );

  const eligibleSectionKeys = useMemo(() => {
    const schoolTypeKeys = explicitSectionKeysForSchoolType(schoolType);
    const configuredKeys = new Set(configuredSectionNames.map(canonicalSectionKey));

    if (schoolTypeKeys) {
      return hasExplicitSectionConfig
        ? new Set(Array.from(schoolTypeKeys).filter((key) => configuredKeys.has(key)))
        : schoolTypeKeys;
    }

    if (hasExplicitSectionConfig) return configuredKeys;
    return null;
  }, [schoolType, configuredSectionNames, hasExplicitSectionConfig]);

  const sectionTabs = useMemo(
    () =>
      yearSections
        .filter((section) => !eligibleSectionKeys || eligibleSectionKeys.has(canonicalSectionKey(section.name)))
        .map((section) => ({ ...section, label: sectionTabLabel(section.name) })),
    [yearSections, eligibleSectionKeys],
  );

  const routineSectionTabs = useMemo(
    () => sectionTabs.filter((section) => isRoutineSectionName(section.name)),
    [sectionTabs],
  );
  const academicSectionTabs = useMemo(
    () => sectionTabs.filter((section) => !isRoutineSectionName(section.name)),
    [sectionTabs],
  );
  const activeModeSections = timetableMode === "routine" ? routineSectionTabs : academicSectionTabs;
  const activeSection =
    activeModeSections.find((section) => section.id === selectedSectionId) ??
    activeModeSections[0] ??
    null;

  useEffect(() => {
    if (
      !canManage ||
      !schoolId ||
      !selectedAcademicYearId ||
      timetableMode !== "academic" ||
      !activeSection?.id
    ) {
      return;
    }
    void loadSavedConfiguration(schoolId, selectedAcademicYearId, activeSection.id);
  }, [
    canManage,
    schoolId,
    selectedAcademicYearId,
    timetableMode,
    activeSection?.id,
  ]);

  useEffect(() => {
    if (!canManage) return;
    if (timetableMode === "routine" && routineSectionTabs.length === 0 && academicSectionTabs.length > 0) {
      setTimetableMode("academic");
      return;
    }
    if (timetableMode === "academic" && academicSectionTabs.length === 0 && routineSectionTabs.length > 0) {
      setTimetableMode("routine");
      return;
    }
    if (!activeModeSections.some((section) => section.id === selectedSectionId)) {
      setSelectedSectionId(activeModeSections[0]?.id ?? "");
    }
  }, [canManage, timetableMode, routineSectionTabs, academicSectionTabs, activeModeSections, selectedSectionId]);

  const allYearClasses = useMemo(
    () => classes.filter((item) => item.academic_year_id === selectedAcademicYearId),
    [classes, selectedAcademicYearId],
  );
  const yearClasses = useMemo(
    () =>
      activeSection
        ? allYearClasses.filter((item) => item.academic_section_id === activeSection.id)
        : [],
    [allYearClasses, activeSection?.id],
  );
  const scopedClassIds = useMemo(() => new Set(yearClasses.map((item) => item.id)), [yearClasses]);
  const yearAssignments = useMemo(
    () =>
      teacherAssignments.filter(
        (item) => item.academic_year_id === selectedAcademicYearId && scopedClassIds.has(item.class_id),
      ),
    [teacherAssignments, selectedAcademicYearId, scopedClassIds],
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
  const periodTimes = useMemo(
    () =>
      new Map(
        periodPreview
          .filter((item) => item.kind === "period" && item.period)
          .map((item) => [item.period!, { start: item.start, end: item.end }]),
      ),
    [periodPreview],
  );



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
    if (timetableMode !== "academic" || !activeSection?.id) {
      setError("Select an academic section before saving timetable settings.");
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
    const sectionSettingsPayload = {
      school_id: schoolId,
      academic_year_id: selectedAcademicYearId,
      academic_section_id: activeSection.id,
      study_days: settings.study_days,
      periods_per_day: settings.periods_per_day,
      period_duration_minutes: settings.period_duration_minutes,
      gap_minutes: settings.gap_minutes,
      first_period_start: settings.first_period_start,
    };
    const existingSettingsResult = await supabase
      .from("timetable_settings")
      .select("id")
      .eq("school_id", schoolId)
      .eq("academic_year_id", selectedAcademicYearId)
      .eq("academic_section_id", activeSection.id)
      .maybeSingle();
    if (existingSettingsResult.error) {
      setError(getErrorMessage(existingSettingsResult.error));
      setSaving(false);
      return false;
    }
    const settingsResult = existingSettingsResult.data?.id
      ? await supabase
          .from("timetable_settings")
          .update(sectionSettingsPayload)
          .eq("id", existingSettingsResult.data.id)
      : await supabase.from("timetable_settings").insert(sectionSettingsPayload);
    if (settingsResult.error) {
      setError(getErrorMessage(settingsResult.error));
      setSaving(false);
      return false;
    }
    const deleteBreak = await supabase
      .from("timetable_breaks")
      .delete()
      .eq("school_id", schoolId)
      .eq("academic_year_id", selectedAcademicYearId)
      .eq("academic_section_id", activeSection.id);
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
            academic_section_id: activeSection.id,
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
      .eq("academic_year_id", selectedAcademicYearId)
      .eq("academic_section_id", activeSection.id);
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
            academic_section_id: activeSection.id,
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
    await loadSavedConfiguration(schoolId, selectedAcademicYearId, activeSection.id);
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

  function buildOccurrences() {
    return assignmentRows.flatMap((row) =>
      Array.from({ length: Math.max(0, row.lessonsPerWeek) }, (_, index) => ({
        row,
        occurrence: index + 1,
      })),
    );
  }

  async function generateTimetable() {
    setError("");
    setSuccess("");
    setGenerationStatus("idle");
    setGenerationIssues([]);
    setGenerationGuidance([]);

    if (!validateForStep(5)) return;
    if (!activeSection?.id) {
      setError("Select an academic section before generating its timetable.");
      return;
    }

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

    const saved = await saveSetup(false);
    if (!saved) return;

    setGenerating(true);
    try {
      const capacityByClass = new Map<string, number>();
      const blockedSet = new Set(
        blockedPeriods.map(
          (item) => `${item.day_of_week}:${item.period_number}`,
        ),
      );

      for (const schoolClass of yearClasses) {
        const blocked = blockedPeriods.filter(
          (item) => settings.study_days.includes(item.day_of_week),
        ).length;
        capacityByClass.set(
          schoolClass.id,
          settings.study_days.length * settings.periods_per_day - blocked,
        );
      }

      for (const schoolClass of yearClasses) {
        const load = assignmentRows
          .filter((row) => row.classId === schoolClass.id)
          .reduce((sum, row) => sum + row.lessonsPerWeek, 0);
        if (load > (capacityByClass.get(schoolClass.id) ?? 0)) {
          throw new Error(
            `${schoolClass.name} needs ${load} lessons but only ${capacityByClass.get(schoolClass.id) ?? 0} usable periods are available.`,
          );
        }
      }

      const slots = settings.study_days.flatMap((day) =>
        Array.from({ length: settings.periods_per_day }, (_, i) => i + 1).map(
          (period) => ({ day, period }),
        ),
      );
      const usableSlots = slots.filter(
        (slot) => !blockedSet.has(`${slot.day}:${slot.period}`),
      );

      const occupiedClass = new Set<string>();
      const occupiedTeacher = new Set<string>();
      const currentSectionClassIds = new Set(yearClasses.map((item) => item.id));
      const externalTeacherEntries = new Map<
        string,
        Array<{ day_of_week: string; start_time: string; end_time: string }>
      >();
      const existingEntriesResult = await supabase
        .from("timetable_entries")
        .select("class_id, teacher_id, day_of_week, period_number, start_time, end_time")
        .eq("school_id", schoolId)
        .eq("academic_year_id", selectedAcademicYearId);
      if (existingEntriesResult.error) throw existingEntriesResult.error;
      for (const existing of existingEntriesResult.data ?? []) {
        // The selected section is regenerated as a unit; entries in other
        // sections stay in place. Different sections may use different period
        // lengths/start times, so cross-section teacher conflicts are checked
        // by overlapping clock times rather than by matching period numbers.
        if (currentSectionClassIds.has(existing.class_id)) continue;
        if (
          existing.teacher_id &&
          existing.day_of_week &&
          existing.start_time &&
          existing.end_time
        ) {
          const teacherEntries = externalTeacherEntries.get(existing.teacher_id) ?? [];
          teacherEntries.push({
            day_of_week: existing.day_of_week,
            start_time: String(existing.start_time),
            end_time: String(existing.end_time),
          });
          externalTeacherEntries.set(existing.teacher_id, teacherEntries);
        }
      }
      const result: GeneratedEntry[] = [];
      const classDayCounts = new Map<string, Map<string, number>>();
      const subjectDayCounts = new Map<string, Map<string, number>>();
      const teacherDayCounts = new Map<string, Map<string, number>>();
      const scheduledByClass = new Map<string, GeneratedEntry[]>();

      const occurrences = buildOccurrences().sort((a, b) => {
        const priorityOrder = { fixed: 0, preferred: 1, normal: 2 } as Record<
          string,
          number
        >;
        return (
          priorityOrder[a.row.priorityLevel] -
            priorityOrder[b.row.priorityLevel] ||
          b.row.lessonsPerWeek - a.row.lessonsPerWeek
        );
      });

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
      ) => {
        if (!map.has(id)) map.set(id, new Map());
        const inner = map.get(id)!;
        inner.set(day, (inner.get(day) ?? 0) + 1);
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

      const canPlace = (
        row: AssignmentRow,
        slot: { day: string; period: number },
      ) => {
        const times = periodTimes.get(slot.period);
        if (!times || !row.teacherId) return false;
        if (blockedSet.has(`${slot.day}:${slot.period}`)) return false;
        if (!settings.study_days.includes(slot.day)) return false;
        const overlapsAnotherSection = (
          externalTeacherEntries.get(row.teacherId) ?? []
        ).some(
          (entry) =>
            entry.day_of_week === slot.day &&
            timeRangesOverlap(times.start, times.end, entry.start_time, entry.end_time),
        );
        if (
          occupiedClass.has(classKey(row.classId, slot.day, slot.period)) ||
          occupiedTeacher.has(teacherKey(row.teacherId, slot.day, slot.period)) ||
          overlapsAnotherSection
        ) {
          return false;
        }
        if (isAdjacentSameSubject(row, slot.day, slot.period)) return false;
        return true;
      };

      const place = (
        row: AssignmentRow,
        slot: { day: string; period: number },
      ) => {
        if (!canPlace(row, slot)) return false;
        const times = periodTimes.get(slot.period);
        if (!times || !row.teacherId) return false;

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
        bump(classDayCounts, row.classId, slot.day);
        bump(subjectDayCounts, `${row.classId}:${row.subjectId}`, slot.day);
        bump(teacherDayCounts, row.teacherId, slot.day);
        if (!scheduledByClass.has(row.classId)) {
          scheduledByClass.set(row.classId, []);
        }
        scheduledByClass.get(row.classId)!.push(entry);
        return true;
      };

      // HARD CONSTRAINT: fixed lessons are placed first. No flexible lesson
      // is allowed to consume a fixed slot before fixed lessons are checked.
      const fixedGroups = occurrences.filter(
        (item) => item.row.priorityLevel === "fixed",
      );
      for (const item of fixedGroups) {
        if (item.occurrence > 1) continue;
        const slot = {
          day: item.row.preferredDay,
          period: Number(item.row.preferredPeriod),
        };
        if (!place(item.row, slot)) {
          throw new Error(
            `Fixed lesson could not be placed: ${item.row.className} — ${item.row.subjectName} → ${slot.day}, Period ${slot.period}. A hard constraint is blocking this slot.`,
          );
        }
      }

      const remaining = occurrences.filter(
        (item) =>
          !(item.row.priorityLevel === "fixed" && item.occurrence === 1),
      );

      for (const item of remaining) {
        const preferred =
          item.row.priorityLevel === "preferred" ||
          item.row.priorityLevel === "fixed";

        let candidates = usableSlots.filter((slot) =>
          canPlace(item.row, slot),
        );

        if (preferred && item.row.preferredDay && item.row.preferredPeriod) {
          const exact = candidates.find(
            (slot) =>
              slot.day === item.row.preferredDay &&
              slot.period === Number(item.row.preferredPeriod),
          );
          if (exact) {
            candidates = [
              exact,
              ...candidates.filter((slot) => slot !== exact),
            ];
          }
        }

        candidates.sort((a, b) => {
          const score = (slot: { day: string; period: number }) => {
            let value = 0;
            if (item.row.preferredDay === slot.day)
              value += preferred ? 100 : 10;
            if (
              item.row.preferredPeriod &&
              Number(item.row.preferredPeriod) === slot.period
            ) {
              value += preferred ? 100 : 5;
            }
            value -= countFor(classDayCounts, item.row.classId, slot.day) * 20;
            value -=
              countFor(
                subjectDayCounts,
                `${item.row.classId}:${item.row.subjectId}`,
                slot.day,
              ) * 50;
            value -=
              countFor(teacherDayCounts, item.row.teacherId ?? "", slot.day) *
              5;
            // Prefer earlier periods when all hard/priority constraints are equal.
            // P1 therefore wins over P2, P2 over P3, etc., without forcing
            // every class to start at P1 when another constraint is stronger.
            value -= (slot.period - 1) * 2;
            return value;
          };
          return score(b) - score(a);
        });

        const chosen = candidates[0];
        if (!chosen || !place(item.row, chosen)) {
          throw new Error(
            `Could not schedule ${item.row.className} — ${item.row.subjectName} (lesson ${item.occurrence}). The remaining constraints are too tight.`,
          );
        }
      }

      // Validate the complete candidate before touching the existing database
      // timetable. If anything is invalid, the previous valid timetable stays
      // exactly where it is.
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
          "Review Fixed lessons first; Fixed is a hard constraint and must never be displaced by a normal lesson.",
          "If a teacher is double-booked, move one lesson or assign it to another teacher.",
          "If a class has two lessons in one period, move one lesson to another available period.",
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
      // school/year/class/day/period. Therefore we cannot insert the new
      // timetable while the old timetable still occupies those slots.
      //
      // We first keep an in-memory backup of the current valid timetable,
      // then replace it. If the insert fails, we restore the backup. This
      // avoids the ON CONFLICT problem and guarantees that an invalid/failed
      // generation does not leave the school without its previous timetable.
      const previousEntriesResult = await supabase
        .from("timetable_entries")
        .select(
          "school_id, academic_year_id, class_id, subject_id, teacher_id, day_of_week, period_number, start_time, end_time",
        )
        .eq("school_id", schoolId)
        .eq("academic_year_id", selectedAcademicYearId)
        .in("class_id", yearClasses.map((item) => item.id));

      if (previousEntriesResult.error) throw previousEntriesResult.error;

      const previousEntries = previousEntriesResult.data ?? [];

      const deletePreviousResult = await supabase
        .from("timetable_entries")
        .delete()
        .eq("school_id", schoolId)
        .eq("academic_year_id", selectedAcademicYearId)
        .in("class_id", yearClasses.map((item) => item.id));

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
        // Remove any partially inserted candidate rows before restoring the
        // previous valid timetable.
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
            .eq("academic_year_id", selectedAcademicYearId)
            .in("class_id", yearClasses.map((item) => item.id));
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

      // The database now contains exactly the validated candidate. Reload it
      // so the UI uses the same records that teachers/principals will see.
      await loadSavedConfiguration(schoolId, selectedAcademicYearId, activeSection.id);
      setGeneratedEntries(
        result.map((entry, index) => ({
          ...entry,
          id: insertedIds[index],
        })),
      );
      setGenerationStatus("valid");
      setGenerationIssues([]);
      setGenerationGuidance([]);
      setSuccess(
        `Timetable generated successfully: ${result.length} lessons across ${yearClasses.length} class${yearClasses.length === 1 ? "" : "es"}.`,
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
        "Review the constraint or database error above and regenerate after fixing it.",
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
            School Timetable
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            {timetableMode === "routine"
              ? "Configure daily care and learning routines for Creche and Nursery classes."
              : "Manage formal subject timetables for the selected academic section."}
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
          {timetableMode === "academic" && (
            <button
              type="button"
              onClick={() => void saveSetup()}
              disabled={saving || !selectedAcademicYearId || yearClasses.length === 0}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? "Saving..." : "Save Setup"}
            </button>
          )}
        </div>
      </div>

      {(routineSectionTabs.length > 0 || academicSectionTabs.length > 0) && (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {routineSectionTabs.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setTimetableMode("routine");
                  setSelectedSectionId(routineSectionTabs[0]?.id ?? "");
                  setError("");
                  setSuccess("");
                }}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition ${timetableMode === "routine" ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${timetableMode === "routine" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                  <Clock3 size={19} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">Routine timetable</span>
                  <span className="mt-0.5 block text-xs opacity-80">Creche and Nursery daily routines</span>
                </span>
                <span className="rounded-full bg-white/80 px-2 py-1 text-xs font-semibold">{routineSectionTabs.length}</span>
              </button>
            )}
            {academicSectionTabs.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setTimetableMode("academic");
                  setSelectedSectionId(academicSectionTabs[0]?.id ?? "");
                  setError("");
                  setSuccess("");
                }}
                className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition ${timetableMode === "academic" ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${timetableMode === "academic" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                  <BookOpen size={19} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">Academic timetable</span>
                  <span className="mt-0.5 block text-xs opacity-80">Subjects, teachers and lesson periods</span>
                </span>
                <span className="rounded-full bg-white/80 px-2 py-1 text-xs font-semibold">{academicSectionTabs.length}</span>
              </button>
            )}
          </div>
          {activeModeSections.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto border-t border-slate-100 pt-3">
              {activeModeSections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => {
                    setSelectedSectionId(section.id);
                    setError("");
                    setSuccess("");
                  }}
                  className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition ${activeSection?.id === section.id ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  {section.label}
                </button>
              ))}
            </div>
          )}
          {activeSection && (
            <p className="mt-3 text-xs text-slate-500">
              Showing {activeSection.label} {timetableMode === "routine" ? "routine" : "academic schedule"} for {selectedAcademicYearId ? academicYears.find((year) => year.id === selectedAcademicYearId)?.name ?? "the selected academic year" : "the selected academic year"}.
            </p>
          )}
        </section>
      )}

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

      {sectionTabs.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <School size={28} className="mx-auto text-slate-400" />
          <h2 className="mt-3 text-base font-semibold text-slate-800">No timetable sections configured</h2>
          <p className="mx-auto mt-1 max-w-lg text-sm text-slate-500">MojaSchool could not find any enabled academic sections for {academicYears.find((year) => year.id === selectedAcademicYearId)?.name ?? "the selected academic year"}. Check the school's section configuration and Academic Settings.</p>
        </div>
      ) : timetableMode === "routine" ? (
        activeSection ? (
          <CrecheRoutineAdminSettings
            schoolId={schoolId}
            academicYearId={selectedAcademicYearId}
            classes={yearClasses}
            sectionName={activeSection.name}
          />
        ) : (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <Clock3 size={28} className="mx-auto text-slate-400" />
            <h2 className="mt-3 text-base font-semibold text-slate-800">No routine sections configured</h2>
            <p className="mt-1 text-sm text-slate-500">Ask the school administrator to enable Creche or Nursery in the school's section configuration for this academic year.</p>
          </div>
        )
      ) : (
        <>
          <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="grid min-w-[980px] grid-cols-5">
              {[
                { n: 1, title: "Academic Structure", desc: "Classes, subjects, teachers" },
                { n: 2, title: "Lesson Assignments", desc: "Teacher + weekly lessons" },
                { n: 3, title: "School Schedule", desc: "Days, periods and breaks" },
                { n: 4, title: "Priority Lessons", desc: "Fixed or preferred slots" },
                { n: 5, title: "Generate & Review", desc: "Section timetable" },
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
          {yearClasses.length === 0 && (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              No active classes are assigned to {activeSection?.label ?? "this academic section"} for the selected academic year. Create or assign classes to this section first.
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
            selectedAcademicYearId && schoolId && activeSection?.id
              ? void loadSavedConfiguration(schoolId, selectedAcademicYearId, activeSection.id)
              : undefined
          }
        />
      )}
        </>
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

  // Build the display periods in the same component that renders the timetable.
  // This keeps P1, P2, etc. visible even when a period has no lesson.
  const displayPeriods: PeriodSlot[] = useMemo(() => {
    const breakMap = new Map<number, BreakRule>(
      breaks.map((item: BreakRule) => [item.after_period, item]),
    );
    let current = minutesFromTime(settings.first_period_start);
    const periods: PeriodSlot[] = [];

    for (
      let period = 1;
      period <= Math.max(0, settings.periods_per_day);
      period += 1
    ) {
      const start = current;
      const end = start + Math.max(1, settings.period_duration_minutes);

      periods.push({
        period,
        start: timeFromMinutes(start),
        end: timeFromMinutes(end),
      });

      current = end + Math.max(0, settings.gap_minutes);

      const breakRule = breakMap.get(period);
      if (breakRule) {
        current += Math.max(0, breakRule.duration_minutes);
        current += Math.max(0, settings.gap_minutes);
      }
    }

    return periods;
  }, [
    breaks,
    settings.first_period_start,
    settings.periods_per_day,
    settings.period_duration_minutes,
    settings.gap_minutes,
  ]);

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
                      {displayPeriods.map((periodSlot: PeriodSlot) => {
                        const entry = dayEntries.find(
                          (item) => item.period_number === periodSlot.period,
                        );

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
  const [sectionLoading, setSectionLoading] = useState(true);
  const [error, setError] = useState("");
  const [isRoutineClass, setIsRoutineClass] = useState(false);
  const [selectedClassSectionName, setSelectedClassSectionName] = useState("Creche");
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
    let cancelled = false;
    async function loadSectionNames() {
      setSectionLoading(true);
      const sectionIds = Array.from(
        new Set(availableClasses.map((item) => item.academic_section_id).filter(Boolean)),
      ) as string[];
      if (!schoolId || sectionIds.length === 0) {
        setIsRoutineClass(false);
        setSelectedClassSectionName("");
        setSectionLoading(false);
        return;
      }
      const { data, error: sectionError } = await supabase
        .from("academic_sections")
        .select("id, name")
        .eq("school_id", schoolId)
        .in("id", sectionIds);
      if (cancelled) return;
      if (sectionError) {
        setError(getErrorMessage(sectionError));
        setSectionLoading(false);
        return;
      }
      const names = Object.fromEntries((data ?? []).map((section: any) => [section.id, section.name]));
      const selected = availableClasses.find((item) => item.id === selectedClassId);
      const sectionName = selected?.academic_section_id ? names[selected.academic_section_id] : "";
      setSelectedClassSectionName(String(sectionName ?? ""));
      setIsRoutineClass(isRoutineSectionName(sectionName));
      setSectionLoading(false);
    }
    void loadSectionNames();
    return () => { cancelled = true; };
  }, [schoolId, availableClasses, selectedClassId]);

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
              ? isRoutineClass
                ? `View the schedule for your assigned ${sectionTabLabel(selectedClassSectionName)} class, including its daily routine.`
                : "View your assigned class timetable."
              : `View the school's timetable as ${role}.`}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {academicYears.length > 1 && (
            <SelectField
              label="Academic Year"
              value={selectedAcademicYearId}
              onChange={setSelectedAcademicYearId}
              options={academicYears.map((year) => ({
                value: year.id,
                label: year.name,
              }))}
            />
          )}
          {availableClasses.length > 1 ? (
            <SelectField
              label="Assigned class"
              value={selectedClassId}
              onChange={setSelectedClassId}
              options={availableClasses.map((schoolClass) => ({
                value: schoolClass.id,
                label: schoolClass.name,
              }))}
            />
          ) : (
            <div className="min-w-[180px] rounded-lg border border-slate-200 bg-white px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Assigned class</p>
              <p className="mt-0.5 text-sm font-semibold text-slate-800">
                {availableClasses[0]?.name ?? "No assigned class"}
              </p>
            </div>
          )}
        </div>
      </div>
      {error && (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {isRoutineClass && (
        <section className="mt-5 rounded-xl border border-indigo-100 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{sectionTabLabel(selectedClassSectionName)} daily routine</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">Care periods for {availableClasses.find((item) => item.id === selectedClassId)?.name ?? "your class"}</h2>
              <p className="mt-1 text-sm text-slate-500">Configured routine times for this assigned class. The school can update these periods in Timetable Setup.</p>
            </div>
            <span className="mt-2 inline-flex w-fit rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">Assigned class only</span>
          </div>
          <CrecheRoutinePanel
            schoolId={schoolId}
            academicYearId={selectedAcademicYearId}
            classId={selectedClassId}
            sectionName={selectedClassSectionName}
            canEdit={false}
            compact
          />
        </section>
      )}
      {loading || sectionLoading ? (
        <div className="mt-6 flex min-h-[260px] items-center justify-center rounded-xl border border-slate-200 bg-white">
          <p className="text-sm text-slate-500">Loading timetable...</p>
        </div>
      ) : !isRoutineClass ? (
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="grid min-w-[1100px] grid-cols-5 divide-x divide-slate-200">
            {DAYS.slice(0, 5).map((day) => (
              <div key={day} className="min-h-[520px]">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-semibold text-slate-800">{day}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {grouped[day]?.length ?? 0} {isRoutineClass ? "scheduled items" : "lessons"}
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
                            {subject?.name ?? (isRoutineClass ? "Scheduled activity" : "Subject")}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {getFullName(teacher ?? {})}
                          </p>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-12 text-center text-xs text-slate-400">
                      {isRoutineClass
                        ? "No timetable entries for this day yet. Use the daily routine above as a guide."
                        : "No lessons scheduled for this day."}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {!isRoutineClass && <PrintableTimetable
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
      />}
    </div>
  );
}

function CrecheRoutineAdminSettings({
  schoolId,
  academicYearId,
  classes,
  sectionName,
}: {
  schoolId: string;
  academicYearId: string;
  classes: SchoolClass[];
  sectionName: string;
}) {
  const [selectedClassId, setSelectedClassId] = useState("");

  useEffect(() => {
    setSelectedClassId((current) =>
      classes.some((item) => item.id === current) ? current : classes[0]?.id ?? "",
    );
  }, [classes]);

  const activeClass = classes.find((item) => item.id === selectedClassId) ?? classes[0] ?? null;

  return (
    <section className="mt-6 rounded-xl border border-indigo-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{sectionTabLabel(sectionName)} routine settings</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900">Configure daily routine periods</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">Set the school's actual start and end times for this section. The saved routine is shown to teachers assigned to the selected class.</p>
        </div>
        {classes.length > 1 ? (
          <label className="flex min-w-[200px] flex-col gap-1 text-xs font-medium text-slate-600">
            {sectionTabLabel(sectionName)} class
            <select
              value={activeClass?.id ?? ""}
              onChange={(event) => setSelectedClassId(event.target.value)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            >
              {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        ) : (
          <div className="min-w-[180px] rounded-lg border border-slate-200 bg-white px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Assigned section</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800">{activeClass?.name ?? "No class assigned"}</p>
          </div>
        )}
      </div>
      {activeClass ? (
        <CrecheRoutinePanel
          schoolId={schoolId}
          academicYearId={academicYearId}
          classId={activeClass.id}
          sectionName={sectionName}
          canEdit
        />
      ) : (
        <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
          <School size={26} className="mx-auto text-slate-400" />
          <p className="mt-3 text-sm font-semibold text-slate-800">No {sectionTabLabel(sectionName)} classes yet</p>
          <p className="mt-1 text-sm text-slate-500">Create a class and assign it to the {sectionTabLabel(sectionName)} section. It will appear here automatically.</p>
        </div>
      )}
    </section>
  );
}

function CrecheRoutinePanel({
  schoolId,
  academicYearId,
  classId,
  sectionName = "Creche",
  canEdit,
  compact = false,
}: {
  schoolId: string;
  academicYearId: string;
  classId: string;
  sectionName?: string;
  canEdit: boolean;
  compact?: boolean;
}) {
  const routines = canonicalSectionKey(sectionName) === "nursery" ? NURSERY_ROUTINES : CRECHE_ROUTINES;
  const [records, setRecords] = useState<Record<string, CrecheRoutineRecord>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadRoutine() {
      setError("");
      setSuccess("");
      if (!schoolId || !academicYearId || !classId) {
        setRecords({});
        return;
      }
      setLoading(true);
      const { data, error: queryError } = await supabase
        .from("creche_routine_periods")
        .select("routine_key, start_time, end_time")
        .eq("school_id", schoolId)
        .eq("academic_year_id", academicYearId)
        .eq("class_id", classId)
        .eq("is_active", true);
      if (cancelled) return;
      setLoading(false);
      if (queryError) {
        setError(getErrorMessage(queryError));
        setRecords({});
        return;
      }
      const next: Record<string, CrecheRoutineRecord> = {};
      for (const item of data ?? []) {
        next[item.routine_key] = {
          routine_key: item.routine_key,
          start_time: normalizeTimeInput(item.start_time),
          end_time: normalizeTimeInput(item.end_time),
        };
      }
      setRecords(next);
    }
    void loadRoutine();
    return () => { cancelled = true; };
  }, [schoolId, academicYearId, classId]);

  function updateTime(key: string, field: "start_time" | "end_time", value: string) {
    setRecords((current) => ({
      ...current,
      [key]: {
        routine_key: key,
        start_time: current[key]?.start_time ?? "",
        end_time: current[key]?.end_time ?? "",
        [field]: value,
      },
    }));
  }

  async function saveRoutine() {
    if (!schoolId || !academicYearId || !classId) return;
    setError("");
    setSuccess("");
    for (const routine of routines) {
      const row = records[routine.key];
      const start = row?.start_time ?? "";
      const end = row?.end_time ?? "";
      if (Boolean(start) !== Boolean(end)) {
        setError(`Enter both start and end times for “${routine.title}”, or leave both blank.`);
        return;
      }
      if (start && end && end <= start) {
        setError(`The end time for “${routine.title}” must be later than its start time.`);
        return;
      }
    }
    setSaving(true);
    const payload = routines.map((routine, index) => {
      const row = records[routine.key];
      return {
        school_id: schoolId,
        academic_year_id: academicYearId,
        class_id: classId,
        routine_key: routine.key,
        start_time: row?.start_time || null,
        end_time: row?.end_time || null,
        display_order: index + 1,
        is_active: true,
      };
    });
    const { error: saveError } = await supabase
      .from("creche_routine_periods")
      .upsert(payload, { onConflict: "school_id,academic_year_id,class_id,routine_key" });
    setSaving(false);
    if (saveError) {
      setError(getErrorMessage(saveError));
      return;
    }
    setSuccess(`${sectionTabLabel(sectionName)} routine times saved.`);
  }

  return (
    <div className={compact ? "mt-4" : "mt-5"}>
      {loading && <p className="mb-3 text-xs text-slate-500">Loading saved routine times...</p>}
      {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {routines.map((routine) => {
          const record = records[routine.key];
          const start = record?.start_time ?? "";
          const end = record?.end_time ?? "";
          const configured = Boolean(start && end);
          return (
            <div key={routine.key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-800">{routine.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{routine.detail}</p>
              {canEdit ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="text-[11px] font-medium text-slate-600">
                    Starts
                    <input type="time" value={start} onChange={(event) => updateTime(routine.key, "start_time", event.target.value)} className="mt-1 h-9 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-800" />
                  </label>
                  <label className="text-[11px] font-medium text-slate-600">
                    Ends
                    <input type="time" value={end} onChange={(event) => updateTime(routine.key, "end_time", event.target.value)} className="mt-1 h-9 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-800" />
                  </label>
                </div>
              ) : (
                <p className="mt-2 text-xs font-medium text-indigo-600">
                  {configured ? `${formatTime(start)} – ${formatTime(end)}` : "Time not configured"}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {canEdit && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">Leave both time fields blank when a period does not need a fixed time.</p>
          <button type="button" onClick={() => void saveRoutine()} disabled={saving || loading || !classId || !academicYearId} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            <Save size={15} />{saving ? "Saving routine..." : "Save routine times"}
          </button>
        </div>
      )}
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
