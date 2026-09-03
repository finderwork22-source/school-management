import { supabase } from "./supabase";

export interface ParentChild {
  id: string;
  name: string;
  studentId: string;
  className: string;
}

export interface Parent {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  childrenCount: number;
  children: ParentChild[];
}

export interface CreateParentChild {
  studentId: string;
  relationship: string;
  isPrimary: boolean;
}

export interface CreateParentInput {
  schoolId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
  children: CreateParentChild[];
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
      address,

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
              name,
              is_active
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
        address: parent.address ?? null,
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

export async function getStudentsForParent(
  schoolId: string,
): Promise<{
  data: {
    id: string;
    name: string;
    studentId: string;
    className: string;
  }[];
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from("students")
    .select(`
      id,
      student_id,
      first_name,
      last_name,

      enrollments (
        classes (
          id,
          name,
          is_active
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

  const students = (data ?? [])
    .map((student) => {
      const enrollment = Array.isArray(
        student.enrollments,
      )
        ? student.enrollments[0]
        : student.enrollments;

      const classData = Array.isArray(
        enrollment?.classes,
      )
        ? enrollment.classes[0]
        : enrollment?.classes;

      return {
        id: student.id,
        name: `${student.first_name} ${student.last_name}`,
        studentId: student.student_id,
        className: classData?.name ?? "Unassigned",
        classIsActive: classData?.is_active ?? false,
      };
    })
    // A parent should only be able to link a student who belongs
    // to an active class. Students without an active class are excluded.
    .filter((student) => student.classIsActive)
    .map(
      ({
        classIsActive: _classIsActive,
        ...student
      }) => student,
    );

  return {
    data: students,
    error: null,
  };
}

export async function createParent(
  input: CreateParentInput,
): Promise<{
  data: Parent | null;
  error: Error | null;
}> {
  const {
    data: parent,
    error: parentError,
  } = await supabase
    .from("parents")
    .insert({
      school_id: input.schoolId,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      phone: input.phone.trim() || null,
      email: input.email.trim() || null,
      address: input.address.trim() || null,
    })
    .select("id")
    .single();

  if (parentError) {
    return {
      data: null,
      error: parentError,
    };
  }

  if (input.children.length > 0) {
    const relationships = input.children.map(
      (child) => ({
        school_id: input.schoolId,
        student_id: child.studentId,
        parent_id: parent.id,
        relationship:
          child.relationship || "Parent / Guardian",
        is_primary: child.isPrimary,
      }),
    );

    const {
      error: relationshipError,
    } = await supabase
      .from("student_parents")
      .insert(relationships);

    if (relationshipError) {
      await supabase
        .from("parents")
        .delete()
        .eq("id", parent.id);

      return {
        data: null,
        error: relationshipError,
      };
    }
  }

  const { data: createdParent, error: fetchError } =
    await getParents(input.schoolId);

  if (fetchError) {
    return {
      data: null,
      error: fetchError,
    };
  }

  return {
    data:
      createdParent.find(
        (item) => item.id === parent.id,
      ) ?? null,
    error: null,
  };
}