"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sql } from "kysely";
import { db } from "@/lib/db";
import { requireActor } from "@/lib/auth";
import {
  checkPasswordStrength,
  DUMMY_HASH,
  hashPassword,
  verifyPassword,
} from "@/lib/auth/password";
import {
  clearSessionCookie,
  createSession,
  readSessionCookie,
  revokeAllSessionsForUser,
  revokeSession,
  writeSessionCookie,
} from "@/lib/auth/session";

export interface AuthFormState {
  error?: string;
  notice?: string;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
/** Generic on purpose: never reveal whether an address has an account. */
const BAD_CREDENTIALS = "Email or password is incorrect.";

function safeRedirectPath(input: FormDataEntryValue | null): string {
  const value = typeof input === "string" ? input : "";
  // Only same-site absolute paths; "//evil.com" and "https://…" are rejected.
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

async function requestMeta() {
  const h = await headers();
  return {
    userAgent: h.get("user-agent"),
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  };
}

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeRedirectPath(formData.get("next"));

  if (!email || !password) return { error: "Enter your email and password." };

  const user = await db
    .selectFrom("app_users")
    .select([
      "id",
      "email",
      "password_hash",
      "must_change_password",
      "failed_login_count",
      "locked_until",
    ])
    .where("email", "=", email)
    .executeTakeFirst();

  if (user?.locked_until && new Date(user.locked_until) > new Date()) {
    return {
      error: `Too many failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`,
    };
  }

  // Always spend a bcrypt comparison so a missing account is not detectable
  // by response time.
  const ok = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) {
    if (user) {
      const failed = user.failed_login_count + 1;
      await db
        .updateTable("app_users")
        .set({
          failed_login_count: failed,
          locked_until:
            failed >= MAX_FAILED_ATTEMPTS
              ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString()
              : null,
        })
        .where("id", "=", user.id)
        .execute();
    }
    return { error: BAD_CREDENTIALS };
  }

  await db
    .updateTable("app_users")
    .set({ failed_login_count: 0, locked_until: null, last_login_at: new Date().toISOString() })
    .where("id", "=", user.id)
    .execute();

  const meta = await requestMeta();
  const { token, expiresAt } = await createSession(user.id, meta);
  await writeSessionCookie(token, expiresAt);

  if (user.must_change_password) redirect("/auth/change-password");
  redirect(next);
}

export async function signOut(): Promise<void> {
  const token = await readSessionCookie();
  if (token) await revokeSession(token);
  await clearSessionCookie();
  redirect("/auth/login");
}

export async function changeOwnPassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const actor = await requireActor();
  const current = String(formData.get("current_password") ?? "");
  const next = String(formData.get("new_password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  if (next !== confirm) return { error: "The new passwords do not match." };

  const strength = checkPasswordStrength(next, actor.email);
  if (!strength.ok) return { error: strength.error };

  const user = await db
    .selectFrom("app_users")
    .select(["id", "password_hash"])
    .where("id", "=", actor.userId)
    .executeTakeFirst();
  if (!user) return { error: "Account not found." };

  if (!(await verifyPassword(current, user.password_hash))) {
    return { error: "Your current password is incorrect." };
  }
  if (await verifyPassword(next, user.password_hash)) {
    return { error: "Choose a password you have not used here before." };
  }

  await db
    .updateTable("app_users")
    .set({
      password_hash: await hashPassword(next),
      must_change_password: false,
      password_changed_at: new Date().toISOString(),
    })
    .where("id", "=", user.id)
    .execute();

  // Changing a password ends every other session, then re-establishes this one.
  await revokeAllSessionsForUser(user.id);
  const meta = await requestMeta();
  const { token, expiresAt } = await createSession(user.id, meta);
  await writeSessionCookie(token, expiresAt);

  redirect("/dashboard");
}

/** True only on a brand-new instance with no accounts at all. */
export async function setupAvailable(): Promise<boolean> {
  const result = await sql<{ count: string }>`select public.app_user_count() as count`.execute(db);
  return Number(result.rows[0]?.count ?? 1) === 0;
}

export async function completeSetup(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  if (!email.includes("@")) return { error: "Enter a valid email address." };
  if (password !== confirm) return { error: "The passwords do not match." };

  const strength = checkPasswordStrength(password, email);
  if (!strength.ok) return { error: strength.error };

  if (!(await setupAvailable())) {
    return { error: "Setup has already been completed. Sign in instead." };
  }

  const hash = await hashPassword(password);
  try {
    await sql`select public.bootstrap_first_admin(${email}::citext, ${hash}, ${fullName})`.execute(db);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Setup failed.";
    return { error: message.includes("already been completed")
      ? "Setup has already been completed. Sign in instead."
      : message };
  }

  const user = await db
    .selectFrom("app_users")
    .select(["id"])
    .where("email", "=", email)
    .executeTakeFirstOrThrow();

  const meta = await requestMeta();
  const { token, expiresAt } = await createSession(user.id, meta);
  await writeSessionCookie(token, expiresAt);

  redirect("/dashboard");
}
