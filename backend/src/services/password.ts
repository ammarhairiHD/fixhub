import { PASSWORD_PBKDF2_ITERATIONS } from "../shared/constants";

export interface PasswordHash {
  hash: string;
  salt: string;
  iterations: number;
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function derivePassword(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const result = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256,
  );
  return new Uint8Array(result);
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

export async function hashPassword(
  password: string,
  iterations = PASSWORD_PBKDF2_ITERATIONS,
): Promise<PasswordHash> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePassword(password, salt, iterations);

  return {
    hash: encodeBase64(hash),
    salt: encodeBase64(salt),
    iterations,
  };
}

export async function verifyPassword(
  password: string,
  hash: string,
  salt: string,
  iterations: number,
): Promise<boolean> {
  if (!Number.isInteger(iterations) || iterations < 1) return false;

  const derived = await derivePassword(password, decodeBase64(salt), iterations);
  return constantTimeEqual(derived, decodeBase64(hash));
}

export async function performDummyPasswordCheck(password: string): Promise<void> {
  const derived = await derivePassword(
    password,
    new Uint8Array(16),
    PASSWORD_PBKDF2_ITERATIONS,
  );
  constantTimeEqual(derived, new Uint8Array(32));
}
