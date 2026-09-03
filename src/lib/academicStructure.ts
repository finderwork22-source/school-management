import { supabase } from "./supabase";

export interface AcademicSection {
  id: string;
  school_id: string;
  academic_year_id: string;
  name: string;
  display_order: number;
  is_active: boolean;
}

export interface AcademicClass {
  id: string;
  name: string;
  grade: string | null;
  capacity: number | null;
  is_active: boolean;
  academic_section_id: string | null;
}

export interface ClassStream {
  id: string;
  class_id: string;
  name: string;
  capacity: number | null;
  is_active: boolean;
}

export async function getAcademicSections(
  schoolId: string,
  academicYearId: string,
) {
  const { data, error } = await supabase
    .from("academic_sections")
    .select(
      "id, school_id, academic_year_id, name, display_order, is_active",
    )
    .eq("school_id", schoolId)
    .eq("academic_year_id", academicYearId)
    .order("display_order", { ascending: true });

  return {
    data: (data ?? []) as AcademicSection[],
    error,
  };
}

export async function createAcademicSection(
  schoolId: string,
  academicYearId: string,
  name: string,
  displayOrder: number,
) {
  return supabase
    .from("academic_sections")
    .insert({
      school_id: schoolId,
      academic_year_id: academicYearId,
      name: name.trim(),
      display_order: displayOrder,
      is_active: true,
    })
    .select()
    .single();
}

export async function getClassesForAcademicYear(
  schoolId: string,
  academicYearId: string,
) {
  const { data, error } = await supabase
    .from("classes")
    .select(
      "id, name, grade, capacity, is_active, academic_section_id",
    )
    .eq("school_id", schoolId)
    .eq("academic_year_id", academicYearId)
    .order("name", { ascending: true });

  return {
    data: (data ?? []) as AcademicClass[],
    error,
  };
}

export async function createAcademicClass(
  schoolId: string,
  academicYearId: string,
  academicSectionId: string,
  name: string,
  capacity: number | null,
) {
  return supabase
    .from("classes")
    .insert({
      school_id: schoolId,
      academic_year_id: academicYearId,
      academic_section_id: academicSectionId,
      name: name.trim(),
      grade: name.trim(),
      section: null,
      capacity,
      is_active: true,
    })
    .select()
    .single();
}

export async function getStreamsForClass(
  classId: string,
) {
  const { data, error } = await supabase
    .from("class_streams")
    .select(
      "id, class_id, name, capacity, is_active",
    )
    .eq("class_id", classId)
    .order("name", { ascending: true });

  return {
    data: (data ?? []) as ClassStream[],
    error,
  };
}

export async function createClassStream(
  schoolId: string,
  classId: string,
  name: string,
  capacity: number | null,
) {
  return supabase
    .from("class_streams")
    .insert({
      school_id: schoolId,
      class_id: classId,
      name: name.trim(),
      capacity,
      is_active: true,
    })
    .select()
    .single();
}