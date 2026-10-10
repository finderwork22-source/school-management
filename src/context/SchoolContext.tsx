import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { getMySchoolMembership } from "../lib/auth";
import { supabase } from "../lib/supabase";
import type { SchoolMembershipResult } from "../lib/auth";
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
  ownership_type?: string | null;
  curriculum: string;
  sections?: Array<{
    key: string;
    name: string;
    enabled: boolean;
    display_order: number;
  }>;
  enabled_modules: Record<string, boolean>;
  academic_settings: Record<string, unknown>;
  ai_settings: {
    enabled: boolean;
    allowed_roles: string[];
    allow_finance_insights: boolean;
    allow_student_insights: boolean;
    allow_teacher_insights: boolean;
    allow_academic_insights: boolean;
    allow_timetable_insights: boolean;
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

    const {
      membership: resolvedMembership,
      error: membershipError,
    } = await getMySchoolMembership();

    if (membershipError) {
      console.error(
        "Failed to resolve authenticated school membership:",
        membershipError,
      );
      setSchool(null);
      setMembership(null);
      setConfiguration(null);
      setError(membershipError.message);
      setLoading(false);
      return;
    }

    if (!resolvedMembership) {
      setSchool(null);
      setMembership(null);
      setConfiguration(null);
      setLoading(false);
      return;
    }

    // getMySchoolMembership uses the same SchoolMembershipResult shape for
    // parents and staff. Keep the context contract unchanged for the rest of
    // the application.
    const typedMembership =
      resolvedMembership as SchoolMembershipResult;

    setMembership({
      id: typedMembership.id,
      school_id: typedMembership.school_id,
      role: typedMembership.role,
      school: typedMembership.school,
    });

    setSchool(typedMembership.school);

    const {
      data: configurationData,
      error: configurationError,
    } = await supabase
      .from("school_configurations")
      .select(
        `
          school_id,
          school_type,
          ownership_type,
          curriculum,
          sections,
          enabled_modules,
          academic_settings,
          ai_settings,
          branding
        `,
      )
      .eq("school_id", typedMembership.school_id)
      .maybeSingle();

    if (configurationError) {
      console.error(
        "Failed to load school configuration:",
        configurationError,
      );

      // Keep the school workspace usable if an older/provisioning school
      // does not yet have a configuration row. A provisioned school is
      // expected to have one, and the platform admin can create it.
      setConfiguration(null);
      setError(configurationError.message);
    } else {
      setConfiguration(
        (configurationData as SchoolConfiguration | null) ?? null,
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    if (authLoading) return;

    void loadSchool();
  }, [user?.id, authLoading]);

  // Keep module permissions fresh when a platform administrator changes a
  // school's configuration in another browser session. Realtime is the fast
  // path; focus refresh and polling are fallbacks if realtime is unavailable.
  useEffect(() => {
    const schoolId = school?.id;
    if (!schoolId) return;

    let active = true;

    async function refreshConfiguration() {
      const { data, error: configurationError } = await supabase
        .from("school_configurations")
        .select(
          `
            school_id,
            school_type,
            ownership_type,
            curriculum,
            sections,
            enabled_modules,
            academic_settings,
            ai_settings,
            branding
          `,
        )
        .eq("school_id", schoolId)
        .maybeSingle();

      if (!active) return;

      if (configurationError) {
        // Keep the last successfully loaded permissions during transient
        // errors instead of briefly re-enabling every module.
        console.error("Failed to refresh school configuration:", configurationError);
        return;
      }

      setConfiguration((data as SchoolConfiguration | null) ?? null);
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshConfiguration();
      }
    };

    const channel = supabase
      .channel(`school-configuration-${schoolId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "school_configurations",
          filter: `school_id=eq.${schoolId}`,
        },
        () => void refreshConfiguration(),
      )
      .subscribe();

    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const intervalId = window.setInterval(refreshWhenVisible, 60_000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      void supabase.removeChannel(channel);
    };
  }, [school?.id]);

  function isModuleEnabled(moduleKey: string) {
    if (!configuration) {
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
