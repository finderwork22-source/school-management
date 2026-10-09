import { supabase } from "./supabase";

export interface SchoolMembershipResult {
  id: string;
  school_id: string;
  role: string;
  school: {
    id: string;
    name: string;
    slug: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
    logo_url: string | null;
  };
}

interface ParentMembershipRpc {
  id: string;
  school_id: string;
  role: string;
  school: SchoolMembershipResult["school"];
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
}

export async function signUp({
  email,
  password,
  firstName,
  lastName,
}: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}) {
  return supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      },

      // Normal school account signup should continue through the
      // regular email-confirmation flow. Invitations use a separate
      // /accept-invitation flow.
      emailRedirectTo: `${window.location.origin}/email-confirmed.html`,
    },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

/**
 * Resolve the authenticated WISE school role.
 *
 * Parents are linked through parents.user_id and are resolved through the
 * SECURITY DEFINER get_my_parent_membership() RPC.
 *
 * Staff users are resolved through school_members.user_id.
 *
 * This helper is intentionally the single source of truth used by the
 * login flow and SchoolContext, so parents and staff receive the same
 * role-aware school context after authentication.
 */
export async function getMySchoolMembership(): Promise<{
  membership: SchoolMembershipResult | null;
  error: Error | null;
}> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    return {
      membership: null,
      error: userError,
    };
  }

  if (!user) {
    return {
      membership: null,
      error: null,
    };
  }

  const metadataRole = String(user.user_metadata?.role ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("_", " ");

  // -----------------------------------------------------------------------
  // 1. Resolve Parent through the secure database function.
  // -----------------------------------------------------------------------
  const {
    data: parentData,
    error: parentRpcError,
  } = await supabase.rpc("get_my_parent_membership");

  if (parentRpcError) {
    console.error(
      "Parent membership RPC failed:",
      parentRpcError,
    );

    // Only block the account when it explicitly identifies itself as a
    // Parent. Staff accounts are allowed to continue to the staff lookup.
    if (metadataRole === "parent") {
      return {
        membership: null,
        error: new Error(
          "Your parent account could not be verified. Please contact the school administrator.",
        ),
      };
    }
  } else if (parentData) {
    const parent = parentData as unknown as ParentMembershipRpc;

    if (
      parent.id &&
      parent.school_id &&
      parent.school
    ) {
      return {
        membership: {
          id: parent.id,
          school_id: parent.school_id,
          role: "Parent",
          school: parent.school,
        },
        error: null,
      };
    }

    if (metadataRole === "parent") {
      return {
        membership: null,
        error: new Error(
          "Your parent account could not be linked to a valid school. Please contact the school administrator.",
        ),
      };
    }
  } else if (metadataRole === "parent") {
    return {
      membership: null,
      error: new Error(
        "Your parent account is not linked to a parent record. Please ask the school administrator to reconnect your parent account.",
      ),
    };
  }

  // -----------------------------------------------------------------------
  // 2. Normal staff membership.
  // -----------------------------------------------------------------------
  const {
    data: staffData,
    error: staffError,
  } = await supabase
    .from("school_members")
    .select(`
      id,
      school_id,
      role,
      schools (
        id,
        name,
        slug,
        email,
        phone,
        address,
        city,
        country,
        logo_url
      )
    `)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (staffError) {
    return {
      membership: null,
      error: staffError,
    };
  }

  if (!staffData?.school_id || !staffData.schools) {
    return {
      membership: null,
      error: null,
    };
  }

  const schoolData = Array.isArray(staffData.schools)
    ? staffData.schools[0]
    : staffData.schools;

  if (!schoolData) {
    return {
      membership: null,
      error: new Error(
        "Your school information could not be loaded.",
      ),
    };
  }

  return {
    membership: {
      id: staffData.id,
      school_id: staffData.school_id,
      role: staffData.role,
      school: schoolData as SchoolMembershipResult["school"],
    },
    error: null,
  };
}
