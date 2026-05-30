import type { KpiMetricKey } from "@/lib/kpi-metrics";

export type RecruiterActuals = Record<KpiMetricKey, number>;

export function zeroActuals(): RecruiterActuals {
  return {
    candidates_added: 0,
    submissions: 0,
    interviews: 0,
    placements: 0,
    revenue: 0,
  };
}

/**
 * Compute per-recruiter (per profile id) actuals since the given ISO timestamp.
 * Returns a Map keyed by profile id; callers default missing entries to zeros.
 */
export async function computeRecruiterActuals(
  // Supabase server client; typed loosely to avoid generated-type coupling.
  supabase: { from: (t: string) => any },
  sinceIso: string,
): Promise<Map<string, RecruiterActuals>> {
  const sinceDate = sinceIso.slice(0, 10);

  const [
    { data: candidates },
    { data: submissions },
    { data: interviews },
    { data: placements },
  ] = await Promise.all([
    supabase.from("candidates").select("assigned_recruiter_id").gte("created_at", sinceIso),
    supabase
      .from("candidate_job_pipeline")
      .select("assigned_recruiter_id")
      .gte("submitted_at", sinceIso),
    supabase.from("interviews").select("scheduled_by").gte("created_at", sinceIso),
    supabase
      .from("placements")
      .select("recruiter_id, placement_revenue")
      .gte("joining_date", sinceDate),
  ]);

  const map = new Map<string, RecruiterActuals>();
  const bump = (id: string | null, fn: (a: RecruiterActuals) => void) => {
    if (!id) return;
    const cur = map.get(id) ?? zeroActuals();
    fn(cur);
    map.set(id, cur);
  };

  (candidates ?? []).forEach((c: { assigned_recruiter_id: string | null }) =>
    bump(c.assigned_recruiter_id, (a) => (a.candidates_added += 1)),
  );
  (submissions ?? []).forEach((s: { assigned_recruiter_id: string | null }) =>
    bump(s.assigned_recruiter_id, (a) => (a.submissions += 1)),
  );
  (interviews ?? []).forEach((i: { scheduled_by: string | null }) =>
    bump(i.scheduled_by, (a) => (a.interviews += 1)),
  );
  (placements ?? []).forEach((p: { recruiter_id: string | null; placement_revenue: number | null }) =>
    bump(p.recruiter_id, (a) => {
      a.placements += 1;
      a.revenue += p.placement_revenue ?? 0;
    }),
  );

  return map;
}
