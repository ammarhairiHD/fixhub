import type { UserRole } from "@shared/enums";

const headingByRole: Record<UserRole, string> = {
  REPORTER: "My requests",
  ADMIN: "Dashboard",
  TECHNICIAN: "My jobs",
};

export function RoleHomePage({ role }: { role: UserRole }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h1 className="text-2xl font-bold">{headingByRole[role]}</h1>
      <p className="mt-3 text-slate-600">
        Authentication is ready. This role home is a placeholder for the next feature phase.
      </p>
    </section>
  );
}
