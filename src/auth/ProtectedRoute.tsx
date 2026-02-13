import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import type { Role } from "./types";

export function ProtectedRoute({ allowedRoles }: { allowedRoles?: Role[] }) {
  const { session, loading, role, roleLoading } = useAuth();
  const location = useLocation();

  if (loading || roleLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-neutral-600">
        Loading…
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const effectiveRole = role ?? "view_only";
    if (!allowedRoles.includes(effectiveRole)) {
      return (
        <div className="mx-auto flex max-w-lg flex-col gap-2 p-8">
          <h1 className="text-xl font-semibold">Not authorized</h1>
          <p className="text-sm text-neutral-600">
            Your account doesn’t have access to this page.
          </p>
        </div>
      );
    }
  }

  return <Outlet />;
}
