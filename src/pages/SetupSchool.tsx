import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Building2 } from "lucide-react";

import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { useSchool } from "../context/SchoolContext";

export default function SetupSchool() {
  const navigate = useNavigate();

  const { user } = useAuth();
  const { refreshSchool } = useSchool();

  const [schoolName, setSchoolName] =
    useState("");

  const [schoolType, setSchoolType] =
    useState("School");

  const [phone, setPhone] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [address, setAddress] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!user) {
      setError(
        "You must be logged in to create a school.",
      );
      return;
    }

    if (!schoolName.trim()) {
      setError("School name is required.");
      return;
    }

    setLoading(true);
    setError("");

    const {
      data: school,
      error: schoolError,
    } = await supabase
      .from("schools")
      .insert({
        name: schoolName.trim(),
        type: schoolType,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
      })
      .select()
      .single();

    if (schoolError) {
      setError(
        schoolError.message ||
          "Failed to create school.",
      );

      setLoading(false);
      return;
    }

    if (!school) {
      setError(
        "School was not created. Please try again.",
      );

      setLoading(false);
      return;
    }

    await refreshSchool();

    setLoading(false);

    navigate("/", {
      replace: true,
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Header */}
          <div className="border-b border-slate-200 px-6 py-6 sm:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Building2 size={22} />
              </div>

              <div>
                <h1 className="text-lg font-semibold text-slate-900">
                  Set up your school
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                  Add your school information to get
                  started.
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form
            onSubmit={handleSubmit}
            className="space-y-5 px-6 py-6 sm:px-8"
          >
            {error && (
              <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                <p className="text-sm text-red-600">
                  {error}
                </p>
              </div>
            )}

            {/* School name */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                School name
              </label>

              <input
                type="text"
                value={schoolName}
                onChange={(event) =>
                  setSchoolName(
                    event.target.value,
                  )
                }
                placeholder="e.g. High Gate International Academy"
                className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                disabled={loading}
              />
            </div>

            {/* School type */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                School type
              </label>

              <select
                value={schoolType}
                onChange={(event) =>
                  setSchoolType(
                    event.target.value,
                  )
                }
                className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                disabled={loading}
              >
                <option value="School">
                  School
                </option>

                <option value="Primary School">
                  Primary School
                </option>

                <option value="Secondary School">
                  Secondary School
                </option>

                <option value="Primary & Secondary">
                  Primary & Secondary
                </option>

                <option value="International School">
                  International School
                </option>

                <option value="Other">
                  Other
                </option>
              </select>
            </div>

            {/* Phone */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Phone number
              </label>

              <input
                type="tel"
                value={phone}
                onChange={(event) =>
                  setPhone(
                    event.target.value,
                  )
                }
                placeholder="+250 7XX XXX XXX"
                className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                disabled={loading}
              />
            </div>

            {/* Email */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                School email
              </label>

              <input
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value,
                  )
                }
                placeholder="info@school.com"
                className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                disabled={loading}
              />
            </div>

            {/* Address */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Address
              </label>

              <textarea
                value={address}
                onChange={(event) =>
                  setAddress(
                    event.target.value,
                  )
                }
                rows={3}
                placeholder="School address"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                disabled={loading}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="flex h-11 w-full items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Creating school..."
                : "Create school"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}