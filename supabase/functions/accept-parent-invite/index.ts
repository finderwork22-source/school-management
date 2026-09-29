import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

type JsonObject = Record<string, unknown>;

type SetupClaims = {
  sub: string;
  email: string;
  full_name: string;
  school_id: string;
  role: "parent";
  iat: number;
  exp: number;
};

function jsonResponse(body: JsonObject, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
}

function getPublishableKey() {
  const value = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (value) {
    try {
      const parsed = JSON.parse(value) as Record<string, string>;
      if (parsed.default) return parsed.default;
    } catch (error) {
      console.error("Could not parse SUPABASE_PUBLISHABLE_KEYS:", error);
    }
  }

  return Deno.env.get("SUPABASE_ANON_KEY") ?? "";
}

function getSecretKey() {
  const value = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (value) {
    try {
      const parsed = JSON.parse(value) as Record<string, string>;
      if (parsed.default) return parsed.default;
    } catch (error) {
      console.error("Could not parse SUPABASE_SECRET_KEYS:", error);
    }
  }

  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  const padded = padding ? normalized + "=".repeat(4 - padding) : normalized;
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function encodeJson(value: unknown) {
  return toBase64Url(
    new TextEncoder().encode(JSON.stringify(value)),
  );
}

function decodeJson<T>(value: string): T {
  const bytes = fromBase64Url(value);
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

async function signSetupToken(claims: SetupClaims, secret: string) {
  const payload = encodeJson(claims);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );

  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

async function verifySetupToken(token: string, secret: string) {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(signature),
      new TextEncoder().encode(payload),
    );

    if (!valid) return null;

    const claims = decodeJson<SetupClaims>(payload);

    if (
      !claims.sub ||
      !claims.school_id ||
      claims.role !== "parent" ||
      !claims.exp ||
      Date.now() >= claims.exp * 1000
    ) {
      return null;
    }

    return claims;
  } catch (error) {
    console.error("Setup token verification failed:", error);
    return null;
  }
}

