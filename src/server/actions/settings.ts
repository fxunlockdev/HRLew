"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function upsertSettingsListItem(formData: FormData) {
  await requirePermission("settings", "manage");
  const list_key = String(formData.get("list_key") ?? "");
  const value = String(formData.get("value") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const sort_order = Number(formData.get("sort_order") ?? 0);
  const color = (formData.get("color") as string) || null;
  if (!list_key || !value || !label) throw new Error("list_key, value, and label are required");

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("settings_lists")
    .upsert({ list_key, value, label, sort_order, color, is_active: true }, { onConflict: "list_key,value" });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function deactivateSettingsListItem(id: string) {
  await requirePermission("settings", "manage");
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from("settings_lists").update({ is_active: false }).eq("id", id).eq("is_system", false);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function updateUserRole(profileId: string, roleId: string | null, status: string) {
  await requirePermission("rbac", "manage");
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from("profiles").update({ role_id: roleId, status }).eq("id", profileId);
  if (error) throw new Error(error.message);
  revalidatePath("/permissions");
}
