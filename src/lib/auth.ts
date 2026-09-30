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
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
      },

      // New school accounts should continue directly
      // to the school onboarding page after email confirmation.
      emailRedirectTo: `${window.location.origin}/login`,
    },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

/**
 * Resolve the authenticated SchoolOS role.
 *
 * Parent role resolution is performed through a SECURITY DEFINER RPC so
 * parents-table RLS cannot incorrectly make a real parent account look like
 * a staff account.
 *
 * Staff accounts continue to resolve from school_members.
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
