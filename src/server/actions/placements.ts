"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuth, requirePermission } from "@/lib/auth";
import { withProfile } from "@/lib/db";
import { orNull, parseFormData } from "@/lib/form";

const schema = z.object({
  candidate_id: z.string().uuid(),
  client_id: z.string().uuid(),
  job_id: z.string().uuid(),
  pipeline_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  recruiter_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  offered_designation: z.string().optional(),
  offered_ctc: z.coerce.number().min(0).optional(),
  billing_percentage: z.coerce.number().min(0).max(100).optional(),
  placement_revenue: z.coerce.number().min(0).optional(),
  joining_date: z.string().optional(),
  replacement_period_days: z.coerce.number().int().min(0).max(365).optional(),
  replacement_end_date: z.string().optional(),
  invoice_status: z
    .enum(["not_raised", "raised", "partially_paid", "paid", "overdue", "cancelled"])
    .optional(),
  payment_status: z
    .enum(["pending", "partial", "received", "overdue", "written_off"])
    .optional(),
  invoice_number: z.string().optional(),
  invoice_date: z.string().optional(),
  invoice_amount: z.coerce.number().min(0).optional(),
  payment_received_date: z.string().optional(),
  status: z.string().optional(),
  joining_status: z
    .enum([
      "pending",
      "joined",
      "backed_out_before",
      "backed_out_after",
      "replacement_required",
    ])
    .optional(),
  notes: z.string().optional(),
});

type PlacementInput = z.infer<typeof schema>;

/** Everything the placement form owns; pipeline_id is set only on create. */
function placementColumns(parsed: PlacementInput) {
  return {
    candidate_id: parsed.candidate_id,
    client_id: parsed.client_id,
    job_id: parsed.job_id,
    recruiter_id: orNull(parsed.recruiter_id),
    offered_designation: orNull(parsed.offered_designation),
    offered_ctc: orNull(parsed.offered_ctc),
    billing_percentage: orNull(parsed.billing_percentage),
    placement_revenue: orNull(parsed.placement_revenue),
    joining_date: orNull(parsed.joining_date),
    replacement_period_days: orNull(parsed.replacement_period_days),
    replacement_end_date: orNull(parsed.replacement_end_date),
    invoice_status: parsed.invoice_status ?? "not_raised",
    payment_status: parsed.payment_status ?? "pending",
    invoice_number: orNull(parsed.invoice_number),
    invoice_date: orNull(parsed.invoice_date),
    invoice_amount: orNull(parsed.invoice_amount),
    payment_received_date: orNull(parsed.payment_received_date),
    status: parsed.status ?? "offer_accepted",
    joining_status: orNull(parsed.joining_status),
    notes: orNull(parsed.notes),
  };
}

export async function createPlacement(formData: FormData) {
  const { profile } = await requireAuth();
  const parsed = schema.parse(parseFormData(formData));

  if (parsed.status === "joined" && !parsed.joining_date) {
    throw new Error("Joining date is required when status is 'Joined'.");
  }

  const id = await withProfile(profile.id, async (trx) => {
    const row = await trx
      .insertInto("placements")
      .values({
        ...placementColumns(parsed),
        pipeline_id: orNull(parsed.pipeline_id),
        created_by: profile.id,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    return row.id;
  });

  revalidatePath("/placements");
  redirect(`/placements/${id}`);
}

export async function updatePlacement(id: string, formData: FormData) {
  // Writes are additionally gated by the placements RLS policy (admin only).
  const { profile } = await requirePermission("placements", "edit");
  const parsed = schema.parse(parseFormData(formData));

  if (parsed.status === "joined" && !parsed.joining_date) {
    throw new Error("Joining date is required when status is 'Joined'.");
  }

  await withProfile(profile.id, (trx) =>
    trx.updateTable("placements").set(placementColumns(parsed)).where("id", "=", id).execute(),
  );

  revalidatePath(`/placements/${id}`);
  revalidatePath("/placements");
}
