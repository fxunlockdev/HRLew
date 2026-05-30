import type { Profile, RoleName } from "@/lib/types";

export type Module =
  | "candidates"
  | "clients"
  | "bd"
  | "jobs"
  | "pipeline"
  | "interviews"
  | "placements"
  | "kpi"
  | "staff"
  | "reports"
  | "settings"
  | "rbac"
  | "tasks";

export type Action =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "export"
  | "manage"
  | "view_sensitive"
  | "view_salary"
  | "edit_salary"
  | "view_financial"
  | "edit_financial"
  | "view_company"
  | "edit_targets"
  | "edit_commercial";

export interface PermissionTuple {
  module: Module | string;
  action: Action | string;
}

/**
 * Best-effort frontend check. The authoritative check happens server-side
 * via the `has_permission()` SQL function and Supabase RLS.
 */
export function hasPermission(
  profile: Profile | null | undefined,
  permissions: PermissionTuple[],
  module: Module | string,
  action: Action | string,
): boolean {
  if (!profile || profile.status !== "active") return false;
  const role = profile.role?.name;
  if (role === "admin") return true;

  return permissions.some((p) => p.module === module && p.action === action);
}

export function isAdmin(profile: Profile | null | undefined): boolean {
  return profile?.role?.name === "admin";
}

export function isManagerOrAdmin(profile: Profile | null | undefined): boolean {
  const r = profile?.role?.name;
  return r === "admin" || r === "manager";
}

export function roleLabel(role: RoleName | string | null | undefined): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "manager":
      return "Manager";
    case "recruiter":
      return "Recruiter";
    case "viewer":
      return "Viewer";
    default:
      return role ?? "—";
  }
}

/**
 * Returns a redacted display value for sensitive fields based on permission.
 * Example: showSensitive(profile, perms, "candidates", "view_sensitive", candidate.current_ctc)
 */
export function showSensitive<T>(
  profile: Profile | null | undefined,
  permissions: PermissionTuple[],
  module: Module,
  viewAction: Action,
  value: T,
  redactedValue: T | string = "—",
): T | string {
  if (hasPermission(profile, permissions, module, viewAction)) return value;
  return redactedValue;
}
