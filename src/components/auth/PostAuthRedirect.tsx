import Dashboard from "../../pages/Dashboard";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { getMySchoolMembership } from "../../lib/auth";
import { useAuth } from "../../context/AuthContext";

export default function PostAuthRedirect() {
  const { user, loading: authLoading } = useAuth();
  const [checkingMembership, setCheckingMembership] = useState(true);
  const [hasSchoolMembership, setHasSchoolMembership] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function resolveDestination() {
      if (authLoading) return;

      if (!user) {
        if (mounted) {
          setCheckingMembership(false);
        }
        return;
      }

      setCheckingMembership(true);
      setError(null);

      const { membership, error: membershipError } =
        await getMySchoolMembership();

      if (!mounted) return;

      if (membershipError) {
        console.error("Unable to resolve school membership:", membershipError);
        setError(
          "We could not verify your school access. Please sign in again or contact the school administrator.",
        );
        setCheckingMembership(false);
        return;
      }

      setHasSchoolMembership(Boolean(membership));
      setCheckingMembership(false);
    }

    void resolveDestination();

    return () => {
      mounted = false;
    };
  }, [authLoading, user?.id]);

  if (authLoading || checkingMembership) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-MojaSchoolr-200 border-t-MojaSchoolr-600" />
          <p className="mt-3 text-sm text-MojaSchoolr-text-secondary">
            Checking your school access...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-MojaSchoolr-text">
            We could not verify your school access
          </h1>
          <p className="mt-2 text-sm leading-6 text-MojaSchoolr-text-secondary">
            {error}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-MojaSchoolr-600 px-4 text-sm font-semibold text-white transition hover:bg-MojaSchoolr-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // A newly confirmed school account has no school membership until the
  // school request is approved. Keep it in onboarding instead of allowing
  // the generic root route to open a role dashboard.
  if (!hasSchoolMembership) {
    return <Navigate to="/setup-school" replace />;
  }

  // Approved/assigned school users continue to the existing role-aware
  // dashboard rendered by the current Dashboard page.
  return <Dashboard />;
}

