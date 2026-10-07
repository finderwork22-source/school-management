import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export type SchoolAccess = {
  allowed: boolean;
  has_school: boolean;
  school_id: string | null;
  school_status: string | null;
  reason: string | null;
  is_platform_admin: boolean;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  accessLoading: boolean;
  schoolAccess: SchoolAccess | null;
  accessDeniedReason: string | null;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getAccessMessage(access: SchoolAccess) {
  if (access.reason === "school_suspended") {
    return "Your school account has been suspended. Please contact your school administrator or MojaSchool support for assistance.";
  }

  if (access.reason === "school_archived") {
    return "Your school account has been archived. Please contact your school administrator or MojaSchool support for assistance.";
  }

  if (access.reason === "school_account_missing") {
    return "Your school account could not be verified. Please contact MojaSchool support for assistance.";
  }

  return (
    access.reason ||
    "Your school account is currently unavailable. Please contact your school administrator or MojaSchool support for assistance."
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessLoading, setAccessLoading] = useState(false);
  const [schoolAccess, setSchoolAccess] = useState<SchoolAccess | null>(null);
  const [accessDeniedReason, setAccessDeniedReason] = useState<string | null>(null);
  const accessDeniedReasonRef = useRef<string | null>(null);

  const checkSchoolAccess = useCallback(async (currentSession: Session) => {
    if (!currentSession.user?.id) {
      return true;
    }

    setAccessLoading(true);

    try {
      const { data, error } = await supabase.rpc("get_my_school_access");

      if (error) {
        console.error("School access check failed:", error);

        const message =
          "We could not verify your school access. Please try again.";

        setSchoolAccess(null);
        setAccessDeniedReason(message);

        // Do not leave a session active when access cannot be verified.
        await supabase.auth.signOut();
        return false;
      }

      const access = data as SchoolAccess;

      setSchoolAccess(access);

      if (!access.allowed && access.has_school) {
        const message = getAccessMessage(access);

        setAccessDeniedReason(message);
        accessDeniedReasonRef.current = message;

        // Clear the Supabase session. ProtectedRoute also blocks rendering
        // while this is happening.
        await supabase.auth.signOut();

        return false;
      }

      setAccessDeniedReason(null);
      accessDeniedReasonRef.current = null;
      return true;
    } catch (error) {
      console.error("Unexpected school access check error:", error);

      const message =
        "We could not verify your school access. Please try again.";

      setSchoolAccess(null);
      setAccessDeniedReason(message);
      accessDeniedReasonRef.current = message;

      await supabase.auth.signOut();
      return false;
    } finally {
      setAccessLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const {
        data: { session: currentSession },
        error,
      } = await supabase.auth.getSession();

      if (!mounted) return;

      if (error) {
        console.error("Error loading session:", error);
      }

      setSession(currentSession);
      setLoading(false);

    }

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;

      setSession(nextSession);
      setSchoolAccess(null);

      // Preserve a denial message caused by a suspended school after the
      // forced sign-out. Clear it for a normal authenticated session.
      if (nextSession) {
        setAccessDeniedReason(null);
        accessDeniedReasonRef.current = null;
      } else {
        setAccessDeniedReason(accessDeniedReasonRef.current);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [checkSchoolAccess]);

  // Check every time a valid session is established.
  useEffect(() => {
    if (!session) return;

    void checkSchoolAccess(session);
  }, [session?.user?.id, checkSchoolAccess]);

  // Re-check periodically so a currently logged-in user is removed
  // shortly after the Super Admin suspends their school.
  useEffect(() => {
    if (!session?.user?.id) return;

    const interval = window.setInterval(() => {
      void checkSchoolAccess(session);
    }, 30_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkSchoolAccess(session);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [session, checkSchoolAccess]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        accessLoading,
        schoolAccess,
        accessDeniedReason,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }

  return context;
}
