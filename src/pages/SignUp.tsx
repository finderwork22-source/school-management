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
    <div className="flex min-h-screen bg-slate-50">
      <div className="hidden flex-1 items-center justify-center bg-indigo-600 p-12 lg:flex">
        <div className="max-w-md text-white">
          <div className="text-2xl font-bold">
            School<span className="text-indigo-200">OS</span>
          </div>

          <h1 className="mt-10 text-4xl font-semibold leading-tight">
            Start managing your school smarter.
          </h1>

          <p className="mt-5 text-base leading-7 text-indigo-100">
            Create your school workspace and bring students,
            teachers, academics and administration together.
          </p>
        </div>
      </div>

      <div className="flex w-full items-center justify-center p-6 lg:w-[520px]">
        <div className="w-full max-w-sm">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Create your account
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Set up your administrator account to get started.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-8 space-y-5"
          >
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
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
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
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="At least 6 characters"
                  minLength={6}
                  required
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-11 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((value) => !value)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? (
                    <EyeOff size={17} />
                  ) : (
                    <Eye size={17} />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center rounded-lg bg-indigo-600 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-medium text-indigo-600 hover:text-indigo-700"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
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
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>

      <div className="relative">
        <User
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />

        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required={required}
          className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
      </div>
    </div>
  );
}