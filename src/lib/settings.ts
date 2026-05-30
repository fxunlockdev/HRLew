import "server-only";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { SettingsListItem } from "@/lib/types";

const cache = new Map<string, { at: number; rows: SettingsListItem[] }>();
const TTL_MS = 60_000;

export async function getSettingsList(listKey: string): Promise<SettingsListItem[]> {
  const hit = cache.get(listKey);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rows;

  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("settings_lists")
    .select("*")
    .eq("list_key", listKey)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const rows = (data ?? []) as SettingsListItem[];
  cache.set(listKey, { at: Date.now(), rows });
  return rows;
}

export async function getMultipleSettingsLists(keys: string[]) {
  const entries = await Promise.all(
    keys.map(async (k) => [k, await getSettingsList(k)] as const),
  );
  return Object.fromEntries(entries) as Record<string, SettingsListItem[]>;
}
