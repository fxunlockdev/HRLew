import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import {
  maybeTouchSession,
  readSessionCookie,
  resolveSessionToken,
  type SessionActor,
} from "@/lib/auth/session";
import type { PermissionTuple } from "@/lib/rbac";
import type { Profile } from "@/lib/types";

export interface AuthContext {
  profile: Profile;
  permissions: PermissionTuple[];
  user: { id: string; email: string };
}

/**
 * Resolve the caller's session once per request.
 *
 * `cache` is what makes this cheap: the dashboard layout and the page inside it
 * both call requireAuth(), and React dedupes them into a single round trip.
 */
export const getSessionActor = cache(async (): Promise<SessionActor | null> => {
  const token = await readSessionCookie();
  if (!token) return null;

  const actor = await resolveSessionToken(token);
  if (!actor) return null;

  await maybeTouchSession(actor.sessionId, actor.lastUsedAt);
  return actor;
});

/**
 * Require a signed-in, approved user. Redirects rather than throwing:
 *   no session       -> /auth/login
 *   temp password    -> /auth/change-password
 *   no/unapproved profile -> /auth/pending
 */
export async function requireAuth(): Promise<AuthContext> {
  const actor = await getSessionActor();
  if (!actor) redirect("/auth/login");
  if (actor.mustChangePassword) redirect("/auth/change-password");
  if (!actor.profile || actor.profile.status !== "active") redirect("/auth/pending");

  return {
    profile: actor.profile,
    permissions: actor.permissions,
    user: { id: actor.userId, email: actor.email },
  };
}

export async function requirePermission(module: string, action: string): Promise<AuthContext> {
  const ctx = await requireAuth();
  const isAdmin = ctx.profile.role?.name === "admin";
  const ok =
    isAdmin || ctx.permissions.some((p) => p.module === module && p.action === action);
  if (!ok) redirect("/dashboard?error=forbidden");
  return ctx;
}

/**
 * Soft variant: returns null instead of redirecting. Does not swallow
 * redirects, so it is safe to call from pages that render for signed-out users.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  const actor = await getSessionActor();
  if (!actor || !actor.profile || actor.profile.status !== "active") return null;
  if (actor.mustChangePassword) return null;

  return {
    profile: actor.profile,
    permissions: actor.permissions,
    user: { id: actor.userId, email: actor.email },
  };
}

/**
 * The signed-in user before the approval and password gates — used by the
 * pages that implement those gates.
 */
export async function requireActor(): Promise<SessionActor> {
  const actor = await getSessionActor();
  if (!actor) redirect("/auth/login");
  return actor;
}
