import { supabase } from "./supabase";

export interface Student {
  id: string;
  name: string;
  studentId: string;
  sectionName: string;
  className: string;
  streamName: string | null;
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

function calculateAge(dateOfBirth: string | null) {
  if (!dateOfBirth) return null;

  const birthDate = new Date(dateOfBirth);
  const today = new Date();

  let age =
    today.getFullYear() - birthDate.getFullYear();

  const monthDifference =
    today.getMonth() - birthDate.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 &&
      today.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

export async function getStudents(
  schoolId: string,
): Promise<{
  data: Student[];
  error: Error | null;
}> {
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
        stream_id,
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
        ),

        class_streams:stream_id (
          id,
          name
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
    .order("last_name", {
      ascending: true,
    });

  if (error) {
    return {
      data: [],
      error,
    };
  }

  const students: Student[] = (data ?? []).map(
    (student) => {
      const enrollments = Array.isArray(
        student.enrollments,
      )
        ? student.enrollments
        : student.enrollments
          ? [student.enrollments]
          : [];

      const enrollment =
        enrollments.find(
          (item) => item.status === "Active",
        ) ??
        enrollments[0];

      const classData = Array.isArray(
        enrollment?.classes,
      )
        ? enrollment.classes[0]
        : enrollment?.classes;

      const academicSection = Array.isArray(
        classData?.academic_sections,
      )
        ? classData.academic_sections[0]
        : classData?.academic_sections;

      const streamData = Array.isArray(
        enrollment?.class_streams,
      )
        ? enrollment.class_streams[0]
        : enrollment?.class_streams;

      const parentRelationship = Array.isArray(
        student.student_parents,
      )
        ? student.student_parents.find(
            (parent) => parent.is_primary,
          ) ??
          student.student_parents[0]
        : student.student_parents;

      const parent = Array.isArray(
        parentRelationship?.parents,
      )
        ? parentRelationship.parents[0]
        : parentRelationship?.parents;

      return {
        id: student.id,
        name: `${student.first_name} ${student.last_name}`,
        studentId: student.student_id,
        sectionName:
          academicSection?.name ??
          "Unassigned",
        className:
          classData?.name ??
          "Unassigned",
        streamName:
          streamData?.name ?? null,
        academicYearId:
          enrollment?.academic_year_id ??
          classData?.academic_year_id ??
          null,
        dateOfBirth:
          student.date_of_birth ?? null,
        age: calculateAge(
          student.date_of_birth ?? null,
        ),
        gender:
          student.gender ?? "Male",
        nationality:
          student.nationality ?? "",
        photoUrl:
          student.photo_url ?? null,
        parent: parent
          ? `${parent.first_name} ${parent.last_name}`
          : "No parent assigned",
        parentPhone:
          parent?.phone ?? "—",
        status: student.status,
        enrolledDate:
          enrollment?.enrolled_at ??
          student.enrolled_date,
      };
    },
  );

  return {
    data: students,
    error: null,
  };
}