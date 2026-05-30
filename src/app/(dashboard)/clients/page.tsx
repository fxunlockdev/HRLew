import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
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
  const supabase = await getSupabaseServerClient();
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  let q = supabase
    .from("clients")
    .select(
      "id, display_id, name, website, industry, location, status, account_owner_id, created_at, owner:profiles!clients_account_owner_id_fkey(full_name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (sp.q) q = q.or(`name.ilike.%${sp.q}%,industry.ilike.%${sp.q}%,location.ilike.%${sp.q}%`);
  if (sp.status) q = q.eq("status", sp.status);

  const [{ data, count }, statuses] = await Promise.all([q, getSettingsList("client_status")]);

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

      {(data ?? []).length === 0 ? (
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
              {(data ?? []).map((c: any) => {
                const stat = statuses.find((s) => s.value === c.status);
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/clients/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{c.display_id}</p>
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
          <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} />
        </div>
      )}
    </>
  );
}
