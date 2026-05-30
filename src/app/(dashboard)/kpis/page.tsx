import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { hasPermission } from "@/lib/rbac";
import { formatCurrency, formatNumber } from "@/lib/utils";

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

  return (
    <>
      <PageHeader title="KPIs & Reports" description="Operational performance across last 30 days." />

      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="recruiters">Recruiters</TabsTrigger>
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
