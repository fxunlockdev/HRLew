import { sql, type RawBuilder } from "kysely";

/**
 * Case-insensitive "contains" against a nullable text column, written so a
 * user's search string can never be read as SQL or as pattern syntax.
 *
 * The Supabase original interpolated the query straight into PostgREST's
 * filter DSL (`full_name.ilike.%${q}%`), where a `,` or `)` in the input
 * rewrote the filter. Here the term is a bound parameter and the wildcards are
 * added around it.
 */
export function ilikeContains(column: RawBuilder<unknown> | string, term: string) {
  const col = typeof column === "string" ? sql.ref(column) : column;
  const escaped = term.replace(/[\\%_]/g, (ch) => `\\${ch}`);
  return sql<boolean>`${col} ilike ${`%${escaped}%`}`;
}

/** Shorthand for `count(*)::int` — pg returns bigint, callers want a number. */
export const countAll = sql<number>`count(*)::int`;
