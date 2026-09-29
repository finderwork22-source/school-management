import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { getMySchoolMembership } from "../lib/auth";
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
        "Failed to resolve school membership:",
        membershipError,
      );

      setError(membershipError.message);
      setSchool(null);
      setMembership(null);
      setLoading(false);
      return;
    }

    if (!resolvedMembership) {
      setSchool(null);
      setMembership(null);
      setLoading(false);
      return;
    }

    const schoolData = resolvedMembership.school as School;

    setMembership({
      id: resolvedMembership.id,
      school_id: resolvedMembership.school_id,
      role: resolvedMembership.role,
      school: schoolData,
    });

    setSchool(schoolData);
    setLoading(false);
  }

  useEffect(() => {
    if (authLoading) {
      return;
    }

    void loadSchool();
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
