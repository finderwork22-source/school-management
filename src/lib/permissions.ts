export type UserRole =
  | "Owner"
  | "CEO"
  | "Principal"
  | "Head of Academics"
  | "Secretary"
  | "Teacher";

export const ROLE_ACCESS: Record<UserRole, string[]> = {
  Owner: ["*"],
  CEO: ["*"],
  Principal: ["*"],
  "Head of Academics": [
    "/students",
    "/students/:id",
    "/teachers",
    "/teachers/:id",
    "/academics",
    "/timetable",
    "/attendance",
    "/attendance/history",
    "/attendance/reports",
    "/assessments",
    "/student-results",
  ],
  Secretary: [
    "/",
    "/admissions",
    "/students",
    "/students/:id",
    "/parents",
    "/pickup-desk",
    "/pickup-history",
    "/finance/payments",
  ],
  Teacher: [
    "/",
    "/students",
    "/students/:id",
    "/teachers",
    "/academics",
    "/timetable",
    "/attendance",
    "/attendance/history",
    "/attendance/reports",
    "/assessments",
    "/student-results",
  ],
};

export function normalizeRole(value?: string | null): UserRole {
  const normalized = (value ?? "").trim().toLowerCase();

  switch (normalized) {
    case "owner":
      return "Owner";
    case "ceo":
      return "CEO";
    case "principal":
      return "Principal";
    case "head of academics":
    case "head_of_academics":
    case "head_of_academic":
      return "Head of Academics";
    case "secretary":
      return "Secretary";
    case "teacher":
      return "Teacher";
    default:
      return "Teacher";
  }
}

function matchesPath(pattern: string, path: string) {
  if (pattern === "*") return true;
  if (pattern === path) return true;

  if (pattern.endsWith("/:id")) {
    return path.startsWith(pattern.slice(0, -3) + "/");
  }

  return false;
}

export function canAccessPath(roleValue: string | null | undefined, path: string) {
  const role = normalizeRole(roleValue);
  return ROLE_ACCESS[role].some((pattern) => matchesPath(pattern, path));
}

export function hasAnyAccess(
  roleValue: string | null | undefined,
  paths: string[],
) {
  return paths.some((path) => canAccessPath(roleValue, path));
}
