import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";
import { getSettingsList } from "@/lib/settings";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { hasPermission } from "@/lib/rbac";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/layout/filter-bar";
import { formatCurrency, formatDate } from "@/lib/utils";

export const metadata = { title: "Jobs · HR OS" };

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; client?: string }>;
}) {
  const { profile, permissions } = await requireAuth();
  const sp = await searchParams;
  const supabase = await getSupabaseServerClient();

  let q = supabase
    .from("job_requirements")
    .select(
      "id, display_id, title, location, work_mode, openings, priority, status, target_closure_date, min_salary, max_salary, required_skills, created_at, client:clients(id, name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (sp.q) q = q.or(`title.ilike.%${sp.q}%,location.ilike.%${sp.q}%`);
  if (sp.status) q = q.eq("status", sp.status);
  if (sp.client) q = q.eq("client_id", sp.client);

  const [{ data }, statuses] = await Promise.all([q, getSettingsList("job_status")]);

  const canViewSalary = hasPermission(profile, permissions, "jobs", "view_salary") || profile.role?.name === "admin" || profile.role?.name === "manager";

  return (
    <>
      <PageHeader
        title="Jobs / Requirements"
        description="Client mandates and live openings."
        actions={
          hasPermission(profile, permissions, "jobs", "create") && (
            <Button asChild>
              <Link href="/jobs/new"><Plus className="h-4 w-4" /> New requirement</Link>
            </Button>
          )
        }
      />

      <FilterBar searchPlaceholder="Search by title or location…" />

      {(data ?? []).length === 0 ? (
        <EmptyState title="No requirements yet" />
      ) : (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Location / Mode</TableHead>
                <TableHead>Openings</TableHead>
                {canViewSalary && <TableHead>Salary band</TableHead>}
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((j: any) => {
                const stat = statuses.find((s) => s.value === j.status);
                return (
                  <TableRow key={j.id}>
                    <TableCell>
                      <Link href={`/jobs/${j.id}`} className="font-medium hover:underline">{j.title}</Link>
                      <p className="text-xs text-muted-foreground">{j.display_id}</p>
                    </TableCell>
                    <TableCell>
                      <Link href={`/clients/${j.client?.id}`} className="text-sm hover:underline">{j.client?.name}</Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {j.location ?? "—"}
                      {j.work_mode && <span className="text-xs text-muted-foreground"> · {j.work_mode}</span>}
                    </TableCell>
                    <TableCell>{j.openings}</TableCell>
                    {canViewSalary && (
                      <TableCell className="text-sm">
                        {j.min_salary || j.max_salary
                          ? `${formatCurrency(j.min_salary ?? 0)} – ${formatCurrency(j.max_salary ?? 0)}`
                          : "—"}
                      </TableCell>
                    )}
                    <TableCell className="capitalize">{j.priority}</TableCell>
                    <TableCell><StatusBadge label={stat?.label ?? j.status} color={stat?.color} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(j.created_at)}</TableCell>
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
