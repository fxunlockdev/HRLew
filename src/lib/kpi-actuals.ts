import type { Tx } from "@/lib/db";
import { sql } from "kysely";
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
 * Which date decides that a placement falls inside the window.
 *
 *   joining_date - when the candidate actually joined (used for target
 *                  attainment, so a target is credited in the month of joining)
 *   created_at   - when the placement was recorded (used by the recruiter
 *                  leaderboard, which reports on recent activity)
 *
 * Both definitions existed in the original app; keeping them explicit stops one
 * silently becoming the other.
 */
export type PlacementBasis = "joining_date" | "created_at";

/**
 * Per-recruiter actuals since `sinceIso`, keyed by profile id. Callers default
 * missing entries to zeros.
 *
 * Counting happens in the database rather than by pulling every row back and
 * tallying in JS, which is what the Supabase version did.
 */
export async function computeRecruiterActuals(
  trx: Tx,
  sinceIso: string,
  placementBasis: PlacementBasis = "joining_date",
): Promise<Map<string, RecruiterActuals>> {
  const sinceDate = sinceIso.slice(0, 10);

  const [candidates, submissions, interviews, placements] = await Promise.all([
    trx
      .selectFrom("candidates")
      .select(["assigned_recruiter_id as id", sql<number>`count(*)::int`.as("n")])
      .where("created_at", ">=", sinceIso)
      .where("assigned_recruiter_id", "is not", null)
      .groupBy("assigned_recruiter_id")
      .execute(),
    trx
      .selectFrom("candidate_job_pipeline")
      .select(["assigned_recruiter_id as id", sql<number>`count(*)::int`.as("n")])
      .where("submitted_at", ">=", sinceIso)
      .where("assigned_recruiter_id", "is not", null)
      .groupBy("assigned_recruiter_id")
      .execute(),
    trx
      .selectFrom("interviews")
      .select(["scheduled_by as id", sql<number>`count(*)::int`.as("n")])
      .where("created_at", ">=", sinceIso)
      .where("scheduled_by", "is not", null)
      .groupBy("scheduled_by")
      .execute(),
    trx
      .selectFrom("placements")
      .select([
        "recruiter_id as id",
        sql<number>`count(*)::int`.as("n"),
        sql<number>`coalesce(sum(placement_revenue), 0)::float8`.as("revenue"),
      ])
      .$if(placementBasis === "joining_date", (qb) => qb.where("joining_date", ">=", sinceDate))
      .$if(placementBasis === "created_at", (qb) => qb.where("created_at", ">=", sinceIso))
      .where("recruiter_id", "is not", null)
      .groupBy("recruiter_id")
      .execute(),
  ]);

  const map = new Map<string, RecruiterActuals>();
  const at = (id: string | null): RecruiterActuals | null => {
    if (!id) return null;
    const existing = map.get(id);
    if (existing) return existing;
    const fresh = zeroActuals();
    map.set(id, fresh);
    return fresh;
  };

  candidates.forEach((r) => {
    const a = at(r.id);
    if (a) a.candidates_added = r.n;
  });
  submissions.forEach((r) => {
    const a = at(r.id);
    if (a) a.submissions = r.n;
  });
  interviews.forEach((r) => {
    const a = at(r.id);
    if (a) a.interviews = r.n;
  });
  placements.forEach((r) => {
    const a = at(r.id);
    if (a) {
      a.placements = r.n;
      a.revenue = r.revenue;
    }
  });

  return map;
}
