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

interface SchoolContextValue {
  school: School | null;
  membership: SchoolMembership | null;
  loading: boolean;
  error: string | null;
  refreshSchool: () => Promise<void>;
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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadSchool() {
    if (!user) {
      setSchool(null);
      setMembership(null);
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
      setLoading(false);
      return;
    }

    if (!data) {
      setSchool(null);
      setMembership(null);
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
    setLoading(false);
  }

  useEffect(() => {
    if (authLoading) return;

    loadSchool();
  }, [user, authLoading]);

  return (
    <SchoolContext.Provider
      value={{
        school,
        membership,
        loading: authLoading || loading,
        error,
        refreshSchool: loadSchool,
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