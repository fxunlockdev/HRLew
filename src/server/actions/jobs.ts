"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

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

function parseFormData(formData: FormData) {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  Object.keys(raw).forEach((k) => {
    if (raw[k] === "") delete raw[k];
  });
  return raw;
}

function toArray(s: string | undefined): string[] {
  if (!s) return [];
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export async function createJob(formData: FormData) {
  const { profile } = await requireAuth();
  const parsed = jobSchema.parse(parseFormData(formData));
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("job_requirements")
    .insert({
      ...parsed,
      required_skills: toArray(parsed.required_skills),
      good_to_have_skills: toArray(parsed.good_to_have_skills),
      target_closure_date: parsed.target_closure_date || null,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/jobs");
  redirect(`/jobs/${data.id}`);
}

export async function updateJob(id: string, formData: FormData) {
  await requireAuth();
  const parsed = jobSchema.parse(parseFormData(formData));
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("job_requirements")
    .update({
      ...parsed,
      required_skills: toArray(parsed.required_skills),
      good_to_have_skills: toArray(parsed.good_to_have_skills),
      target_closure_date: parsed.target_closure_date || null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/jobs/${id}`);
  revalidatePath("/jobs");
}

export async function submitCandidateToJob(jobId: string, candidateId: string) {
  const { profile } = await requireAuth();
  const supabase = await getSupabaseServerClient();
  const { data: job } = await supabase
    .from("job_requirements")
    .select("client_id")
    .eq("id", jobId)
    .single();
  if (!job) throw new Error("Job not found");

  const { error } = await supabase.from("candidate_job_pipeline").insert({
    candidate_id: candidateId,
    job_id: jobId,
    client_id: job.client_id,
    assigned_recruiter_id: profile.id,
    current_stage: "submitted",
    submitted_at: new Date().toISOString(),
    created_by: profile.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/pipeline");
}
