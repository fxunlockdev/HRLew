#!/usr/bin/env node
/**
 * Migration runner.
 *
 * Applies db/migrations/*.sql in filename order, each inside its own
 * transaction, and records what ran in public.schema_migrations along with a
 * checksum so an already-applied file cannot be edited underneath us.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/migrate.mjs
 *   DATABASE_URL=... APP_DB_PASSWORD=... node scripts/migrate.mjs   # also provisions the hr_app role
 *   DATABASE_URL=... node scripts/migrate.mjs --demo                # plus db/demo_data.sql
 *   SEED_DEMO=1 ...                                                 # same, for a deploy step
 *   DATABASE_URL=... node scripts/migrate.mjs --status              # report only, change nothing
 *
 * Connect with the privileged (superuser) URL Railway gives you. The app itself
 * connects as hr_app so that row-level security actually applies.
 */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, "..", "db", "migrations");
const DEMO_FILE = join(HERE, "..", "db", "demo_data.sql");
const APP_ROLE = "hr_app";

const args = new Set(process.argv.slice(2));
const wantDemo =
  args.has("--demo") || ["1", "true"].includes((process.env.SEED_DEMO ?? "").toLowerCase());
const statusOnly = args.has("--status");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const checksum = (sql) => createHash("sha256").update(sql).digest("hex").slice(0, 16);

function sslFor(url) {
  // Railway's internal network needs no TLS; public proxy endpoints do, and
  // present a cert chain Node does not ship a root for.
  if (/\.railway\.internal/.test(url) || /localhost|127\.0\.0\.1/.test(url)) return undefined;
  return { rejectUnauthorized: false };
}

async function ensureMigrationsTable(client) {
  await client.query(`
    create table if not exists public.schema_migrations (
      filename text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `);
}

async function ensureAppRole(client) {
  const password = process.env.APP_DB_PASSWORD;
  if (!password) {
    console.log("· APP_DB_PASSWORD not set — skipping hr_app role provisioning");
    return false;
  }
  const { rows } = await client.query("select 1 from pg_roles where rolname = $1", [APP_ROLE]);
  const literal = (await client.query("select quote_literal($1::text) as q", [password])).rows[0].q;
  if (rows.length === 0) {
    await client.query(
      `create role ${APP_ROLE} with login password ${literal} ` +
        `nosuperuser nocreatedb nocreaterole noreplication nobypassrls`,
    );
    console.log(`✓ created role ${APP_ROLE}`);
  } else {
    await client.query(`alter role ${APP_ROLE} with login password ${literal} nobypassrls`);
    console.log(`✓ updated role ${APP_ROLE} password`);
  }
  return true;
}

async function main() {
  const client = new pg.Client({ connectionString, ssl: sslFor(connectionString) });
  await client.connect();

  try {
    await ensureMigrationsTable(client);

    const applied = new Map(
      (await client.query("select filename, checksum from public.schema_migrations")).rows.map(
        (r) => [r.filename, r.checksum],
      ),
    );

    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
    if (files.length === 0) throw new Error(`no migrations found in ${MIGRATIONS_DIR}`);

    if (statusOnly) {
      for (const file of files) {
        const sum = checksum(await readFile(join(MIGRATIONS_DIR, file), "utf8"));
        const prev = applied.get(file);
        const state = !prev ? "PENDING" : prev === sum ? "applied" : "CHANGED SINCE APPLIED";
        console.log(`${state.padEnd(22)} ${file}`);
      }
      return;
    }

    if (!applied.size) await ensureAppRole(client);

    let ran = 0;
    for (const file of files) {
      const sql = await readFile(join(MIGRATIONS_DIR, file), "utf8");
      const sum = checksum(sql);
      const prev = applied.get(file);

      if (prev === sum) {
        console.log(`· ${file} (already applied)`);
        continue;
      }
      if (prev && prev !== sum) {
        throw new Error(
          `${file} has changed since it was applied (${prev} -> ${sum}). ` +
            `Add a new migration instead of editing an applied one.`,
        );
      }

      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          "insert into public.schema_migrations (filename, checksum) values ($1, $2)",
          [file, sum],
        );
        await client.query("commit");
        console.log(`✓ ${file}`);
        ran += 1;
      } catch (err) {
        await client.query("rollback");
        throw new Error(`${file} failed: ${err.message}`);
      }
    }

    // Grants have to run after the role exists; re-assert them when the role
    // was provisioned on a database whose migrations were already applied.
    if (ran === 0 && process.env.APP_DB_PASSWORD) {
      const created = await ensureAppRole(client);
      if (created) {
        const grants = await readFile(join(MIGRATIONS_DIR, "0006_rls_policies.sql"), "utf8");
        const block = grants.slice(grants.indexOf("do $$\nbegin\n  if not exists"));
        if (block) {
          await client.query(block);
          console.log("✓ re-applied hr_app grants");
        }
      }
    }

    if (wantDemo) {
      const demo = await readFile(DEMO_FILE, "utf8");
      await client.query("begin");
      try {
        await client.query(demo);
        await client.query("commit");
        console.log("✓ db/demo_data.sql");
      } catch (err) {
        await client.query("rollback");
        throw new Error(`demo data failed: ${err.message}`);
      }
    }

    console.log(ran === 0 ? "Database already up to date." : `Applied ${ran} migration(s).`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}`);
  process.exit(1);
});
