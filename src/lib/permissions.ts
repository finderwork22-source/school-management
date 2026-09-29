export type UserRole =
  | "Owner"
  | "Principal"
  | "Head of Academics"
  | "Secretary"
  | "Teacher"
  | "Parent";

export const ROLE_ACCESS: Record<UserRole, string[]> = {
  Owner: ["*"],
  Principal: ["*"],

  "Head of Academics": [
    "/",
    "/profile",
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
    "/announcements",
    "/settings/academic",
    "/settings/users",
  ],

  Secretary: [
    "/",
    "/profile",
    "/admissions",
    "/students",
    "/students/:id",
    "/parents",
    "/pickup-desk",
    "/pickup-history",
    "/finance",
    "/finance/billing",
    "/finance/payments",
    "/finance/receipts",
    "/finance/reports",
    "/announcements",
  ],

  Teacher: [
    "/",
    "/profile",
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
    "/announcements",
  ],

  Parent: [
    "/",
    "/profile",
    "/pickup-authorisations",
    "/announcements",
  ],
};

export function normalizeRole(value?: string | null): UserRole {
  const normalized = (value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("_", " ");

  switch (normalized) {
    case "owner":
      return "Owner";
    case "principal":
      return "Principal";
    case "head of academics":
    case "head of academic":
      return "Head of Academics";
    case "secretary":
      return "Secretary";
    case "teacher":
      return "Teacher";
    case "parent":
    case "parent guardian":
    case "parent/guardian":
      return "Parent";
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

export function canAccessPath(
  roleValue: string | null | undefined,
  path: string,
) {
  const role = normalizeRole(roleValue);

  return ROLE_ACCESS[role].some((pattern) =>
    matchesPath(pattern, path),
  );
}

export function hasAnyAccess(
  roleValue: string | null | undefined,
  paths: string[],
) {
  return paths.some((path) =>
    canAccessPath(roleValue, path),
  );
}
