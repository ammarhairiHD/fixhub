import { USER_ROLES, type UserRole } from "@shared/enums";

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  mustChangePassword: boolean;
}

export interface RegistrationInput {
  fullName: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export class AuthApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseUser(value: unknown): AuthUser {
  const role =
    isRecord(value) && typeof value.role === "string"
      ? USER_ROLES.find((candidate) => candidate === value.role)
      : undefined;
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.fullName !== "string" ||
    typeof value.email !== "string" ||
    !role ||
    typeof value.mustChangePassword !== "boolean"
  ) {
    throw new Error("Authentication response was invalid");
  }

  return {
    id: value.id,
    fullName: value.fullName,
    email: value.email,
    role,
    mustChangePassword: value.mustChangePassword,
  };
}

function parseFieldErrors(value: unknown): Record<string, string[]> {
  if (!isRecord(value)) return {};

  return Object.fromEntries(
    Object.entries(value).flatMap(([field, messages]) =>
      Array.isArray(messages) && messages.every((message) => typeof message === "string")
        ? [[field, messages]]
        : [],
    ),
  );
}

async function request(
  path: string,
  method: "GET" | "POST",
  body?: object,
): Promise<Record<string, unknown>> {
  const response = await fetch(`/api/auth/${path}`, {
    method,
    credentials: "same-origin",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload: unknown = response.status === 204 ? {} : await response.json();
  const data = isRecord(payload) ? payload : {};

  if (!response.ok) {
    const message =
      typeof data.error === "string"
        ? data.error
        : "The request could not be completed";
    throw new AuthApiError(
      message,
      response.status,
      parseFieldErrors(data.errors),
    );
  }

  return data;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const data = await request("me", "GET");
    return parseUser(data.user);
  } catch (error) {
    if (error instanceof AuthApiError && error.status === 401) return null;
    throw error;
  }
}

export async function login(input: LoginInput): Promise<AuthUser> {
  const data = await request("login", "POST", input);
  return parseUser(data.user);
}

export async function register(input: RegistrationInput): Promise<void> {
  await request("register", "POST", input);
}

export async function changePassword(input: ChangePasswordInput): Promise<void> {
  await request("change-password", "POST", input);
}

export async function logout(): Promise<void> {
  await request("logout", "POST");
}
