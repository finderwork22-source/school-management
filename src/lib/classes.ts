import { supabase } from "./supabase";

export interface SchoolClass {
  id: string;
  name: string;
  grade: string | null;
  section: string | null;
}

export async function getClasses(
  schoolId: string,
  academicYearId?: string,
): Promise<{
  data: SchoolClass[];
  error: Error | null;
}> {
  let query = supabase
    .from("classes")
    .select("id, name, grade, section")
    .eq("school_id", schoolId)
    .order("grade", { ascending: true })
    .order("name", { ascending: true });

  if (academicYearId) {
    query = query.eq(
      "academic_year_id",
      academicYearId,
    );
  }

  const { data, error } = await query;

  if (error) {
    return {
      data: [],
      error,
    };
  }

  return {
    data: data ?? [],
    error: null,
  };
}