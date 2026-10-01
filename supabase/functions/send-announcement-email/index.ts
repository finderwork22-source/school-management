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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL")?.trim() ?? "";
    const appUrl = (
      Deno.env.get("APP_URL") ?? "https://mojaschool.com"
    ).replace(/\/$/, "");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return jsonResponse(
        { error: "Supabase environment variables are not configured." },
        500,
      );
    }

    if (!resendApiKey || !fromEmail) {
      return jsonResponse(
        {
          error:
            "RESEND_API_KEY and RESEND_FROM_EMAIL must be configured for announcement email delivery.",
        },
        500,
      );
    }

    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Authentication required." }, 401);
    }

    const accessToken = authorization.slice("Bearer ".length);

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
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
    });

    const {
      data: { user: caller },
      error: callerError,
    } = await userClient.auth.getUser();

    if (callerError || !caller) {
      return jsonResponse(
        { error: "Your session is invalid or has expired." },
        401,
      );
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const body = (await req.json()) as Record<string, unknown>;
    const announcementId = String(body.announcementId ?? "").trim();

    if (!announcementId) {
      return jsonResponse({ error: "announcementId is required." }, 400);
    }

    // Verify the caller belongs to a school and has announcement-management
    // permission.
    const { data: membership, error: membershipError } = await adminClient
      .from("school_members")
      .select("school_id, role")
      .eq("user_id", caller.id)
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      console.error("Caller school membership lookup failed:", membershipError);
      return jsonResponse(
        { error: "Could not verify your school membership." },
        500,
      );
    }

    if (!membership?.school_id) {
      return jsonResponse({ error: "You are not a member of a school." }, 403);
    }

    const callerRole = normalizeRole(membership.role);

    if (!["owner", "principal", "head of academics"].includes(callerRole)) {
      return jsonResponse(
        { error: "You do not have permission to email school announcements." },
        403,
      );
    }

    const { data: announcement, error: announcementError } = await adminClient
      .from("announcements")
      .select(
        "id, school_id, title, content, status, priority, audience_type, publish_date, expiry_date",
      )
      .eq("id", announcementId)
      .eq("school_id", membership.school_id)
      .maybeSingle();

    if (announcementError) {
      console.error("Announcement lookup failed:", announcementError);
      return jsonResponse(
        { error: "Could not load the announcement." },
        500,
      );
    }

    if (!announcement) {
      return jsonResponse({ error: "Announcement not found." }, 404);
    }

    if (announcement.status !== "Published") {
      return jsonResponse({
        success: true,
        skipped: true,
        reason: "Announcement is not published.",
        sent: 0,
        failed: 0,
      });
    }

    if (!["All School", "Parents"].includes(announcement.audience_type)) {
      return jsonResponse({
        success: true,
        skipped: true,
        reason: "This audience does not include parents.",
        sent: 0,
        failed: 0,
      });
    }

    const { data: parents, error: parentsError } = await adminClient
      .from("parents")
      .select("id, first_name, last_name, email")
      .eq("school_id", announcement.school_id)
      .not("email", "is", null)
      .order("created_at", { ascending: true });

    if (parentsError) {
      console.error("Parent lookup failed:", parentsError);
      return jsonResponse(
        { error: "Could not load parent email recipients." },
        500,
      );
    }

    const recipientsByEmail = new Map<
      string,
      { id: string; first_name: string | null; last_name: string | null; email: string }
    >();

    for (const parent of parents ?? []) {
      const email = String(parent.email ?? "").trim().toLowerCase();
      if (!email || recipientsByEmail.has(email)) continue;

      recipientsByEmail.set(email, {
        id: parent.id,
        first_name: parent.first_name,
        last_name: parent.last_name,
        email,
      });
    }

    let sent = 0;
    let failed = 0;
    let skippedExisting = 0;

    for (const parent of recipientsByEmail.values()) {
      const { data: existingDelivery } = await adminClient
        .from("announcement_email_deliveries")
        .select("id, status")
        .eq("announcement_id", announcement.id)
        .eq("parent_id", parent.id)
        .maybeSingle();

      if (existingDelivery?.status === "sent") {
        skippedExisting += 1;
        continue;
      }

      if (existingDelivery?.id) {
        await adminClient
          .from("announcement_email_deliveries")
          .update({
            status: "pending",
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingDelivery.id);
      } else {
        const { error: deliveryInsertError } = await adminClient
          .from("announcement_email_deliveries")
          .insert({
            announcement_id: announcement.id,
            parent_id: parent.id,
            email: parent.email,
            status: "pending",
          });

        if (deliveryInsertError) {
          // A concurrent invocation can create the same row. Re-read it so
          // this request remains idempotent.
          const { data: concurrentDelivery } = await adminClient
            .from("announcement_email_deliveries")
            .select("id, status")
            .eq("announcement_id", announcement.id)
            .eq("parent_id", parent.id)
            .maybeSingle();

          if (concurrentDelivery?.status === "sent") {
            skippedExisting += 1;
            continue;
          }
        }
      }

      const firstName = String(parent.first_name ?? "").trim();
      const greeting = firstName ? `Hello ${escapeHtml(firstName)},` : "Hello,";
      const title = escapeHtml(String(announcement.title ?? "School announcement"));
      const content = escapeHtml(String(announcement.content ?? ""))
        .replaceAll("\n", "<br />");
      const priority = escapeHtml(String(announcement.priority ?? "Normal"));
      const announcementUrl = `${appUrl}/announcements?id=${encodeURIComponent(announcement.id)}`;

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [parent.email],
          subject: title,
          html: `
            <div style="margin:0;background:#f8fafc;padding:32px 16px;font-family:Arial,sans-serif;color:#0f172a;">
              <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
                <div style="background:#3b1070;padding:24px 28px;color:#ffffff;">
                  <div style="font-size:22px;font-weight:700;">MojaSchool</div>
                  <div style="margin-top:4px;font-size:13px;opacity:.85;">School announcement</div>
                </div>
                <div style="padding:28px;">
                  <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${greeting}</p>
                  <h1 style="margin:0 0 12px;font-size:24px;line-height:1.3;">${title}</h1>
                  <div style="display:inline-block;margin:0 0 20px;padding:6px 10px;border-radius:999px;background:#f1f5f9;color:#475569;font-size:12px;font-weight:600;">${priority}</div>
                  <div style="font-size:15px;line-height:1.75;color:#334155;">${content}</div>
                  <a href="${announcementUrl}" style="display:inline-block;margin-top:24px;padding:11px 16px;border-radius:9px;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;">View announcement</a>
                  <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">You are receiving this email because this announcement was shared with parents through MojaSchool.</p>
                </div>
              </div>
            </div>
          `,
        }),
      });

      const emailBody = await emailResponse.text();

      if (!emailResponse.ok) {
        failed += 1;

        await adminClient
          .from("announcement_email_deliveries")
          .update({
            status: "failed",
            error_message: emailBody.slice(0, 1000),
            updated_at: new Date().toISOString(),
          })
          .eq("announcement_id", announcement.id)
          .eq("parent_id", parent.id);

        console.error(
          `Resend failed for ${parent.email}:`,
          emailResponse.status,
          emailBody,
        );
        continue;
      }

      let parsedBody: { id?: string } = {};
      try {
        parsedBody = JSON.parse(emailBody) as { id?: string };
      } catch {
        // Resend should return JSON; keep the send successful even if parsing
        // the response body fails.
      }

      const { error: sentUpdateError } = await adminClient
        .from("announcement_email_deliveries")
        .update({
          status: "sent",
          resend_email_id: parsedBody.id ?? null,
          sent_at: new Date().toISOString(),
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("announcement_id", announcement.id)
        .eq("parent_id", parent.id);

      if (sentUpdateError) {
        console.error(
          `Email sent but delivery record could not be updated for ${parent.email}:`,
          sentUpdateError,
        );
      }

      sent += 1;
    }

    return jsonResponse({
      success: failed === 0,
      sent,
      failed,
      skippedExisting,
      totalRecipients: recipientsByEmail.size,
      message:
        failed === 0
          ? sent > 0
            ? `Announcement email sent to ${sent} parent${sent === 1 ? "" : "s"}.`
            : "No new parent emails needed to be sent."
          : `Announcement email sent to ${sent} parent${sent === 1 ? "" : "s"}, with ${failed} failure${failed === 1 ? "" : "s"}.`,
    });
  } catch (error) {
    console.error("Unexpected announcement email error:", error);
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected error while sending announcement emails.",
      },
      500,
    );
  }
});
