import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { sql } from "kysely";
import { db } from "@/lib/db";
import type { PermissionTuple } from "@/lib/rbac";
import type { Profile, RoleName, UserStatus } from "@/lib/types";

export const SESSION_COOKIE = "hros_session";
export const SESSION_TTL_DAYS = 30;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
/** Only slide a session's expiry this often, so reads stay read-only. */
const TOUCH_INTERVAL_MS = 15 * 60 * 1000;

export interface SessionActor {
  sessionId: string;
  userId: string;
  email: string;
  mustChangePassword: boolean;
  profile: Profile | null;
  permissions: PermissionTuple[];
  lastUsedAt: string;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function constantTimeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ip?: string | null } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db
    .insertInto("user_sessions")
    .values({
      user_id: userId,
      token_hash: hashToken(token),
      user_agent: meta.userAgent?.slice(0, 500) ?? null,
      ip_address: meta.ip?.slice(0, 100) ?? null,
      expires_at: expiresAt.toISOString(),
    })
    .execute();

  return { token, expiresAt };
}

interface ResolveRow {
  session_id: string;
  session_expires_at: string;
  session_last_used_at: string;
  user_id: string;
  user_email: string;
  must_change_password: boolean;
  profile_id: string | null;
  full_name: string | null;
  profile_email: string | null;
  phone: string | null;
  avatar_url: string | null;
  role_id: string | null;
  role_name: string | null;
  role_description: string | null;
  status: UserStatus | null;
  invited_by: string | null;
  last_seen_at: string | null;
  profile_created_at: string | null;
  profile_updated_at: string | null;
  permissions: PermissionTuple[] | null;
}

export async function resolveSessionToken(token: string): Promise<SessionActor | null> {
  if (!token) return null;

  const result = await sql<ResolveRow>`select * from public.resolve_session(${hashToken(token)})`
    .execute(db);
  const row = result.rows[0];
  if (!row) return null;

  const profile: Profile | null =
    row.profile_id && row.profile_email
      ? {
          id: row.profile_id,
          user_id: row.user_id,
          full_name: row.full_name,
          email: row.profile_email,
          phone: row.phone,
          avatar_url: row.avatar_url,
          role_id: row.role_id,
          status: (row.status ?? "pending") as UserStatus,
          invited_by: row.invited_by,
          last_seen_at: row.last_seen_at,
          created_at: row.profile_created_at ?? new Date().toISOString(),
          updated_at: row.profile_updated_at ?? new Date().toISOString(),
          role: row.role_id && row.role_name
            ? {
                id: row.role_id,
                name: row.role_name as RoleName,
                description: row.role_description,
              }
            : null,
        }
      : null;

  return {
    sessionId: row.session_id,
    userId: row.user_id,
    email: row.user_email,
    mustChangePassword: row.must_change_password,
    profile,
    permissions: row.permissions ?? [],
    lastUsedAt: row.session_last_used_at,
  };
}

/**
 * Slide the expiry if the session has not been touched recently. Failures are
 * swallowed: a read-only request should not 500 because we could not bump a
 * timestamp (and Next.js renders some pages where writes are disallowed).
 */
export async function maybeTouchSession(sessionId: string, lastUsedAt?: string | null) {
  if (lastUsedAt && Date.now() - new Date(lastUsedAt).getTime() < TOUCH_INTERVAL_MS) return;
  try {
    await sql`select public.touch_session(${sessionId}::uuid, ${`${SESSION_TTL_DAYS} days`}::interval)`
      .execute(db);
  } catch {
    // non-fatal
  }
}

export async function revokeSession(token: string): Promise<void> {
  await db.deleteFrom("user_sessions").where("token_hash", "=", hashToken(token)).execute();
}

export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await db.deleteFrom("user_sessions").where("user_id", "=", userId).execute();
}

export async function deleteExpiredSessions(): Promise<number> {
  const result = await db
    .deleteFrom("user_sessions")
    .where("expires_at", "<", new Date().toISOString())
    .executeTakeFirst();
  return Number(result.numDeletedRows ?? 0);
}

// --- cookie plumbing -------------------------------------------------------

export async function readSessionCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

export async function writeSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
