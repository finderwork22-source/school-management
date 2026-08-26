import { useState } from "react";
import type { FormEvent } from "react";
import { Building2, MapPin, Phone, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export default function SetupSchool() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Kigali");
  const [country, setCountry] = useState("Rwanda");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!user) {
      setError("You must be signed in to create a school.");
      return;
    }

    setLoading(true);
    setError("");

    const slug =
      name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") +
      "-" +
      crypto.randomUUID().slice(0, 8);

    const { data: school, error: schoolError } = await supabase.rpc(
      "create_school",
      {
        school_name: name.trim(),
        school_slug: slug,
        school_email: email.trim() || null,
        school_phone: phone.trim() || null,
        school_city: city.trim() || null,
        school_country: country.trim() || null,
      },
    );

    if (schoolError) {
      setError(schoolError.message);
      setLoading(false);
      return;
    }

    if (!school) {
      setError("The school could not be created.");
      setLoading(false);
      return;
    }

    navigate("/");

    if (schoolError) {
      setError(schoolError.message);
      setLoading(false);
      return;
    }

    if (!school) {
    setError("The school could not be created.");
    setLoading(false);
    return;
  }

    navigate("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-xl">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Building2 size={22} />
          </div>

          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">
            Set up your school
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            This information will be used to create your school workspace.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <form onSubmit={handleSubmit}>
            <div className="space-y-5 p-6 sm:p-8">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  School name
                </label>

                <div className="relative">
                  <Building2
                    size={17}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="High Gate International Academy"
                    required
                    className="h-11 w-full rounded-lg border border-slate-200 pl-10 pr-4 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="School email"
                  icon={Mail}
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="info@school.com"
                />

                <Field
                  label="Phone"
                  icon={Phone}
                  value={phone}
                  onChange={setPhone}
                  placeholder="+250..."
                />

                <Field
                  label="City"
                  icon={MapPin}
                  value={city}
                  onChange={setCity}
                  placeholder="Kigali"
                />

                <Field
                  label="Country"
                  icon={MapPin}
                  value={country}
                  onChange={setCountry}
                  placeholder="Rwanda"
                />
              </div>
            </div>

            <div className="border-t border-slate-200 p-6 sm:px-8">
              <button
                type="submit"
                disabled={loading}
                className="flex h-11 w-full items-center justify-center rounded-lg bg-indigo-600 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
              >
                {loading ? "Creating school..." : "Create school"}
              </button>
            </div>
          </form>
        </div>

        <p className="mt-5 text-center text-xs text-slate-400">
          You will become the owner of this school.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  type = "text",
  value,
  onChange,
  placeholder,
}: {
  label: string;
  icon: typeof Mail;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>

      <div className="relative">
        <Icon
          size={17}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />

        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-11 w-full rounded-lg border border-slate-200 pl-10 pr-4 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
      </div>
    </div>
  );
}
