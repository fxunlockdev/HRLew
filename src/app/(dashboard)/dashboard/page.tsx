import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { PlacementChart } from "@/components/dashboard/placement-chart";
import { PipelineByStage } from "@/components/dashboard/pipeline-by-stage";
import { TopRecruiters } from "@/components/dashboard/top-recruiters";
import { hasPermission } from "@/lib/rbac";

export const metadata = { title: "Dashboard · HR OS" };

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

async function loadCounts(): Promise<Counts> {
  const supabase = await getSupabaseServerClient();

  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();
  const monthStart = new Date(new Date().setDate(1)).toISOString().slice(0, 10);

  const [
    candidatesTotal,
    candidatesActive,
    candidatesWeek,
    clientsActive,
    jobsOpen,
    pipelineActive,
    interviewsScheduled,
    offersReleased,
    placementsThisMonth,
    revenueRow,
  ] = await Promise.all([
    supabase.from("candidates").select("*", { count: "exact", head: true }),
    supabase
      .from("candidates")
      .select("*", { count: "exact", head: true })
      .not("status", "in", "(rejected,joined,not_interested,blacklisted)"),
    supabase
      .from("candidates")
      .select("*", { count: "exact", head: true })
      .gte("created_at", weekAgo),
    supabase.from("clients").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("job_requirements").select("*", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("candidate_job_pipeline").select("*", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("interviews").select("*", { count: "exact", head: true }).eq("status", "scheduled"),
    supabase
      .from("candidate_job_pipeline")
      .select("*", { count: "exact", head: true })
      .eq("current_stage", "offer_released"),
    supabase
      .from("placements")
      .select("*", { count: "exact", head: true })
      .gte("joining_date", monthStart),
    supabase.from("placements").select("placement_revenue").gte("joining_date", monthStart),
  ]);

  const revenueThisMonth =
    revenueRow.data?.reduce((s, p: { placement_revenue: number | null }) => s + (p.placement_revenue ?? 0), 0) ?? 0;

  return {
    totalCandidates: candidatesTotal.count ?? 0,
    activeCandidates: candidatesActive.count ?? 0,
    newCandidatesThisWeek: candidatesWeek.count ?? 0,
    activeClients: clientsActive.count ?? 0,
    openJobs: jobsOpen.count ?? 0,
    pipelineCount: pipelineActive.count ?? 0,
    scheduledInterviews: interviewsScheduled.count ?? 0,
    offersReleased: offersReleased.count ?? 0,
    placementsThisMonth: placementsThisMonth.count ?? 0,
    revenueThisMonth,
  };
}

async function loadPipelineByStage() {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("candidate_job_pipeline")
    .select("current_stage")
    .eq("is_active", true);

  const buckets = new Map<string, number>();
  data?.forEach((row: { current_stage: string }) => {
    buckets.set(row.current_stage, (buckets.get(row.current_stage) ?? 0) + 1);
  });
  return Array.from(buckets.entries()).map(([stage, count]) => ({ stage, count }));
}

async function loadPlacementsByMonth() {
  const supabase = await getSupabaseServerClient();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);

  const { data } = await supabase
    .from("placements")
    .select("joining_date, placement_revenue")
    .gte("joining_date", sixMonthsAgo.toISOString().slice(0, 10));

  const buckets = new Map<string, { count: number; revenue: number }>();
  data?.forEach((row: { joining_date: string | null; placement_revenue: number | null }) => {
    if (!row.joining_date) return;
    const key = row.joining_date.slice(0, 7); // YYYY-MM
    const b = buckets.get(key) ?? { count: 0, revenue: 0 };
    b.count += 1;
    b.revenue += row.placement_revenue ?? 0;
    buckets.set(key, b);
  });
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v }));
}

async function loadTopRecruiters() {
  const supabase = await getSupabaseServerClient();
  const since = new Date();
  since.setMonth(since.getMonth() - 1);

  const { data } = await supabase
    .from("placements")
    .select("recruiter_id, placement_revenue, profile:profiles!placements_recruiter_id_fkey(full_name)")
    .gte("created_at", since.toISOString());

  const buckets = new Map<string, { name: string; placements: number; revenue: number }>();
  data?.forEach((row: any) => {
    if (!row.recruiter_id) return;
    const cur = buckets.get(row.recruiter_id) ?? {
      name: row.profile?.full_name ?? "Unknown",
      placements: 0,
      revenue: 0,
    };
    cur.placements += 1;
    cur.revenue += row.placement_revenue ?? 0;
    buckets.set(row.recruiter_id, cur);
  });

  return Array.from(buckets.values())
    .sort((a, b) => b.placements - a.placements)
    .slice(0, 5);
}

export default async function DashboardPage() {
  const { profile, permissions } = await requireAuth();
  const canViewRevenue = hasPermission(profile, permissions, "kpi", "view_company") || profile.role?.name === "admin" || profile.role?.name === "manager";

  const [counts, pipelineByStage, placementsByMonth, topRecruiters] = await Promise.all([
    loadCounts(),
    loadPipelineByStage(),
    loadPlacementsByMonth(),
    loadTopRecruiters(),
  ]);

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
