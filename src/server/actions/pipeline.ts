"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function movePipelineStage(pipelineId: string, toStage: string, notes?: string) {
  await requireAuth();
  const supabase = await getSupabaseServerClient();
  const update: Record<string, unknown> = { current_stage: toStage };
  if (notes) update.notes = notes;
  const { error } = await supabase.from("candidate_job_pipeline").update(update).eq("id", pipelineId);
  if (error) throw new Error(error.message);
  revalidatePath("/pipeline");
}

export async function setPipelineRejectionReason(pipelineId: string, reason: string) {
  await requireAuth();
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("candidate_job_pipeline")
    .update({ rejection_reason: reason, current_stage: "rejected", is_active: false })
    .eq("id", pipelineId);
  if (error) throw new Error(error.message);
  revalidatePath("/pipeline");
}

export async function setOfferAmount(pipelineId: string, amount: number) {
  await requireAuth();
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("candidate_job_pipeline")
    .update({ offer_amount: amount, current_stage: "offer_released" })
    .eq("id", pipelineId);
  if (error) throw new Error(error.message);
  revalidatePath("/pipeline");
}
