import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate } from "@/lib/utils";
import { hasPermission } from "@/lib/rbac";

export const metadata = { title: "Staff · HRLew" };

export default async function StaffPage() {
  const ctx = await requirePermission("staff", "view");
  const supabase = await getSupabaseServerClient();
  const { data: rows } = await supabase
    .from("staff")
    .select("id, display_id, full_name, email, designation, department, employment_status, salary, joining_date, manager:staff!staff_manager_id_fkey(full_name)")
    .order("created_at", { ascending: false });

  const canViewSalary = hasPermission(ctx.profile, ctx.permissions, "staff", "view_salary") || ctx.profile.role?.name === "admin";

  return (
    <>
      <PageHeader
        title="Staff"
        description="Internal team. Admin-only fields gated by RLS."
        actions={
          hasPermission(ctx.profile, ctx.permissions, "staff", "create") && (
            <Button asChild><Link href="/staff/new"><Plus className="h-4 w-4" /> Add staff</Link></Button>
          )
        }
      />
      {(rows ?? []).length === 0 ? (
        <EmptyState title="No staff records yet" />
      ) : (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Status</TableHead>
                {canViewSalary && <TableHead>Salary</TableHead>}
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows!.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link href={`/staff/${s.id}`} className="font-medium hover:underline">{s.full_name}</Link>
                    <p className="text-xs text-muted-foreground">{s.email}</p>
                  </TableCell>
                  <TableCell>{s.designation ?? "—"}</TableCell>
                  <TableCell>{s.department ?? "—"}</TableCell>
                  <TableCell>{s.manager?.full_name ?? "—"}</TableCell>
                  <TableCell className="capitalize">{s.employment_status.replace("_", " ")}</TableCell>
                  {canViewSalary && <TableCell>{formatCurrency(s.salary)}</TableCell>}
                  <TableCell>{formatDate(s.joining_date)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
