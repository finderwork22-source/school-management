import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function normalizeRole(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("_", " ");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return jsonResponse(
        { error: "Supabase environment variables are not configured." },
        500,
      );
    }

    const authorization = req.headers.get("Authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse(
        { error: "Authentication required." },
        401,
      );
    }

    const accessToken = authorization.slice("Bearer ".length);

    const userClient = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );

    const {
      data: { user: inviter },
      error: inviterError,
    } = await userClient.auth.getUser();

    if (inviterError || !inviter) {
      return jsonResponse(
        { error: "Your session is invalid or has expired." },
        401,
      );
    }

    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );

    let body: { parentId?: string };

    try {
      body = (await req.json()) as { parentId?: string };
    } catch {
      return jsonResponse(
        { error: "Invalid request body." },
        400,
      );
    }

    const parentId = body.parentId?.trim();

    if (!parentId) {
      return jsonResponse(
        { error: "parentId is required." },
        400,
      );
    }

    // Verify the caller belongs to a school and has an administrative role.
    const { data: inviterMembership, error: membershipError } =
      await adminClient
        .from("school_members")
        .select("school_id, role")
        .eq("user_id", inviter.id)
        .maybeSingle();

    if (membershipError) {
      console.error("Inviter membership lookup failed:", membershipError);
      return jsonResponse(
        { error: "Could not verify your school membership." },
        500,
      );
    }

    if (!inviterMembership?.school_id) {
      return jsonResponse(
        { error: "You are not a member of a school." },
        403,
      );
    }

    const inviterRole = normalizeRole(inviterMembership.role);

    if (
      !["owner", "principal", "head of academics"].includes(inviterRole)
    ) {
      return jsonResponse(
        { error: "You do not have permission to invite parents." },
        403,
      );
    }

    const { data: parent, error: parentError } =
      await adminClient
        .from("parents")
        .select(
          "id, school_id, first_name, last_name, email, user_id",
        )
        .eq("id", parentId)
        .maybeSingle();

    if (parentError) {
      console.error("Parent lookup failed:", parentError);
      return jsonResponse(
        { error: "Could not load the selected parent." },
        500,
      );
    }

    if (!parent) {
      return jsonResponse(
        { error: "Parent record not found." },
        404,
      );
    }

    if (parent.school_id !== inviterMembership.school_id) {
      return jsonResponse(
        { error: "The selected parent does not belong to your school." },
        403,
      );
    }

    const email = parent.email?.trim().toLowerCase();

    if (!email) {
      return jsonResponse(
        { error: "The selected parent does not have an email address." },
        400,
      );
    }

    if (parent.user_id) {
      return jsonResponse(
        {
          error: "This parent already has an active account.",
          userId: parent.user_id,
        },
        409,
      );
    }

    const configuredAppUrl = Deno.env.get("APP_URL")?.trim();
    const requestOrigin = req.headers.get("origin")?.trim();
    const origin =
      configuredAppUrl ||
      requestOrigin ||
      "http://localhost:5173";

    const redirectTo =
      `${origin.replace(/\/$/, "")}/accept-invitation`;

    const { data: invitedUser, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        data: {
          first_name: parent.first_name,
          last_name: parent.last_name,
          full_name: `${parent.first_name} ${parent.last_name}`.trim(),
          school_id: parent.school_id,
          role: "parent",
        },
        redirectTo,
      });

    if (inviteError) {
      console.error("Parent invitation failed:", inviteError);

      return jsonResponse(
        {
          error:
            inviteError.message ||
            "Could not send the parent invitation.",
          code: inviteError.code ?? null,
        },
        typeof inviteError.status === "number"
          ? inviteError.status
          : 400,
      );
    }

    if (!invitedUser?.user?.id) {
      return jsonResponse(
        { error: "The invitation was not created." },
        500,
      );
    }

    const invitedUserId = invitedUser.user.id;

    // Explicitly link the application parent record to Supabase Auth.
    const { error: updateParentError } =
      await adminClient
        .from("parents")
        .update({
          user_id: invitedUserId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", parent.id)
        .eq("school_id", parent.school_id);

    if (updateParentError) {
      console.error(
        "Failed to link parent to Auth user:",
        updateParentError,
      );

      await adminClient.auth.admin.deleteUser(invitedUserId);

      return jsonResponse(
        {
          error:
            "The invitation was created but the parent account could not be linked to the parent record.",
          details: updateParentError.message,
        },
        500,
      );
    }

    // Re-apply metadata after creation so role and school information are
    // explicit on the Auth account as well.
    const { error: metadataError } =
      await adminClient.auth.admin.updateUserById(
        invitedUserId,
        {
          user_metadata: {
            ...(invitedUser.user.user_metadata ?? {}),
            first_name: parent.first_name,
            last_name: parent.last_name,
            full_name:
              `${parent.first_name} ${parent.last_name}`.trim(),
            school_id: parent.school_id,
            role: "parent",
          },
        },
      );

    if (metadataError) {
      console.error(
        "Failed to update parent Auth metadata:",
        metadataError,
      );

      await adminClient
        .from("parents")
        .update({
          user_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", parent.id);

      await adminClient.auth.admin.deleteUser(invitedUserId);

      return jsonResponse(
        {
          error:
            "The invitation was created but the parent account metadata could not be saved.",
          details: metadataError.message,
        },
        500,
      );
    }

    return jsonResponse({
      success: true,
      userId: invitedUserId,
      parentId: parent.id,
      schoolId: parent.school_id,
      role: "parent",
      message:
        `Invitation sent successfully to ${email}.`,
    });
  } catch (error) {
    console.error("Unexpected parent invitation error:", error);

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
