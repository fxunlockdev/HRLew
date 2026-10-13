"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { withProfile } from "@/lib/db";
import { orNull, parseFormData, toStringArray } from "@/lib/form";

const jobSchema = z.object({
  client_id: z.string().uuid(),
  title: z.string().min(2),
  department: z.string().optional(),
  location: z.string().optional(),
  work_mode: z.enum(["onsite", "hybrid", "remote"]).optional(),
  employment_type: z.enum(["full_time", "contract", "part_time", "internship"]).optional(),
  openings: z.coerce.number().int().min(1).default(1),
  min_experience_years: z.coerce.number().min(0).max(60).optional(),
  max_experience_years: z.coerce.number().min(0).max(60).optional(),
  min_salary: z.coerce.number().min(0).optional(),
  max_salary: z.coerce.number().min(0).optional(),
  required_skills: z.string().optional(),
  good_to_have_skills: z.string().optional(),
  description: z.string().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  status: z.string().default("open"),
  target_closure_date: z.string().optional(),
});

type JobInput = z.infer<typeof jobSchema>;

function jobColumns(parsed: JobInput) {
  return {
    client_id: parsed.client_id,
    title: parsed.title,
    department: orNull(parsed.department),
    location: orNull(parsed.location),
    work_mode: orNull(parsed.work_mode),
    employment_type: orNull(parsed.employment_type),
    openings: parsed.openings,
    min_experience_years: orNull(parsed.min_experience_years),
    max_experience_years: orNull(parsed.max_experience_years),
    min_salary: orNull(parsed.min_salary),
    max_salary: orNull(parsed.max_salary),
    required_skills: toStringArray(parsed.required_skills),
    good_to_have_skills: toStringArray(parsed.good_to_have_skills),
    description: orNull(parsed.description),
    priority: parsed.priority,
    status: parsed.status,
    target_closure_date: orNull(parsed.target_closure_date),
  };
}

export async function createJob(formData: FormData) {
  const { profile } = await requireAuth();
  const parsed = jobSchema.parse(parseFormData(formData));

  const id = await withProfile(profile.id, async (trx) => {
    const row = await trx
      .insertInto("job_requirements")
      .values({ ...jobColumns(parsed), created_by: profile.id })
      .returning("id")
      .executeTakeFirstOrThrow();
    return row.id;
  });

  revalidatePath("/jobs");
  redirect(`/jobs/${id}`);
}

export async function updateJob(id: string, formData: FormData) {
  const { profile } = await requireAuth();
  const parsed = jobSchema.parse(parseFormData(formData));

  await withProfile(profile.id, (trx) =>
    trx.updateTable("job_requirements").set(jobColumns(parsed)).where("id", "=", id).execute(),
  );

  revalidatePath(`/jobs/${id}`);
  revalidatePath("/jobs");
}

export async function submitCandidateToJob(jobId: string, candidateId: string) {
  const { profile } = await requireAuth();

  await withProfile(profile.id, async (trx) => {
    const job = await trx
      .selectFrom("job_requirements")
      .select("client_id")
      .where("id", "=", jobId)
      .executeTakeFirst();
    if (!job) throw new Error("Job not found");

    const existing = await trx
      .selectFrom("candidate_job_pipeline")
      .select("id")
      .where("candidate_id", "=", candidateId)
      .where("job_id", "=", jobId)
      .executeTakeFirst();
    if (existing) throw new Error("That candidate is already on this job's pipeline.");

    await trx
      .insertInto("candidate_job_pipeline")
      .values({
        candidate_id: candidateId,
        job_id: jobId,
        client_id: job.client_id,
        assigned_recruiter_id: profile.id,
        current_stage: "submitted",
        submitted_at: new Date().toISOString(),
        created_by: profile.id,
      })
      .execute();
  });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/pipeline");
}
