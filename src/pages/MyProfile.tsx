import { useEffect, useMemo, useState } from "react";
import {
  Mail,
  Phone,
  UserRound,
  CalendarDays,
  BriefcaseBusiness,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useSchool } from "../context/SchoolContext";
import { normalizeRole } from "../lib/permissions";

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
  academicYearName: string;
  className: string;
  subjectName: string;
}

function fullName(teacher: Teacher) {
  return [teacher.first_name, teacher.middle_name, teacher.last_name]
    .filter(Boolean)
    .join(" ");
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function MyProfile() {
  const { user } = useAuth();
  const { school, membership } = useSchool();
  const role = normalizeRole(membership?.role);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const firstName = user?.user_metadata?.first_name ?? "";
  const lastName = user?.user_metadata?.last_name ?? "";
  const accountName =
    `${firstName} ${lastName}`.trim() || user?.email || "My Profile";
  const initials =
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() ||
    (user?.email?.charAt(0).toUpperCase() ?? "U");

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!school?.id || !user?.email) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      const { data: teacherData, error: teacherError } = await supabase
        .from("teachers")
        .select(
          "id, teacher_id, first_name, middle_name, last_name, date_of_birth, gender, nationality, phone, email, photo_url, status, joined_date",
        )
        .eq("school_id", school.id)
        .ilike("email", user.email)
        .maybeSingle();

      if (cancelled) return;

      if (teacherError) {
        setError(teacherError.message);
        setTeacher(null);
        setAssignments([]);
        setLoading(false);
        return;
      }

      if (!teacherData) {
        setTeacher(null);
        setAssignments([]);
        setLoading(false);
        return;
      }

      const teacherRecord = teacherData as Teacher;
      setTeacher(teacherRecord);

      if (role === "Teacher") {
        const { data: assignmentData, error: assignmentError } = await supabase
          .from("teacher_assignments")
          .select(
            `
              id,
              academic_years ( name ),
              classes ( name ),
              subjects ( name )
            `,
          )
          .eq("school_id", school.id)
          .eq("teacher_id", teacherRecord.id);

        if (cancelled) return;

        if (assignmentError) {
          setError(assignmentError.message);
          setAssignments([]);
        } else {
          setAssignments(
            (assignmentData ?? []).map((item: any) => {
              const year = Array.isArray(item.academic_years)
                ? item.academic_years[0]
                : item.academic_years;
              const schoolClass = Array.isArray(item.classes)
                ? item.classes[0]
                : item.classes;
              const subject = Array.isArray(item.subjects)
                ? item.subjects[0]
                : item.subjects;

              return {
                id: item.id,
                academicYearName: year?.name ?? "—",
                className: schoolClass?.name ?? "—",
                subjectName: subject?.name ?? "—",
              };
            }),
          );
        }
      }

      setLoading(false);
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [school?.id, user?.email, role]);

  const groupedAssignments = useMemo(() => {
    const groups = new Map<
      string,
      {
        academicYearName: string;
        className: string;
        subjects: string[];
      }
    >();

    assignments.forEach((assignment) => {
      const key = `${assignment.academicYearName}-${assignment.className}`;
      const existing = groups.get(key);

      if (existing) {
        if (!existing.subjects.includes(assignment.subjectName)) {
          existing.subjects.push(assignment.subjectName);
        }
      } else {
        groups.set(key, {
          academicYearName: assignment.academicYearName,
          className: assignment.className,
          subjects: [assignment.subjectName],
        });
      }
    });

    return Array.from(groups.values());
  }, [assignments]);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1100px]">
        <p className="text-sm text-slate-500">Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1100px]">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">My Profile</h1>
        <p className="mt-1 text-sm text-slate-500">
          View your SchoolOS account and personal information.
        </p>
      </div>

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-5 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:p-6">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-indigo-50 text-xl font-semibold text-indigo-700">
            {teacher?.photo_url ? (
              <img
                src={teacher.photo_url}
                alt={fullName(teacher)}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>
                {teacher
                  ? fullName(teacher).slice(0, 2).toUpperCase()
                  : initials}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="break-words text-xl font-semibold text-slate-900 sm:text-2xl">
                {teacher ? fullName(teacher) : accountName}
              </h2>
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
                {membership?.role ?? "User"}
              </span>
            </div>
            <p className="mt-1 break-all text-sm text-slate-500">
              {user?.email ?? "—"}
            </p>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-slate-800">
            Personal Information
          </h3>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <InfoItem
              icon={<UserRound size={16} />}
              label="First name"
              value={(teacher?.first_name ?? firstName) || "—"}
            />

            <InfoItem
              icon={<UserRound size={16} />}
              label="Last name"
              value={(teacher?.last_name ?? lastName) || "—"}
            />
            <InfoItem
              icon={<Mail size={16} />}
              label="Email"
              value={teacher?.email ?? user?.email ?? "—"}
            />
            <InfoItem
              icon={<Phone size={16} />}
              label="Phone"
              value={teacher?.phone ?? "—"}
            />
            <InfoItem
              icon={<CalendarDays size={16} />}
              label="Date of birth"
              value={formatDate(teacher?.date_of_birth ?? null)}
            />
            <InfoItem
              icon={<UserRound size={16} />}
              label="Gender"
              value={teacher?.gender ?? "—"}
            />
            <InfoItem
              icon={<UserRound size={16} />}
              label="Nationality"
              value={teacher?.nationality ?? "—"}
            />
            <InfoItem
              icon={<BriefcaseBusiness size={16} />}
              label="Teacher ID"
              value={teacher?.teacher_id ?? "—"}
            />
            <InfoItem
              icon={<CalendarDays size={16} />}
              label="Joined date"
              value={formatDate(teacher?.joined_date ?? null)}
            />
          </div>
        </div>
      </div>

      {role === "Teacher" && (
        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              My Teaching Assignments
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Classes and subjects currently assigned to you.
            </p>
          </div>

          {groupedAssignments.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
              No teaching assignments have been linked to your profile yet.
            </div>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {groupedAssignments.map((assignment) => (
                <div
                  key={`${assignment.academicYearName}-${assignment.className}`}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <p className="text-xs font-medium text-slate-500">
                    {assignment.academicYearName}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {assignment.className}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {assignment.subjects.map((subject) => (
                      <span
                        key={subject}
                        className="rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600"
                      >
                        {subject}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <span className="text-slate-400">{icon}</span>
        {label}
      </div>
      <p className="mt-1.5 break-words text-sm font-medium text-slate-800">
        {value}
      </p>
    </div>
  );
}
