import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  MailCheck,
  School,
  ShieldCheck,
} from "lucide-react";

import { supabase } from "../lib/supabase";
import type { Session } from "@supabase/supabase-js";

const PENDING_INVITATION_STORAGE_KEY = "schoolos.invitation.pending";

interface InvitationUser {
  id?: string;
  email?: string;
  user_metadata?: {
    first_name?: string;
    last_name?: string;
    full_name?: string;
  };
}

function getDisplayName(user: InvitationUser | null) {
  if (!user) return "";

  const fullName = user.user_metadata?.full_name?.trim();
  if (fullName) return fullName;

  const firstName = user.user_metadata?.first_name?.trim();
  const lastName = user.user_metadata?.last_name?.trim();

  return [firstName, lastName].filter(Boolean).join(" ");
}

function getReadableError(error: unknown, fallback: string) {
  if (!(error instanceof Error) || !error.message) {
    return fallback;
  }

  const message = error.message.toLowerCase();

  if (
    message.includes("expired") ||
    message.includes("otp_expired") ||
    message.includes("has expired")
  ) {
    return "This invitation link has expired. Please ask the school administrator to send a new invitation.";
  }

  if (message.includes("invalid")) {
    return "The invitation could not be verified because the verification link is invalid. Please send a new invitation.";
  }

  return error.message;
}

