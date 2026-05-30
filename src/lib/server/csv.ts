import Papa from "papaparse";

export function rowsToCsv<T extends Record<string, unknown>>(rows: T[]): string {
  if (!rows.length) return "";
  return Papa.unparse(rows);
}

export function csvToRows(csv: string): Record<string, string>[] {
  const out = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  return out.data ?? [];
}
