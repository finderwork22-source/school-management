import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getSecretKey() {
  const secretKeysJson = Deno.env.get("SUPABASE_SECRET_KEYS");

  if (secretKeysJson) {
    try {
      const secretKeys = JSON.parse(secretKeysJson) as Record<string, string>;
      if (secretKeys.default) return secretKeys.default;
    } catch (error) {
      console.error("Could not parse SUPABASE_SECRET_KEYS:", error);
    }
  }

  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

function getPublishableKey() {
  const publishableKeysJson = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");

  if (publishableKeysJson) {
    try {
      const publishableKeys = JSON.parse(
        publishableKeysJson,
      ) as Record<string, string>;
      if (publishableKeys.default) return publishableKeys.default;
    } catch (error) {
      console.error("Could not parse SUPABASE_PUBLISHABLE_KEYS:", error);
    }
  }

  return Deno.env.get("SUPABASE_ANON_KEY") ?? "";
}

function getErrorDetails(error: {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
} | null) {
  return {
    message: error?.message ?? "Unknown error.",
    code: error?.code ?? null,
    details: error?.details ?? null,
    hint: error?.hint ?? null,
  };
}

function normalizeRole(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("_", " ");
}

async function findAuthUserByEmail(
  adminClient: any,
  email: string,
) {
  const perPage = 1000;

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      return { user: null, error };
    }

    const match = data.users.find(
      (candidate) =>
        (candidate.email ?? "").trim().toLowerCase() === email,
    );

    if (match) {
      return { user: match, error: null };
    }

    if (data.users.length < perPage) break;
  }

  return { user: null, error: null };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  let invitedUserId = "";
  let createdAuthUser = false;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const publishableKey = getPublishableKey();
    const secretKey = getSecretKey();

    if (!supabaseUrl || !publishableKey || !secretKey) {
      return jsonResponse(
        { error: "The teacher invitation service is not configured correctly." },
        500,
      );
    }

    const authorization = req.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Authentication required." }, 401);
    }

    const userClient = createClient(supabaseUrl, publishableKey, {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    const {
      data: { user: inviter },
      error: inviterAuthError,
    } = await userClient.auth.getUser();

    if (inviterAuthError || !inviter) {
      console.error("Caller authentication failed:", inviterAuthError);
      return jsonResponse(
        {
          error:
            "Your session is invalid or has expired. Please sign in again.",
        },
        401,
      );
    }

    let body: Record<string, unknown>;

    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse({ error: "Invalid request body." }, 400);
    }

    const teacherId = String(body.teacherId ?? "").trim();

    if (!teacherId) {
      return jsonResponse({ error: "Teacher ID is required." }, 400);
    }

    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    const { data: inviterMembership, error: membershipError } =
      await adminClient
        .from("school_members")
        .select("school_id, role")
        .eq("user_id", inviter.id)
        .maybeSingle();

    if (membershipError) {
      console.error("Inviter membership lookup failed:", membershipError);
      return jsonResponse(
        {
          error: "Could not verify your school membership.",
          details: getErrorDetails(membershipError),
        },
        500,
      );
    }

    const schoolId = inviterMembership?.school_id;

    if (!schoolId) {
      return jsonResponse({ error: "You are not a member of a school." }, 403);
    }

    const inviterRole = normalizeRole(inviterMembership.role);

    if (![
      "owner",
      "principal",
      "head of academics",
    ].includes(inviterRole)) {
      return jsonResponse(
        { error: "You do not have permission to invite teachers." },
        403,
      );
    }

    const { data: teacher, error: teacherError } = await adminClient
      .from("teachers")
      .select(
        "id, school_id, teacher_id, first_name, middle_name, last_name, email, user_id, status",
      )
      .eq("id", teacherId)
      .maybeSingle();

    if (teacherError) {
      console.error("Teacher lookup failed:", teacherError);
      return jsonResponse(
        {
          error: "Could not load the selected teacher.",
          details: getErrorDetails(teacherError),
        },
        500,
      );
    }

    if (!teacher) {
      return jsonResponse({ error: "Teacher record not found." }, 404);
    }

    if (teacher.school_id !== schoolId) {
      return jsonResponse(
        { error: "The selected teacher does not belong to your school." },
        403,
      );
    }

    if (teacher.user_id) {
      return jsonResponse(
        {
          error: "This teacher already has an active account.",
          userId: teacher.user_id,
        },
        409,
      );
    }

    const email = teacher.email?.trim().toLowerCase();

    if (!email) {
      return jsonResponse(
        {
          error:
            "This teacher does not have an email address. Add an email address before sending the invitation.",
        },
        400,
      );
    }

    const fullName = [
      teacher.first_name,
      teacher.middle_name,
      teacher.last_name,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    const configuredAppUrl = Deno.env.get("APP_URL")?.trim();
    const requestOrigin = req.headers.get("origin")?.trim();
    const origin = configuredAppUrl || requestOrigin || "http://localhost:5173";
    const redirectTo = `${origin.replace(/\/$/, "")}/accept-invitation`;

    console.log("Inviting teacher", {
      teacherId,
      email,
      schoolId,
      redirectTo,
    });

    // -----------------------------------------------------------------------
    // 1. Re-use an existing Auth account when one already exists for this
    //    email. This is important for teachers created through an older
    //    Users & Roles flow before teacher profiles were separated from staff.
    // -----------------------------------------------------------------------
    const existingAuthResult = await findAuthUserByEmail(adminClient, email);

    if (existingAuthResult.error) {
      console.error("Auth user lookup failed:", existingAuthResult.error);
      return jsonResponse(
        {
          error: "Unable to verify whether this teacher already has a login account.",
          details: getErrorDetails(existingAuthResult.error),
        },
        500,
      );
    }

    let authUser = existingAuthResult.user;

    // -----------------------------------------------------------------------
    // 2. Create a new Auth invitation when no account exists yet.
    // -----------------------------------------------------------------------
    if (!authUser) {
      const { data: invitedUser, error: inviteError } =
        await adminClient.auth.admin.inviteUserByEmail(email, {
          data: {
            first_name: teacher.first_name,
            last_name: teacher.last_name,
            full_name: fullName,
            school_id: schoolId,
            role: "teacher",
          },
          redirectTo,
        });

      if (inviteError) {
        console.error("Teacher invitation failed:", inviteError);

        return jsonResponse(
          {
            error:
              inviteError.message ||
              "Could not send the teacher invitation.",
            code: inviteError.code ?? null,
          },
          typeof inviteError.status === "number" ? inviteError.status : 400,
        );
      }

      authUser = invitedUser.user;
      createdAuthUser = true;
    }

    if (!authUser?.id) {
      return jsonResponse(
        { error: "The teacher login account could not be created or found." },
        500,
      );
    }

    invitedUserId = authUser.id;

    // -----------------------------------------------------------------------
    // 3. Keep the profile table aligned with the Auth account.
    // -----------------------------------------------------------------------
    const { error: profileError } = await adminClient
      .from("profiles")
      .upsert(
        {
          id: invitedUserId,
          first_name: teacher.first_name || null,
          last_name: teacher.last_name || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );

    if (profileError) {
      console.error("Teacher profile creation failed:", profileError);

      if (createdAuthUser) {
        await adminClient.auth.admin.deleteUser(invitedUserId);
      }

      return jsonResponse(
        {
          error: "The teacher account was created but the user profile could not be saved.",
          details: getErrorDetails(profileError),
        },
        500,
      );
    }

    // -----------------------------------------------------------------------
    // 4. Ensure the Auth user is a Teacher member of this school.
    // -----------------------------------------------------------------------
    const { data: existingMemberships, error: existingMembershipError } =
      await adminClient
        .from("school_members")
        .select("id, school_id, user_id, role")
        .eq("user_id", invitedUserId);

    if (existingMembershipError) {
      console.error(
        "Existing teacher membership lookup failed:",
        existingMembershipError,
      );

      if (createdAuthUser) {
        await adminClient.auth.admin.deleteUser(invitedUserId);
      }

      return jsonResponse(
        {
          error: "The teacher account was created but school membership could not be checked.",
          details: getErrorDetails(existingMembershipError),
        },
        500,
      );
    }

    const otherSchoolMembership = (existingMemberships ?? []).find(
      (membership) => membership.school_id !== schoolId,
    );

    if (otherSchoolMembership) {
      if (createdAuthUser) {
        await adminClient.auth.admin.deleteUser(invitedUserId);
      }

      return jsonResponse(
        {
          error:
            "This email is already linked to a user from another school.",
        },
        409,
      );
    }

    const sameSchoolMembership = (existingMemberships ?? []).find(
      (membership) => membership.school_id === schoolId,
    );

    if (sameSchoolMembership) {
      const { error: updateMembershipError } = await adminClient
        .from("school_members")
        .update({ role: "teacher" })
        .eq("id", sameSchoolMembership.id);

      if (updateMembershipError) {
        console.error(
          "Teacher membership update failed:",
          updateMembershipError,
        );

        if (createdAuthUser) {
          await adminClient.auth.admin.deleteUser(invitedUserId);
        }

        return jsonResponse(
          {
            error: "The teacher account was created but the school membership could not be updated.",
            details: getErrorDetails(updateMembershipError),
          },
          500,
        );
      }
    } else {
      const { error: insertMembershipError } = await adminClient
        .from("school_members")
        .insert({
          school_id: schoolId,
          user_id: invitedUserId,
          role: "teacher",
        });

      if (insertMembershipError) {
        console.error(
          "Teacher membership creation failed:",
          insertMembershipError,
        );

        if (createdAuthUser) {
          await adminClient.auth.admin.deleteUser(invitedUserId);
        }

        return jsonResponse(
          {
            error: "The teacher account was created but the school membership could not be saved.",
            details: getErrorDetails(insertMembershipError),
          },
          500,
        );
      }
    }

    // -----------------------------------------------------------------------
    // 5. Link the teacher profile to the Auth account.
    // -----------------------------------------------------------------------
    const { error: teacherLinkError } = await adminClient
      .from("teachers")
      .update({ user_id: invitedUserId })
      .eq("id", teacher.id)
      .eq("school_id", schoolId);

    if (teacherLinkError) {
      console.error(
        "Teacher/Auth link update failed:",
        teacherLinkError,
      );

      if (createdAuthUser) {
        await adminClient.auth.admin.deleteUser(invitedUserId);
      }

      return jsonResponse(
        {
          error:
            "The teacher account was created but the teacher profile could not be linked to it.",
          details: getErrorDetails(teacherLinkError),
        },
        500,
      );
    }

    return jsonResponse({
      success: true,
      teacherId: teacher.id,
      teacherCode: teacher.teacher_id,
      userId: invitedUserId,
      schoolId,
      role: "teacher",
      invitationSent: createdAuthUser,
      accountLinked: true,
      message: createdAuthUser
        ? `Invitation sent successfully to ${email}.`
        : `The existing login account for ${email} was linked to this teacher profile.`,
    });
  } catch (error) {
    console.error("Unexpected teacher invitation error:", error);

    if (createdAuthUser && invitedUserId) {
      try {
        const cleanupClient = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          getSecretKey(),
          {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
              detectSessionInUrl: false,
            },
          },
        );

        await cleanupClient.auth.admin.deleteUser(invitedUserId);
      } catch (cleanupError) {
        console.error("Teacher invitation cleanup failed:", cleanupError);
      }
    }

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      },
      500,
    );
  }
});
