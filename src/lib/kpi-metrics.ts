// Shared KPI metric definitions used by the staff target editor and the
// KPIs & Reports attainment view. Keys must match the actuals computed in
// src/lib/kpi-actuals.ts.

export interface KpiMetricDef {
  key: KpiMetricKey;
  label: string;
  currency?: boolean;
}

export type KpiMetricKey =
  | "candidates_added"
  | "submissions"
  | "interviews"
  | "placements"
  | "revenue";

export const KPI_METRICS: KpiMetricDef[] = [
  { key: "candidates_added", label: "Candidates added" },
  { key: "submissions", label: "Submissions" },
  { key: "interviews", label: "Interviews scheduled" },
  { key: "placements", label: "Placements" },
  { key: "revenue", label: "Revenue", currency: true },
];

export const KPI_PERIOD = "monthly" as const;

/** First day of the month (YYYY-MM-01) for the given date, in local time. */
export function currentPeriodStart(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function periodLabel(periodStart: string): string {
  return new Date(periodStart).toLocaleDateString("en-AE", {
    month: "long",
    year: "numeric",
  });
}
