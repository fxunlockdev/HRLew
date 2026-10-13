import { describe, expect, it } from "vitest";
import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from "kysely";
import type { DB } from "@/lib/db/schema";
import { countAll, ilikeContains } from "@/lib/db/sql-helpers";

/** Compiles SQL without connecting to anything. */
const db = new Kysely<DB>({
  dialect: {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (i) => new PostgresIntrospector(i),
    createQueryCompiler: () => new PostgresQueryCompiler(),
  },
});

const compileSearch = (term: string) =>
  db
    .selectFrom("candidates")
    .select("id")
    .where((eb) => eb.or([ilikeContains("full_name", term), ilikeContains("email", term)]))
    .compile();

describe("ilikeContains", () => {
  it("binds the search term as a parameter, never as SQL", () => {
    const { sql, parameters } = compileSearch("mehta");
    expect(sql).toContain('"full_name" ilike $1');
    expect(sql).toContain('"email" ilike $2');
    expect(parameters).toEqual(["%mehta%", "%mehta%"]);
  });

  it("keeps SQL metacharacters inside the parameter", () => {
    // The Supabase original interpolated the term into PostgREST's filter DSL
    // (`full_name.ilike.%TERM%`), where a comma or paren rewrote the filter.
    const hostile = "x',1)--";
    const { sql, parameters } = compileSearch(hostile);
    expect(sql).not.toContain(hostile);
    expect(parameters[0]).toBe(`%${hostile}%`);
  });

  it("escapes LIKE wildcards so they match literally", () => {
    expect(compileSearch("100%").parameters[0]).toBe("%100\\%%");
    expect(compileSearch("a_b").parameters[0]).toBe("%a\\_b%");
    expect(compileSearch("back\\slash").parameters[0]).toBe("%back\\\\slash%");
  });

  it("does not let a term inject an OR that widens the result set", () => {
    const { parameters } = compileSearch("' or '1'='1");
    expect(parameters).toEqual(["%' or '1'='1%", "%' or '1'='1%"]);
  });

  it("quotes the column reference", () => {
    const { sql } = db
      .selectFrom("candidates")
      .select("id")
      .where(() => ilikeContains("current_company", "acme"))
      .compile();
    expect(sql).toContain('"current_company" ilike $1');
  });
});

describe("countAll", () => {
  it("casts to int so the driver returns a number, not a bigint string", () => {
    const { sql } = db.selectFrom("candidates").select(countAll.as("count")).compile();
    expect(sql).toContain("count(*)::int");
  });
});
