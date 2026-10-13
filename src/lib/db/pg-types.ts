import pg from "pg";

/**
 * Make node-postgres hand back the same JSON-ish shapes the Supabase REST
 * client used to, so every component that consumes this data keeps working:
 *
 *   timestamptz / timestamp -> ISO 8601 string   (not Date)
 *   date                    -> "YYYY-MM-DD"      (not Date)
 *   numeric                 -> number            (not string)
 *   int8                    -> number            (not string)
 *
 * numeric -> number loses precision past 2^53. Every numeric column here is
 * money or an experience figure well inside that range; nothing is summed in
 * the database beyond revenue totals, so this is safe for this schema.
 */
const OID = {
  INT8: 20,
  NUMERIC: 1700,
  DATE: 1082,
  TIMESTAMP: 1114,
  TIMESTAMPTZ: 1184,
} as const;

let configured = false;

export function configurePgTypes() {
  if (configured) return;
  configured = true;

  pg.types.setTypeParser(OID.NUMERIC, (value) => (value === null ? null : Number(value)));
  pg.types.setTypeParser(OID.INT8, (value) => (value === null ? null : Number(value)));

  // Dates stay plain strings — no timezone shifting on the way through.
  pg.types.setTypeParser(OID.DATE, (value) => value);

  const toIso = (value: string | null) => (value === null ? null : new Date(value).toISOString());
  pg.types.setTypeParser(OID.TIMESTAMPTZ, toIso);
  pg.types.setTypeParser(OID.TIMESTAMP, (value) =>
    value === null ? null : new Date(`${value}Z`).toISOString(),
  );
}
