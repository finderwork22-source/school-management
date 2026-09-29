import { supabase } from "./supabase";

export interface PlatformAdminIdentity {
  userId: string;
  email: string | null;
  firstName: string;
  lastName: string;
}

/**
 * Platform access is resolved from the database, not Auth user metadata.
 * The is_platform_admin() function is SECURITY DEFINER and checks the
 * active platform_admins record for the current authenticated user.
 */
export async function isPlatformAdmin(): Promise<{
  isAdmin: boolean;
  error: Error | null;
}> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return { isAdmin: false, error: userError };
  }

  if (!user) {
    return { isAdmin: false, error: null };
  }

  const { data, error } = await supabase.rpc("is_platform_admin");

  if (error) {
    return {
      isAdmin: false,
      error,
    };
  }

  return {
    isAdmin: data === true,
    error: null,
  };
}

export async function getPlatformAdminIdentity(): Promise<{
  identity: PlatformAdminIdentity | null;
  error: Error | null;
}> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return { identity: null, error: userError };
  }

  if (!user) {
    return { identity: null, error: null };
  }

  const { data, error } = await supabase.rpc("is_platform_admin");

  if (error) {
    return { identity: null, error };
  }

  if (data !== true) {
    return { identity: null, error: null };
  }

  return {
    identity: {
      userId: user.id,
      email: user.email ?? null,
      firstName: String(user.user_metadata?.first_name ?? "").trim(),
      lastName: String(user.user_metadata?.last_name ?? "").trim(),
    },
    error: null,
  };
}
