import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";

export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-500">
          Loading...
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}