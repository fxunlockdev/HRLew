import "server-only";
import type { Tx } from "@/lib/db";
import type { SettingsListItem } from "@/lib/types";

const cache = new Map<string, { at: number; rows: SettingsListItem[] }>();
const TTL_MS = 60_000;

/**
 * Configurable reference lists (statuses, stages, sources).
 *
 * Takes the caller's transaction because `settings_lists` is behind RLS: the
 * actor is published on the transaction, so a query outside one sees nothing.
 * Results are process-cached for a minute — this data changes rarely and is
 * read by nearly every page.
 */
export async function getSettingsList(trx: Tx, listKey: string): Promise<SettingsListItem[]> {
  const hit = cache.get(listKey);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.rows;

  const rows = (await trx
    .selectFrom("settings_lists")
    .selectAll()
    .where("list_key", "=", listKey)
    .where("is_active", "=", true)
    .orderBy("sort_order", "asc")
    .execute()) as SettingsListItem[];

  cache.set(listKey, { at: Date.now(), rows });
  return rows;
}

export async function getMultipleSettingsLists(trx: Tx, keys: string[]) {
  const entries: (readonly [string, SettingsListItem[]])[] = [];
  for (const key of keys) {
    entries.push([key, await getSettingsList(trx, key)] as const);
  }
  return Object.fromEntries(entries) as Record<string, SettingsListItem[]>;
}

/** Drop the cache after an edit in Settings so the change shows immediately. */
export function invalidateSettingsCache(listKey?: string) {
  if (listKey) cache.delete(listKey);
  else cache.clear();
}
