"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { withProfile } from "@/lib/db";
import { invalidateSettingsCache } from "@/lib/settings";

export async function upsertSettingsListItem(formData: FormData) {
  const { profile } = await requirePermission("settings", "manage");

  const listKey = String(formData.get("list_key") ?? "");
  const value = String(formData.get("value") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const sortOrder = Number(formData.get("sort_order") ?? 0);
  const color = (formData.get("color") as string) || null;
  if (!listKey || !value || !label) throw new Error("list_key, value, and label are required");

  await withProfile(profile.id, (trx) =>
    trx
      .insertInto("settings_lists")
      .values({
        list_key: listKey,
        value,
        label,
        sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
        color,
        is_active: true,
      })
      .onConflict((oc) =>
        oc.columns(["list_key", "value"]).doUpdateSet((eb) => ({
          label: eb.ref("excluded.label"),
          sort_order: eb.ref("excluded.sort_order"),
          color: eb.ref("excluded.color"),
          is_active: true,
        })),
      )
      .execute(),
  );

  invalidateSettingsCache(listKey);
  revalidatePath("/settings");
}

export async function deactivateSettingsListItem(id: string) {
  const { profile } = await requirePermission("settings", "manage");

  await withProfile(profile.id, (trx) =>
    trx
      .updateTable("settings_lists")
      .set({ is_active: false })
      .where("id", "=", id)
      .where("is_system", "=", false)
      .execute(),
  );

  invalidateSettingsCache();
  revalidatePath("/settings");
}

export async function updateUserRole(profileId: string, roleId: string | null, status: string) {
  const { profile } = await requirePermission("rbac", "manage");

  if (!["pending", "active", "suspended", "archived"].includes(status)) {
    throw new Error("Unknown status");
  }

  await withProfile(profile.id, (trx) =>
    trx
      .updateTable("profiles")
      .set({
        role_id: roleId,
        status: status as "pending" | "active" | "suspended" | "archived",
      })
      .where("id", "=", profileId)
      .execute(),
  );

  revalidatePath("/permissions");
}
