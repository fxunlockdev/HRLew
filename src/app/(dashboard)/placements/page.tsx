import Link from "next/link";
import { withProfile } from "@/lib/db";
import { jsonObjectFrom } from "kysely/helpers/postgres";
import { requireAuth } from "@/lib/auth";
import { getSettingsList } from "@/lib/settings";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/layout/filter-bar";
import { formatCurrency, formatDate } from "@/lib/utils";
import { hasPermission } from "@/lib/rbac";

export const metadata = { title: "Placements · HR OS" };

export default async function PlacementsPage() {
  const { profile, permissions } = await requireAuth();
  const { rows, statuses } = await withProfile(profile.id, async (trx) => ({
    rows: await trx
      .selectFrom("placements")
      .select((eb) => [
        "placements.id",
        "placements.display_id",
        "placements.status",
        "placements.joining_date",
        "placements.offered_ctc",
        "placements.placement_revenue",
        "placements.invoice_status",
        "placements.payment_status",
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
      ])
      .orderBy("joining_date", "desc")
      .limit(200)
      .execute(),
    statuses: await getSettingsList(trx, "placement_status"),
  }));

  const canViewFinancial = hasPermission(profile, permissions, "placements", "view_financial") || profile.role?.name === "admin" || profile.role?.name === "manager";

  return (
    <>
      <PageHeader
        title="Placements"
        description="Successful hires and commercial outcomes."
        actions={
          hasPermission(profile, permissions, "placements", "create") && (
            <Button asChild><Link href="/placements/new"><Plus className="h-4 w-4" /> New placement</Link></Button>
          )
        }
      />
      <FilterBar searchPlaceholder="Search…" />
      {rows.length === 0 ? (
        <EmptyState title="No placements yet" />
      ) : (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Placement</TableHead>
                <TableHead>Candidate</TableHead>
                <TableHead>Client / Job</TableHead>
                <TableHead>Join date</TableHead>
                {canViewFinancial && <TableHead>Offered CTC</TableHead>}
                {canViewFinancial && <TableHead>Revenue</TableHead>}
                <TableHead>Status</TableHead>
                {canViewFinancial && <TableHead>Invoice</TableHead>}
                {canViewFinancial && <TableHead>Payment</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => {
                const stat = statuses.find((s) => s.value === p.status);
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/placements/${p.id}`} className="font-medium hover:underline">{p.display_id}</Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/candidates/${p.candidate?.id}`} className="hover:underline">{p.candidate?.full_name}</Link>
                    </TableCell>
                    <TableCell>
                      <Link href={`/clients/${p.client?.id}`} className="text-sm hover:underline">{p.client?.name}</Link>
                      <p className="text-xs text-muted-foreground">{p.job?.title}</p>
                    </TableCell>
                    <TableCell>{formatDate(p.joining_date)}</TableCell>
                    {canViewFinancial && <TableCell>{formatCurrency(p.offered_ctc)}</TableCell>}
                    {canViewFinancial && <TableCell>{formatCurrency(p.placement_revenue)}</TableCell>}
                    <TableCell><StatusBadge label={stat?.label ?? p.status} color={stat?.color} /></TableCell>
                    {canViewFinancial && <TableCell className="capitalize text-xs">{p.invoice_status.replace("_", " ")}</TableCell>}
                    {canViewFinancial && <TableCell className="capitalize text-xs">{p.payment_status}</TableCell>}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
