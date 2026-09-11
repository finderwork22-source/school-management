import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  School,
} from "lucide-react";

import { supabase } from "../lib/supabase";

interface InvitationUser {
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

export default function AcceptInvitation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [user, setUser] = useState<InvitationUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
      setLoading(true);
      setError("");

      try {
        // Supabase may return an authorization code when PKCE is enabled.
        const code = searchParams.get("code");
        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            throw new Error(
              "This invitation link is invalid or has expired. Please ask the school administrator to send a new invitation.",
            );
          }
        }

        // Some Supabase invitation links use token_hash + type=invite.
        const tokenHash = searchParams.get("token_hash");
        const type = searchParams.get("type");

        if (tokenHash && type === "invite") {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "invite",
          });

          if (verifyError) {
            throw new Error(
              "This invitation link is invalid or has expired. Please ask the school administrator to send a new invitation.",
            );
          }
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw new Error(
            "We could not verify your invitation session. Please open the invitation link again.",
          );
        }

        if (!session?.user) {
          throw new Error(
            "This invitation could not be verified. Please open the invitation link from your email again, or ask the school administrator to send a new invitation.",
          );
        }

        if (!mounted) return;
        setUser(session.user);
      } catch (caughtError) {
        if (!mounted) return;

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "We could not verify your invitation. Please try again.",
        );
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void prepareInvitation();

    return () => {
      mounted = false;
    };
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

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

      // Give the success state a short moment so the user knows the setup
      // completed before entering the normal SchoolOS dashboard.
      window.setTimeout(() => {
        navigate("/", { replace: true });
      }, 900);
    } catch (caughtError) {
      console.error("Failed to set invitation password:", caughtError);

      setError(
        caughtError instanceof Error && caughtError.message
          ? caughtError.message
          : "We could not set your password. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <PageShell>
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <Loader2 size={25} className="animate-spin" />
          </div>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-slate-900">
            Verifying your invitation
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
            Please wait while we securely prepare your SchoolOS account.
          </p>
        </div>
      </PageShell>
    );
  }

  if (error && !user) {
    return (
      <PageShell>
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <AlertCircle size={27} />
          </div>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-slate-900">
            Invitation could not be verified
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">{error}</p>

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
            Your password has been set successfully. We are taking you to your SchoolOS dashboard.
          </p>
          <div className="mt-7 flex items-center gap-2 text-sm font-medium text-slate-500">
            <Loader2 size={16} className="animate-spin" />
            Opening dashboard...
          </div>
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
          SchoolOS invitation
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Welcome{displayName ? `, ${displayName}` : ""}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
          Your school administrator has invited you to join SchoolOS. Set a secure password to finish creating your account.
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
          <label htmlFor="invited-email" className="mb-2 block text-sm font-medium text-slate-700">
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
              Set password & continue
            </>
          )}
        </button>

        <p className="text-center text-xs leading-5 text-slate-400">
          By continuing, you are completing the account setup for the school that invited you.
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
          autoComplete={id === "new-password" ? "new-password" : "new-password"}
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
