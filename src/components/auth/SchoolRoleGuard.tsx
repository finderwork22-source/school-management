import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSchool } from "../../context/SchoolContext";
import { normalizeRole } from "../../lib/permissions";

type SchoolRole =
  | "Owner"
  | "Principal"
  | "Head of Academics"
  | "Secretary"
  | "Teacher"
  | "Librarian"
  | "Parent";

interface SchoolRoleGuardProps {
  allowedRoles: SchoolRole[];
  children?: React.ReactNode;
}

export default function SchoolRoleGuard({
  allowedRoles,
  children,
}: SchoolRoleGuardProps) {
  const { membership } = useSchool();
  const location = useLocation();

  const role = normalizeRole(membership?.role) as SchoolRole | null;

  if (!role || !allowedRoles.includes(role)) {
    return (
      <Navigate
        to="/"
        replace
        state={{
          from: location.pathname,
          authorizationDenied: true,
        }}
      />
    );
  }

  if (children) {
    return <>{children}</>;
  }

  return <Outlet />;
}