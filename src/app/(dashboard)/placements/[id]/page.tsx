import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { withProfile } from "@/lib/db";
import { jsonObjectFrom } from "kysely/helpers/postgres";
import { getSettingsList } from "@/lib/settings";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { PlacementForm } from "@/components/placements/placement-form";
import { formatCurrency, formatDate } from "@/lib/utils";
import { hasPermission } from "@/lib/rbac";

export default async function PlacementDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile, permissions } = await requireAuth();
  const data = await withProfile(profile.id, async (trx) => {
    const placement = await trx
      .selectFrom("placements")
      .selectAll("placements")
      .select((eb) => [
        jsonObjectFrom(
          eb
            .selectFrom("candidates")
            .select(["candidates.id", "candidates.full_name"])
            .whereRef("candidates.id", "=", "placements.candidate_id"),
        ).as("candidate"),
        jsonObjectFrom(
          eb
            .selectFrom("clients")
            .select(["clients.id", "clients.name"])
            .whereRef("clients.id", "=", "placements.client_id"),
        ).as("client"),
        jsonObjectFrom(
          eb
            .selectFrom("job_requirements")
            .select(["job_requirements.id", "job_requirements.title"])
            .whereRef("job_requirements.id", "=", "placements.job_id"),
        ).as("job"),
        jsonObjectFrom(
          eb
            .selectFrom("profiles")
            .select("profiles.full_name")
            .whereRef("profiles.id", "=", "placements.recruiter_id"),
        ).as("recruiter"),
      ])
      .where("placements.id", "=", id)
      .executeTakeFirst();
    if (!placement) return null;

    return {
      placement,
      statuses: await getSettingsList(trx, "placement_status"),
      candidates: await trx
        .selectFrom("candidates")
        .select(["id", "full_name"])
        .orderBy("full_name", "asc")
        .limit(500)
        .execute(),
      clients: await trx
        .selectFrom("clients")
        .select(["id", "name"])
        .orderBy("name", "asc")
        .limit(500)
        .execute(),
      jobs: await trx
        .selectFrom("job_requirements")
        .select(["id", "title"])
        .orderBy("title", "asc")
        .limit(500)
        .execute(),
      recruiters: await trx
        .selectFrom("profiles")
        .select(["id", "full_name"])
        .where("status", "=", "active")
        .orderBy("full_name", "asc")
        .execute(),
    };
  });

  if (!data) notFound();
  const { placement: p, statuses, candidates, clients, jobs, recruiters } = data;

  const stat = statuses.find((s) => s.value === p.status);
  const canViewFinancial = hasPermission(profile, permissions, "placements", "view_financial") || profile.role?.name === "admin" || profile.role?.name === "manager";
  const canEditFinancial = hasPermission(profile, permissions, "placements", "edit_financial") || profile.role?.name === "admin";

  return (
    <>
      <PageHeader
        title={`${p.display_id} · ${p.candidate?.full_name}`}
        description={`${p.client?.name} · ${p.job?.title}`}
        actions={
          <Button asChild variant="outline"><Link href="/placements">← Back</Link></Button>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
            <div className="mt-1"><StatusBadge label={stat?.label ?? p.status} color={stat?.color} /></div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Designation" value={p.offered_designation} />
            <Row label="Joining" value={formatDate(p.joining_date)} />
            <Row label="Recruiter" value={p.recruiter?.full_name} />
            {canViewFinancial && (
              <>
                <Row label="Offered CTC" value={formatCurrency(p.offered_ctc)} />
                <Row label="Billing %" value={p.billing_percentage ? `${p.billing_percentage}%` : null} />
                <Row label="Revenue" value={formatCurrency(p.placement_revenue)} />
                <Row label="Invoice" value={`${p.invoice_status} ${p.invoice_number ? `· ${p.invoice_number}` : ""}`.trim()} />
                <Row label="Payment" value={p.payment_status} />
              </>
            )}
            <Row label="Replacement until" value={formatDate(p.replacement_end_date)} />
          </CardContent>
        </Card>

        <PlacementForm
          mode="edit"
          placement={p}
          statuses={statuses}
          candidates={candidates}
          clients={clients}
          jobs={jobs}
          recruiters={recruiters}
          canEditFinancial={canEditFinancial}
        />
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-2">
      <span className="text-xs uppercase text-muted-foreground">{label}</span>
      <span className="text-right capitalize">{value}</span>
    </div>
  );
}
