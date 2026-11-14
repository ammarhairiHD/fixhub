import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthApiError, login } from "../api/auth";
import { useAuth } from "../auth/AuthContext";
import { roleHome } from "../components/AuthGuard";

export function LoginPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const notice =
    typeof location.state?.message === "string" ? location.state.message : "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const user = await login({ email, password });
      setUser(user);
      navigate(
        user.mustChangePassword
          ? "/change-password"
          : typeof location.state?.from === "string"
            ? location.state.from
            : roleHome(user.role),
        { replace: true },
      );
    } catch (cause) {
      setError(
        cause instanceof AuthApiError
          ? cause.message
          : "Unable to sign in. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-labelledby="login-heading"
      className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
    >
      <h1 className="text-2xl font-bold" id="login-heading">
        Sign in
      </h1>
      <p className="mt-2 text-slate-600">Sign in to your FixHub@uitm account.</p>
      {notice && (
        <p className="mt-4 text-sm text-green-800" role="status">
          {notice}
        </p>
      )}
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <div>
          <label className="block font-medium" htmlFor="email">
            UiTM email
          </label>
          <input
            autoComplete="username"
            className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-3"
            id="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </div>
        <div>
          <label className="block font-medium" htmlFor="password">
            Password
          </label>
          <input
            autoComplete="current-password"
            className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-3"
            id="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </div>
        {error && (
          <p className="text-sm text-red-800" role="alert">
            {error}
          </p>
        )}
        <button
          className="min-h-11 w-full rounded-md bg-brand-800 px-4 font-semibold text-white hover:bg-brand-900"
          disabled={pending}
          type="submit"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-5 text-sm text-slate-600">
        New to FixHub? <Link className="font-semibold text-brand-800 underline" to="/register">Create an account</Link>
      </p>
    </section>
  );
}
