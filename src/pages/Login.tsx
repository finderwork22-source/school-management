import { useState } from "react";
import type { FormEvent } from "react";
import { LockKeyhole, Mail, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";

import {
  signIn,
  getMySchoolMembership,
} from "../lib/auth";

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

    const { error } = await signIn(email, password);

if (error) {
  setError(error.message);
  setLoading(false);
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
    <div className="flex min-h-screen bg-slate-50">
      <div className="hidden flex-1 items-center justify-center bg-indigo-600 p-12 lg:flex">
        <div className="max-w-md text-white">
          <div className="text-2xl font-bold">
            School<span className="text-indigo-200">OS</span>
          </div>

          <h1 className="mt-10 text-4xl font-semibold leading-tight">
            Everything your school needs, in one place.
          </h1>

          <p className="mt-5 text-base leading-7 text-indigo-100">
            Manage students, academics, attendance, communication and school
            operations from one platform.
          </p>
        </div>
      </div>

      <div className="flex w-full items-center justify-center p-6 lg:w-[520px]">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="text-xl font-bold text-slate-900">
              School<span className="text-indigo-600">OS</span>
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Welcome back
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Sign in to your school account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Email
              </label>

              <div className="relative">
                <Mail
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@school.com"
                  required
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Password
              </label>

              <div className="relative">
                <LockKeyhole
                  size={17}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  required
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-11 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center rounded-lg bg-indigo-600 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
            <p className="mt-6 text-center text-sm text-slate-500">
              Don't have an account?{" "}
              <Link
                to="/signup"
                className="font-medium text-indigo-600 hover:text-indigo-700"
              >
                Create an account
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
