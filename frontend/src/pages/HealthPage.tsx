import { useQuery } from "@tanstack/react-query";
import { getHealth } from "../api/health";

export function HealthPage() {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
  });

  return (
    <section
      aria-labelledby="welcome-heading"
      className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
    >
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-800">
        Maintenance and repair requests
      </p>
      <h1
        className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl"
        id="welcome-heading"
      >
        Welcome to FixHub@uitm
      </h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        The application foundation is ready. Request reporting and tracking
        features will be added in later development phases.
      </p>

      <div aria-live="polite" className="mt-6 rounded-lg bg-slate-50 p-4">
        <h2 className="font-semibold">API connection</h2>
        {health.isPending && <p className="mt-1 text-slate-600">Checking API…</p>}
        {health.isError && (
          <p className="mt-1 text-red-800">
            API health check failed. Make sure the backend is running.
          </p>
        )}
        {health.isSuccess && (
          <p className="mt-1 text-green-800">API status: healthy</p>
        )}
      </div>
    </section>
  );
}
