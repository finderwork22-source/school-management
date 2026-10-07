import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function ProtectedRoute() {
  const {
    user,
    loading,
    accessLoading,
    schoolAccess,
    accessDeniedReason,
  } = useAuth();

  if (loading || (user && accessLoading && !schoolAccess)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-MojaSchoolr-600" />
          <p className="text-sm text-slate-600">Checking access...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={
          accessDeniedReason
            ? { accessDeniedReason }
            : undefined
        }
      />
    );
  }

  if (schoolAccess && !schoolAccess.allowed && schoolAccess.has_school) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          accessDeniedReason:
            accessDeniedReason ||
            "Your school account is currently unavailable. Please contact your school administrator or MojaSchool support for assistance.",
        }}
      />
    );
  }

  return <Outlet />;
}
