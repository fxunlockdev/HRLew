import "server-only";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { PermissionTuple } from "@/lib/rbac";
import type { Profile } from "@/lib/types";

export interface AuthContext {
  profile: Profile;
  permissions: PermissionTuple[];
}

/**
 * Resolve the current signed-in user, their profile, and their effective
 * permissions. Redirects to /auth/login if not signed in, /auth/pending if
 * not yet approved.
 */
export async function requireAuth(): Promise<AuthContext> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, role:roles(id, name, description)")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile) redirect("/auth/pending");
  if (profile.status !== "active") redirect("/auth/pending");

  let permissions: PermissionTuple[] = [];
  if (profile.role_id) {
    const { data: perms } = await supabase
      .from("role_permissions")
      .select("permission:permissions(module, action)")
      .eq("role_id", profile.role_id);
    permissions =
      perms
        ?.flatMap((rp) => {
          const p = rp.permission as
            | { module: string; action: string }
            | { module: string; action: string }[]
            | null;
          if (!p) return [];
          return Array.isArray(p) ? p : [p];
        })
        .map((p) => ({ module: p.module, action: p.action })) ?? [];
  }

  return { profile: profile as Profile, permissions };
}

export async function requirePermission(
  module: string,
  action: string,
): Promise<AuthContext> {
  const ctx = await requireAuth();
  const isAdmin = ctx.profile.role?.name === "admin";
  const ok =
    isAdmin || ctx.permissions.some((p) => p.module === module && p.action === action);
  if (!ok) redirect("/dashboard?error=forbidden");
  return ctx;
}

/**
 * Soft variant — does not redirect, returns null instead.
 */
export async function getAuthContext(): Promise<AuthContext | null> {
  try {
    return await requireAuth();
  } catch {
    return null;
  }
}
