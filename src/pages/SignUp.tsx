import { useState } from "react";
import type { FormEvent } from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  User,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import WiserLogo from "../assets/wiser-logo-cropped.png";
import { signUp } from "../lib/auth";
import { supabase } from "../lib/supabase";

export default function SignUp() {
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const [error, setError] = useState("");
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setResendMessage("");

    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedFirstName) {
      setError("Please enter your first name.");
      return;
    }

    if (!normalizedLastName) {
      setError("Please enter your last name.");
      return;
    }

    if (!normalizedEmail) {
      setError("Please enter your email address.");
      return;
    }

    if (password.length < 6) {
      setError("Your password must contain at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);

    const { data, error: signUpError } = await signUp({
      email: normalizedEmail,
      password,
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
    });

    if (signUpError) {
      setError(getSignUpErrorMessage(signUpError.message));
      setLoading(false);
      return;
    }

    if (!data.user) {
      setError("Unable to create your account. Please try again.");
      setLoading(false);
      return;
    }

    /*
     * When Supabase email confirmation is enabled, there is no active
     * session immediately after signup. In that case we show a dedicated
     * confirmation state instead of sending the user to a page that
     * requires authentication.
     */
    if (!data.session) {
      setConfirmationSent(true);
      setLoading(false);
      return;
    }

    /*
     * When email confirmation is disabled, Supabase gives us a live session
     * and the user can immediately continue to school onboarding.
     */
    navigate("/setup-school", { replace: true });
  }

  async function handleResendConfirmation() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("Please enter your email address.");
      return;
    }

    setError("");
    setResendMessage("");
    setResending(true);

    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: normalizedEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/setup-school`,
      },
    });

    if (resendError) {
      setError(
        resendError.message ||
          "We could not resend the confirmation email. Please try again.",
      );
      setResending(false);
      return;
    }

    setResendMessage(
      "A new confirmation email has been sent. Please check your inbox.",
    );
    setResending(false);
  }

  if (confirmationSent) {
    return (
      <div className="min-h-screen bg-wiser-background lg:grid lg:grid-cols-[minmax(0,1fr)_520px]">
        {/* Brand panel */}
        <section className="hidden min-h-screen bg-wiser-900 px-10 py-10 text-white lg:flex lg:items-center lg:justify-center xl:px-16">
          <div className="w-full max-w-xl">
            <div className="inline-flex h-16 w-60 items-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-white/20">
              <img
                src={WiserLogo}
                alt="WISE"
                className="h-auto w-[180px]"
              />
            </div>

            <div className="mt-14 max-w-lg">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-wiser-200">
                School management
              </p>

              <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
                Start managing your school smarter.
              </h1>

              <p className="mt-6 max-w-lg text-base leading-7 text-wiser-100">
                Create your WISE account, request school access and manage
                your school from one platform.
              </p>
            </div>
          </div>
        </section>

        {/* Confirmation panel */}
        <main className="flex min-h-screen w-full items-center justify-center px-5 py-8 sm:px-8 lg:px-10">
          <div className="w-full max-w-sm">
            <div className="mb-8 lg:hidden">
              <div className="h-14 w-52 overflow-hidden rounded-xl bg-white ring-1 ring-wiser-border">
                <img
                  src={WiserLogo}
                  alt="WISE"
                  className="h-auto w-[170px]"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-wiser-border bg-white p-6 shadow-sm sm:p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={24} />
              </div>

              <h1 className="mt-6 text-2xl font-semibold tracking-tight text-wiser-text">
                Check your email
              </h1>

              <p className="mt-3 text-sm leading-6 text-wiser-text-secondary">
                Your WISE account has been created. We sent a confirmation
                link to:
              </p>

              <p className="mt-2 break-all rounded-lg bg-wiser-50 px-3 py-2 text-sm font-semibold text-wiser-700">
                {email.trim().toLowerCase()}
              </p>

              <p className="mt-4 text-sm leading-6 text-wiser-text-secondary">
                Confirm your email address, then return to WISE and sign in.
                You can continue with your school request after signing in.
              </p>

              {error && (
                <div
                  role="alert"
                  className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
                >
                  {error}
                </div>
              )}

              {resendMessage && (
                <div
                  role="status"
                  className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-700"
                >
                  {resendMessage}
                </div>
              )}

              <button
                type="button"
                onClick={() => void handleResendConfirmation()}
                disabled={resending}
                className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-wiser-border bg-white px-4 text-sm font-semibold text-wiser-text transition hover:bg-wiser-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resending ? "Sending..." : "Resend confirmation email"}
              </button>

              <button
                type="button"
                onClick={() => navigate("/login")}
                className="mt-3 flex h-11 w-full items-center justify-center rounded-lg bg-wiser-600 px-4 text-sm font-semibold text-white transition hover:bg-wiser-700"
              >
                Go to sign in
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-wiser-background lg:grid lg:grid-cols-[minmax(0,1fr)_520px]">
      {/* Brand panel */}
      <section className="hidden min-h-screen bg-wiser-900 px-10 py-10 text-white lg:flex lg:items-center lg:justify-center xl:px-16">
        <div className="w-full max-w-xl">
          <div className="inline-flex h-16 w-60 items-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-white/20">
            <img
              src={WiserLogo}
              alt="WISE"
              className="h-auto w-[180px]"
            />
          </div>

          <div className="mt-14 max-w-lg">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-wiser-200">
              School management
            </p>

            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
              Start managing your school smarter.
            </h1>

            <p className="mt-6 max-w-lg text-base leading-7 text-wiser-100">
              Create your WISE account, request school access and bring
              students, teachers, academics and administration together.
            </p>
          </div>
        </div>
      </section>

      {/* Form panel */}
      <main className="flex min-h-screen w-full items-center justify-center px-5 py-8 sm:px-8 lg:px-10">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 lg:hidden">
            <div className="h-14 w-52 overflow-hidden rounded-xl bg-white ring-1 ring-wiser-border">
              <img
                src={WiserLogo}
                alt="WISE"
                className="h-auto w-[170px]"
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-wiser-500">
              WISE account
            </p>

            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-wiser-text">
              Create your account
            </h1>

            <p className="mt-2 text-sm leading-6 text-wiser-text-secondary">
              Create your account first, then request access for your school.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-8 space-y-5"
          >
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
              >
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NameField
                id="signup-first-name"
                label="First name"
                value={firstName}
                onChange={setFirstName}
                placeholder="David"
                autoComplete="given-name"
                disabled={loading}
              />

              <NameField
                id="signup-last-name"
                label="Last name"
                value={lastName}
                onChange={setLastName}
                placeholder="Mbonigaba"
                autoComplete="family-name"
                disabled={loading}
              />
            </div>

            <div>
              <label
                htmlFor="signup-email"
                className="mb-1.5 block text-sm font-medium text-wiser-text-secondary"
              >
                Email
              </label>

              <div className="relative">
                <Mail
                  size={17}
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-wiser-text-muted"
                />

                <input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@school.com"
                  autoComplete="email"
                  required
                  disabled={loading}
                  className="h-11 w-full rounded-lg border border-wiser-border bg-white pl-10 pr-4 text-sm text-wiser-text outline-none transition placeholder:text-slate-400 focus:border-wiser-500 focus:ring-2 focus:ring-wiser-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </div>
            </div>

            <PasswordField
              id="signup-password"
              label="Password"
              value={password}
              onChange={setPassword}
              placeholder="At least 6 characters"
              autoComplete="new-password"
              visible={showPassword}
              onToggle={() => setShowPassword((value) => !value)}
              disabled={loading}
            />

            <PasswordField
              id="signup-confirm-password"
              label="Confirm password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="Re-enter your password"
              autoComplete="new-password"
              visible={showConfirmPassword}
              onToggle={() =>
                setShowConfirmPassword((value) => !value)
              }
              disabled={loading}
            />

            <div className="rounded-xl border border-wiser-border bg-wiser-50/60 px-4 py-4">
              <p className="text-xs font-semibold text-wiser-text">
                What happens next?
              </p>

              <div className="mt-3 space-y-2">
                <Step number="1" text="Create your WISE account." />
                <Step number="2" text="Confirm your email address." />
                <Step number="3" text="Submit your school information." />
                <Step
                  number="4"
                  text="WISE reviews and activates your school workspace."
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center rounded-lg bg-wiser-600 px-4 text-sm font-semibold text-white transition hover:bg-wiser-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wiser-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-wiser-text-secondary">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-medium text-wiser-600 transition hover:text-wiser-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wiser-500 focus-visible:ring-offset-2"
            >
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

function NameField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
  disabled: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-wiser-text-secondary"
      >
        {label}
      </label>

      <div className="relative">
        <User
          size={16}
          aria-hidden="true"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-wiser-text-muted"
        />

        <input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
          disabled={disabled}
          className="h-11 w-full rounded-lg border border-wiser-border bg-white pl-10 pr-3 text-sm text-wiser-text outline-none transition placeholder:text-slate-400 focus:border-wiser-500 focus:ring-2 focus:ring-wiser-100 disabled:cursor-not-allowed disabled:bg-slate-50"
        />
      </div>
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  visible,
  onToggle,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
  visible: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-wiser-text-secondary"
      >
        {label}
      </label>

      <div className="relative">
        <LockKeyhole
          size={17}
          aria-hidden="true"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-wiser-text-muted"
        />

        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          minLength={6}
          required
          disabled={disabled}
          className="h-11 w-full rounded-lg border border-wiser-border bg-white pl-10 pr-11 text-sm text-wiser-text outline-none transition placeholder:text-slate-400 focus:border-wiser-500 focus:ring-2 focus:ring-wiser-100 disabled:cursor-not-allowed disabled:bg-slate-50"
        />

        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
          className="absolute right-2.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-wiser-text-muted transition hover:bg-wiser-50 hover:text-wiser-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wiser-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed"
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </div>
  );
}

function Step({
  number,
  text,
}: {
  number: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-wiser-600 ring-1 ring-wiser-border">
        {number}
      </div>

      <p className="text-xs leading-5 text-wiser-text-secondary">
        {text}
      </p>
    </div>
  );
}

function getSignUpErrorMessage(message: string) {
  const normalized = message.toLowerCase();

  if (
    normalized.includes("user already registered") ||
    normalized.includes("already registered")
  ) {
    return "An account already exists with this email address. Please sign in instead.";
  }

  if (normalized.includes("password")) {
    return message;
  }

  return message || "Unable to create your account. Please try again.";
}