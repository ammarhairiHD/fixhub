import { env, SELF } from "cloudflare:test";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { requireAuth, requireRole, canAccessRequest } from "../src/middleware/auth";
import { PASSWORD_PBKDF2_ITERATIONS } from "../src/shared/constants";
import { hashPassword } from "../src/services/password";
import type { AppEnv } from "../src/types";

const initialPassword = "Password123";

interface AccountOptions {
  role?: "REPORTER" | "ADMIN" | "TECHNICIAN";
  status?: "Active" | "Inactive";
  mustChangePassword?: boolean;
}

async function createAccount(
  options: AccountOptions = {},
): Promise<{ id: string; email: string; password: string }> {
  const id = crypto.randomUUID();
  const email = `auth-${id}@student.uitm.edu.my`;
  const password = initialPassword;
  const passwordHash = await hashPassword(password);
  await env.DB.prepare(
    `INSERT INTO users (
       id, full_name, email, password_hash, password_salt, password_iterations,
       role, status, must_change_password
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      "Authentication Test",
      email,
      passwordHash.hash,
      passwordHash.salt,
      passwordHash.iterations,
      options.role ?? "REPORTER",
      options.status ?? "Active",
      options.mustChangePassword ?? false,
    )
    .run();

  return { id, email, password };
}

async function authRequest(
  path: string,
  method: "GET" | "POST" = "GET",
  body?: Record<string, string>,
  cookie?: string,
): Promise<Response> {
  return SELF.fetch(`http://example.com/api/auth${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

async function login(email: string, password = initialPassword): Promise<Response> {
  return authRequest("/login", "POST", { email, password });
}

function sessionCookie(response: Response): string {
  const value = response.headers.get("set-cookie");
  if (!value) throw new Error("Login response did not set a session cookie");
  return value.split(";", 1)[0];
}

async function createRequestFixture(reporterId: string, technicianId: string) {
  const suffix = crypto.randomUUID();
  const locationId = crypto.randomUUID();
  const requestId = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO locations (id, building, room, location_type) VALUES (?, ?, ?, 'Academic')",
  )
    .bind(locationId, `Auth building ${suffix}`, "Room 1")
    .run();
  await env.DB.prepare(
    `INSERT INTO requests (
       id, reference_no, reporter_id, location_id, description, category, priority,
       assigned_technician_id
     ) VALUES (?, ?, ?, ?, ?, 'Electrical', 'Medium', ?)`,
  )
    .bind(
      requestId,
      `FH-2099-${suffix.slice(0, 4)}`,
      reporterId,
      locationId,
      "A test maintenance request.",
      technicianId,
    )
    .run();
  return requestId;
}

describe("UC-01 authentication (FR-01–06, FR-48)", () => {
  it("fr01/fr02: validates registration fields and restricts registration to UiTM emails", async () => {
    const invalid = await authRequest("/register", "POST", {
      fullName: "",
      email: "reporter@example.com",
      password: "short",
    });

    expect(invalid.status).toBe(400);
    const invalidBody = (await invalid.json()) as {
      errors: Record<string, string[]>;
    };
    expect(invalidBody.errors).toHaveProperty("fullName");
    expect(invalidBody.errors).toHaveProperty("email");
    expect(invalidBody.errors).toHaveProperty("password");

    const email = `register-${crypto.randomUUID()}@student.uitm.edu.my`;
    const registered = await authRequest("/register", "POST", {
      fullName: "New Reporter",
      email: email.toUpperCase(),
      password: initialPassword,
    });
    expect(registered.status).toBe(201);

    const row = await env.DB.prepare("SELECT role, email FROM users WHERE email = ?")
      .bind(email.toLowerCase())
      .first<{ role: string; email: string }>();
    expect(row).toEqual({ role: "REPORTER", email: email.toLowerCase() });

    const duplicate = await authRequest("/register", "POST", {
      fullName: "Duplicate Reporter",
      email,
      password: initialPassword,
    });
    expect(duplicate.status).toBe(409);
    await expect(duplicate.json()).resolves.toMatchObject({
      errors: { email: expect.any(Array) },
    });
  });

  it("fr03: returns the same generic error for unknown emails and incorrect passwords", async () => {
    const account = await createAccount();
    const wrongPassword = await login(account.email, "WrongPassword123");
    const unknownEmail = await login(`missing-${crypto.randomUUID()}@uitm.edu.my`);

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    await expect(wrongPassword.json()).resolves.toEqual({
      error: "Incorrect email or password",
    });
    await expect(unknownEmail.json()).resolves.toEqual({
      error: "Incorrect email or password",
    });

    const successful = await login(account.email.toUpperCase());
    expect(successful.status).toBe(200);
    const cookie = successful.headers.get("set-cookie");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
  });

  it("fr03: reports deactivated accounts explicitly", async () => {
    const account = await createAccount({ status: "Inactive" });
    const response = await login(account.email);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "Account inactive" });
  });

  it("fr04: locks the account for 15 minutes after five failed attempts", async () => {
    const account = await createAccount();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await login(account.email, "WrongPassword123")).status).toBe(401);
    }

    const row = await env.DB.prepare(
      "SELECT failed_login_count, locked_until FROM users WHERE id = ?",
    )
      .bind(account.id)
      .first<{ failed_login_count: number; locked_until: string | null }>();
    expect(row?.failed_login_count).toBe(5);
    expect(Date.parse(row?.locked_until ?? "")).toBeGreaterThan(Date.now());

    const correctDuringLock = await login(account.email);
    expect(correctDuringLock.status).toBe(401);
    await expect(correctDuringLock.json()).resolves.toEqual({
      error: "Incorrect email or password",
    });
  });

  it("fr05: enforces authentication and role-specific access with 401/403 responses", async () => {
    const accounts = await Promise.all([
      createAccount({ role: "REPORTER" }),
      createAccount({ role: "ADMIN" }),
      createAccount({ role: "TECHNICIAN" }),
    ]);
    const cookies = await Promise.all(
      accounts.map(async (account) =>
        sessionCookie(await login(account.email)),
      ),
    );

    const protectedRoutes = new Hono<AppEnv>();
    protectedRoutes.get(
      "/reporter",
      requireAuth,
      requireRole("REPORTER"),
      (context) => context.text("reporter"),
    );
    protectedRoutes.get(
      "/admin",
      requireAuth,
      requireRole("ADMIN"),
      (context) => context.text("admin"),
    );
    protectedRoutes.get(
      "/technician",
      requireAuth,
      requireRole("TECHNICIAN"),
      (context) => context.text("technician"),
    );

    for (const route of ["/reporter", "/admin", "/technician"]) {
      expect((await protectedRoutes.request(route, {}, env)).status).toBe(401);
    }
    expect(
      (
        await protectedRoutes.request(
          "/admin",
          { headers: { cookie: cookies[0] } },
          env,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await protectedRoutes.request(
          "/technician",
          { headers: { cookie: cookies[1] } },
          env,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await protectedRoutes.request(
          "/reporter",
          { headers: { cookie: cookies[2] } },
          env,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await protectedRoutes.request(
          "/admin",
          { headers: { cookie: cookies[1] } },
          env,
        )
      ).status,
    ).toBe(200);
  });

  it("fr05: grants reporters owner/follower access, technicians assigned access, and admins all access", async () => {
    const reporter = await createAccount({ role: "REPORTER" });
    const follower = await createAccount({ role: "REPORTER" });
    const otherReporter = await createAccount({ role: "REPORTER" });
    const admin = await createAccount({ role: "ADMIN" });
    const technician = await createAccount({ role: "TECHNICIAN" });
    const otherTechnician = await createAccount({ role: "TECHNICIAN" });
    const requestId = await createRequestFixture(reporter.id, technician.id);
    await env.DB.prepare(
      "INSERT INTO followers (id, request_id, user_id) VALUES (?, ?, ?)",
    )
      .bind(crypto.randomUUID(), requestId, follower.id)
      .run();

    const requestAccess = new Hono<AppEnv>();
    requestAccess.get("/:id", requireAuth, canAccessRequest(), (context) =>
      context.text("allowed"),
    );
    const accountCookies = await Promise.all(
      [reporter, follower, otherReporter, admin, technician, otherTechnician].map(
        async (account) => sessionCookie(await login(account.email)),
      ),
    );
    const check = (cookie?: string) =>
      requestAccess.request(
        `/${requestId}`,
        { headers: cookie ? { cookie } : {} },
        env,
      );

    expect((await check()).status).toBe(401);
    expect((await check(accountCookies[0])).status).toBe(200);
    expect((await check(accountCookies[1])).status).toBe(200);
    expect((await check(accountCookies[2])).status).toBe(403);
    expect((await check(accountCookies[3])).status).toBe(200);
    expect((await check(accountCookies[4])).status).toBe(200);
    expect((await check(accountCookies[5])).status).toBe(403);
  });

  it("fr06: logs out sessions and expires idle sessions after 30 minutes", async () => {
    const account = await createAccount();
    const successful = await login(account.email);
    const cookie = sessionCookie(successful);

    expect((await authRequest("/me", "GET", undefined, cookie)).status).toBe(200);
    expect((await authRequest("/logout", "POST", undefined, cookie)).status).toBe(204);
    expect((await authRequest("/me", "GET", undefined, cookie)).status).toBe(401);

    const idleLogin = await login(account.email);
    const idleCookie = sessionCookie(idleLogin);
    const token = idleCookie.slice(idleCookie.indexOf("=") + 1);
    const { hashSessionToken } = await import("../src/services/session");
    const tokenHash = await hashSessionToken(token);
    await env.DB.prepare("UPDATE sessions SET last_seen = ? WHERE token_hash = ?")
      .bind(new Date(Date.now() - 31 * 60_000).toISOString(), tokenHash)
      .run();

    expect(
      (await authRequest("/me", "GET", undefined, idleCookie)).status,
    ).toBe(401);
    const session = await env.DB.prepare(
      "SELECT id FROM sessions WHERE token_hash = ?",
    )
      .bind(tokenHash)
      .first();
    expect(session).toBeNull();
  });

  it("fr48/nfr10: enforces staff first-login password change within the CPU budget", async () => {
    const staff = await createAccount({
      role: "ADMIN",
      mustChangePassword: true,
    });
    const successful = await login(staff.email);
    const cookie = sessionCookie(successful);
    await expect(successful.json()).resolves.toMatchObject({
      user: { role: "ADMIN", mustChangePassword: true },
    });

    const protectedRoute = new Hono<AppEnv>();
    protectedRoute.get("/protected", requireAuth, (context) =>
      context.text("allowed"),
    );
    expect(
      (
        await protectedRoute.request(
          "/protected",
          { headers: { cookie } },
          env,
        )
      ).status,
    ).toBe(403);

    const changed = await authRequest(
      "/change-password",
      "POST",
      { currentPassword: initialPassword, newPassword: "A-new-Password456" },
      cookie,
    );
    expect(changed.status).toBe(200);
    const row = await env.DB.prepare(
      "SELECT must_change_password, password_iterations FROM users WHERE id = ?",
    )
      .bind(staff.id)
      .first<{ must_change_password: number; password_iterations: number }>();
    expect(row?.must_change_password).toBe(0);
    expect(row?.password_iterations).toBe(PASSWORD_PBKDF2_ITERATIONS);
    expect(
      (
        await protectedRoute.request(
          "/protected",
          { headers: { cookie } },
          env,
        )
      ).status,
    ).toBe(200);

    const newLogin = await login(staff.email, "A-new-Password456");
    expect(newLogin.status).toBe(200);
    await expect(newLogin.json()).resolves.toMatchObject({
      user: { mustChangePassword: false },
    });
  });
});
