"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { withProfile } from "@/lib/db";

export async function movePipelineStage(pipelineId: string, toStage: string, notes?: string) {
  const { profile } = await requireAuth();

  await withProfile(profile.id, (trx) =>
    trx
      .updateTable("candidate_job_pipeline")
      .set(notes ? { current_stage: toStage, notes } : { current_stage: toStage })
      .where("id", "=", pipelineId)
      .execute(),
  );

  revalidatePath("/pipeline");
}

export async function setPipelineRejectionReason(pipelineId: string, reason: string) {
  const { profile } = await requireAuth();

  await withProfile(profile.id, (trx) =>
    trx
      .updateTable("candidate_job_pipeline")
      .set({ rejection_reason: reason, current_stage: "rejected", is_active: false })
      .where("id", "=", pipelineId)
      .execute(),
  );

  revalidatePath("/pipeline");
}

export async function setOfferAmount(pipelineId: string, amount: number) {
  const { profile } = await requireAuth();

  await withProfile(profile.id, (trx) =>
    trx
      .updateTable("candidate_job_pipeline")
      .set({ offer_amount: amount, current_stage: "offer_released" })
      .where("id", "=", pipelineId)
      .execute(),
  );

  revalidatePath("/pipeline");
}
