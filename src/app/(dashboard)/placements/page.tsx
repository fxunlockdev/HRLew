import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
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
  const supabase = await getSupabaseServerClient();
  const [{ data: rows }, statuses] = await Promise.all([
    supabase
      .from("placements")
      .select(
        "id, display_id, status, joining_date, offered_ctc, placement_revenue, invoice_status, payment_status, candidate:candidates(id, full_name), client:clients(id, name), job:job_requirements(id, title)",
      )
      .order("joining_date", { ascending: false, nullsFirst: false })
      .limit(200),
    getSettingsList("placement_status"),
  ]);

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
      {(rows ?? []).length === 0 ? (
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
              {rows!.map((p: any) => {
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
