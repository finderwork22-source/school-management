import { supabase } from "./supabase";

export interface Student {
  id: string;
  name: string;
  studentId: string;
  className: string;
  gender: "Male" | "Female";
  parent: string;
  parentPhone: string;
  status: "Active" | "Inactive";
  enrolledDate: string;
}

export async function getStudents(schoolId: string): Promise<{
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
      gender,
      status,
      enrolled_date,

      enrollments (
        class_id,
        classes (
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
    .order("last_name", { ascending: true });

  if (error) {
    return {
      data: [],
      error,
    };
  }

  const students: Student[] = (data ?? []).map((student) => {
    const enrollment = Array.isArray(student.enrollments)
      ? student.enrollments[0]
      : student.enrollments;

    const classData = Array.isArray(enrollment?.classes)
      ? enrollment.classes[0]
      : enrollment?.classes;

    const parentRelationship = Array.isArray(
      student.student_parents,
    )
      ? student.student_parents.find(
          (parent) => parent.is_primary,
        ) ?? student.student_parents[0]
      : student.student_parents;

    const parent = Array.isArray(parentRelationship?.parents)
      ? parentRelationship.parents[0]
      : parentRelationship?.parents;

    return {
      id: student.id,

      name: `${student.first_name} ${student.last_name}`,

      studentId: student.student_id,

      className: classData?.name ?? "Unassigned",

      gender: student.gender ?? "Male",

      parent: parent
        ? `${parent.first_name} ${parent.last_name}`
        : "No parent assigned",

      parentPhone: parent?.phone ?? "—",

      status: student.status,

      enrolledDate: student.enrolled_date,
    };
  });

  return {
    data: students,
    error: null,
  };
}