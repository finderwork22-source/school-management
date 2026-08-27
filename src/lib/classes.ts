import { supabase } from "./supabase";

export interface SchoolClass {
  id: string;
  name: string;
  grade: string | null;
  section: string | null;
  capacity: number | null;
  academic_year_id: string | null;
  is_active: boolean;
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
    .select(`
      id,
      name,
      grade,
      section,
      academic_year_id,
      capacity,
      is_active
    `)
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