function getFullName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}) {
  const metadata = user.user_metadata ?? {};
  const fullName = String(metadata.full_name ?? "").trim();
  if (fullName) return fullName;

  return [
    String(metadata.first_name ?? "").trim(),
    String(metadata.last_name ?? "").trim(),
  ]
    .filter(Boolean)
    .join(" ") || user.email || "Parent";
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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const publishableKey = getPublishableKey();
    const secretKey = getSecretKey();
    const setupSecret = Deno.env.get("INVITE_SETUP_SECRET")?.trim() || secretKey;

    if (!supabaseUrl || !publishableKey || !secretKey || !setupSecret) {
      console.error("Missing Supabase invitation runtime credentials.");
      return jsonResponse(
        { error: "The parent invitation service is not configured correctly." },
        500,
      );
    }

    let body: JsonObject;
    try {
      body = (await req.json()) as JsonObject;
    } catch {
      return jsonResponse({ error: "Invalid request body." }, 400);
    }

    const action = String(body.action ?? "").trim().toLowerCase();

    if (action === "verify") {
      const tokenHash = String(body.token_hash ?? "").trim();
      const tokenType = String(body.type ?? "").trim().toLowerCase();

      if (!tokenHash || tokenType !== "invite") {
        return jsonResponse(
          { error: "A valid parent invitation token is required." },
          400,
        );
      }

      const userClient = createClient(supabaseUrl, publishableKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      });

      const { data: verificationData, error: verificationError } =
        await userClient.auth.verifyOtp({
          token_hash: tokenHash,
          type: "invite",
        });

      if (verificationError || !verificationData.user) {
        console.error("Parent invitation verification failed:", verificationError);
        return jsonResponse(
          {
            error:
              verificationError?.message ||
              "The parent invitation could not be verified. Please ask the school administrator to send a new invitation.",
          },
          400,
        );
      }

      const invitedUser = verificationData.user;
      const metadata = invitedUser.user_metadata ?? {};
      const role = String(metadata.role ?? "").trim().toLowerCase();
      const schoolId = String(metadata.school_id ?? "").trim();

      if (role !== "parent" || !schoolId) {
        return jsonResponse(
          { error: "This invitation is not configured as a parent invitation." },
          403,
        );
      }

      const adminClient = createClient(supabaseUrl, secretKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      });

      const { data: parent, error: parentError } = await adminClient
        .from("parents")
        .select("id, school_id, user_id, first_name, last_name, email")
        .eq("school_id", schoolId)
        .eq("user_id", invitedUser.id)
        .maybeSingle();

      if (parentError) {
        console.error("Parent link lookup failed:", parentError);
        return jsonResponse(
          { error: "We could not verify the parent record for this invitation." },
          500,
        );
      }

      if (!parent) {
        return jsonResponse(
          { error: "This parent account is not linked to a parent record at the school." },
          403,
        );
      }

      const now = Math.floor(Date.now() / 1000);
      const claims: SetupClaims = {
        sub: invitedUser.id,
        email: invitedUser.email ?? parent.email ?? "",
        full_name: getFullName(invitedUser),
        school_id: schoolId,
        role: "parent",
        iat: now,
        exp: now + 15 * 60,
      };

      const setupToken = await signSetupToken(claims, setupSecret);

      return jsonResponse({
        success: true,
        role: "parent",
        setup_token: setupToken,
        user: {
          email: invitedUser.email ?? parent.email ?? undefined,
          user_metadata: {
            first_name: metadata.first_name ?? parent.first_name ?? undefined,
            last_name: metadata.last_name ?? parent.last_name ?? undefined,
            full_name: getFullName(invitedUser),
          },
        },
      });
    }

    if (action === "set-password") {
      const setupToken = String(body.setup_token ?? "").trim();
      const password = String(body.password ?? "");

      if (!setupToken || !password) {
        return jsonResponse(
          { error: "setup_token and password are required." },
          400,
        );
      }

      if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
        return jsonResponse(
          {
            error:
              "Your password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number.",
          },
          400,
        );
      }

      const claims = await verifySetupToken(setupToken, setupSecret);
      if (!claims) {
        return jsonResponse(
          { error: "Your parent setup session has expired or is invalid. Please reopen the invitation email and try again." },
          401,
        );
      }

      const adminClient = createClient(supabaseUrl, secretKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      });

      const { data: authUserData, error: authUserError } =
        await adminClient.auth.admin.getUserById(claims.sub);

      if (authUserError || !authUserData.user) {
        console.error("Parent auth user lookup failed:", authUserError);
        return jsonResponse(
          { error: "The parent account could not be found." },
          404,
        );
      }

      const metadata = authUserData.user.user_metadata ?? {};
      const role = String(metadata.role ?? "").trim().toLowerCase();
      const schoolId = String(metadata.school_id ?? "").trim();

      if (role !== "parent" || schoolId !== claims.school_id) {
        return jsonResponse(
          { error: "This setup session is not valid for a parent account." },
          403,
        );
      }

      const { data: parent, error: parentError } = await adminClient
        .from("parents")
        .select("id, school_id, user_id")
        .eq("school_id", claims.school_id)
        .eq("user_id", claims.sub)
        .maybeSingle();

      if (parentError) {
        console.error("Parent account lookup failed:", parentError);
        return jsonResponse(
          { error: "We could not verify the linked parent record." },
          500,
        );
      }

      if (!parent) {
        return jsonResponse(
          { error: "This parent account is not linked to a school parent record." },
          403,
        );
      }

      const { error: updateError } = await adminClient.auth.admin.updateUserById(
        claims.sub,
        {
          password,
          user_metadata: {
            ...metadata,
            role: "parent",
            school_id: claims.school_id,
          },
        },
      );

      if (updateError) {
        console.error("Parent password update failed:", updateError);
        return jsonResponse(
          { error: updateError.message || "Could not set the parent password." },
          400,
        );
      }

      return jsonResponse({
        success: true,
        role: "parent",
        userId: claims.sub,
        parentId: parent.id,
        message: "Parent account setup completed successfully.",
      });
    }

    return jsonResponse(
      { error: "Unknown action. Use verify or set-password." },
      400,
    );
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
