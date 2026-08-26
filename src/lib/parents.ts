import { supabase } from "./supabase";

export interface Parent {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  childrenCount: number;
  children: {
    id: string;
    name: string;
    studentId: string;
    className: string;
  }[];
}

export async function getParents(
  schoolId: string,
): Promise<{
  data: Parent[];
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from("parents")
    .select(`
      id,
      first_name,
      last_name,
      phone,
      email,

      student_parents (
        student_id,
        students (
          id,
          student_id,
          first_name,
          last_name,

          enrollments (
            classes (
              id,
              name
            )
          )
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

  const parents: Parent[] = (data ?? []).map(
    (parent) => {
      const relationships = Array.isArray(
        parent.student_parents,
      )
        ? parent.student_parents
        : [];

      const children = relationships.map(
        (relationship) => {
          const student = Array.isArray(
            relationship.students,
          )
            ? relationship.students[0]
            : relationship.students;

          const enrollment = Array.isArray(
            student?.enrollments,
          )
            ? student.enrollments[0]
            : student?.enrollments;

          const classData = Array.isArray(
            enrollment?.classes,
          )
            ? enrollment.classes[0]
            : enrollment?.classes;

          return {
            id: student?.id ?? "",
            name: student
              ? `${student.first_name} ${student.last_name}`
              : "Unknown student",
            studentId:
              student?.student_id ?? "",
            className:
              classData?.name ??
              "Unassigned",
          };
        },
      );

      return {
        id: parent.id,

        name: `${parent.first_name} ${parent.last_name}`,

        phone: parent.phone ?? null,

        email: parent.email ?? null,

        childrenCount: children.length,

        children,
      };
    },
  );

  return {
    data: parents,
    error: null,
  };
}