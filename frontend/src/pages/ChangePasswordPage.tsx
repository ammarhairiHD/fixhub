import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { PASSWORD_MIN } from "@shared/constants";
import { AuthApiError, changePassword } from "../api/auth";
import { useAuth } from "../auth/AuthContext";
import { roleHome } from "../components/AuthGuard";

export function ChangePasswordPage() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setMessage("");
    setPending(true);
    try {
      await changePassword({ currentPassword, newPassword });
      if (user) setUser({ ...user, mustChangePassword: false });
      navigate(user ? roleHome(user.role) : "/login", { replace: true });
    } catch (cause) {
      if (cause instanceof AuthApiError) {
        setErrors(cause.fieldErrors);
        if (Object.keys(cause.fieldErrors).length === 0) setMessage(cause.message);
      } else {
        setMessage("Unable to change your password. Please try again.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-labelledby="change-password-heading"
      className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
    >
      <h1 className="text-2xl font-bold" id="change-password-heading">
        Change password
      </h1>
      <p className="mt-2 text-slate-600">
        {user?.mustChangePassword
          ? "Change your temporary password to continue."
          : "Enter your current password and choose a new password."}
      </p>
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <div>
          <label className="block font-medium" htmlFor="currentPassword">
            Current password
          </label>
          <input
            autoComplete="current-password"
            className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-3"
            id="currentPassword"
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
            type="password"
            value={currentPassword}
          />
          {errors.currentPassword && <FieldError messages={errors.currentPassword} />}
        </div>
        <div>
          <label className="block font-medium" htmlFor="newPassword">
            New password
          </label>
          <input
            autoComplete="new-password"
            className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-3"
            id="newPassword"
            minLength={PASSWORD_MIN}
            onChange={(event) => setNewPassword(event.target.value)}
            required
            type="password"
            value={newPassword}
          />
          {errors.newPassword && <FieldError messages={errors.newPassword} />}
        </div>
        {message && (
          <p className="text-sm text-red-800" role="alert">
            {message}
          </p>
        )}
        <button
          className="min-h-11 w-full rounded-md bg-brand-800 px-4 font-semibold text-white hover:bg-brand-900"
          disabled={pending}
          type="submit"
        >
          {pending ? "Saving…" : "Change password"}
        </button>
      </form>
    </section>
  );
}

function FieldError({ messages }: { messages: string[] }) {
  return (
    <p className="mt-1 text-sm text-red-800" role="alert">
      {messages.join(" ")}
    </p>
  );
}
