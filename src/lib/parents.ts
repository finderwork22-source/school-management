import { supabase } from "./supabase";

export interface ParentChild {
  id: string;
  name: string;
  studentId: string;
  className: string;
}

export interface Parent {
  id: string;
  user_id: string | null;
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

function normalizeParentName(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeParentEmail(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeParentPhone(value: string | null | undefined) {
  return String(value ?? "").replace(/\D/g, "");
}

function haveSameParentIdentity(
  left: Pick<Parent, "name" | "phone" | "email" | "user_id">,
  right: Pick<Parent, "name" | "phone" | "email" | "user_id">,
) {
  const leftName = normalizeParentName(left.name);
  const rightName = normalizeParentName(right.name);

  if (!leftName || leftName !== rightName) return false;

  // Don't combine two separate active logins, even if their contact details
  // are identical. If only one record is linked to Auth, it becomes canonical.
  if (left.user_id && right.user_id && left.user_id !== right.user_id) {
    return false;
  }

  const leftEmail = normalizeParentEmail(left.email);
  const rightEmail = normalizeParentEmail(right.email);
  if (leftEmail && rightEmail && leftEmail === rightEmail) return true;

  const leftPhone = normalizeParentPhone(left.phone);
  const rightPhone = normalizeParentPhone(right.phone);
  return leftPhone.length >= 6 && rightPhone.length >= 6 && leftPhone === rightPhone;
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
      user_id,
      first_name,
      last_name,
      phone,
      email,
      address,
      created_at,
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
    .order("created_at", { ascending: true })
    .order("last_name", { ascending: true });

  if (error) {
    return { data: [], error };
  }

  const mappedParents: Parent[] = (data ?? []).map((parent) => {
    const relationships = Array.isArray(parent.student_parents)
      ? parent.student_parents
      : [];

    const children = relationships
      .map((relationship) => {
        const student = Array.isArray(relationship.students)
          ? relationship.students[0]
          : relationship.students;
        const enrollments = Array.isArray(student?.enrollments)
          ? student.enrollments
          : student?.enrollments
            ? [student.enrollments]
            : [];
        const activeEnrollment = enrollments.find((item) => {
          const classData = Array.isArray(item?.classes)
            ? item.classes[0]
            : item?.classes;
          return Boolean(classData?.is_active);
        }) ?? enrollments[0];
        const classData = Array.isArray(activeEnrollment?.classes)
          ? activeEnrollment.classes[0]
          : activeEnrollment?.classes;

        if (!student?.id) return null;

        return {
          id: student.id,
          name: `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim(),
          studentId: student.student_id ?? "",
          className: classData?.name ?? "Unassigned",
        } satisfies ParentChild;
      })
      .filter((child): child is ParentChild => Boolean(child));

    return {
      id: parent.id,
      user_id: parent.user_id ?? null,
      name: `${parent.first_name ?? ""} ${parent.last_name ?? ""}`.trim(),
      phone: parent.phone ?? null,
      email: parent.email ?? null,
      address: parent.address ?? null,
      childrenCount: children.length,
      children,
    };
  });

  // Legacy data may already contain duplicate rows for one parent. Group rows
  // with the same normalized name plus matching email or phone, combine their
  // children, and prefer the row linked to the active parent login. This keeps
  // one visible parent with all children without deleting historical records.
  const deduplicated: Parent[] = [];

  for (const candidate of mappedParents) {
    const existingIndex = deduplicated.findIndex((existing) =>
      haveSameParentIdentity(existing, candidate),
    );

    if (existingIndex < 0) {
      deduplicated.push(candidate);
      continue;
    }

    const existing = deduplicated[existingIndex];
    const canonical = candidate.user_id && !existing.user_id ? candidate : existing;
    const childrenById = new Map<string, ParentChild>();
    for (const child of [...existing.children, ...candidate.children]) {
      if (child.id) childrenById.set(child.id, child);
    }
    const children = [...childrenById.values()];

    deduplicated[existingIndex] = {
      ...canonical,
      phone: canonical.phone || existing.phone || candidate.phone,
      email: canonical.email || existing.email || candidate.email,
      address: canonical.address || existing.address || candidate.address,
      children,
      childrenCount: children.length,
    };
  }

  deduplicated.sort((a, b) => a.name.localeCompare(b.name));
  return { data: deduplicated, error: null };
}

export async function updateParent(
  input: {
    schoolId: string;
    parentId: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    address: string;
  },
): Promise<{
  data: Parent | null;
  error: Error | null;
}> {
  const cleanedEmail = input.email.trim().toLowerCase();

  const { error: updateError } = await supabase
    .from("parents")
    .update({
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      phone: input.phone.trim() || null,
      email: cleanedEmail || null,
      address: input.address.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.parentId)
    .eq("school_id", input.schoolId);

  if (updateError) {
    return {
      data: null,
      error: updateError,
    };
  }

  const { data: parents, error: fetchError } = await getParents(
    input.schoolId,
  );

  if (fetchError) {
    return {
      data: null,
      error: fetchError,
    };
  }

  return {
    data: parents.find((parent) => parent.id === input.parentId) ?? null,
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
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const normalizedName = normalizeParentName(`${firstName} ${lastName}`);
  const normalizedPhone = normalizeParentPhone(input.phone);
  const normalizedEmail = normalizeParentEmail(input.email);

  // Reuse an existing parent with the same name and contact details instead
  // of creating a second record when adding siblings or linking more children.
  const { data: existingRows, error: lookupError } = await supabase
    .from("parents")
    .select("id, user_id, first_name, last_name, phone, email, address, created_at")
    .eq("school_id", input.schoolId)
    .order("created_at", { ascending: true });

  if (lookupError) {
    return { data: null, error: lookupError };
  }

  const matches = (existingRows ?? []).filter((parent) => {
    const existingName = normalizeParentName(`${parent.first_name ?? ""} ${parent.last_name ?? ""}`);
    if (!normalizedName || existingName !== normalizedName) return false;

    const emailMatches = normalizedEmail && normalizeParentEmail(parent.email) === normalizedEmail;
    const phoneMatches = normalizedPhone.length >= 6 && normalizeParentPhone(parent.phone) === normalizedPhone;
    return Boolean(emailMatches || phoneMatches);
  });

  // Keep a parent already linked to a portal account as the canonical record.
  matches.sort((a, b) => {
    if (Boolean(a.user_id) !== Boolean(b.user_id)) return a.user_id ? -1 : 1;
    return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
  });

  let parentId: string;
  let createdNewParent = false;

  if (matches.length > 0) {
    const canonical = matches[0];
    parentId = canonical.id;

    // Fill in missing contact information, but never replace already-known
    // details or unlink an existing parent account.
    const { error: updateError } = await supabase
      .from("parents")
      .update({
        phone: canonical.phone || input.phone.trim() || null,
        email: canonical.email || normalizedEmail || null,
        address: canonical.address || input.address.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parentId)
      .eq("school_id", input.schoolId);

    if (updateError) return { data: null, error: updateError };

    // Reattach all children from duplicate legacy rows to the canonical parent.
    const duplicateIds = matches.map((row) => row.id).filter((id) => id !== parentId);
    if (duplicateIds.length > 0) {
      const { data: oldLinks, error: oldLinksError } = await supabase
        .from("student_parents")
        .select("student_id, parent_id, relationship, is_primary")
        .eq("school_id", input.schoolId)
        .in("parent_id", duplicateIds);

      if (oldLinksError) return { data: null, error: oldLinksError };

      const { data: canonicalLinks, error: canonicalLinksError } = await supabase
        .from("student_parents")
        .select("student_id")
        .eq("school_id", input.schoolId)
        .eq("parent_id", parentId);

      if (canonicalLinksError) return { data: null, error: canonicalLinksError };
      const canonicalStudentIds = new Set((canonicalLinks ?? []).map((row) => row.student_id));
      const toInsert = (oldLinks ?? [])
        .filter((link) => link.student_id && !canonicalStudentIds.has(link.student_id))
        .filter((link, index, array) => array.findIndex((other) => other.student_id === link.student_id) === index)
        .map((link) => ({
          school_id: input.schoolId,
          student_id: link.student_id,
          parent_id: parentId,
          relationship: link.relationship || "Parent / Guardian",
          is_primary: Boolean(link.is_primary),
        }));

      if (toInsert.length > 0) {
        const { error: insertMergedLinksError } = await supabase
          .from("student_parents")
          .insert(toInsert);
        if (insertMergedLinksError) return { data: null, error: insertMergedLinksError };
      }
    }
  } else {
    const { data: createdParent, error: parentError } = await supabase
      .from("parents")
      .insert({
        school_id: input.schoolId,
        first_name: firstName,
        last_name: lastName,
        phone: input.phone.trim() || null,
        email: normalizedEmail || null,
        address: input.address.trim() || null,
      })
      .select("id")
      .single();

    if (parentError) return { data: null, error: parentError };
    parentId = createdParent.id;
    createdNewParent = true;
  }

  // Attach only children that aren't already linked to the selected parent.
  const { data: currentLinks, error: currentLinksError } = await supabase
    .from("student_parents")
    .select("student_id")
    .eq("school_id", input.schoolId)
    .eq("parent_id", parentId);

  if (currentLinksError) return { data: null, error: currentLinksError };
  const alreadyLinked = new Set((currentLinks ?? []).map((row) => row.student_id));
  const newRelationships = input.children
    .filter((child) => !alreadyLinked.has(child.studentId))
    .map((child) => ({
      school_id: input.schoolId,
      student_id: child.studentId,
      parent_id: parentId,
      relationship: child.relationship || "Parent / Guardian",
      is_primary: child.isPrimary,
    }));

  if (newRelationships.length > 0) {
    const { error: relationshipError } = await supabase
      .from("student_parents")
      .insert(newRelationships);

    if (relationshipError) {
      if (createdNewParent) {
        await supabase.from("parents").delete().eq("id", parentId).eq("school_id", input.schoolId);
      }
      return { data: null, error: relationshipError };
    }
  }

  const { data: allParents, error: fetchError } = await getParents(input.schoolId);
  if (fetchError) return { data: null, error: fetchError };

  return {
    data: allParents.find((parent) => parent.id === parentId) ?? null,
    error: null,
  };
}
