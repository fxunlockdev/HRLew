import "server-only";
import { Kysely, PostgresDialect, sql, type Transaction } from "kysely";
import { Pool } from "pg";
import { configurePgTypes } from "@/lib/db/pg-types";
import type { DB } from "@/lib/db/schema";

export type { DB } from "@/lib/db/schema";
export type Tx = Transaction<DB>;

configurePgTypes();

function connectionString(): string {
  // APP_DATABASE_URL points at the hr_app role, which cannot bypass RLS.
  // DATABASE_URL is Railway's superuser URL and is only a fallback so the app
  // still boots before the role is provisioned — RLS does not apply on it.
  const appUrl = process.env.APP_DATABASE_URL;
  if (appUrl) return appUrl;

  const fallback = process.env.DATABASE_URL;
  if (!fallback) {
    throw new Error(
      "No database connection string. Set APP_DATABASE_URL (preferred) or DATABASE_URL.",
    );
  }
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[db] APP_DATABASE_URL is not set — falling back to DATABASE_URL. " +
        "If that is a superuser role, row-level security is NOT being enforced.",
    );
  }
  return fallback;
}

function needsSsl(url: string): boolean {
  if (/\.railway\.internal/.test(url)) return false;
  if (/localhost|127\.0\.0\.1|::1/.test(url)) return false;
  return true;
}

function createPool(): Pool {
  const url = connectionString();
  return new Pool({
    connectionString: url,
    ssl: needsSsl(url) ? { rejectUnauthorized: false } : undefined,
    max: Number(process.env.DB_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

// Reuse across hot reloads in dev, otherwise every edit leaks a pool.
const globalForDb = globalThis as unknown as { __hrosPool?: Pool; __hrosDb?: Kysely<DB> };

export const pool: Pool = globalForDb.__hrosPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.__hrosPool = pool;

/**
 * Unscoped handle. Use for pre-auth work only: login, session lookup,
 * first-run setup. Data access goes through `withProfile`.
 */
export const db: Kysely<DB> =
  globalForDb.__hrosDb ?? new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
if (process.env.NODE_ENV !== "production") globalForDb.__hrosDb = db;

/**
 * Run `fn` in a transaction that knows who the actor is.
 *
 * The profile id is published as the `app.profile_id` GUC for the life of the
 * transaction, which is what every RLS policy and audit trigger reads (the
 * stand-in for Supabase's `auth.uid()`). Queries issued outside this wrapper
 * see nothing, by design.
 */
export async function withProfile<T>(profileId: string, fn: (trx: Tx) => Promise<T>): Promise<T> {
  return db.transaction().execute(async (trx) => {
    await sql`select set_config('app.profile_id', ${profileId}, true)`.execute(trx);
    return fn(trx);
  });
}

/**
 * Escape hatch for maintenance paths that legitimately run without an actor
 * (health checks, first-run setup). Audit rows get a null actor.
 */
export async function withoutProfile<T>(fn: (trx: Tx) => Promise<T>): Promise<T> {
  return db.transaction().execute((trx) => fn(trx));
}

export { sql } from "kysely";
