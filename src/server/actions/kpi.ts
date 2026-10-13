"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { withProfile } from "@/lib/db";
import { isAdmin } from "@/lib/rbac";
import { KPI_METRICS, KPI_PERIOD } from "@/lib/kpi-metrics";

/**
 * Upsert this staff member's monthly KPI targets. Admin only — also enforced
 * by the kpi_targets RLS policy (admin-only writes) at the database level.
 *
 * A blank or non-positive value means "no target", which clears any existing
 * row for that metric.
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

  const toUpsert: { metric_key: string; target_value: number }[] = [];
  const toClear: string[] = [];

  for (const m of KPI_METRICS) {
    const raw = formData.get(`metric_${m.key}`);
    const num = raw === null || raw === "" ? NaN : Number(raw);
    if (Number.isNaN(num) || num <= 0) toClear.push(m.key);
    else toUpsert.push({ metric_key: m.key, target_value: num });
  }

  await withProfile(ctx.profile.id, async (trx) => {
    if (toUpsert.length > 0) {
      await trx
        .insertInto("kpi_targets")
        .values(
          toUpsert.map((t) => ({
            staff_id: staffId,
            period: KPI_PERIOD,
            period_start: periodStart,
            metric_key: t.metric_key,
            target_value: t.target_value,
          })),
        )
        .onConflict((oc) =>
          oc
            .columns(["staff_id", "period", "period_start", "metric_key"])
            .doUpdateSet((eb) => ({ target_value: eb.ref("excluded.target_value") })),
        )
        .execute();
    }

    if (toClear.length > 0) {
      await trx
        .deleteFrom("kpi_targets")
        .where("staff_id", "=", staffId)
        .where("period", "=", KPI_PERIOD)
        .where("period_start", "=", periodStart)
        .where("metric_key", "in", toClear)
        .execute();
    }
  });

  revalidatePath(`/staff/${staffId}`);
  revalidatePath("/kpis");
}
