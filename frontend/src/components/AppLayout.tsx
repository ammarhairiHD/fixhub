import { useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { logout } from "../api/auth";
import { useAuth } from "../auth/AuthContext";
import { roleHome } from "./AuthGuard";

export function AppLayout() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState("");

  async function signOut() {
    setLogoutError("");
    try {
      await logout();
      setUser(null);
      navigate("/login", { replace: true });
    } catch {
      setLogoutError("Unable to sign out. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link className="text-lg font-bold text-brand-800" to="/">
            FixHub@uitm
          </Link>

          <nav
            aria-label="Main navigation"
            className="flex items-center gap-3 text-sm text-slate-600 sm:gap-5"
          >
            {user ? (
              <>
                <Link className="min-h-11 content-center font-medium text-brand-800" to={roleHome(user.role)}>
                  {user.role === "REPORTER"
                    ? "My requests"
                    : user.role === "ADMIN"
                      ? "Dashboard"
                      : "My jobs"}
                </Link>
                <button
                  className="min-h-11 rounded-md px-2 font-medium hover:bg-slate-100"
                  onClick={() => void signOut()}
                  type="button"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link className="min-h-11 content-center font-medium" to="/login">
                  Sign in
                </Link>
                <Link className="min-h-11 content-center font-medium text-brand-800" to="/register">
                  Register
                </Link>
              </>
            )}
          </nav>

          <button
            aria-label="Notifications (placeholder)"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
            disabled
            type="button"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
              viewBox="0 0 24 24"
            >
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
              <path d="M10 21h4" />
            </svg>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {logoutError && (
          <p className="mb-4 text-sm text-red-800" role="alert">
            {logoutError}
          </p>
        )}
        <Outlet />
      </main>
    </div>
  );
}
