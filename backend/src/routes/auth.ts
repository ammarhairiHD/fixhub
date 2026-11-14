import { zValidator } from "@hono/zod-validator";
import { Hono, type Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import {
  EMAIL_DOMAINS,
  LOCK_AFTER,
  LOCK_MINUTES,
  PASSWORD_MIN,
} from "../shared/constants";
import {
  hashPassword,
  performDummyPasswordCheck,
  verifyPassword,
} from "../services/password";
import {
  createSessionToken,
  hashSessionToken,
  SESSION_COOKIE,
} from "../services/session";
import { requireAuth } from "../middleware/auth";
import type { AppEnv } from "../types";

const registerSchema = z.object({
  fullName: z.string().trim().min(1, "Enter your full name").max(120),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(254)
    .refine(
      (email) => EMAIL_DOMAINS.some((domain) => email.toLowerCase().endsWith(domain)),
      "Use a UiTM email address",
    ),
  password: z.string().min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters`),
});

const loginSchema = z.object({
  email: z.string().min(1).max(254),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z
    .string()
    .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters`),
});

interface LoginRow {
  id: string;
  full_name: string;
  email: string;
  password_hash: string;
  password_salt: string;
  password_iterations: number;
  role: string;
  status: string;
  must_change_password: number;
  failed_login_count: number;
  locked_until: string | null;
}

interface AuthenticatedAccount {
  id: string;
  full_name: string;
  email: string;
  role: string;
  must_change_password: number;
}

function fieldErrors(error: z.ZodError): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(error.flatten().fieldErrors).filter(
      (entry): entry is [string, string[]] => Array.isArray(entry[1]),
    ),
  );
}

function isLocked(lockedUntil: string | null, now: number): boolean {
  return lockedUntil !== null && Date.parse(lockedUntil) > now;
}

async function createSession(
  context: Context<AppEnv>,
  userId: string,
): Promise<void> {
  const token = createSessionToken();
  const tokenHash = await hashSessionToken(token);
  const now = new Date().toISOString();

  await context.env.DB.prepare(
    "INSERT INTO sessions (id, user_id, token_hash, last_seen, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(crypto.randomUUID(), userId, tokenHash, now, now)
    .run();

  setCookie(context, SESSION_COOKIE, token, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
  });
}

function publicUser(user: AuthenticatedAccount) {
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.must_change_password === 1,
  };
}

const authRoutes = new Hono<AppEnv>();

authRoutes.post(
  "/register",
  zValidator("json", registerSchema, (result, context) => {
    if (!result.success) {
      return context.json({ errors: fieldErrors(result.error) }, 400);
    }
  }),
  async (context) => {
    const body = context.req.valid("json");
    const email = body.email.toLowerCase();
    const existing = await context.env.DB.prepare(
      "SELECT 1 AS email_exists FROM users WHERE email = ? LIMIT 1",
    )
      .bind(email)
      .first();
    if (existing) {
      return context.json(
        { errors: { email: ["An account with this email already exists"] } },
        409,
      );
    }

    const password = await hashPassword(body.password);
    const now = new Date().toISOString();
    const result = await context.env.DB.prepare(
      `INSERT INTO users (
         id, full_name, email, password_hash, password_salt, password_iterations,
         role, status, must_change_password, failed_login_count, locked_until,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, 'REPORTER', 'Active', 0, 0, NULL, ?, ?)
       ON CONFLICT(email) DO NOTHING`,
    )
      .bind(
        crypto.randomUUID(),
        body.fullName,
        email,
        password.hash,
        password.salt,
        password.iterations,
        now,
        now,
      )
      .run();

    if (result.meta.changes === 0) {
      return context.json(
        { errors: { email: ["An account with this email already exists"] } },
        409,
      );
    }

    return context.json({ message: "Registration successful" }, 201);
  },
);

