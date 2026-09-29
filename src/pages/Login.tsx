import { useState } from "react";
import type { FormEvent } from "react";
import { LockKeyhole, Mail, Eye, EyeOff } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";

import WiserLogo from "../assets/wiser-logo-cropped.png";

import { signIn, getMySchoolMembership } from "../lib/auth";
import { isPlatformAdmin } from "../lib/platformAuth";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    setError("");
    setLoading(true);

    const { error: signInError } = await signIn(email, password);

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    // WISE Admin is a platform-level identity and must be checked before
    // school membership so an admin is never sent to /setup-school.
    const { isAdmin, error: adminError } = await isPlatformAdmin();

    if (adminError) {
      console.error("WISE Admin access check failed:", adminError);
      setError(
        "Your account was signed in, but WISE Admin access could not be verified. Please try again.",
      );
      setLoading(false);
      return;
    }

    if (isAdmin) {
      navigate("/admin");
      return;
    }

    const {
      membership,
      error: membershipError,
    } = await getMySchoolMembership();

    if (membershipError) {
      setError(membershipError.message);
      setLoading(false);
      return;
    }

    if (!membership) {
      navigate("/setup-school");
    } else {
      navigate("/");
    }
  }

  return (
    <div className="min-h-screen bg-wiser-background lg:grid lg:grid-cols-[minmax(0,1fr)_520px]">
      {/* Brand panel */}
      <section className="hidden min-h-screen bg-wiser-900 px-10 py-10 text-white lg:flex lg:items-center lg:justify-center xl:px-16">
        <div className="w-full max-w-xl">
          <div className="inline-flex h-16 w-60 items-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-white/20">
            <img
              src={WiserLogo}
              alt="Wiser"
              className="h-auto w-[180px]"
            />
          </div>

          <div className="mt-14 max-w-lg">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-wiser-200">
              School management
            </p>
            <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
              Everything your school needs, in one place.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-wiser-100">
              Manage students, academics, attendance, communication and school
              operations from one platform.
            </p>
          </div>
        </div>
      </section>

      {/* Form panel */}
      <main className="flex min-h-screen w-full items-center justify-center px-5 py-8 sm:px-8 lg:px-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="h-14 w-52 overflow-hidden rounded-xl bg-white ring-1 ring-wiser-border">
              <img
                src={WiserLogo}
                alt="Wiser"
                className="h-auto w-[170px]"
              />
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-wiser-text">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-wiser-text-secondary">
              Sign in to your WISE account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
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
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@school.com"
                  autoComplete="email"
                  required
                  className="h-11 w-full rounded-lg border border-wiser-border bg-white pl-10 pr-4 text-sm text-wiser-text outline-none transition placeholder:text-slate-400 focus:border-wiser-500 focus:ring-2 focus:ring-wiser-100"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-wiser-text-secondary"
              >
                Password
              </label>

              <div className="relative">
                <LockKeyhole
                  size={17}
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-wiser-text-muted"
                />

                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className="h-11 w-full rounded-lg border border-wiser-border bg-white pl-10 pr-11 text-sm text-wiser-text outline-none transition placeholder:text-slate-400 focus:border-wiser-500 focus:ring-2 focus:ring-wiser-100"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-wiser-text-muted transition hover:bg-wiser-50 hover:text-wiser-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wiser-500 focus-visible:ring-offset-1"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center rounded-lg bg-wiser-600 text-sm font-semibold text-white transition hover:bg-wiser-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wiser-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>

            <p className="pt-1 text-center text-sm text-wiser-text-secondary">
              Don't have an account?{" "}
              <Link
                to="/signup"
                className="font-medium text-wiser-600 transition hover:text-wiser-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wiser-500 focus-visible:ring-offset-2"
              >
                Create an account
              </Link>
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
