import { describe, expect, it } from "vitest";
import { hasPermission, isAdmin, isManagerOrAdmin } from "@/lib/rbac";
import type { Profile } from "@/lib/types";

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    user_id: "22222222-2222-2222-2222-222222222222",
    full_name: "Riya Recruiter",
    email: "riya@example.com",
    phone: null,
    avatar_url: null,
    role_id: "33333333-3333-3333-3333-333333333333",
    status: "active",
    invited_by: null,
    last_seen_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    role: { id: "33333333-3333-3333-3333-333333333333", name: "recruiter", description: null },
    ...overrides,
  };
}

describe("hasPermission", () => {
  it("grants a permission the role actually holds", () => {
    expect(
      hasPermission(profile(), [{ module: "candidates", action: "view" }], "candidates", "view"),
    ).toBe(true);
  });

  it("denies a permission the role does not hold", () => {
    expect(
      hasPermission(profile(), [{ module: "candidates", action: "view" }], "candidates", "delete"),
    ).toBe(false);
  });

  it("does not let a permission leak across modules", () => {
    expect(
      hasPermission(profile(), [{ module: "candidates", action: "view" }], "placements", "view"),
    ).toBe(false);
  });

  it("gives admins everything without enumerating it", () => {
    const admin = profile({ role: { id: "r", name: "admin", description: null } });
    expect(hasPermission(admin, [], "placements", "edit_financial")).toBe(true);
  });

  it("denies everything to a non-active profile, even an admin", () => {
    const suspended = profile({
      role: { id: "r", name: "admin", description: null },
      status: "suspended",
    });
    expect(hasPermission(suspended, [], "candidates", "view")).toBe(false);
  });

  it("denies everything when there is no profile", () => {
    expect(hasPermission(null, [{ module: "candidates", action: "view" }], "candidates", "view")).toBe(
      false,
    );
    expect(hasPermission(undefined, [], "candidates", "view")).toBe(false);
  });

  it("denies when the profile has no role at all", () => {
    const roleless = profile({ role: null, role_id: null });
    expect(hasPermission(roleless, [], "candidates", "view")).toBe(false);
  });
});

describe("isAdmin / isManagerOrAdmin", () => {
  it("identifies admins", () => {
    expect(isAdmin(profile({ role: { id: "r", name: "admin", description: null } }))).toBe(true);
    expect(isAdmin(profile())).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });

  it("treats managers and admins alike, and nobody else", () => {
    expect(isManagerOrAdmin(profile({ role: { id: "r", name: "manager", description: null } }))).toBe(true);
    expect(isManagerOrAdmin(profile({ role: { id: "r", name: "admin", description: null } }))).toBe(true);
    expect(isManagerOrAdmin(profile())).toBe(false);
    expect(isManagerOrAdmin(profile({ role: { id: "r", name: "viewer", description: null } }))).toBe(false);
  });
});
