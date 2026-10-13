"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { withProfile } from "@/lib/db";
import { orNull, parseFormData } from "@/lib/form";

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
  outcome: z
    .enum(["selected", "rejected", "on_hold", "no_show", "rescheduled", "pending"])
    .optional(),
  feedback: z.string().optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  next_step: z.string().optional(),
});

type InterviewInput = z.infer<typeof schema>;

/** The fields the scheduling form owns. Feedback fields are set separately. */
function scheduleColumns(parsed: InterviewInput) {
  return {
    candidate_id: parsed.candidate_id,
    job_id: parsed.job_id,
    pipeline_id: orNull(parsed.pipeline_id),
    round_label: orNull(parsed.round_label),
    interview_type: orNull(parsed.interview_type),
    scheduled_at: orNull(parsed.scheduled_at),
    duration_minutes: orNull(parsed.duration_minutes),
    interviewer_name: orNull(parsed.interviewer_name),
    interviewer_email: orNull(parsed.interviewer_email),
    meeting_link: orNull(parsed.meeting_link),
    location: orNull(parsed.location),
    status: parsed.status,
  };
}

export async function createInterview(formData: FormData) {
  const { profile } = await requireAuth();
  const parsed = schema.parse(parseFormData(formData));

  const id = await withProfile(profile.id, async (trx) => {
    const job = await trx
      .selectFrom("job_requirements")
      .select("client_id")
      .where("id", "=", parsed.job_id)
      .executeTakeFirst();
    if (!job) throw new Error("Job not found");

    const row = await trx
      .insertInto("interviews")
      .values({
        ...scheduleColumns(parsed),
        client_id: job.client_id,
        outcome: orNull(parsed.outcome),
        feedback: orNull(parsed.feedback),
        rating: orNull(parsed.rating),
        next_step: orNull(parsed.next_step),
        scheduled_by: profile.id,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    return row.id;
  });

  revalidatePath("/interviews");
  redirect(`/interviews/${id}`);
}

export async function updateInterview(id: string, formData: FormData) {
  const { profile } = await requireAuth();
  const parsed = schema.parse(parseFormData(formData));

  await withProfile(profile.id, async (trx) => {
    const job = await trx
      .selectFrom("job_requirements")
      .select("client_id")
      .where("id", "=", parsed.job_id)
      .executeTakeFirst();
    if (!job) throw new Error("Job not found");

    await trx
      .updateTable("interviews")
      .set({ ...scheduleColumns(parsed), client_id: job.client_id })
      .where("id", "=", id)
      .execute();
  });

  revalidatePath(`/interviews/${id}`);
  revalidatePath("/interviews");
}

const outcomeSchema = z.enum([
  "selected",
  "rejected",
  "on_hold",
  "no_show",
  "rescheduled",
  "pending",
]);

export async function recordInterviewFeedback(
  id: string,
  outcome: string,
  feedback: string,
  rating: number | null,
  nextStep: string | null,
) {
  if (!feedback?.trim()) throw new Error("Feedback is required to mark this interview complete.");
  const parsedOutcome = outcomeSchema.parse(outcome);
  const { profile } = await requireAuth();

  await withProfile(profile.id, (trx) =>
    trx
      .updateTable("interviews")
      .set({
        status: "completed",
        outcome: parsedOutcome,
        feedback,
        rating,
        next_step: nextStep,
      })
      .where("id", "=", id)
      .execute(),
  );

  revalidatePath(`/interviews/${id}`);
  revalidatePath("/interviews");
}
