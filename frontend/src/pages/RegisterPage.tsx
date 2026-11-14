import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PASSWORD_MIN } from "@shared/constants";
import { AuthApiError, register } from "../api/auth";

export function RegisterPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setMessage("");
    setPending(true);
    try {
      await register({ fullName, email, password });
      navigate("/login", {
        replace: true,
        state: { message: "Registration successful. You can now sign in." },
      });
    } catch (cause) {
      if (cause instanceof AuthApiError) {
        setErrors(cause.fieldErrors);
        if (Object.keys(cause.fieldErrors).length === 0) setMessage(cause.message);
      } else {
        setMessage("Unable to register. Please try again.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-labelledby="register-heading"
      className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
    >
      <h1 className="text-2xl font-bold" id="register-heading">
        Create reporter account
      </h1>
      <form className="mt-6 space-y-4" onSubmit={submit}>
        <div>
          <label className="block font-medium" htmlFor="fullName">
            Full name
          </label>
          <input
            autoComplete="name"
            className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-3"
            id="fullName"
            onChange={(event) => setFullName(event.target.value)}
            required
            value={fullName}
          />
          {errors.fullName && <FieldError messages={errors.fullName} />}
        </div>
        <div>
          <label className="block font-medium" htmlFor="email">
            UiTM email
          </label>
          <input
            autoComplete="email"
            className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-3"
            id="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
          {errors.email && <FieldError messages={errors.email} />}
        </div>
        <div>
          <label className="block font-medium" htmlFor="password">
            Password
          </label>
          <input
            autoComplete="new-password"
            className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-3"
            id="password"
            minLength={PASSWORD_MIN}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          {errors.password && <FieldError messages={errors.password} />}
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
          {pending ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="mt-5 text-sm text-slate-600">
        Already registered? <Link className="font-semibold text-brand-800 underline" to="/login">Sign in</Link>
      </p>
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
