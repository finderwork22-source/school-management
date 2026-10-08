import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

export interface School {
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

export interface SchoolMembership {
  id: string;
  school_id: string;
  role: string;
  school: School;
}

export interface SchoolConfiguration {
  school_id: string;
  school_type: string;
  curriculum: string;
  sections: Array<{
    key: string;
    name: string;
    enabled: boolean;
    display_order: number;
  }>;
  enabled_modules: Record<string, boolean>;
  academic_settings: {
    school_days_per_week: number;
    periods_per_day: number;
    lesson_duration_minutes: number;
    break_duration_minutes: number;
    grading_system: string;
    week_starts_on: string;
  };
  ai_settings: {
    enabled: boolean;
    allowed_roles: string[];
    allow_academic_insights: boolean;
    allow_student_insights: boolean;
    allow_teacher_insights: boolean;
    allow_timetable_insights: boolean;
    allow_finance_insights: boolean;
  };
  branding: {
    logo_url: string | null;
    primary_color: string;
    secondary_color: string;
    portal_name: string | null;
    tagline: string | null;
  };
}

interface SchoolContextValue {
  school: School | null;
  membership: SchoolMembership | null;
  configuration: SchoolConfiguration | null;
  loading: boolean;
  error: string | null;
  refreshSchool: () => Promise<void>;
  isModuleEnabled: (moduleKey: string) => boolean;
}

const SchoolContext =
  createContext<SchoolContextValue | undefined>(undefined);

export function SchoolProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();

  const [school, setSchool] = useState<School | null>(null);
  const [membership, setMembership] =
    useState<SchoolMembership | null>(null);

  const [configuration, setConfiguration] =
    useState<SchoolConfiguration | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadSchool() {
    if (!user) {
      setSchool(null);
      setMembership(null);
      setConfiguration(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: queryError } = await supabase
      .from("school_members")
      .select(
        `
          id,
          school_id,
          role,
          schools (
            id,
            name,
            slug,
            email,
            phone,
            address,
            city,
            country,
            logo_url
          )
        `,
      )
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (queryError) {
      console.error("Failed to load school:", queryError);
      setError(queryError.message);
      setSchool(null);
      setMembership(null);
      setConfiguration(null);
      setLoading(false);
      return;
    }

    if (!data) {
      setSchool(null);
      setMembership(null);
      setConfiguration(null);
      setLoading(false);
      return;
    }

    const schoolData = data.schools as unknown as School;

    setMembership({
      id: data.id,
      school_id: data.school_id,
      role: data.role,
      school: schoolData,
    });

    setSchool(schoolData);

    const {
      data: configurationData,
      error: configurationError,
    } = await supabase
      .from("school_configurations")
      .select(
        `
          school_id,
          school_type,
          curriculum,
          sections,
          enabled_modules,
          academic_settings,
          ai_settings,
          branding
        `,
      )
      .eq("school_id", data.school_id)
      .maybeSingle();

    if (configurationError) {
      console.error(
        "Failed to load school configuration:",
        configurationError,
      );

      setConfiguration(null);
      setError(configurationError.message);
    } else {
      setConfiguration(
        configurationData as SchoolConfiguration | null,
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    if (authLoading) return;

    loadSchool();
  }, [user, authLoading]);

  function isModuleEnabled(moduleKey: string) {
    if (!configuration) {
      // Preserve the existing application behaviour while configuration
      // is unavailable. Every provisioned school should have a
      // school_configurations row.
      return true;
    }

    return configuration.enabled_modules?.[moduleKey] !== false;
  }

  return (
    <SchoolContext.Provider
      value={{
        school,
        membership,
        configuration,
        loading: authLoading || loading,
        error,
        refreshSchool: loadSchool,
        isModuleEnabled,
      }}
    >
      {children}
    </SchoolContext.Provider>
  );
}

export function useSchool() {
  const context = useContext(SchoolContext);

  if (!context) {
    throw new Error(
      "useSchool must be used inside SchoolProvider",
    );
  }

  return context;
}