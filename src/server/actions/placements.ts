"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuth, requirePermission } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

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
  invoice_status: z.string().optional(),
  payment_status: z.string().optional(),
  invoice_number: z.string().optional(),
  invoice_date: z.string().optional(),
  invoice_amount: z.coerce.number().min(0).optional(),
  payment_received_date: z.string().optional(),
  status: z.string().optional(),
  joining_status: z.string().optional(),
  notes: z.string().optional(),
});

function parseFormData(formData: FormData) {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  Object.keys(raw).forEach((k) => {
    if (raw[k] === "") delete raw[k];
  });
  return raw;
}

export async function createPlacement(formData: FormData) {
  const { profile } = await requireAuth();
  const parsed = schema.parse(parseFormData(formData));
  const supabase = await getSupabaseServerClient();

  if (parsed.status === "joined" && !parsed.joining_date) {
    throw new Error("Joining date is required when status is 'Joined'.");
  }

  const { data, error } = await supabase
    .from("placements")
    .insert({
      ...parsed,
      joining_date: parsed.joining_date || null,
      replacement_end_date: parsed.replacement_end_date || null,
      invoice_date: parsed.invoice_date || null,
      payment_received_date: parsed.payment_received_date || null,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/placements");
  redirect(`/placements/${data.id}`);
}

export async function updatePlacement(id: string, formData: FormData) {
  // Only admin can edit placement financials per RLS.
  await requirePermission("placements", "edit");
  const parsed = schema.partial().parse(parseFormData(formData));
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("placements")
    .update({
      ...parsed,
      joining_date: parsed.joining_date || null,
      replacement_end_date: parsed.replacement_end_date || null,
      invoice_date: parsed.invoice_date || null,
      payment_received_date: parsed.payment_received_date || null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/placements/${id}`);
  revalidatePath("/placements");
}
