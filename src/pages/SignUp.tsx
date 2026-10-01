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

import { signUp } from "../lib/auth";
import { supabase } from "../lib/supabase";

export default function SignUp() {
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setResendMessage("");
    setLoading(true);

    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedFirstName) {
      setError("Please enter your first name.");
      setLoading(false);
      return;
    }

    if (!normalizedLastName) {
      setError("Please enter your last name.");
      setLoading(false);
      return;
    }

    if (!normalizedEmail) {
      setError("Please enter your email address.");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Your password must contain at least 6 characters.");
      setLoading(false);
      return;
    }

    const { data, error: signUpError } = await signUp({
      email: normalizedEmail,
      password,
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (!data.user) {
      setError("Unable to create your account.");
      setLoading(false);
      return;
    }

    /*
     * When email confirmation is enabled in Supabase, there is no active
     * session after signup. Keep the user on this page and show a dedicated
     * confirmation state instead of sending them to login immediately.
     */
    if (!data.session) {
      setEmail(normalizedEmail);
      setConfirmationSent(true);
      setLoading(false);
      return;
    }

    /*
     * When email confirmation is disabled, Supabase returns a live session
     * and the user can continue directly to school setup.
     */
    setLoading(false);
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
        emailRedirectTo: `${window.location.origin}/email-confirmed.html`,
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
      <div className="min-h-screen bg-MojaSchoolr-background lg:grid lg:grid-cols-[minmax(0,1fr)_520px]">
        {/* Brand panel */}
        <section className="hidden min-h-screen bg-MojaSchoolr-900 px-10 py-10 text-white lg:flex lg:items-center lg:justify-center xl:px-16">
          <div className="w-full max-w-xl">
            <img
              src="/MojaSchool-white.svg"
              alt="MojaSchool"
              className="h-auto w-[180px]"
            />

            <div className="mt-8 max-w-lg">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-MojaSchoolr-200">
                School management
              </p>

              <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
                Start managing your school smarter.
              </h1>

              <p className="mt-6 max-w-lg text-base leading-7 text-MojaSchoolr-100">
                Create your MojaSchool workspace and bring students, teachers,
                academics and administration together in one place.
              </p>
            </div>
          </div>
        </section>

        {/* Confirmation panel */}
        <main className="flex min-h-screen w-full items-center justify-center px-5 py-8 sm:px-8 lg:px-10">
          <div className="w-full max-w-sm">
            <div className="mb-8 lg:hidden">
              <img
                src="/MojaSchool-white.svg"
                alt="MojaSchool"
                className="h-auto w-[180px]"
              />
            </div>

            <div className="rounded-2xl border border-MojaSchoolr-border bg-white p-6 shadow-sm sm:p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={24} aria-hidden="true" />
              </div>

              <h1 className="mt-6 text-2xl font-semibold tracking-tight text-MojaSchoolr-text">
                Check your email
              </h1>

              <p className="mt-3 text-sm leading-6 text-MojaSchoolr-text-secondary">
                Your MojaSchool account has been created. We sent a confirmation link to:
              </p>

              <p className="mt-2 break-all rounded-lg bg-MojaSchoolr-50 px-3 py-2 text-sm font-semibold text-MojaSchoolr-700">
                {email.trim().toLowerCase()}
              </p>

              <p className="mt-4 text-sm leading-6 text-MojaSchoolr-text-secondary">
                Open the email and click the confirmation link. Once your email
                is confirmed, return here and sign in to continue with your
                school setup.
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
                className="mt-6 flex h-11 w-full items-center justify-center rounded-lg border border-MojaSchoolr-border bg-white px-4 text-sm font-semibold text-MojaSchoolr-700 transition hover:bg-MojaSchoolr-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-MojaSchoolr-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resending ? "Resending..." : "Resend confirmation email"}
              </button>

              <button
                type="button"
                onClick={() => navigate("/login", { replace: true })}
                className="mt-3 flex h-11 w-full items-center justify-center rounded-lg bg-MojaSchoolr-600 px-4 text-sm font-semibold text-white transition hover:bg-MojaSchoolr-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-MojaSchoolr-500 focus-visible:ring-offset-2"
              >
                Go to sign in
              </button>

              <p className="mt-5 text-center text-xs leading-5 text-MojaSchoolr-text-muted">
                Check your spam or junk folder if you do not see the message.
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-MojaSchoolr-background lg:grid lg:grid-cols-[minmax(0,1fr)_520px]">
      {/* Brand panel */}
      <section className="hidden min-h-screen bg-MojaSchoolr-900 px-10 py-10 text-white lg:flex lg:items-center lg:justify-center xl:px-16">
        <div className="w-full max-w-xl">
          <img
            src="/MojaSchool-white.svg"
            alt="MojaSchool"
            className="h-auto w-[180px]"
          />

          <div className="mt-8 max-w-lg">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-MojaSchoolr-200">
              School management
            </p>

            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
              Start managing your school smarter.
            </h1>

            <p className="mt-6 max-w-lg text-base leading-7 text-MojaSchoolr-100">
              Create your MojaSchool workspace and bring students, teachers,
              academics and administration together in one place.
            </p>
          </div>
        </div>
      </section>

      {/* Form panel */}
      <main className="flex min-h-screen w-full items-center justify-center px-5 py-8 sm:px-8 lg:px-10">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 lg:hidden">
            <img
              src="/MojaSchool-white.svg"
              alt="MojaSchool"
              className="h-auto w-[180px]"
            />
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-MojaSchoolr-text">
              Create your MojaSchool account
            </h1>

            <p className="mt-2 text-sm text-MojaSchoolr-text-secondary">
              Set up your administrator account to get started.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field
                label="First name"
                value={firstName}
                onChange={setFirstName}
                placeholder="David"
                required
                disabled={loading}
              />

              <Field
                label="Last name"
                value={lastName}
                onChange={setLastName}
                placeholder="Mbonigaba"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label
                htmlFor="signup-email"
                className="mb-1.5 block text-sm font-medium text-MojaSchoolr-text"
              >
                Email
              </label>

              <div className="relative">
                <Mail
                  size={17}
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-MojaSchoolr-text-muted"
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
                  className="h-11 w-full rounded-lg border border-MojaSchoolr-border bg-white pl-10 pr-4 text-sm text-MojaSchoolr-text outline-none transition placeholder:text-slate-400 focus:border-MojaSchoolr-500 focus:ring-2 focus:ring-MojaSchoolr-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="signup-password"
                className="mb-1.5 block text-sm font-medium text-MojaSchoolr-text"
              >
                Password
              </label>

              <div className="relative">
                <LockKeyhole
                  size={17}
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-MojaSchoolr-text-muted"
                />

                <input
                  id="signup-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  minLength={6}
                  required
                  disabled={loading}
                  className="h-11 w-full rounded-lg border border-MojaSchoolr-border bg-white pl-10 pr-11 text-sm text-MojaSchoolr-text outline-none transition placeholder:text-slate-400 focus:border-MojaSchoolr-500 focus:ring-2 focus:ring-MojaSchoolr-100 disabled:cursor-not-allowed disabled:bg-slate-50"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={loading}
                  className="absolute right-2.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-MojaSchoolr-text-muted transition hover:bg-MojaSchoolr-50 hover:text-MojaSchoolr-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-MojaSchoolr-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center rounded-lg bg-MojaSchoolr-600 text-sm font-semibold text-white transition hover:bg-MojaSchoolr-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-MojaSchoolr-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="mt-6 pt-1 text-center text-sm text-MojaSchoolr-text-secondary">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-medium text-MojaSchoolr-600 transition hover:text-MojaSchoolr-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-MojaSchoolr-500 focus-visible:ring-offset-2"
            >
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-MojaSchoolr-text">
        {label}
      </label>

      <div className="relative">
        <User
          size={16}
          aria-hidden="true"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-MojaSchoolr-text-muted"
        />

        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={label === "First name" ? "given-name" : "family-name"}
          required={required}
          disabled={disabled}
          className="h-11 w-full rounded-lg border border-MojaSchoolr-border bg-white pl-10 pr-3 text-sm text-MojaSchoolr-text outline-none transition placeholder:text-slate-400 focus:border-MojaSchoolr-500 focus:ring-2 focus:ring-MojaSchoolr-100 disabled:cursor-not-allowed disabled:bg-slate-50"
        />
      </div>
    </div>
  );
}
