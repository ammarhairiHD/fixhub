import type { PropsWithChildren } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { UserRole } from "@shared/enums";

export function roleHome(role: UserRole): string {
  switch (role) {
    case "REPORTER":
      return "/requests";
    case "ADMIN":
      return "/dashboard";
    case "TECHNICIAN":
      return "/jobs";
  }
}

function AuthLoading() {
  return (
    <p aria-live="polite" className="rounded-lg bg-white p-6 text-slate-700">
      Checking your session…
    </p>
  );
}

export function RequireAuth() {
  const { user, status, error, refresh } = useAuth();
  const location = useLocation();

  if (status === "loading") return <AuthLoading />;
  if (status === "error") {
    return (
      <section className="rounded-lg border border-red-200 bg-white p-6">
        <p className="text-red-800">{error ?? "Unable to verify your session"}</p>
        <button
          className="mt-4 min-h-11 rounded-md bg-brand-800 px-4 font-semibold text-white"
          onClick={() => void refresh().catch(() => undefined)}
          type="button"
        >
          Try again
        </button>
      </section>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (user.mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  return <Outlet />;
}

export function RoleHomeRedirect() {
  const { user } = useAuth();
  return user ? <Navigate to={roleHome(user.role)} replace /> : <Navigate to="/login" replace />;
}

export function PublicOnly({ children }: PropsWithChildren) {
  const { user, status } = useAuth();
  if (status === "loading") return <AuthLoading />;
  if (user) {
    return (
      <Navigate
        to={user.mustChangePassword ? "/change-password" : roleHome(user.role)}
        replace
      />
    );
  }
  return children;
}

export function RequireRole({
  role,
  children,
}: PropsWithChildren<{ role: UserRole }>) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) {
    return <Navigate to={roleHome(user.role)} replace />;
  }
  return children;
}
