"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { isAdmin } from "@/lib/rbac";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { KPI_METRICS, KPI_PERIOD } from "@/lib/kpi-metrics";

/**
 * Upsert this staff member's monthly KPI targets. Admin only — also enforced
 * by the kpi_targets RLS policy (admin-only writes) at the database level.
 */
export async function saveStaffKpiTargets(
  staffId: string,
  periodStart: string,
  formData: FormData,
): Promise<void> {
  const ctx = await requireAuth();
  if (!isAdmin(ctx.profile)) {
    throw new Error("Only admins can edit KPI targets");
  }

  const supabase = await getSupabaseServerClient();
  const toUpsert: {
    staff_id: string;
    period: string;
    period_start: string;
    metric_key: string;
    target_value: number;
  }[] = [];
  const toClear: string[] = [];

  for (const m of KPI_METRICS) {
    const raw = formData.get(`metric_${m.key}`);
    const num = raw === null || raw === "" ? NaN : Number(raw);
    if (Number.isNaN(num) || num <= 0) {
      toClear.push(m.key);
    } else {
      toUpsert.push({
        staff_id: staffId,
        period: KPI_PERIOD,
        period_start: periodStart,
        metric_key: m.key,
        target_value: num,
      });
    }
  }

  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from("kpi_targets")
      .upsert(toUpsert, { onConflict: "staff_id,period,period_start,metric_key" });
    if (error) throw new Error(error.message);
  }

  if (toClear.length > 0) {
    const { error } = await supabase
      .from("kpi_targets")
      .delete()
      .eq("staff_id", staffId)
      .eq("period", KPI_PERIOD)
      .eq("period_start", periodStart)
      .in("metric_key", toClear);
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/staff/${staffId}`);
  revalidatePath("/kpis");
}
