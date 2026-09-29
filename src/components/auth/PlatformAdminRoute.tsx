import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { supabase } from "../../lib/supabase";
import { isPlatformAdmin } from "../../lib/platformAuth";

interface PlatformAdminRouteProps {
  children: ReactNode;
}

export default function PlatformAdminRoute({
  children,
}: PlatformAdminRouteProps) {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function checkAccess() {
      setChecking(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (userError) {
        setAuthenticated(false);
        setAllowed(false);
        setError(userError.message);
        setChecking(false);
        return;
      }

      if (!user) {
        setAuthenticated(false);
        setAllowed(false);
        setChecking(false);
        return;
      }

      setAuthenticated(true);

      const { isAdmin, error: adminError } = await isPlatformAdmin();

      if (!mounted) return;

      if (adminError) {
        setAllowed(false);
        setError(
          "We could not verify your WISE Admin access. Please try again.",
        );
        setChecking(false);
        return;
      }

      setAllowed(isAdmin);
      setChecking(false);
    }

    void checkAccess();

    return () => {
      mounted = false;
    };
  }, []);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-wiser-background px-6">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-wiser-200 border-t-wiser-600" />
          <p className="mt-4 text-sm text-wiser-text-secondary">
            Verifying WISE Admin access...
          </p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-wiser-background px-6">
        <div className="w-full max-w-md rounded-2xl border border-wiser-border bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-wiser-text">
            WISE Admin access required
          </h1>

          <p className="mt-2 text-sm leading-6 text-wiser-text-secondary">
            {error ||
              "This account is not registered as an active WISE platform administrator."}
          </p>

          <a
            href="/"
            className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-wiser-600 px-4 text-sm font-semibold text-white transition hover:bg-wiser-700"
          >
            Return to school dashboard
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}