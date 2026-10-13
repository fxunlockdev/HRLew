import { withProfile, type Tx } from "@/lib/db";
import { sql } from "kysely";
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

export const metadata = { title: "KPIs & Reports · HR OS" };

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
  const canViewRevenue =
    hasPermission(profile, permissions, "kpi", "view_company") ||
    profile.role?.name === "admin" ||
    profile.role?.name === "manager";

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceIso = since.toISOString();
  const sinceDate = sinceIso.slice(0, 10);
  const periodStart = currentPeriodStart();
  const monthIso = new Date(periodStart).toISOString();

  /** Headline totals for the last 30 days, counted in the database. */
  async function loadTotals(trx: Tx) {
    const result = await sql<{
      candidates_added: number;
      candidates_submitted: number;
      interviews_scheduled: number;
      offers: number;
      joinings: number;
      revenue: number;
    }>`
      select
        (select count(*)::int from candidates where created_at >= ${sinceIso}) as candidates_added,
        (select count(*)::int from candidate_job_pipeline
          where submitted_at >= ${sinceIso}) as candidates_submitted,
        (select count(*)::int from interviews where created_at >= ${sinceIso}) as interviews_scheduled,
        (select count(*)::int from candidate_job_pipeline
          where current_stage = 'offer_released') as offers,
        (select count(*)::int from placements where joining_date >= ${sinceDate}::date) as joinings,
        (select coalesce(sum(placement_revenue), 0)::float8 from placements
          where joining_date >= ${sinceDate}::date) as revenue
    `.execute(trx);
    return result.rows[0];
  }

  const { totals, recruiterRows, staffRows, targetRows, monthActuals } = await withProfile(
    profile.id,
    async (trx) => {
      const perRecruiter = await computeRecruiterActuals(trx, sinceIso, "created_at");
      const activeProfiles = await trx
        .selectFrom("profiles")
        .select(["id", "full_name"])
        .where("status", "=", "active")
        .execute();

      // Offers are not per-recruiter in the source data, so they stay at zero
      // here exactly as they did before.
      const rows: RecruiterKpi[] = activeProfiles
        .map((prof) => {
          const actuals = perRecruiter.get(prof.id) ?? zeroActuals();
          return {
            recruiter_id: prof.id,
            name: prof.full_name ?? "—",
            candidates_added: actuals.candidates_added,
            submissions: actuals.submissions,
            interviews: actuals.interviews,
            offers: 0,
            placements: actuals.placements,
            revenue: actuals.revenue,
          };
        })
        .sort((a, b) => b.placements - a.placements);

      return {
        totals: await loadTotals(trx),
        recruiterRows: rows,
        staffRows: await trx
          .selectFrom("staff")
          .select(["id", "full_name", "profile_id"])
          .where("employment_status", "!=", "ex_employee")
          .execute(),
        targetRows: await trx
          .selectFrom("kpi_targets")
          .select(["staff_id", "metric_key", "target_value"])
          .where("period", "=", KPI_PERIOD)
          .where("period_start", "=", periodStart)
          .execute(),
        monthActuals: await computeRecruiterActuals(trx, monthIso),
      };
    },
  );

  const candidatesAdded = totals?.candidates_added ?? 0;
  const candidatesSubmitted = totals?.candidates_submitted ?? 0;
  const interviewsScheduled = totals?.interviews_scheduled ?? 0;
  const offers = totals?.offers ?? 0;
  const joinings = totals?.joinings ?? 0;
  const revenue = totals?.revenue ?? 0;

  const targetsByStaff = new Map<string, Map<string, number>>();
  targetRows.forEach((t) => {
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
  staffRows
    .filter((s) => targetsByStaff.has(s.id))
    .forEach((s) => {
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
