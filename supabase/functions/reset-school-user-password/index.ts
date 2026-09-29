import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

function getPublishableKey() {
  const keysJson = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");

  if (keysJson) {
    try {
      const keys = JSON.parse(keysJson) as Record<string, string>;
      if (keys.default) return keys.default;
    } catch {
      // Fall through to the legacy variable.
    }
  }

  return Deno.env.get("SUPABASE_ANON_KEY") ?? "";
}

function getSecretKey() {
  const keysJson = Deno.env.get("SUPABASE_SECRET_KEYS");

  if (keysJson) {
    try {
      const keys = JSON.parse(keysJson) as Record<string, string>;
      if (keys.default) return keys.default;
    } catch {
      // Fall through to the legacy variable.
    }
  }

  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

const PUBLISHABLE_KEY = getPublishableKey();
const SECRET_KEY = getSecretKey();

const configuredAppUrl = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");

function getCorsHeaders(request: Request) {
  const origin = request.headers.get("Origin") ?? "";

  const allowedOrigins = new Set(
    [
      configuredAppUrl,
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ].filter(Boolean),
  );

  const allowOrigin =
    allowedOrigins.has(origin) ? origin : configuredAppUrl || "http://localhost:5173";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
  };
}

function json(
  body: Record<string, unknown>,
  status: number,
  headers: Record<string, string>,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      "Cache-Control": "no-store",
    },
  });
}

function normalizeRole(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/_/g, " ");
}

function generateTemporaryPassword() {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  let password = "";
  for (const byte of bytes) {
    password += alphabet[byte % alphabet.length];
  }

  // Keep the generated password readable while still adding symbol/number variety.
  return `Wiser-${password.slice(0, 8)}!${password.slice(8, 16)}7`;
}

Deno.serve(async (request) => {
  const headers = getCorsHeaders(request);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405, headers);
  }

  if (!SUPABASE_URL || !PUBLISHABLE_KEY || !SECRET_KEY) {
    console.error("Supabase function environment is incomplete.");
    return json(
      { error: "The password reset service is not configured correctly." },
      500,
      headers,
    );
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return json({ error: "Authentication required." }, 401, headers);
  }

  const userClient = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });

  const { data: authData, error: authError } =
    await userClient.auth.getUser();

  if (authError || !authData.user) {
    console.error("Caller authentication failed:", authError);
    return json({ error: "Your session is invalid or expired." }, 401, headers);
  }

  let body: {
    schoolId?: string;
    targetTeacherId?: string;
  };

  try {
    body = (await request.json()) as {
      schoolId?: string;
      targetTeacherId?: string;
    };
  } catch {
    return json({ error: "Invalid request body." }, 400, headers);
  }

  const schoolId = body.schoolId?.trim();
  const targetTeacherId = body.targetTeacherId?.trim();

  if (!schoolId || !targetTeacherId) {
    return json(
      { error: "schoolId and targetTeacherId are required." },
      400,
      headers,
    );
  }

  const admin = createClient(SUPABASE_URL, SECRET_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Only Owner, CEO, and Principal may perform an administrative password reset.
  const { data: callerMembership, error: callerMembershipError } = await admin
    .from("school_members")
    .select("role")
    .eq("school_id", schoolId)
    .eq("user_id", authData.user.id)
    .maybeSingle();

  if (callerMembershipError) {
    console.error("Caller membership lookup failed:", callerMembershipError);
    return json({ error: "Unable to verify your school permissions." }, 500, headers);
  }

  const callerRole = normalizeRole(callerMembership?.role);
  const callerCanReset = ["owner", "ceo", "principal"].includes(callerRole);

  if (!callerCanReset) {
    return json(
      { error: "You do not have permission to reset another user's password." },
      403,
      headers,
    );
  }

  // Resolve the selected teacher record first. The Teachers table is the source
  // of the staff record shown in the Wiser UI, while the auth user lives in
  // Supabase Auth. We bridge them through the teacher's email address.
  const { data: targetTeacher, error: targetTeacherError } = await admin
    .from("teachers")
    .select("id, email, school_id")
    .eq("school_id", schoolId)
    .eq("id", targetTeacherId)
    .maybeSingle();

  if (targetTeacherError) {
    console.error("Teacher lookup failed:", targetTeacherError);
    return json({ error: "Unable to verify the selected teacher." }, 500, headers);
  }

  const targetEmail = targetTeacher?.email?.trim().toLowerCase();

  if (!targetTeacher || !targetEmail) {
    return json(
      { error: "The selected teacher does not have an email address for a login account." },
      400,
      headers,
    );
  }

  // Find the Auth user by email. Supabase Admin exposes users through paginated
  // listUsers(), so search until the requested email is found.
  let targetUser: { id: string; email?: string | undefined } | null = null;
  const perPage = 1000;

  for (let page = 1; page <= 10 && !targetUser; page += 1) {
    const { data: usersPage, error: usersError } =
      await admin.auth.admin.listUsers({
        page,
        perPage,
      });

    if (usersError) {
      console.error("Auth user lookup failed:", usersError);
      return json({ error: "Unable to find the teacher's login account." }, 500, headers);
    }

    const match = usersPage.users.find(
      (candidate) =>
        (candidate.email ?? "").trim().toLowerCase() === targetEmail,
    );

    if (match) {
      targetUser = {
        id: match.id,
        email: match.email,
      };
      break;
    }

    if (usersPage.users.length < perPage) {
      break;
    }
  }

  if (!targetUser) {
    return json(
      { error: "No login account was found for this teacher email address." },
      404,
      headers,
    );
  }

  // The auth user must also be a Teacher member of this same school.
  const { data: targetMembership, error: targetMembershipError } = await admin
    .from("school_members")
    .select("user_id, role")
    .eq("school_id", schoolId)
    .eq("user_id", targetUser.id)
    .maybeSingle();

  if (targetMembershipError) {
    console.error("Target membership lookup failed:", targetMembershipError);
    return json({ error: "Unable to verify the selected teacher's school access." }, 500, headers);
  }

  if (!targetMembership) {
    return json(
      { error: "The selected teacher does not have a login membership for this school." },
      404,
      headers,
    );
  }

  const targetRole = normalizeRole(targetMembership.role);
  if (targetRole !== "teacher") {
    return json(
      { error: "This reset action currently supports Teacher accounts only." },
      400,
      headers,
    );
  }

  if (targetUser.id === authData.user.id) {
    return json(
      { error: "Use your own password settings or the Forgot password flow for your account." },
      400,
      headers,
    );
  }

  const temporaryPassword = generateTemporaryPassword();

  const { error: updateError } = await admin.auth.admin.updateUserById(
    targetUser.id,
    {
      password: temporaryPassword,
    },
  );

  if (updateError) {
    console.error("Password reset failed:", updateError);
    return json(
      { error: "Unable to reset the teacher's password." },
      500,
      headers,
    );
  }

  return json(
    {
      success: true,
      targetUserId: targetUser.id,
      temporaryPassword,
      message:
        "Password reset successfully. Give the temporary password to the teacher and ask them to change it after signing in.",
    },
    200,
    headers,
  );
});
