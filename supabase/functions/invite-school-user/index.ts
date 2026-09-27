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
      console.error(
        "Could not parse SUPABASE_PUBLISHABLE_KEYS:",
        error,
      );
    }
  }

  return Deno.env.get("SUPABASE_ANON_KEY") ?? "";
}

function normalizeRole(value: string) {
  const normalized = value.trim().toLowerCase().replaceAll("_", " ");

  const roleMap: Record<string, string> = {
    owner: "owner",
    ceo: "ceo",
    principal: "principal",
    "head of academics": "head of academics",
    secretary: "secretary",
    teacher: "teacher",
  };

  return roleMap[normalized] ?? "";
}

Deno.serve(async (req: Request) => {
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const publishableKey = getPublishableKey();
    const secretKey = getSecretKey();

    if (!supabaseUrl || !publishableKey || !secretKey) {
      console.error("Missing Supabase runtime credentials.");
      return jsonResponse(
        { error: "The invitation service is not configured correctly." },
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
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      console.error("Caller authentication failed:", authError);
      return jsonResponse(
        { error: "Your session is invalid or has expired. Please sign in again." },
        401,
      );
    }

    let body: Record<string, unknown>;

    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return jsonResponse({ error: "Invalid request body." }, 400);
    }

    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const requestedRole = normalizeRole(String(body.role ?? ""));

    if (!firstName || !lastName || !email || !requestedRole) {
      return jsonResponse(
        { error: "First name, last name, email, and role are required." },
        400,
      );
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
        .eq("user_id", user.id)
        .maybeSingle();

    if (membershipError) {
      console.error("Membership lookup error:", membershipError);
      return jsonResponse(
        {
          error: "Could not verify your school membership.",
          details: membershipError.message,
          code: membershipError.code ?? null,
        },
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
      .toLowerCase()
      .replaceAll("_", " ");

    if (!["owner", "ceo", "principal"].includes(inviterRole)) {
      return jsonResponse(
        {
          error: "You do not have permission to invite users.",
          inviterRole,
        },
        403,
      );
    }

    if (requestedRole === "owner" && inviterRole !== "owner") {
      return jsonResponse(
        { error: "Only the Owner can assign the Owner role." },
        403,
      );
    }

    const configuredAppUrl = Deno.env.get("APP_URL")?.trim();
    const requestOrigin = req.headers.get("origin")?.trim();
    const origin = configuredAppUrl || requestOrigin;

    const redirectTo = origin
      ? `${origin.replace(/\/$/, "")}/accept-invitation`
      : undefined;

    console.log("Creating invitation", {
      email,
      role: requestedRole,
      schoolId: inviterMembership.school_id,
      redirectTo,
    });

    const { data: invitedUser, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        data: {
          first_name: firstName,
          last_name: lastName,
          full_name: `${firstName} ${lastName}`,
          school_id: inviterMembership.school_id,
          role: requestedRole,
        },
        ...(redirectTo ? { redirectTo } : {}),
      });

    if (inviteError) {
      console.error("Invitation error:", inviteError);

      const status =
        typeof inviteError.status === "number" &&
        inviteError.status >= 400 &&
        inviteError.status <= 599
          ? inviteError.status
          : 400;

      return jsonResponse(
        {
          error: inviteError.message || "Could not send the invitation.",
          code: inviteError.code ?? null,
          status,
        },
        status,
      );
    }

    if (!invitedUser.user) {
      return jsonResponse({ error: "The invitation was not created." }, 500);
    }

    const { error: insertError } = await adminClient
      .from("school_members")
      .insert({
        school_id: inviterMembership.school_id,
        user_id: invitedUser.user.id,
        role: requestedRole,
      });

    if (insertError) {
      console.error("School membership insert error:", insertError);

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(
        invitedUser.user.id,
      );

      if (deleteError) {
        console.error("Invitation cleanup failed:", deleteError);
      }

      return jsonResponse(
        {
          error: "The invitation was created but the school membership could not be saved.",
          details: insertError.message,
          code: insertError.code ?? null,
          hint: insertError.hint ?? null,
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
    console.error("Unexpected invitation error:", error);

    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "An unexpected error occurred.",
      },
      500,
    );
  }
});
