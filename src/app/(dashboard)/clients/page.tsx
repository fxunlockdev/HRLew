import Link from "next/link";
import { withProfile, type DB } from "@/lib/db";
import { countAll, ilikeContains } from "@/lib/db/sql-helpers";
import { jsonObjectFrom } from "kysely/helpers/postgres";
import type { ExpressionBuilder } from "kysely";
import { requireAuth } from "@/lib/auth";
import { getSettingsList } from "@/lib/settings";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { hasPermission } from "@/lib/rbac";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FilterBar } from "@/components/layout/filter-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { CompanyLogo } from "@/components/ui/company-logo";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Clients · HR OS" };

const PAGE_SIZE = 20;

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { profile, permissions } = await requireAuth();
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const { rows, total, statuses } = await withProfile(profile.id, async (trx) => {
    const filters = (eb: ExpressionBuilder<DB, "clients">) => {
      const conditions = [];
      if (sp.q) {
        conditions.push(
          eb.or([
            ilikeContains("name", sp.q),
            ilikeContains("industry", sp.q),
            ilikeContains("location", sp.q),
          ]),
        );
      }
      if (sp.status) conditions.push(eb("status", "=", sp.status));
      return eb.and(conditions);
    };

    return {
      rows: await trx
        .selectFrom("clients")
        .select((eb) => [
          "id",
          "display_id",
          "name",
          "logo_url",
          "website",
          "industry",
          "location",
          "status",
          "account_owner_id",
          "created_at",
          jsonObjectFrom(
            eb
              .selectFrom("profiles")
              .select("profiles.full_name")
              .whereRef("profiles.id", "=", "clients.account_owner_id"),
          ).as("owner"),
        ])
        .where(filters)
        .orderBy("created_at", "desc")
        .limit(PAGE_SIZE)
        .offset(offset)
        .execute(),
      total:
        (await trx
          .selectFrom("clients")
          .select(countAll.as("count"))
          .where(filters)
          .executeTakeFirst())?.count ?? 0,
      statuses: await getSettingsList(trx, "client_status"),
    };
  });

  return (
    <>
      <PageHeader
        title="Clients"
        description="Client companies and their account owners."
        actions={
          hasPermission(profile, permissions, "clients", "create") && (
            <Button asChild>
              <Link href="/clients/new">
                <Plus className="h-4 w-4" /> New client
              </Link>
            </Button>
          )
        }
      />

      <FilterBar searchPlaceholder="Search by name, industry, location…" />

      {rows.length === 0 ? (
        <EmptyState title="No clients yet" description="Add your first client to begin tracking requirements." />
      ) : (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => {
                const stat = statuses.find((s) => s.value === c.status);
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <CompanyLogo name={c.name} logoUrl={c.logo_url} className="h-10 w-10" />
                        <div>
                          <Link href={`/clients/${c.id}`} className="font-medium hover:underline">
                            {c.name}
                          </Link>
                          <p className="text-xs text-muted-foreground">{c.display_id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{c.industry ?? "—"}</TableCell>
                    <TableCell>{c.location ?? "—"}</TableCell>
                    <TableCell><StatusBadge label={stat?.label ?? c.status} color={stat?.color} /></TableCell>
                    <TableCell className="text-sm">{c.owner?.full_name ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(c.created_at)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
        </div>
      )}
    </>
  );
}
