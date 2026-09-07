import { supabase } from "./supabase";

export interface Student {
  id: string;
  name: string;
  studentId: string;
  sectionName: string;
  className: string;
  academicYearId: string | null;
  dateOfBirth: string | null;
  age: number | null;
  gender: "Male" | "Female";
  nationality: string;
  photoUrl: string | null;
  parent: string;
  parentPhone: string;
  status: "Active" | "Inactive";
  enrolledDate: string;
}

function calculateAge(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;

  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();

  const monthDifference = today.getMonth() - birthDate.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

type StudentRow = {
  id: string;
  student_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  date_of_birth: string | null;
  gender: "Male" | "Female";
  nationality: string | null;
  photo_url: string | null;
  status: "Active" | "Inactive";
  enrolled_date: string;
  enrollments:
    | Array<{
        academic_year_id: string | null;
        class_id: string;
        enrolled_at: string | null;
        status: string;
        classes:
          | {
              id: string;
              name: string;
              academic_year_id: string | null;
              academic_section_id: string | null;
              academic_sections:
                | { id: string; name: string }
                | { id: string; name: string }[]
                | null;
            }
          | {
              id: string;
              name: string;
              academic_year_id: string | null;
              academic_section_id: string | null;
              academic_sections:
                | { id: string; name: string }
                | { id: string; name: string }[]
                | null;
            }[]
          | null;
      }>
    | null;
  student_parents:
    | Array<{
        relationship: string | null;
        is_primary: boolean;
        parents:
          | {
              first_name: string;
              last_name: string;
              phone: string | null;
            }
          | {
              first_name: string;
              last_name: string;
              phone: string | null;
            }[]
          | null;
      }>
    | null;
};

export async function getStudents(
  schoolId: string,
): Promise<{ data: Student[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("students")
    .select(`
      id,
      student_id,
      first_name,
      middle_name,
      last_name,
      date_of_birth,
      gender,
      nationality,
      photo_url,
      status,
      enrolled_date,
      enrollments (
        academic_year_id,
        class_id,
        enrolled_at,
        status,
        classes (
          id,
          name,
          academic_year_id,
          academic_section_id,
          academic_sections (
            id,
            name
          )
        )
      ),
      student_parents (
        relationship,
        is_primary,
        parents (
          first_name,
          last_name,
          phone
        )
      )
    `)
    .eq("school_id", schoolId)
    .order("last_name", { ascending: true });

  if (error) {
    return { data: [], error };
  }

  const rows = (data ?? []) as unknown as StudentRow[];

  const students: Student[] = rows.map((student) => {
    const enrollments = Array.isArray(student.enrollments)
      ? student.enrollments
      : [];

    const enrollment =
      enrollments.find((item) => item.status === "Active") ??
      enrollments[0];

    const classDataRaw = enrollment?.classes ?? null;
    const classData = Array.isArray(classDataRaw)
      ? classDataRaw[0] ?? null
      : classDataRaw;

    const sectionRaw = classData?.academic_sections ?? null;
    const academicSection = Array.isArray(sectionRaw)
      ? sectionRaw[0] ?? null
      : sectionRaw;

    const parents = Array.isArray(student.student_parents)
      ? student.student_parents
      : [];

    const parentRelationship =
      parents.find((parent) => parent.is_primary) ?? parents[0];

    const parentRaw = parentRelationship?.parents ?? null;
    const parent = Array.isArray(parentRaw)
      ? parentRaw[0] ?? null
      : parentRaw;

    return {
      id: student.id,
      name: [student.first_name, student.middle_name, student.last_name]
        .filter(Boolean)
        .join(" "),
      studentId: student.student_id,
      sectionName: academicSection?.name ?? "Unassigned",
      className: classData?.name ?? "Unassigned",
      academicYearId:
        enrollment?.academic_year_id ??
        classData?.academic_year_id ??
        null,
      dateOfBirth: student.date_of_birth ?? null,
      age: calculateAge(student.date_of_birth ?? null),
      gender: student.gender ?? "Male",
      nationality: student.nationality ?? "",
      photoUrl: student.photo_url ?? null,
      parent: parent
        ? `${parent.first_name} ${parent.last_name}`
        : "No parent assigned",
      parentPhone: parent?.phone ?? "—",
      status: student.status,
      enrolledDate:
        enrollment?.enrolled_at ?? student.enrolled_date,
    };
  });

  return { data: students, error: null };
}
