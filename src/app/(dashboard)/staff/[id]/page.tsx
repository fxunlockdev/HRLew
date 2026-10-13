import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { withProfile } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { StaffForm } from "@/components/staff/staff-form";
import { StaffKpiTargets } from "@/components/staff/staff-kpi-targets";
import { hasPermission, isAdmin } from "@/lib/rbac";
import { currentPeriodStart, periodLabel, KPI_PERIOD } from "@/lib/kpi-metrics";

export default async function StaffDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("staff", "view");
  const periodStart = currentPeriodStart();

  const data = await withProfile(ctx.profile.id, async (trx) => {
    const staff = await trx
      .selectFrom("staff")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    if (!staff) return null;

    return {
      staff,
      managers: await trx
        .selectFrom("staff")
        .select(["id", "full_name"])
        .where("id", "!=", id)
        .orderBy("full_name", "asc")
        .execute(),
      profiles: await trx
        .selectFrom("profiles")
        .select(["id", "full_name"])
        .orderBy("full_name", "asc")
        .execute(),
      kpiRows: await trx
        .selectFrom("kpi_targets")
        .select(["metric_key", "target_value"])
        .where("staff_id", "=", id)
        .where("period", "=", KPI_PERIOD)
        .where("period_start", "=", periodStart)
        .execute(),
    };
  });

  if (!data) notFound();
  const { staff, managers, profiles, kpiRows } = data;

  const targets: Record<string, number> = Object.fromEntries(
    kpiRows.map((r) => [r.metric_key, Number(r.target_value)]),
  );

  return (
    <>
      <PageHeader
        title={staff.full_name}
        description={[staff.designation, staff.department].filter(Boolean).join(" · ")}
        actions={<Button asChild variant="outline"><Link href="/staff">← Back</Link></Button>}
      />
      <StaffForm
        mode="edit"
        staff={staff}
        managers={managers}
        profiles={profiles}
        canEditSalary={hasPermission(ctx.profile, ctx.permissions, "staff", "edit_salary") || ctx.profile.role?.name === "admin"}
      />
      {isAdmin(ctx.profile) && (
        <div className="mt-6">
          <StaffKpiTargets
            staffId={id}
            periodStart={periodStart}
            periodLabel={periodLabel(periodStart)}
            targets={targets}
          />
        </div>
      )}
    </>
  );
}
