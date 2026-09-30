import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  ShieldCheck,
} from "lucide-react";

import { supabase } from "../../lib/supabase";

type RecoveryStatus = "checking" | "ready" | "invalid" | "success";

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

export default function AdminResetPassword() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<RecoveryStatus>("checking");
  const [statusMessage, setStatusMessage] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const passwordChecks = useMemo(
    () => [
      { label: "At least 8 characters", valid: newPassword.length >= 8 },
      { label: "At least one uppercase letter", valid: /[A-Z]/.test(newPassword) },
      { label: "At least one lowercase letter", valid: /[a-z]/.test(newPassword) },
      { label: "At least one number", valid: /\d/.test(newPassword) },
      {
        label: "Passwords match",
        valid: confirmPassword.length > 0 && newPassword === confirmPassword,
      },
    ],
    [newPassword, confirmPassword],
  );

  const passwordIsValid = passwordChecks.every((check) => check.valid);

  useEffect(() => {
    let mounted = true;

    const setReadyState = () => {
      if (!mounted) return;
      setStatus("ready");
      setStatusMessage("");
    };

    const setInvalidState = (message: string) => {
      if (!mounted) return;
      setStatus("invalid");
      setStatusMessage(message);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setReadyState();
      }
    });

    async function handleCallback() {
      const url = new URL(window.location.href);
      const queryError =
        url.searchParams.get("error_description") || url.searchParams.get("error");
      const code = url.searchParams.get("code");
      const queryRecoveryType = url.searchParams.get("type") === "recovery";
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
      const hashRecoveryType = hashParams.get("type") === "recovery";
      const hasRecoveryHash =
        hashRecoveryType || hashParams.has("access_token") || hashParams.has("refresh_token");

      if (queryError) {
        setInvalidState(queryError || "This password reset link is invalid or has expired.");
        return;
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (!mounted) return;

        if (exchangeError) {
          console.error("Failed to exchange WISE Admin password reset code:", exchangeError);
          setInvalidState(
            getReadableError(
              exchangeError,
              "This password reset link is invalid or has expired.",
            ),
          );
          return;
        }

        url.searchParams.delete("code");
        window.history.replaceState(
          {},
          document.title,
          `${url.pathname}${url.search}${url.hash}`,
        );

        setReadyState();
        return;
      }

      if (!queryRecoveryType && !hasRecoveryHash) {
        setInvalidState(
          "Open this page from the password reset email. If the link has expired, request a new one.",
        );
        return;
      }

      // For the implicit recovery flow, Supabase processes the URL hash and
      // emits PASSWORD_RECOVERY asynchronously. Give that listener a chance
      // before declaring the callback invalid.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (session) {
        setReadyState();
        return;
      }

      window.setTimeout(async () => {
        if (!mounted) return;

        const {
          data: { session: delayedSession },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (delayedSession) {
          setReadyState();
        } else {
          setInvalidState(
            "This password reset link is invalid or has expired. Please request a new one.",
          );
        }
      }, 600);
    }

    void handleCallback();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (status !== "ready") {
      setError("This password reset session is not ready. Please request a new reset email.");
      return;
    }

    if (!passwordIsValid) {
      setError("Choose a stronger password and make sure both password fields match.");
      return;
    }

    setSaving(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      setNewPassword("");
      setConfirmPassword("");
      setStatus("success");
      setStatusMessage("Your WISE Admin password has been updated successfully.");

      // End the recovery session so the admin signs back in with the new password.
      await supabase.auth.signOut();
      navigate("/login?reset=success", { replace: true });
    } catch (updateError) {
      console.error("Failed to update WISE Admin password:", updateError);
      setError(
        getReadableError(
          updateError,
          "We could not update your password. Please request a new reset link and try again.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  const formDisabled = status !== "ready" || saving;

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
              Set a new password
            </h1>
            <p className="mt-2 text-sm leading-6 text-wiser-text-secondary">
              Create a new password for your super admin account. The reset link
              is valid only for this password-recovery session.
            </p>
          </div>

          {status === "checking" && (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Verifying your password reset link...
              </div>
            </div>
          )}

          {status === "invalid" && (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Reset link unavailable</p>
                  <p className="mt-1 leading-5">
                    {statusMessage ||
                      "This password reset link is invalid or has expired. Please request a new one."}
                  </p>
                </div>
              </div>
              <Link
                to="/admin/forgot-password"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-wiser-700 hover:text-wiser-800"
              >
                <ArrowLeft size={15} />
                Request a new reset email
              </Link>
            </div>
          )}

          {status === "success" && (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
              <div className="flex items-start gap-2">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">Password updated</p>
                  <p className="mt-1 leading-5">
                    {statusMessage} Redirecting you to the login page...
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {status === "ready" && (
            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <PasswordField
                label="New password"
                value={newPassword}
                onChange={setNewPassword}
                visible={showNewPassword}
                onToggleVisibility={() => setShowNewPassword((current) => !current)}
                autoComplete="new-password"
                disabled={formDisabled}
              />

              <PasswordField
                label="Confirm new password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                visible={showConfirmPassword}
                onToggleVisibility={() => setShowConfirmPassword((current) => !current)}
                autoComplete="new-password"
                disabled={formDisabled}
              />

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-700">Password requirements</p>
                <div className="mt-3 space-y-2">
                  {passwordChecks.map((check) => (
                    <div key={check.label} className="flex items-center gap-2 text-xs">
                      <span
                        className={[
                          "flex h-4 w-4 items-center justify-center rounded-full",
                          check.valid
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200 text-slate-400",
                        ].join(" ")}
                      >
                        <CheckCircle2 size={11} />
                      </span>
                      <span
                        className={
                          check.valid ? "text-emerald-700" : "text-slate-500"
                        }
                      >
                        {check.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={formDisabled}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-wiser-600 px-4 text-sm font-semibold text-white transition hover:bg-wiser-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <KeyRound size={16} />
                )}
                {saving ? "Updating password..." : "Update password"}
              </button>
            </form>
          )}

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

function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggleVisibility,
  autoComplete,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggleVisibility: () => void;
  autoComplete: string;
  disabled: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">
        {label}
      </span>
      <div className="relative">
        <KeyRound
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          disabled={disabled}
          className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-11 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-wiser-500 focus:ring-2 focus:ring-wiser-100 disabled:bg-slate-50"
        />
        <button
          type="button"
          onClick={onToggleVisibility}
          disabled={disabled}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </label>
  );
}
