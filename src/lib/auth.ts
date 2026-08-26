import { supabase } from "./supabase";

export async function signIn(
  email: string,
  password: string,
) {
  return supabase.auth.signInWithPassword({
    email,
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
    },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getMySchoolMembership() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      membership: null,
      error: null,
    };
  }

  const { data, error } = await supabase
    .from("school_members")
    .select(
      `
        id,
        school_id,
        role,
        schools (
          id,
          name,
          slug
        )
      `,
    )
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return {
    membership: data,
    error,
  };
}