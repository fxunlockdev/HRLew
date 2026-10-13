import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { withProfile } from "@/lib/db";
import { jsonObjectFrom } from "kysely/helpers/postgres";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate } from "@/lib/utils";
import { hasPermission } from "@/lib/rbac";

export const metadata = { title: "Staff · HR OS" };

export default async function StaffPage() {
  const ctx = await requirePermission("staff", "view");
  const rows = await withProfile(ctx.profile.id, (trx) =>
    trx
      .selectFrom("staff")
      .select((eb) => [
        "staff.id",
        "staff.display_id",
        "staff.full_name",
        "staff.email",
        "staff.designation",
        "staff.department",
        "staff.employment_status",
        "staff.salary",
        "staff.joining_date",
        jsonObjectFrom(
          eb
            .selectFrom("staff as manager")
            .select("manager.full_name")
            .whereRef("manager.id", "=", "staff.manager_id"),
        ).as("manager"),
      ])
      .orderBy("staff.created_at", "desc")
      .execute(),
  );

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
      {rows.length === 0 ? (
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
              {rows.map((s) => (
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
