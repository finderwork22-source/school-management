import { supabase } from "./supabase";

export interface SchoolApplication {
  id: string;
  requested_by_user_id: string;
  school_name: string;
  school_type: string | null;
  school_email: string | null;
  school_phone: string | null;
  country: string;
  city: string;
  address: string | null;
  website: string | null;
  applicant_first_name: string;
  applicant_last_name: string;
  applicant_email: string;
  applicant_phone: string | null;
  requested_role: string | null;
  assigned_role: string | null;
  status:
    | "pending"
    | "under_review"
    | "approved"
    | "rejected"
    | "cancelled";
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  school_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function submitSchoolApplication({
  schoolName,
  schoolType,
  schoolEmail,
  schoolPhone,
  country,
  city,
  address,
  website,
  requestedRole,
}: {
  schoolName: string;
  schoolType?: string;
  schoolEmail?: string;
  schoolPhone?: string;
  country: string;
  city: string;
  address?: string;
  website?: string;
  requestedRole?: string | null;
}) {
  const { data, error } = await supabase.rpc(
    "submit_school_application",
    {
      p_school_name: schoolName.trim(),
      p_school_type: schoolType?.trim() || "School",
      p_school_email: schoolEmail?.trim() || null,
      p_school_phone: schoolPhone?.trim() || null,
      p_country: country.trim(),
      p_city: city.trim(),
      p_address: address?.trim() || null,
      p_website: website?.trim() || null,
      p_requested_role: requestedRole || null,
    },
  );

  return {
    data: (data as SchoolApplication | null) ?? null,
    error,
  };
}

export async function getMySchoolApplication() {
  const { data, error } = await supabase.rpc(
    "get_my_school_application",
  );

  return {
    data: (data as SchoolApplication | null) ?? null,
    error,
  };
}
