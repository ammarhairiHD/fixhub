import { deleteCookie, getCookie } from "hono/cookie";
import type { Context, MiddlewareHandler } from "hono";
import { IDLE_TIMEOUT_MIN } from "../shared/constants";
import { USER_ROLES, type UserRole } from "../shared/enums";
import { SESSION_COOKIE, hashSessionToken } from "../services/session";
import type { AppEnv } from "../types";

interface SessionRow {
  session_id: string;
  last_seen: string;
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
  must_change_password: number;
}

function clearSessionCookie(context: Context<AppEnv>) {
  deleteCookie(context, SESSION_COOKIE, {
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: "Lax",
  });
}

function isUserRole(role: string): role is UserRole {
  return USER_ROLES.some((candidate) => candidate === role);
}

export const requireAuth: MiddlewareHandler<AppEnv> = async (context, next) => {
  const token = getCookie(context, SESSION_COOKIE);
  if (!token) return context.json({ error: "Unauthorized" }, 401);

  const tokenHash = await hashSessionToken(token);
  const session = await context.env.DB.prepare(
    `SELECT sessions.id AS session_id, sessions.last_seen,
            users.id AS user_id, users.full_name, users.email, users.role,
            users.status, users.must_change_password
     FROM sessions
     INNER JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ?
     LIMIT 1`,
  )
    .bind(tokenHash)
    .first<SessionRow>();

  if (!session || session.status !== "Active" || !isUserRole(session.role)) {
    if (session) {
      await context.env.DB.prepare("DELETE FROM sessions WHERE id = ?")
        .bind(session.session_id)
        .run();
    }
    clearSessionCookie(context);
    return context.json({ error: "Unauthorized" }, 401);
  }

  const nowMs = Date.now();
  const lastSeenMs = Date.parse(session.last_seen);
  if (
    !Number.isFinite(lastSeenMs) ||
    nowMs - lastSeenMs >= IDLE_TIMEOUT_MIN * 60_000
  ) {
    await context.env.DB.prepare("DELETE FROM sessions WHERE id = ?")
      .bind(session.session_id)
      .run();
    clearSessionCookie(context);
    return context.json({ error: "Unauthorized" }, 401);
  }

  const user = {
    id: session.user_id,
    fullName: session.full_name,
    email: session.email,
    role: session.role,
    mustChangePassword: session.must_change_password === 1,
  };
  context.set("authUser", user);
  context.set("sessionId", session.session_id);

  if (
    user.mustChangePassword &&
    context.req.path !== "/api/auth/me" &&
    context.req.path !== "/api/auth/change-password"
  ) {
    return context.json({ error: "Password change required" }, 403);
  }

  await context.env.DB.prepare("UPDATE sessions SET last_seen = ? WHERE id = ?")
    .bind(new Date(nowMs).toISOString(), session.session_id)
    .run();

  return next();
};

export function requireRole(...roles: UserRole[]): MiddlewareHandler<AppEnv> {
  return async (context, next) => {
    const user = context.get("authUser");
    if (!user) return context.json({ error: "Unauthorized" }, 401);
    if (!roles.includes(user.role)) return context.json({ error: "Forbidden" }, 403);
    return next();
  };
}

export function canAccessRequest(
  requestIdParam = "id",
): MiddlewareHandler<AppEnv> {
  return async (context, next) => {
    const user = context.get("authUser");
    if (!user) return context.json({ error: "Unauthorized" }, 401);
    if (user.role === "ADMIN") return next();

    const requestId = context.req.param(requestIdParam);
    if (!requestId) return context.json({ error: "Forbidden" }, 403);

    const access =
      user.role === "REPORTER"
        ? await context.env.DB.prepare(
            `SELECT 1 AS allowed
             FROM requests
             WHERE id = ? AND (
               reporter_id = ? OR EXISTS (
                 SELECT 1 FROM followers
                 WHERE followers.request_id = requests.id
                   AND followers.user_id = ?
               )
             )
             LIMIT 1`,
          )
            .bind(requestId, user.id, user.id)
            .first()
        : await context.env.DB.prepare(
            `SELECT 1 AS allowed
             FROM requests
             WHERE id = ? AND assigned_technician_id = ?
             LIMIT 1`,
          )
            .bind(requestId, user.id)
            .first();

    if (!access) return context.json({ error: "Forbidden" }, 403);
    return next();
  };
}