authRoutes.post(
  "/login",
  zValidator("json", loginSchema, (result, context) => {
    if (!result.success) {
      return context.json({ error: "Incorrect email or password" }, 401);
    }
  }),
  async (context) => {
    const { email: suppliedEmail, password } = context.req.valid("json");
    const email = suppliedEmail.trim().toLowerCase();
    const user = await context.env.DB.prepare(
      `SELECT id, full_name, email, password_hash, password_salt,
              password_iterations, role, status, must_change_password,
              failed_login_count, locked_until
       FROM users WHERE email = ? LIMIT 1`,
    )
      .bind(email)
      .first<LoginRow>();

    if (!user) {
      await performDummyPasswordCheck(password);
      return context.json({ error: "Incorrect email or password" }, 401);
    }
    if (user.status !== "Active") {
      return context.json({ error: "Account inactive" }, 403);
    }

    const nowMs = Date.now();
    if (isLocked(user.locked_until, nowMs)) {
      await performDummyPasswordCheck(password);
      return context.json({ error: "Incorrect email or password" }, 401);
    }
    const passwordIsValid = await verifyPassword(
      password,
      user.password_hash,
      user.password_salt,
      user.password_iterations,
    );
    if (!passwordIsValid) {
      const now = new Date(nowMs).toISOString();
      const lockUntil = new Date(nowMs + LOCK_MINUTES * 60_000).toISOString();
      await context.env.DB.prepare(
        `UPDATE users
         SET failed_login_count =
               CASE WHEN locked_until IS NOT NULL AND locked_until <= ? THEN 1
                    ELSE failed_login_count + 1 END,
             locked_until =
               CASE WHEN (CASE WHEN locked_until IS NOT NULL AND locked_until <= ? THEN 1
                               ELSE failed_login_count + 1 END) >= ?
                    THEN ? ELSE NULL END,
             updated_at = ?
         WHERE id = ? AND status = 'Active'
           AND (locked_until IS NULL OR locked_until <= ?)`,
      )
        .bind(now, now, LOCK_AFTER, lockUntil, now, user.id, now)
        .run();
      return context.json({ error: "Incorrect email or password" }, 401);
    }

    const now = new Date(nowMs).toISOString();
    const updated = await context.env.DB.prepare(
      `UPDATE users
       SET failed_login_count = 0, locked_until = NULL, updated_at = ?
       WHERE id = ? AND status = 'Active'`,
    )
      .bind(now, user.id)
      .run();
    if (updated.meta.changes === 0) {
      return context.json({ error: "Account inactive" }, 403);
    }
    await createSession(context, user.id);
    return context.json({ user: publicUser(user) });
  },
);

authRoutes.post("/logout", async (context) => {
  const token = getCookie(context, SESSION_COOKIE);
  if (token) {
    const tokenHash = await hashSessionToken(token);
    await context.env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?")
      .bind(tokenHash)
      .run();
  }
  deleteCookie(context, SESSION_COOKIE, {
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "Lax",
  });
  return context.body(null, 204);
});

authRoutes.post(
  "/change-password",
  requireAuth,
  zValidator("json", changePasswordSchema, (result, context) => {
    if (!result.success) {
      return context.json({ errors: fieldErrors(result.error) }, 400);
    }
  }),
  async (context) => {
    const { currentPassword, newPassword } = context.req.valid("json");
    const userId = context.get("authUser").id;
    const account = await context.env.DB.prepare(
      `SELECT password_hash, password_salt, password_iterations
       FROM users WHERE id = ? AND status = 'Active' LIMIT 1`,
    )
      .bind(userId)
      .first<Pick<LoginRow, "password_hash" | "password_salt" | "password_iterations">>();

    if (
      !account ||
      !(await verifyPassword(
        currentPassword,
        account.password_hash,
        account.password_salt,
        account.password_iterations,
      ))
    ) {
      return context.json(
        { errors: { currentPassword: ["Current password is incorrect"] } },
        400,
      );
    }

    const password = await hashPassword(newPassword);
    const now = new Date().toISOString();
    await context.env.DB.batch([
      context.env.DB.prepare(
        `UPDATE users
         SET password_hash = ?, password_salt = ?, password_iterations = ?,
             must_change_password = 0, failed_login_count = 0, locked_until = NULL,
             updated_at = ?
         WHERE id = ?`,
      ).bind(password.hash, password.salt, password.iterations, now, userId),
      context.env.DB.prepare(
        "DELETE FROM sessions WHERE user_id = ? AND id != ?",
      ).bind(userId, context.get("sessionId")),
    ]);

    return context.json({ message: "Password changed successfully" });
  },
);

authRoutes.get("/me", requireAuth, async (context) => {
  const user = context.get("authUser");
  return context.json({
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    },
  });
});

export { authRoutes };
