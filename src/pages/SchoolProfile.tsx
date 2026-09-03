import { useEffect, useRef, useState } from "react";
import {
  Building2,
  Globe,
  Image as ImageIcon,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  Upload,
} from "lucide-react";

import { useSchool } from "../context/SchoolContext";
import { supabase } from "../lib/supabase";

interface SchoolProfileData {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  logo_url: string | null;
}

export default function SchoolProfile() {
  const { school } = useSchool();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState<SchoolProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!school?.id) {
      setLoading(false);
      return;
    }

    loadSchool();
  }, [school?.id]);

  const loadSchool = async () => {
    if (!school?.id) return;

    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("schools")
      .select(
        `
          id,
          name,
          slug,
          email,
          phone,
          address,
          city,
          country,
          logo_url
        `,
      )
      .eq("id", school.id)
      .single();

    if (error) {
      console.error("Failed to load school profile:", error);
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    setForm(data);
    setLoading(false);
  };

  const updateField = (
    field: keyof SchoolProfileData,
    value: string,
  ) => {
    if (!form) return;

    setForm({
      ...form,
      [field]: value,
    });
  };

  const handleSave = async () => {
    if (!form) return;

    setSaving(true);
    setSuccessMessage("");
    setErrorMessage("");

    const { error } = await supabase
      .from("schools")
      .update({
        name: form.name.trim(),
        email: form.email?.trim() || null,
        phone: form.phone?.trim() || null,
        address: form.address?.trim() || null,
        city: form.city?.trim() || null,
        country: form.country?.trim() || null,
        logo_url: form.logo_url || null,
      })
      .eq("id", form.id);

    if (error) {
      console.error("Failed to update school profile:", error);
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    setSuccessMessage("School profile updated successfully.");
    setSaving(false);

    setTimeout(() => {
      setSuccessMessage("");
    }, 4000);
  };

  const handleLogoClick = () => {
    fileInputRef.current?.click();
  };

  const handleLogoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file || !form) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Logo must be smaller than 5 MB.");
      return;
    }

    setUploadingLogo(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "png";

      const filePath = `${form.id}/logo-${Date.now()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("school-logos")
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage
        .from("school-logos")
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("schools")
        .update({
          logo_url: publicUrl,
        })
        .eq("id", form.id);

      if (updateError) {
        throw updateError;
      }

      setForm({
        ...form,
        logo_url: publicUrl,
      });

      setSuccessMessage("School logo updated successfully.");

      setTimeout(() => {
        setSuccessMessage("");
      }, 4000);
    } catch (error: any) {
      console.error("Failed to upload logo:", error);
      setErrorMessage(
        error?.message || "Failed to upload school logo.",
      );
    } finally {
      setUploadingLogo(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading school profile...
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {errorMessage || "Unable to load school profile."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Building2 className="h-4 w-4" />
          Settings
        </div>

        <div className="mt-1">
          <h1 className="text-2xl font-semibold text-slate-900">
            School Profile
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Manage your school's basic information and branding.
          </p>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Main information */}
        <div className="xl:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-base font-semibold text-slate-900">
                School Information
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                This information will be used throughout SchoolOS.
              </p>
            </div>

            <div className="space-y-6 p-6">
              {/* School name */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  School Name
                </label>

                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) =>
                      updateField("name", e.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                    placeholder="School name"
                  />
                </div>
              </div>

              {/* Slug */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  School Slug
                </label>

                <input
                  type="text"
                  value={form.slug}
                  disabled
                  className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-500"
                />

                <p className="mt-1.5 text-xs text-slate-400">
                  The school slug is managed by the system and cannot
                  be changed here.
                </p>
              </div>

              {/* Email + Phone */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Email
                  </label>

                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <input
                      type="email"
                      value={form.email || ""}
                      onChange={(e) =>
                        updateField("email", e.target.value)
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                      placeholder="school@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Phone
                  </label>

                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <input
                      type="tel"
                      value={form.phone || ""}
                      onChange={(e) =>
                        updateField("phone", e.target.value)
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                      placeholder="+250..."
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Address
                </label>

                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />

                  <textarea
                    value={form.address || ""}
                    onChange={(e) =>
                      updateField("address", e.target.value)
                    }
                    rows={3}
                    className="w-full resize-none rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                    placeholder="School physical address"
                  />
                </div>
              </div>

              {/* City + Country */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    City
                  </label>

                  <input
                    type="text"
                    value={form.city || ""}
                    onChange={(e) =>
                      updateField("city", e.target.value)
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                    placeholder="Kigali"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Country
                  </label>

                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                    <input
                      type="text"
                      value={form.country || ""}
                      onChange={(e) =>
                        updateField("country", e.target.value)
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-100"
                      placeholder="Rwanda"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || uploadingLogo}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}

                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>

        {/* Branding */}
        <div>
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-base font-semibold text-slate-900">
                School Branding
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Upload the logo used across SchoolOS.
              </p>
            </div>

            <div className="p-6">
              <div className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6">
                {form.logo_url ? (
                  <div className="flex w-full flex-col items-center gap-5">
                    <div className="flex h-40 w-full items-center justify-center rounded-lg bg-white p-4 shadow-sm">
                      <img
                        src={form.logo_url}
                        alt={form.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleLogoClick}
                      disabled={uploadingLogo}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                    >
                      {uploadingLogo ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}

                      {uploadingLogo
                        ? "Uploading..."
                        : "Change Logo"}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-white shadow-sm">
                      <ImageIcon className="h-7 w-7 text-slate-400" />
                    </div>

                    <p className="text-sm font-medium text-slate-700">
                      No school logo
                    </p>

                    <p className="mt-1 text-center text-xs text-slate-400">
                      PNG, JPG or WEBP up to 5 MB
                    </p>

                    <button
                      type="button"
                      onClick={handleLogoClick}
                      disabled={uploadingLogo}
                      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
                    >
                      {uploadingLogo ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}

                      {uploadingLogo
                        ? "Uploading..."
                        : "Upload Logo"}
                    </button>
                  </>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </div>

              <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-xs font-medium text-slate-700">
                  Recommended
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Use a high-quality PNG with a transparent background
                  for the best results on reports, receipts and
                  printed documents.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}