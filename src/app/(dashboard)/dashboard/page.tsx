import { requireAuth } from "@/lib/auth";
import { withProfile, type Tx } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { PlacementChart } from "@/components/dashboard/placement-chart";
import { PipelineByStage } from "@/components/dashboard/pipeline-by-stage";
import { TopRecruiters } from "@/components/dashboard/top-recruiters";
import { hasPermission } from "@/lib/rbac";
import { sql } from "kysely";

export const metadata = { title: "Dashboard · HR OS" };

/** Statuses that take a candidate out of active circulation. */
const CLOSED_CANDIDATE_STATUSES = ["rejected", "joined", "not_interested", "blacklisted"];

interface Counts {
  totalCandidates: number;
  activeCandidates: number;
  newCandidatesThisWeek: number;
  activeClients: number;
  openJobs: number;
  pipelineCount: number;
  scheduledInterviews: number;
  offersReleased: number;
  placementsThisMonth: number;
  revenueThisMonth: number;
}

function monthStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

/**
 * Every headline number in one round trip. The Supabase version issued ten
 * count queries plus a full revenue scan it summed in JS.
 */
async function loadCounts(trx: Tx): Promise<Counts> {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const since = monthStart();

  const row = await sql<{
    total_candidates: number;
    active_candidates: number;
    new_candidates_this_week: number;
    active_clients: number;
    open_jobs: number;
    pipeline_count: number;
    scheduled_interviews: number;
    offers_released: number;
    placements_this_month: number;
    revenue_this_month: number;
  }>`
    select
      (select count(*)::int from candidates) as total_candidates,
      (select count(*)::int from candidates
        where status <> all(${sql.val(CLOSED_CANDIDATE_STATUSES)}::text[])) as active_candidates,
      (select count(*)::int from candidates where created_at >= ${weekAgo}) as new_candidates_this_week,
      (select count(*)::int from clients where status = 'active') as active_clients,
      (select count(*)::int from job_requirements where status = 'open') as open_jobs,
      (select count(*)::int from candidate_job_pipeline where is_active) as pipeline_count,
      (select count(*)::int from interviews where status = 'scheduled') as scheduled_interviews,
      (select count(*)::int from candidate_job_pipeline
        where current_stage = 'offer_released') as offers_released,
      (select count(*)::int from placements
        where joining_date >= ${since}::date) as placements_this_month,
      (select coalesce(sum(placement_revenue), 0)::float8 from placements
        where joining_date >= ${since}::date) as revenue_this_month
  `.execute(trx);

  const r = row.rows[0];
  return {
    totalCandidates: r?.total_candidates ?? 0,
    activeCandidates: r?.active_candidates ?? 0,
    newCandidatesThisWeek: r?.new_candidates_this_week ?? 0,
    activeClients: r?.active_clients ?? 0,
    openJobs: r?.open_jobs ?? 0,
    pipelineCount: r?.pipeline_count ?? 0,
    scheduledInterviews: r?.scheduled_interviews ?? 0,
    offersReleased: r?.offers_released ?? 0,
    placementsThisMonth: r?.placements_this_month ?? 0,
    revenueThisMonth: r?.revenue_this_month ?? 0,
  };
}

async function loadPipelineByStage(trx: Tx) {
  const rows = await trx
    .selectFrom("candidate_job_pipeline")
    .select(["current_stage as stage", sql<number>`count(*)::int`.as("count")])
    .where("is_active", "=", true)
    .groupBy("current_stage")
    .orderBy("count", "desc")
    .execute();
  return rows;
}

async function loadPlacementsByMonth(trx: Tx) {
  const start = new Date();
  start.setUTCMonth(start.getUTCMonth() - 5);
  start.setUTCDate(1);

  const rows = await sql<{ month: string; count: number; revenue: number }>`
    select
      to_char(date_trunc('month', joining_date), 'YYYY-MM') as month,
      count(*)::int as count,
      coalesce(sum(placement_revenue), 0)::float8 as revenue
    from placements
    where joining_date >= ${start.toISOString().slice(0, 10)}::date
    group by 1
    order by 1
  `.execute(trx);

  return rows.rows;
}

async function loadTopRecruiters(trx: Tx) {
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - 1);

  const rows = await trx
    .selectFrom("placements")
    .leftJoin("profiles", "profiles.id", "placements.recruiter_id")
    .select([
      sql<string>`coalesce(profiles.full_name, 'Unknown')`.as("name"),
      sql<number>`count(*)::int`.as("placements"),
      sql<number>`coalesce(sum(placements.placement_revenue), 0)::float8`.as("revenue"),
    ])
    .where("placements.created_at", ">=", since.toISOString())
    .where("placements.recruiter_id", "is not", null)
    .groupBy(["placements.recruiter_id", "profiles.full_name"])
    .orderBy("placements", "desc")
    .limit(5)
    .execute();

  return rows;
}

export default async function DashboardPage() {
  const { profile, permissions } = await requireAuth();
  const canViewRevenue =
    hasPermission(profile, permissions, "kpi", "view_company") ||
    profile.role?.name === "admin" ||
    profile.role?.name === "manager";

  const { counts, pipelineByStage, placementsByMonth, topRecruiters } = await withProfile(
    profile.id,
    async (trx) => ({
      counts: await loadCounts(trx),
      pipelineByStage: await loadPipelineByStage(trx),
      placementsByMonth: await loadPlacementsByMonth(trx),
      topRecruiters: await loadTopRecruiters(trx),
    }),
  );

  return (
    <>
      <PageHeader
        title={`Welcome back, ${profile.full_name?.split(" ")[0] ?? "there"}`}
        description="Real-time view of your recruitment pipeline and operating health."
      />

      <KpiGrid counts={counts} canViewRevenue={canViewRevenue} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PlacementChart data={placementsByMonth} showRevenue={canViewRevenue} />
        </div>
        <div>
          <PipelineByStage data={pipelineByStage} />
        </div>
      </div>

      <TopRecruiters data={topRecruiters} showRevenue={canViewRevenue} />
    </>
  );
}
