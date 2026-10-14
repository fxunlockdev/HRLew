"use server";

import { revalidatePath } from "next/cache";
import { sql } from "kysely";
import { requirePermission } from "@/lib/auth";
import { generateTemporaryPassword, hashPassword } from "@/lib/auth/password";
import { revokeAllSessionsForUser } from "@/lib/auth/session";
import { withProfile } from "@/lib/db";

export interface UserAdminState {
  error?: string;
  /** Shown to the admin once, right after provisioning or a reset. */
  credentials?: { email: string; temporaryPassword: string };
  deleted?: { email: string };
}

/** What a user still owns, so the admin knows what a delete would move. */
export interface UserRecordCounts {
  total: number;
  counts: Record<string, number>;
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

/**
 * Provision an account. The admin never chooses the password: a temporary one
 * is generated, shown once, and the user is forced to replace it at first
 * sign-in (`must_change_password`).
 */
export async function createUser(
  _prev: UserAdminState,
  formData: FormData,
): Promise<UserAdminState> {
  const { profile: admin } = await requirePermission("rbac", "manage");

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const roleId = String(formData.get("role_id") ?? "").trim();
  const status = String(formData.get("status") ?? "active");

  if (!email.includes("@")) return { error: "Enter a valid email address." };
  if (!fullName) return { error: "Enter the person's name." };
  if (!["pending", "active", "suspended", "archived"].includes(status)) {
    return { error: "Unknown status." };
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  try {
    await withProfile(admin.id, async (trx) => {
      const user = await trx
        .insertInto("app_users")
        .values({
          email,
          password_hash: passwordHash,
          must_change_password: true,
          password_changed_at: new Date().toISOString(),
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      await trx
        .insertInto("profiles")
        .values({
          user_id: user.id,
          email,
          full_name: fullName,
          role_id: roleId || null,
          status: status as "pending" | "active" | "suspended" | "archived",
          invited_by: admin.id,
        })
        .execute();
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { error: `${email} already has an account.` };
    throw err;
  }

  revalidatePath("/permissions");
  return { credentials: { email, temporaryPassword } };
}

/** Issue a new temporary password and sign the user out everywhere. */
export async function resetUserPassword(
  _prev: UserAdminState,
  formData: FormData,
): Promise<UserAdminState> {
  const { profile: admin } = await requirePermission("rbac", "manage");
  const profileId = String(formData.get("profile_id") ?? "");
  if (!profileId) return { error: "Missing user." };

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  const target = await withProfile(admin.id, async (trx) => {
    const row = await trx
      .selectFrom("profiles")
      .select(["user_id", "email"])
      .where("id", "=", profileId)
      .executeTakeFirst();
    if (!row) return null;

    await trx
      .updateTable("app_users")
      .set({
        password_hash: passwordHash,
        must_change_password: true,
        password_changed_at: new Date().toISOString(),
        failed_login_count: 0,
        locked_until: null,
      })
      .where("id", "=", row.user_id)
      .execute();

    return row;
  });

  if (!target) return { error: "User not found." };

  await revokeAllSessionsForUser(target.user_id);
  revalidatePath("/permissions");
  return { credentials: { email: target.email, temporaryPassword } };
}

/** Force a user off every device without changing their password. */
export async function revokeUserSessions(profileId: string): Promise<void> {
  const { profile: admin } = await requirePermission("rbac", "manage");

  const target = await withProfile(admin.id, (trx) =>
    trx.selectFrom("profiles").select("user_id").where("id", "=", profileId).executeTakeFirst(),
  );
  if (!target) throw new Error("User not found.");

  await revokeAllSessionsForUser(target.user_id);
  revalidatePath("/permissions");
}

/**
 * What this user owns. Drives the delete confirmation: ownership has to go
 * somewhere, and the admin should see how much before choosing.
 */
export async function getUserRecordCounts(profileId: string): Promise<UserRecordCounts> {
  const { profile: admin } = await requirePermission("rbac", "manage");

  const result = await withProfile(admin.id, (trx) =>
    sql<{ counts: Record<string, number> }>`
      select public.profile_record_counts(${profileId}::uuid) as counts
    `.execute(trx),
  );

  const counts = result.rows[0]?.counts ?? {};
  const total = Object.values(counts).reduce((sum, n) => sum + Number(n), 0);
  return { total, counts };
}

/**
 * Delete an account for good.
 *
 * Ownership (clients, candidates, jobs, pipeline, interviews, placements, BD
 * leads, tasks) is reassigned to another active user; authorship and audit
 * history is kept but detached, so the trail stays truthful about who is gone.
 * The database refuses to delete your own account or the last administrator.
 */
export async function deleteUser(
  _prev: UserAdminState,
  formData: FormData,
): Promise<UserAdminState> {
  const { profile: admin } = await requirePermission("rbac", "manage");

  const profileId = String(formData.get("profile_id") ?? "");
  const reassignTo = String(formData.get("reassign_to") ?? "").trim();
  if (!profileId) return { error: "Missing user." };
  if (profileId === admin.id) return { error: "You cannot delete your own account." };

  try {
    const email = await withProfile(admin.id, async (trx) => {
      const target = await trx
        .selectFrom("profiles")
        .select("email")
        .where("id", "=", profileId)
        .executeTakeFirst();
      if (!target) throw new Error("User not found.");

      await sql`
        select public.delete_profile(${profileId}::uuid, ${reassignTo || null}::uuid)
      `.execute(trx);

      return target.email;
    });

    revalidatePath("/permissions");
    return { deleted: { email } };
  } catch (err) {
    // The database raises these with messages written for a person to read.
    const message = err instanceof Error ? err.message : "Could not delete that user.";
    return { error: message.replace(/^error:\s*/i, "") };
  }
}
