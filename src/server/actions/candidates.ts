"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const candidateSchema = z.object({
  full_name: z.string().min(2, "Name is required"),
  email: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  phone: z.string().optional(),
  current_company: z.string().optional(),
  current_designation: z.string().optional(),
  current_location: z.string().optional(),
  preferred_location: z.string().optional(),
  total_experience_years: z.coerce.number().min(0).max(60).optional(),
  relevant_experience_years: z.coerce.number().min(0).max(60).optional(),
  current_ctc: z.coerce.number().min(0).optional(),
  expected_ctc: z.coerce.number().min(0).optional(),
  notice_period_days: z.coerce.number().int().min(0).max(365).optional(),
  last_working_day: z.string().optional(),
  skills: z.string().optional(),
  industry: z.string().optional(),
  source: z.string().optional(),
  linkedin_url: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  portfolio_url: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  status: z.string().optional(),
  assigned_recruiter_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  notes: z.string().optional(),
});

function parseFormData(formData: FormData) {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  Object.keys(raw).forEach((k) => {
    if (raw[k] === "") delete raw[k];
  });
  return raw;
}

function normalizeSkills(input: string | undefined): string[] {
  if (!input) return [];
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createCandidate(formData: FormData) {
  const { profile } = await requireAuth();
  const parsed = candidateSchema.parse(parseFormData(formData));
  const supabase = await getSupabaseServerClient();

  if (parsed.email) {
    const { data: dup } = await supabase
      .from("candidates")
      .select("id")
      .eq("email", parsed.email)
      .maybeSingle();
    if (dup) throw new Error(`A candidate with email ${parsed.email} already exists.`);
  }

  const { data, error } = await supabase
    .from("candidates")
    .insert({
      full_name: parsed.full_name,
      email: parsed.email,
      phone: parsed.phone,
      current_company: parsed.current_company,
      current_designation: parsed.current_designation,
      current_location: parsed.current_location,
      preferred_location: parsed.preferred_location,
      total_experience_years: parsed.total_experience_years,
      relevant_experience_years: parsed.relevant_experience_years,
      current_ctc: parsed.current_ctc,
      expected_ctc: parsed.expected_ctc,
      notice_period_days: parsed.notice_period_days,
      last_working_day: parsed.last_working_day || null,
      skills: normalizeSkills(parsed.skills),
      industry: parsed.industry,
      source: parsed.source,
      linkedin_url: parsed.linkedin_url,
      portfolio_url: parsed.portfolio_url,
      status: parsed.status ?? "new",
      assigned_recruiter_id: parsed.assigned_recruiter_id ?? profile.id,
      notes: parsed.notes,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/candidates");
  redirect(`/candidates/${data.id}`);
}

export async function updateCandidate(id: string, formData: FormData) {
  await requireAuth();
  const parsed = candidateSchema.parse(parseFormData(formData));
  const supabase = await getSupabaseServerClient();

  const { error } = await supabase
    .from("candidates")
    .update({
      full_name: parsed.full_name,
      email: parsed.email,
      phone: parsed.phone,
      current_company: parsed.current_company,
      current_designation: parsed.current_designation,
      current_location: parsed.current_location,
      preferred_location: parsed.preferred_location,
      total_experience_years: parsed.total_experience_years,
      relevant_experience_years: parsed.relevant_experience_years,
      current_ctc: parsed.current_ctc,
      expected_ctc: parsed.expected_ctc,
      notice_period_days: parsed.notice_period_days,
      last_working_day: parsed.last_working_day || null,
      skills: normalizeSkills(parsed.skills),
      industry: parsed.industry,
      source: parsed.source,
      linkedin_url: parsed.linkedin_url,
      portfolio_url: parsed.portfolio_url,
      status: parsed.status,
      assigned_recruiter_id: parsed.assigned_recruiter_id,
      notes: parsed.notes,
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath(`/candidates/${id}`);
  revalidatePath("/candidates");
}

export async function deleteCandidate(id: string) {
  await requireAuth();
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from("candidates").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/candidates");
  redirect("/candidates");
}

export async function addCandidateNote(candidateId: string, body: string) {
  const { profile } = await requireAuth();
  if (!body.trim()) return;
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("candidate_notes")
    .insert({ candidate_id: candidateId, author_id: profile.id, body });
  if (error) throw new Error(error.message);
  revalidatePath(`/candidates/${candidateId}`);
}

export async function attachResume(
  candidateId: string,
  fileName: string,
  storagePath: string,
  mime: string,
  size: number,
) {
  const { profile } = await requireAuth();
  const supabase = await getSupabaseServerClient();
  const { error: docErr } = await supabase.from("candidate_documents").insert({
    candidate_id: candidateId,
    uploaded_by: profile.id,
    file_name: fileName,
    storage_path: storagePath,
    mime_type: mime,
    size_bytes: size,
    category: "resume",
  });
  if (docErr) throw new Error(docErr.message);

  // Cache latest resume on the candidate row for convenience
  await supabase
    .from("candidates")
    .update({ resume_file_name: fileName, resume_url: storagePath })
    .eq("id", candidateId);

  revalidatePath(`/candidates/${candidateId}`);
}
