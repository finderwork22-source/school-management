import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
} from "lucide-react";

import { supabase } from "../../lib/supabase";

function getReadableError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;

  if (error && typeof error === "object") {
    const details = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
    };

    return (
      [
        typeof details.message === "string" ? details.message : "",
        typeof details.details === "string" ? details.details : "",
        typeof details.hint === "string" ? details.hint : "",
      ]
        .filter(Boolean)
        .join(" ") || fallback
    );
  }

  return fallback;
}

export default function AdminForgotPassword() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("Enter the email address used for your WISE Admin account.");
      return;
    }

    setSending(true);
    setSent(false);
    setError("");

    try {
      const redirectTo = `${window.location.origin}/admin/reset-password`;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        { redirectTo },
      );

      if (resetError) throw resetError;

      // Supabase intentionally does not reveal whether the email belongs to an
      // account, so the UI keeps the confirmation message generic as well.
      setSent(true);
    } catch (resetError) {
      console.error("Failed to send WISE Admin password reset email:", resetError);
      setError(
        getReadableError(
          resetError,
          "We could not send the password reset email. Please try again.",
        ),
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center justify-center">
        <div className="w-full rounded-2xl border border-wiser-border bg-white p-6 shadow-sm sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-wiser-50 text-wiser-600">
            <KeyRound size={21} />
          </div>

          <div className="mt-5">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-wiser-600">
              <ShieldCheck size={13} />
              WISE Admin
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-wiser-text">
              Forgot your password?
            </h1>
            <p className="mt-2 text-sm leading-6 text-wiser-text-secondary">
              Enter the email address for your super admin account and we will
              send you a secure password reset link.
            </p>
          </div>

          {error && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {sent && (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <div className="flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Check your email</p>
                  <p className="mt-1 leading-5">
                    If a WISE Admin account exists for that address, a password
                    reset email has been sent. Check your inbox and spam folder.
                  </p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">
                Email address
              </span>
              <div className="relative">
                <Mail
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@yourdomain.com"
                  autoComplete="email"
                  autoFocus
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-wiser-500 focus:ring-2 focus:ring-wiser-100"
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={sending}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-wiser-600 px-4 text-sm font-semibold text-white transition hover:bg-wiser-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <KeyRound size={16} />
              )}
              {sending ? "Sending reset email..." : "Send reset email"}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-5">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-semibold text-wiser-600 transition hover:text-wiser-700"
            >
              <ArrowLeft size={15} />
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
