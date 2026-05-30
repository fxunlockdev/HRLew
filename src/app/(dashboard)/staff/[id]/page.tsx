import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { StaffForm } from "@/components/staff/staff-form";
import { StaffKpiTargets } from "@/components/staff/staff-kpi-targets";
import { hasPermission, isAdmin } from "@/lib/rbac";
import { currentPeriodStart, periodLabel, KPI_PERIOD } from "@/lib/kpi-metrics";

export default async function StaffDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("staff", "view");
  const supabase = await getSupabaseServerClient();
  const periodStart = currentPeriodStart();
  const [{ data: staff }, { data: managers }, { data: profiles }, { data: kpiRows }] = await Promise.all([
    supabase.from("staff").select("*").eq("id", id).maybeSingle(),
    supabase.from("staff").select("id, full_name").order("full_name"),
    supabase.from("profiles").select("id, full_name").order("full_name"),
    supabase
      .from("kpi_targets")
      .select("metric_key, target_value")
      .eq("staff_id", id)
      .eq("period", KPI_PERIOD)
      .eq("period_start", periodStart),
  ]);
  if (!staff) notFound();

  const targets: Record<string, number> = Object.fromEntries(
    (kpiRows ?? []).map((r: { metric_key: string; target_value: number }) => [
      r.metric_key,
      Number(r.target_value),
    ]),
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
        staff={staff as any}
        managers={managers ?? []}
        profiles={profiles ?? []}
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
