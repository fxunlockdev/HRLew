import { describe, expect, it } from "vitest";
import {
  checkPasswordStrength,
  DUMMY_HASH,
  generateTemporaryPassword,
  hashPassword,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  verifyPassword,
} from "@/lib/auth/password";

describe("checkPasswordStrength", () => {
  it("accepts a reasonable password", () => {
    expect(checkPasswordStrength("Kestrel-Harbour-4417")).toEqual({ ok: true });
  });

  it("rejects anything shorter than the minimum", () => {
    const result = checkPasswordStrength("a".repeat(MIN_PASSWORD_LENGTH - 1));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/at least/i);
  });

  it("rejects passwords bcrypt would silently truncate", () => {
    const result = checkPasswordStrength("a1".repeat(MAX_PASSWORD_LENGTH));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/at most/i);
  });

  it("rejects all-digit passwords", () => {
    expect(checkPasswordStrength("12345678901").ok).toBe(false);
  });

  it("rejects well-known passwords regardless of case", () => {
    expect(checkPasswordStrength("Password123").ok).toBe(false);
  });

  it("rejects a password containing the email local part", () => {
    const result = checkPasswordStrength("riya-is-here-2026", "riya@example.com");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/email/i);
  });

  it("ignores very short email local parts", () => {
    expect(checkPasswordStrength("ab-great-password", "ab@example.com").ok).toBe(true);
  });
});

describe("hashPassword / verifyPassword", () => {
  it("round-trips a password", async () => {
    const hash = await hashPassword("Kestrel-Harbour-4417");
    expect(hash).not.toContain("Kestrel");
    await expect(verifyPassword("Kestrel-Harbour-4417", hash)).resolves.toBe(true);
    await expect(verifyPassword("Kestrel-Harbour-4418", hash)).resolves.toBe(false);
  });

  it("produces a different hash each time (salted)", async () => {
    const [a, b] = await Promise.all([hashPassword("same-password-1"), hashPassword("same-password-1")]);
    expect(a).not.toBe(b);
  });

  it("returns false rather than throwing on a malformed hash", async () => {
    await expect(verifyPassword("whatever", "not-a-hash")).resolves.toBe(false);
  });

  it("has a dummy hash that no password matches, for constant-time login", async () => {
    await expect(verifyPassword("password", DUMMY_HASH)).resolves.toBe(false);
    expect(DUMMY_HASH).toMatch(/^\$2[aby]\$\d{2}\$/);
  });
});

describe("generateTemporaryPassword", () => {
  it("is long enough to satisfy the strength check", () => {
    expect(checkPasswordStrength(generateTemporaryPassword())).toEqual({ ok: true });
  });

  it("avoids visually ambiguous characters", () => {
    const sample = Array.from({ length: 50 }, () => generateTemporaryPassword()).join("");
    expect(sample).not.toMatch(/[0OlI1]/);
  });

  it("does not repeat", () => {
    const values = new Set(Array.from({ length: 100 }, () => generateTemporaryPassword()));
    expect(values.size).toBe(100);
  });
});
