import { supabase } from "./supabase";

export interface AdminPasswordResetResult {
  success: boolean;
  targetUserId: string;
  temporaryPassword: string;
  message: string;
}

export async function resetTeacherPassword(
  schoolId: string,
  targetTeacherId: string,
): Promise<{ data: AdminPasswordResetResult | null; error: Error | null }> {
  const { data, error } = await supabase.functions.invoke(
    "reset-school-user-password",
    {
      body: {
        schoolId,
        targetTeacherId,
      },
    },
  );

  if (error) {
    return { data: null, error };
  }

  if (!data?.success || !data?.temporaryPassword) {
    return {
      data: null,
      error: new Error(data?.error ?? "Password reset failed."),
    };
  }

  return {
    data: data as AdminPasswordResetResult,
    error: null,
  };
}
