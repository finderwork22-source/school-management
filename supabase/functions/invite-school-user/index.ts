import { createClient } from "@supabase/supabase-js";

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

Deno.serve(async (req: Request) => {
  // CORS preflight must succeed before authentication is checked.
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return jsonResponse(
        { error: "Supabase environment variables are not configured." },
        500,
      );
    }

    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Missing authorization token." }, 401);
    }

    const accessToken = authHeader.replace("Bearer ", "");

    // Validate the currently signed-in user.
    const userClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      },
    );

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      console.error("Authentication error:", userError);
      return jsonResponse(
        {
          error:
            "Your session is invalid or has expired. Please sign in again.",
        },
        401,
      );
    }

    // Service-role client is server-side only.
    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const body = await req.json();

    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();

    // The UI uses title-case labels, while the existing database stores
    // roles in lowercase (for example: "owner"). Normalize here so both
    // formats are accepted and the database convention is preserved.
    const requestedRole = String(body.role ?? "").trim().toLowerCase();

    const allowedRoles = [
      "owner",
      "ceo",
      "principal",
      "head of academics",
      "secretary",
      "teacher",
    ];

    if (!firstName || !lastName || !email || !requestedRole) {
      return jsonResponse(
        {
          error:
            "First name, last name, email, and role are required.",
        },
        400,
      );
    }

    if (!allowedRoles.includes(requestedRole)) {
      return jsonResponse({ error: "Invalid role." }, 400);
    }

    // Verify the inviter's school membership.
    const { data: inviterMembership, error: membershipError } =
      await adminClient
        .from("school_members")
        .select("school_id, role")
        .eq("user_id", user.id)
        .maybeSingle();

    if (membershipError) {
      console.error("Membership lookup error:", membershipError);
      return jsonResponse(
        { error: "Could not verify your school membership." },
        500,
      );
    }

    if (!inviterMembership) {
      return jsonResponse(
        { error: "You are not a member of a school." },
        403,
      );
    }

    const inviterRole = String(inviterMembership.role ?? "")
      .trim()
      .toLowerCase();

    if (!["owner", "ceo", "principal"].includes(inviterRole)) {
      return jsonResponse(
        { error: "You do not have permission to invite users." },
        403,
      );
    }

    // Only the Owner can assign the Owner role.
    if (requestedRole === "owner" && inviterRole !== "owner") {
      return jsonResponse(
        { error: "Only the Owner can assign the Owner role." },
        403,
      );
    }

    // Use APP_URL when configured so the invitation always points to the
    // intended SchoolOS deployment, even if the invite was sent locally.
    const configuredAppUrl = Deno.env.get("APP_URL");
    const origin =
      configuredAppUrl ||
      req.headers.get("origin") ||
      "http://localhost:5173";

    const redirectTo = `${origin.replace(/\/$/, "")}/accept-invitation`;

    const { data: invitedUser, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`,
          school_id: inviterMembership.school_id,
          role: requestedRole,
        },
        redirectTo,
      });

    if (inviteError) {
      console.error("Invitation error:", inviteError);
      return jsonResponse(
        {
          error:
            inviteError.message ||
            "Could not send the invitation.",
        },
        400,
      );
    }

    if (!invitedUser.user) {
      return jsonResponse(
        { error: "The invitation was not created." },
        500,
      );
    }

    const { error: insertError } = await adminClient
      .from("school_members")
      .insert({
        school_id: inviterMembership.school_id,
        user_id: invitedUser.user.id,
        role: requestedRole,
      });

    if (insertError) {
      console.error(
        "School membership insert error:",
        insertError,
      );

      // Clean up the auth user if the membership could not be created.
      await adminClient.auth.admin.deleteUser(invitedUser.user.id);

      return jsonResponse(
        {
          error:
            "The invitation was created but the school membership could not be saved.",
        },
        500,
      );
    }

    return jsonResponse({
      success: true,
      userId: invitedUser.user.id,
      schoolId: inviterMembership.school_id,
      role: requestedRole,
    });
  } catch (error) {
    console.error("Unexpected error:", error);

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
