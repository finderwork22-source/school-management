import { useState } from "react";
import type { FormEvent } from "react";
import { Eye, EyeOff, LockKeyhole, Mail, User } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";


import { signUp } from "../lib/auth";

export default function SignUp() {
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    setError("");
    setLoading(true);

    const { data, error } = await signUp({
      email,
      password,
      firstName,
      lastName,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (!data.user) {
      setError("Unable to create your account.");
      setLoading(false);
      return;
    }

    /*
     * If email confirmation is enabled in Supabase,
     * the user may not have an active session yet.
     */
    if (!data.session) {
      navigate("/login?registered=true");
      return;
    }

    navigate("/setup-school");
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
              />

              <Field
                label="Last name"
                value={lastName}
                onChange={setLastName}
                placeholder="Mbonigaba"
                required
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
                  className="h-11 w-full rounded-lg border border-MojaSchoolr-border bg-white pl-10 pr-4 text-sm text-MojaSchoolr-text outline-none transition placeholder:text-slate-400 focus:border-MojaSchoolr-500 focus:ring-2 focus:ring-MojaSchoolr-100"
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
                  className="h-11 w-full rounded-lg border border-MojaSchoolr-border bg-white pl-10 pr-11 text-sm text-MojaSchoolr-text outline-none transition placeholder:text-slate-400 focus:border-MojaSchoolr-500 focus:ring-2 focus:ring-MojaSchoolr-100"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-MojaSchoolr-text-muted transition hover:bg-MojaSchoolr-50 hover:text-MojaSchoolr-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-MojaSchoolr-500 focus-visible:ring-offset-1"
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

          <p className="pt-1 mt-6 text-center text-sm text-MojaSchoolr-text-secondary">
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
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
          className="h-11 w-full rounded-lg border border-MojaSchoolr-border bg-white pl-10 pr-3 text-sm text-MojaSchoolr-text outline-none transition placeholder:text-slate-400 focus:border-MojaSchoolr-500 focus:ring-2 focus:ring-MojaSchoolr-100"
        />
      </div>
    </div>
  );
}
