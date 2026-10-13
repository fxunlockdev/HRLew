import "server-only";
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

/** bcrypt silently ignores bytes past 72, so refuse rather than truncate. */
export const MAX_PASSWORD_LENGTH = 72;
export const MIN_PASSWORD_LENGTH = 10;

const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "1234567890",
  "qwertyuiop",
  "letmein123",
  "welcome123",
  "admin12345",
  "changeme123",
  "iloveyou123",
]);

export interface PasswordCheck {
  ok: boolean;
  error?: string;
}

export function checkPasswordStrength(password: string, email?: string): PasswordCheck {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, error: `Use at most ${MAX_PASSWORD_LENGTH} characters.` };
  }
  if (/^\d+$/.test(password)) {
    return { ok: false, error: "Use more than just digits." };
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    return { ok: false, error: "That password is too common." };
  }
  const localPart = email?.split("@")[0]?.toLowerCase();
  if (localPart && localPart.length >= 3 && password.toLowerCase().includes(localPart)) {
    return { ok: false, error: "Do not include your email address in the password." };
  }
  return { ok: true };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

/**
 * A hash of a value nobody knows, compared against when the email does not
 * exist so that a missing account costs the same time as a wrong password.
 */
export const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEe.Ck8H8FRYbHKSyBlPCWBOtrQ1ZQFaQZ2";

const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Readable temporary password for admin-provisioned accounts. */
export function generateTemporaryPassword(length = 14): string {
  let out = "";
  for (let i = 0; i < length; i += 1) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}
