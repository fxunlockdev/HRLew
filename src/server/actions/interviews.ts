"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  candidate_id: z.string().uuid(),
  job_id: z.string().uuid(),
  pipeline_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  round_label: z.string().optional(),
  interview_type: z.enum(["phone", "video", "in_person", "assignment"]).optional(),
  scheduled_at: z.string().optional(),
  duration_minutes: z.coerce.number().int().min(0).optional(),
  interviewer_name: z.string().optional(),
  interviewer_email: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  meeting_link: z.string().optional(),
  location: z.string().optional(),
  status: z.string().default("scheduled"),
  outcome: z.string().optional(),
  feedback: z.string().optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  next_step: z.string().optional(),
});

function parseFormData(formData: FormData) {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  Object.keys(raw).forEach((k) => {
    if (raw[k] === "") delete raw[k];
  });
  return raw;
}

export async function createInterview(formData: FormData) {
  const { profile } = await requireAuth();
  const parsed = schema.parse(parseFormData(formData));
  const supabase = await getSupabaseServerClient();

  // Resolve client_id from job
  const { data: job } = await supabase
    .from("job_requirements")
    .select("client_id")
    .eq("id", parsed.job_id)
    .single();
  if (!job) throw new Error("Job not found");

  const { data, error } = await supabase
    .from("interviews")
    .insert({
      ...parsed,
      client_id: job.client_id,
      scheduled_at: parsed.scheduled_at || null,
      scheduled_by: profile.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/interviews");
  redirect(`/interviews/${data.id}`);
}

export async function updateInterview(id: string, formData: FormData) {
  await requireAuth();
  const parsed = schema.partial().parse(parseFormData(formData));
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("interviews")
    .update({ ...parsed, scheduled_at: parsed.scheduled_at || null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/interviews/${id}`);
  revalidatePath("/interviews");
}

export async function recordInterviewFeedback(
  id: string,
  outcome: string,
  feedback: string,
  rating: number | null,
  nextStep: string | null,
) {
  if (!feedback?.trim()) throw new Error("Feedback is required to mark this interview complete.");
  await requireAuth();
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("interviews")
    .update({
      status: "completed",
      outcome,
      feedback,
      rating,
      next_step: nextStep,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/interviews/${id}`);
}
