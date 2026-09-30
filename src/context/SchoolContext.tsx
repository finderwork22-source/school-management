import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { getMySchoolMembership } from "../lib/auth";
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
        "Failed to resolve authenticated school membership:",
        membershipError,
      );
      setSchool(null);
      setMembership(null);
      setError(membershipError.message);
      setLoading(false);
      return;
    }

    if (!resolvedMembership) {
      setSchool(null);
      setMembership(null);
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
    setLoading(false);
  }

  useEffect(() => {
    if (authLoading) return;

    void loadSchool();
  }, [user?.id, authLoading]);

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
