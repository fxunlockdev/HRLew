import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasPermission } from "@/lib/rbac";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { KPI_METRICS, KPI_PERIOD, currentPeriodStart, periodLabel } from "@/lib/kpi-metrics";
import { computeRecruiterActuals, zeroActuals } from "@/lib/kpi-actuals";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "KPIs & Reports · HRLew" };

interface RecruiterKpi {
  recruiter_id: string;
  name: string;
  candidates_added: number;
  submissions: number;
  interviews: number;
  offers: number;
  placements: number;
  revenue: number;
}

export default async function KpisPage() {
  const { profile, permissions } = await requireAuth();
  const supabase = await getSupabaseServerClient();
  const canViewRevenue = hasPermission(profile, permissions, "kpi", "view_company") || profile.role?.name === "admin" || profile.role?.name === "manager";

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceIso = since.toISOString();

  const [
    { count: candidatesAdded },
    { count: candidatesSubmitted },
    { count: interviewsScheduled },
    { count: offers },
    { count: joinings },
    { data: placementsRevenue },
    { data: profiles },
    { data: candidatesByRecruiter },
    { data: submissionsByRecruiter },
    { data: interviewsByRecruiter },
    { data: placementsByRecruiter },
  ] = await Promise.all([
    supabase.from("candidates").select("*", { count: "exact", head: true }).gte("created_at", sinceIso),
    supabase.from("candidate_job_pipeline").select("*", { count: "exact", head: true }).gte("submitted_at", sinceIso),
    supabase.from("interviews").select("*", { count: "exact", head: true }).gte("created_at", sinceIso),
    supabase.from("candidate_job_pipeline").select("*", { count: "exact", head: true }).eq("current_stage", "offer_released"),
    supabase.from("placements").select("*", { count: "exact", head: true }).gte("joining_date", since.toISOString().slice(0, 10)),
    supabase.from("placements").select("placement_revenue").gte("joining_date", since.toISOString().slice(0, 10)),
    supabase.from("profiles").select("id, full_name").eq("status", "active"),
    supabase.from("candidates").select("assigned_recruiter_id").gte("created_at", sinceIso),
    supabase.from("candidate_job_pipeline").select("assigned_recruiter_id").gte("submitted_at", sinceIso),
    supabase.from("interviews").select("scheduled_by").gte("created_at", sinceIso),
    supabase.from("placements").select("recruiter_id, placement_revenue").gte("created_at", sinceIso),
  ]);

  const revenue = placementsRevenue?.reduce((s, p: any) => s + (p.placement_revenue ?? 0), 0) ?? 0;

  // Aggregate per recruiter
  const byRecruiter = new Map<string, RecruiterKpi>();
  profiles?.forEach((p) => {
    byRecruiter.set(p.id, {
      recruiter_id: p.id,
      name: p.full_name ?? "—",
      candidates_added: 0,
      submissions: 0,
      interviews: 0,
      offers: 0,
      placements: 0,
      revenue: 0,
    });
  });
  candidatesByRecruiter?.forEach((c: any) => {
    if (!c.assigned_recruiter_id) return;
    const k = byRecruiter.get(c.assigned_recruiter_id);
    if (k) k.candidates_added += 1;
  });
  submissionsByRecruiter?.forEach((s: any) => {
    if (!s.assigned_recruiter_id) return;
    const k = byRecruiter.get(s.assigned_recruiter_id);
    if (k) k.submissions += 1;
  });
  interviewsByRecruiter?.forEach((i: any) => {
    if (!i.scheduled_by) return;
    const k = byRecruiter.get(i.scheduled_by);
    if (k) k.interviews += 1;
  });
  placementsByRecruiter?.forEach((p: any) => {
    if (!p.recruiter_id) return;
    const k = byRecruiter.get(p.recruiter_id);
    if (k) {
      k.placements += 1;
      k.revenue += p.placement_revenue ?? 0;
    }
  });
  const recruiterRows = Array.from(byRecruiter.values()).sort((a, b) => b.placements - a.placements);

  // ---- Staff KPI targets vs actuals (current month) ----
  const periodStart = currentPeriodStart();
  const monthIso = new Date(periodStart).toISOString();
  const [{ data: staffRows }, { data: targetRows }, monthActuals] = await Promise.all([
    supabase.from("staff").select("id, full_name, profile_id").neq("employment_status", "ex_employee"),
    supabase
      .from("kpi_targets")
      .select("staff_id, metric_key, target_value")
      .eq("period", KPI_PERIOD)
      .eq("period_start", periodStart),
    computeRecruiterActuals(supabase, monthIso),
  ]);

  const targetsByStaff = new Map<string, Map<string, number>>();
  targetRows?.forEach((t: { staff_id: string; metric_key: string; target_value: number }) => {
    const m = targetsByStaff.get(t.staff_id) ?? new Map<string, number>();
    m.set(t.metric_key, Number(t.target_value));
    targetsByStaff.set(t.staff_id, m);
  });

  interface AttainRow {
    staff: string;
    metricLabel: string;
    currency: boolean;
    target: number;
    actual: number;
    pct: number;
  }
  const attainmentRows: AttainRow[] = [];
  (staffRows ?? [])
    .filter((s: { id: string }) => targetsByStaff.has(s.id))
    .forEach((s: { id: string; full_name: string; profile_id: string | null }) => {
      const tmap = targetsByStaff.get(s.id)!;
      const actuals = (s.profile_id && monthActuals.get(s.profile_id)) || zeroActuals();
      KPI_METRICS.forEach((m) => {
        const target = tmap.get(m.key);
        if (target == null) return;
        const actual = actuals[m.key];
        attainmentRows.push({
          staff: s.full_name,
          metricLabel: m.label,
          currency: !!m.currency,
          target,
          actual,
          pct: target > 0 ? Math.round((actual / target) * 100) : 0,
        });
      });
    });

  return (
    <>
      <PageHeader title="KPIs & Reports" description="Operational performance across last 30 days." />

      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="recruiters">Recruiters</TabsTrigger>
          {canViewRevenue && <TabsTrigger value="targets">Staff targets</TabsTrigger>}
        </TabsList>

        <TabsContent value="company">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Candidates added" value={formatNumber(candidatesAdded ?? 0)} />
            <Kpi label="Submissions" value={formatNumber(candidatesSubmitted ?? 0)} />
            <Kpi label="Interviews scheduled" value={formatNumber(interviewsScheduled ?? 0)} />
            <Kpi label="Offers released" value={formatNumber(offers ?? 0)} />
            <Kpi label="Joinings" value={formatNumber(joinings ?? 0)} />
            {canViewRevenue && <Kpi label="Revenue" value={formatCurrency(revenue)} />}
            <Kpi label="Submission → interview" value={candidatesSubmitted ? `${Math.round(((interviewsScheduled ?? 0) / candidatesSubmitted) * 100)}%` : "—"} />
            <Kpi label="Interview → offer" value={(interviewsScheduled ?? 0) ? `${Math.round(((offers ?? 0) / (interviewsScheduled ?? 1)) * 100)}%` : "—"} />
          </div>
        </TabsContent>

        <TabsContent value="recruiters">
          <Card>
            <CardHeader><CardTitle className="text-base">Per-recruiter performance · last 30 days</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recruiter</TableHead>
                    <TableHead className="text-right">Added</TableHead>
                    <TableHead className="text-right">Submissions</TableHead>
                    <TableHead className="text-right">Interviews</TableHead>
                    <TableHead className="text-right">Placements</TableHead>
                    {canViewRevenue && <TableHead className="text-right">Revenue</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recruiterRows.map((r) => (
                    <TableRow key={r.recruiter_id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-right">{r.candidates_added}</TableCell>
                      <TableCell className="text-right">{r.submissions}</TableCell>
                      <TableCell className="text-right">{r.interviews}</TableCell>
                      <TableCell className="text-right">{r.placements}</TableCell>
                      {canViewRevenue && <TableCell className="text-right">{formatCurrency(r.revenue)}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {canViewRevenue && (
          <TabsContent value="targets">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Staff KPI attainment · {periodLabel(periodStart)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {attainmentRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No KPI targets set yet. Open a staff member (Staff → a person) and set their
                    monthly targets — attainment will track here automatically.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff</TableHead>
                        <TableHead>Metric</TableHead>
                        <TableHead className="text-right">Target</TableHead>
                        <TableHead className="text-right">Actual (MTD)</TableHead>
                        <TableHead className="text-right">Attainment</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attainmentRows.map((r, i) => (
                        <TableRow key={`${r.staff}-${r.metricLabel}-${i}`}>
                          <TableCell className="font-medium">{r.staff}</TableCell>
                          <TableCell>{r.metricLabel}</TableCell>
                          <TableCell className="text-right">
                            {r.currency ? formatCurrency(r.target) : formatNumber(r.target)}
                          </TableCell>
                          <TableCell className="text-right">
                            {r.currency ? formatCurrency(r.actual) : formatNumber(r.actual)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={r.pct >= 100 ? "default" : r.pct >= 60 ? "secondary" : "outline"}
                            >
                              {r.pct}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1.5 text-2xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}