export default function AcceptInvitation() {
  const navigate = useNavigate();
  const [user, setUser] = useState<InvitationUser | null>(null);
  const [checkingLink, setCheckingLink] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [confirmationUrl, setConfirmationUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [verified, setVerified] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [invitationSession, setInvitationSession] = useState<Session | null>(null);

  const displayName = useMemo(() => getDisplayName(user), [user]);

  const passwordChecks = useMemo(
    () => ({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      matching: password.length > 0 && password === confirmPassword,
    }),
    [password, confirmPassword],
  );

  const passwordIsValid =
    passwordChecks.length &&
    passwordChecks.uppercase &&
    passwordChecks.lowercase &&
    passwordChecks.number;

  useEffect(() => {
    let mounted = true;

    async function prepareInvitation() {
      setCheckingLink(true);
      setError("");
      setVerified(false);
      setUser(null);
      setConfirmationUrl("");

      try {
        const rawSearch = window.location.search;
        const rawHash = window.location.hash.replace(/^#/, "");

        // Step 1: All invitations arrive at this page first with the real
        // Supabase ConfirmationURL stored inside the `confirmation_url`
        // query parameter. We must NOT call Supabase Auth at this stage.
        // This prevents email/link scanners from consuming the one-time
        // invitation token before the invited user deliberately accepts it.
        //
        // The confirmation_url parameter is intentionally the FINAL query
        // parameter in the email template because the embedded Supabase URL
        // contains its own query parameters.
        const confirmationMatch = rawSearch.match(
          /[?&]confirmation_url=(.*)$/s,
        );

        if (confirmationMatch?.[1]) {
          let decodedConfirmationUrl = confirmationMatch[1].trim();

          // Decode safely up to two levels because some mail clients/link
          // rewriters can encode an already-encoded URL.
          for (let i = 0; i < 2; i += 1) {
            if (/^https?:\/\//i.test(decodedConfirmationUrl)) break;

            try {
              const nextValue = decodeURIComponent(decodedConfirmationUrl);
              if (nextValue === decodedConfirmationUrl) break;
              decodedConfirmationUrl = nextValue.trim();
            } catch {
              break;
            }
          }

          if (!/^https?:\/\//i.test(decodedConfirmationUrl)) {
            throw new Error(
              "This invitation link is incomplete. Please ask the school administrator to send a new invitation.",
            );
          }

          try {
            const confirmationUrlObject = new URL(decodedConfirmationUrl);

            if (
              !confirmationUrlObject.pathname.startsWith("/auth/v1/verify")
            ) {
              throw new Error(
                "This invitation link is not a valid Supabase invitation link.",
              );
            }
          } catch (caughtError) {
            if (
              caughtError instanceof Error &&
              caughtError.message.includes("not a valid Supabase")
            ) {
              throw caughtError;
            }

            throw new Error(
              "This invitation link is incomplete. Please ask the school administrator to send a new invitation.",
            );
          }

          console.info("Invitation wrapper detected", {
            hasConfirmationUrl: true,
            confirmationHost: (() => {
              try {
                return new URL(decodedConfirmationUrl).host;
              } catch {
                return null;
              }
            })(),
          });

          // Remember that this browser tab is in the middle of an invitation.
          // Supabase may consume the URL hash before React reads it; this
          // marker lets the return path recover the session with getSession().
          try {
            window.sessionStorage.setItem(
              PENDING_INVITATION_STORAGE_KEY,
              "true",
            );
          } catch {
            // sessionStorage can be unavailable in privacy-restricted contexts.
          }

          if (mounted) {
            setConfirmationUrl(decodedConfirmationUrl);
            setCheckingLink(false);
          }

          return;
        }

        // Step 2: Support the direct token_hash form as a compatibility
        // fallback. The normal unified email template uses the wrapper above,
        // but accepting token_hash here keeps the page resilient to an older
        // or alternate invitation template.
        //
        // Supabase may redirect invitation links in two different formats:
        //
        //   /accept-invitation?token_hash=...&type=invite
        //
        // or:
        //
        //   /accept-invitation#access_token=...&refresh_token=...&type=invite
        //
        // The token_hash form does NOT contain access_token/refresh_token in
        // the URL, so calling setSession() directly would fail. In that case
        // we must explicitly exchange the invitation token hash with
        // supabase.auth.verifyOtp(), which creates the authenticated session.
        const searchParams = new URLSearchParams(rawSearch);
        const tokenHash = searchParams.get("token_hash");
        const tokenType = searchParams.get("type");

        if (tokenHash) {
          if (tokenType !== "invite") {
            throw new Error(
              "This invitation link has an invalid verification type. Please ask the school administrator to send a new invitation.",
            );
          }

          const { data: verificationData, error: verificationError } =
            await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: "invite",
            });

          if (verificationError) {
            throw verificationError;
          }

          if (!verificationData.session || !verificationData.user) {
            throw new Error(
              "Your invitation was verified, but we could not create your account session. Please ask the school administrator to send a new invitation.",
            );
          }

          // Keep the invitation session in component state as a fallback.
          // Some browser/auth configurations can lose the persisted Supabase
          // session between verification and the password submission.
          // Re-applying these exact tokens before updateUser() keeps the
          // password setup tied to the invitation that was just accepted.
          const verifiedSession = verificationData.session;

          console.info("Invitation verification succeeded", {
            userId: verificationData.user?.id ?? null,
            email: verificationData.user?.email ?? null,
            hasAccessToken: Boolean(verifiedSession.access_token),
            hasRefreshToken: Boolean(verifiedSession.refresh_token),
          });

          if (!mounted) return;

          setInvitationSession(verifiedSession);
          setUser(verificationData.user);
          setVerified(true);
          setCheckingLink(false);

          try {
            window.sessionStorage.removeItem(
              PENDING_INVITATION_STORAGE_KEY,
            );
          } catch {
            // Ignore storage cleanup failures.
          }

          // The token hash has now been exchanged for a real Supabase
          // session. Remove it from the visible browser URL.
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname,
          );

          return;
        }

        // Step 3: After Supabase verifies the invitation, it normally
        // redirects back with the authenticated session in the URL hash.
        // Some Supabase/browser configurations process that hash before this
        // component reads it, so we also recover a session when the browser
        // tab is marked as having a pending invitation.
        const hashParams = new URLSearchParams(rawHash);
        const hashError = hashParams.get("error");
        const hashErrorCode = hashParams.get("error_code");
        const hashErrorDescription = hashParams.get(
          "error_description",
        );

        if (hashError || hashErrorCode) {
          const description = hashErrorDescription
            ? decodeURIComponent(
                hashErrorDescription.replace(/\+/g, " "),
              )
            : "The invitation link could not be verified.";

          throw new Error(
            hashErrorCode === "otp_expired"
              ? "This invitation link has expired. Please ask the school administrator to send a new invitation."
              : description,
          );
        }

        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (!accessToken || !refreshToken) {
          let pendingInvitation = false;

          try {
            pendingInvitation =
              window.sessionStorage.getItem(
                PENDING_INVITATION_STORAGE_KEY,
              ) === "true";
          } catch {
            pendingInvitation = false;
          }

          if (pendingInvitation) {
            const recoverSession = async () => {
              const initial = await supabase.auth.getSession();

              if (initial.error) {
                throw initial.error;
              }

              if (initial.data.session) {
                return initial.data.session;
              }

              return new Promise<Session | null>((resolve, reject) => {
                let finished = false;
                let timeoutId: number | undefined;
                let unsubscribe = () => {};

                const finish = (session: Session | null) => {
                  if (finished) return;
                  finished = true;
                  if (timeoutId !== undefined) {
                    window.clearTimeout(timeoutId);
                  }
                  unsubscribe();
                  resolve(session);
                };

                const { data } = supabase.auth.onAuthStateChange(
                  (event, session) => {
                    if (session) {
                      finish(session);
                    } else if (event === "SIGNED_OUT") {
                      finish(null);
                    }
                  },
                );

                unsubscribe = () => data.subscription.unsubscribe();

                timeoutId = window.setTimeout(() => {
                  if (finished) return;
                  finished = true;
                  unsubscribe();
                  reject(
                    new Error(
                      "Auth session missing. Please reopen the invitation email and try again.",
                    ),
                  );
                }, 5000);

                void supabase.auth.getSession().then(({ data: latest }) => {
                  if (latest.session) {
                    finish(latest.session);
                  }
                });
              });
            };

            const recoveredSession = await recoverSession();

            if (!recoveredSession?.user) {
              throw new Error(
                "Auth session missing. Please reopen the invitation email and try again.",
              );
            }

            if (!mounted) return;

            setInvitationSession(recoveredSession);
            setUser(recoveredSession.user);
            setVerified(true);
            setCheckingLink(false);

            try {
              window.sessionStorage.removeItem(
                PENDING_INVITATION_STORAGE_KEY,
              );
            } catch {
              // Ignore storage cleanup failures.
            }

            window.history.replaceState(
              {},
              document.title,
              window.location.pathname,
            );

            return;
          }

          throw new Error(
            "This invitation link is incomplete. Please use the invitation link sent to you by the school administrator, or ask them to send a new invitation.",
          );
        }

        if (!accessToken || !refreshToken) {
          throw new Error(
            "This invitation link is incomplete. Please use the invitation link sent to you by the school administrator, or ask them to send a new invitation.",
          );
        }

        // The invitation redirect contains the authenticated session tokens
        // in the URL hash. Establish the Supabase session explicitly instead
        // of waiting for the client to process the hash automatically.
        //
        // This is important because the password page needs a real Auth
        // session before supabase.auth.updateUser({ password }) can succeed.
        const { data: sessionData, error: setSessionError } =
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

        if (setSessionError) {
          throw setSessionError;
        }

        if (!sessionData.session || !sessionData.user) {
          throw new Error(
            "Your invitation was confirmed, but we could not create your account session. Please request a new invitation.",
          );
        }

        if (!mounted) return;

        setInvitationSession(sessionData.session);
        setUser(sessionData.user);
        setVerified(true);
        setCheckingLink(false);

        try {
          window.sessionStorage.removeItem(
            PENDING_INVITATION_STORAGE_KEY,
          );
        } catch {
          // Ignore storage cleanup failures.
        }

        // The tokens have now been exchanged for a Supabase session.
        // Remove the sensitive tokens from the visible browser URL.
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );
      } catch (caughtError) {
        console.error("Failed to prepare invitation:", {
          error: caughtError,
          message: caughtError instanceof Error ? caughtError.message : String(caughtError),
          code: typeof caughtError === "object" && caughtError !== null && "code" in caughtError
            ? String((caughtError as { code?: unknown }).code ?? "")
            : null,
          status: typeof caughtError === "object" && caughtError !== null && "status" in caughtError
            ? String((caughtError as { status?: unknown }).status ?? "")
            : null,
        });

        if (mounted) {
          setError(
            getReadableError(
              caughtError,
              "We could not verify your invitation. Please ask the school administrator to send a new invitation.",
            ),
          );
          setCheckingLink(false);
        }
      }
    }

    void prepareInvitation();

    return () => {
      mounted = false;

    };
  }, []);

  function handleVerifyInvitation() {
    if (!confirmationUrl) {
      setError(
        "This invitation link is incomplete. Please ask the school administrator to send a new invitation.",
      );
      return;
    }

    setVerifying(true);
    setError("");

    // Navigate to the actual Supabase confirmation URL only after the user
    // explicitly clicks the button. Supabase will verify the invitation and
    // redirect back to /accept-invitation with a session hash.
    window.location.assign(confirmationUrl);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!verified || !user) {
      setError("Please verify your invitation before setting your password.");
      return;
    }

    if (!passwordIsValid) {
      setError(
        "Your password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number.",
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setSaving(true);

    try {
      // Make sure the authenticated invitation session is active immediately
      // before changing the password. If the browser lost the persisted
      // session, restore the exact session returned by Supabase during
      // invitation verification.
      const { data: currentSessionData } =
        await supabase.auth.getSession();

      if (!currentSessionData.session && invitationSession) {
        const { data: restoredSessionData, error: restoreError } =
          await supabase.auth.setSession({
            access_token: invitationSession.access_token,
            refresh_token: invitationSession.refresh_token,
          });

        if (restoreError) {
          throw restoreError;
        }

        if (!restoredSessionData.session) {
          throw new Error(
            "Auth session missing. Please reopen the invitation email and try again.",
          );
        }
      }

      const { data: activeSessionData } =
        await supabase.auth.getSession();

      if (!activeSessionData.session) {
        throw new Error(
          "Auth session missing. Please reopen the invitation email and try again.",
        );
      }

      const { data, error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        throw updateError;
      }

      if (!data.user) {
        throw new Error(
          "Your password could not be saved because your account session is no longer active.",
        );
      }

      setSuccess(true);
      setPassword("");
      setConfirmPassword("");

      window.setTimeout(() => {
        navigate("/", { replace: true });
      }, 900);
    } catch (caughtError) {
      console.error("Failed to set invitation password:", caughtError);

      setError(
        getReadableError(
          caughtError,
          "We could not set your password. Please try again.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  if (checkingLink) {
    return (
      <PageShell>
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <Loader2 size={25} className="animate-spin" />
          </div>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-slate-900">
            Preparing your invitation
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
            Please wait while we check the invitation link.
          </p>
        </div>
      </PageShell>
    );
  }

  if (error && !verified) {
    return (
      <PageShell>
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <AlertCircle size={27} />
          </div>

          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-slate-900">
            Invitation could not be verified
          </h1>

          <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
            {error}
          </p>

          <div className="mt-7 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              Try again
            </button>

            <Link
              to="/login"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Go to sign in
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  if (success) {
    return (
      <PageShell>
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={28} />
          </div>

          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-slate-900">
            Your account is ready
          </h1>

          <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
            Your password has been set successfully. We are taking you to your
            Wiser dashboard.
          </p>

          <div className="mt-7 flex items-center gap-2 text-sm font-medium text-slate-500">
            <Loader2 size={16} className="animate-spin" />
            Opening dashboard...
          </div>
        </div>
      </PageShell>
    );
  }

  if (!verified) {
    return (
      <PageShell>
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <MailCheck size={27} />
          </div>

          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
            Wiser invitation
          </p>

          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            You&apos;ve been invited
          </h1>

          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
            You&apos;ve been invited to join your school on Wiser. Continue below
            to securely verify this invitation before creating your password.
          </p>
        </div>

        <div className="mt-8 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck size={19} className="mt-0.5 shrink-0 text-indigo-600" />
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Secure invitation verification
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Your invitation will be securely confirmed after you
                  click the button below. The email link itself does not consume
                  the invitation token.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleVerifyInvitation()}
            disabled={verifying}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {verifying ? (
              <>
                <Loader2 size={17} className="animate-spin" />
                Opening secure invitation...
              </>
            ) : (
              <>
                <MailCheck size={17} />
                Accept invitation
              </>
            )}
          </button>

          <p className="text-center text-xs leading-5 text-slate-400">
            This link is intended for the person who received the invitation
            email.
          </p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <School size={27} />
        </div>

        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
          Wiser invitation
        </p>

        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Welcome{displayName ? `, ${displayName}` : ""}
        </h1>

        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
          Your invitation has been verified. Set a secure password to finish
          creating your Wiser account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        {error && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div>
          <label
            htmlFor="invited-email"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Email address
          </label>

          <input
            id="invited-email"
            type="email"
            value={user?.email ?? ""}
            readOnly
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-600 outline-none"
          />
        </div>

        <PasswordField
          id="new-password"
          label="Create password"
          value={password}
          onChange={setPassword}
          visible={showPassword}
          onToggle={() => setShowPassword((current) => !current)}
          disabled={saving}
        />

        <PasswordField
          id="confirm-password"
          label="Confirm password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          visible={showConfirmPassword}
          onToggle={() => setShowConfirmPassword((current) => !current)}
          disabled={saving}
        />

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <KeyRound size={16} />
            Password requirements
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <PasswordRule valid={passwordChecks.length} label="At least 8 characters" />
            <PasswordRule valid={passwordChecks.uppercase} label="One uppercase letter" />
            <PasswordRule valid={passwordChecks.lowercase} label="One lowercase letter" />
            <PasswordRule valid={passwordChecks.number} label="One number" />
            <PasswordRule valid={passwordChecks.matching} label="Passwords match" />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving || !passwordIsValid || password !== confirmPassword}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {saving ? (
            <>
              <Loader2 size={17} className="animate-spin" />
              Setting up your account...
            </>
          ) : (
            <>
              <LockKeyhole size={17} />
              Set password &amp; continue
            </>
          )}
        </button>

        <p className="text-center text-xs leading-5 text-slate-400">
          By continuing, you are completing the account setup for the school
          that invited you.
        </p>
      </form>
    </PageShell>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  visible,
  onToggle,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium text-slate-700">
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="new-password"
          disabled={disabled}
          required
          minLength={8}
          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 disabled:bg-slate-50"
          placeholder="Enter a secure password"
        />

        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-600 disabled:cursor-not-allowed"
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </div>
  );
}

function PasswordRule({ valid, label }: { valid: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-500">
      <span
        className={[
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px]",
          valid
            ? "border-emerald-200 bg-emerald-100 text-emerald-700"
            : "border-slate-200 bg-white text-slate-300",
        ].join(" ")}
      >
        {valid ? "✓" : ""}
      </span>
      {label}
    </div>
  );
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg items-center justify-center">
        <section className="w-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          {children}
        </section>
      </div>
    </main>
  );
}
