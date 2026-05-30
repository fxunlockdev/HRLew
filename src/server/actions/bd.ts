"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const leadSchema = z.object({
  company_name: z.string().min(2),
  contact_name: z.string().optional(),
  contact_email: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  contact_phone: z.string().optional(),
  linkedin_url: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  industry: z.string().optional(),
  source: z.string().optional(),
  owner_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  stage: z.string().optional(),
  expected_value: z.coerce.number().min(0).optional(),
  next_follow_up_at: z.string().optional(),
  notes: z.string().optional(),
});

function parseFormData(formData: FormData) {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  Object.keys(raw).forEach((k) => {
    if (raw[k] === "") delete raw[k];
  });
  return raw;
}

export async function createLead(formData: FormData) {
  const { profile } = await requireAuth();
  const parsed = leadSchema.parse(parseFormData(formData));
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("bd_leads")
    .insert({
      ...parsed,
      owner_id: parsed.owner_id ?? profile.id,
      next_follow_up_at: parsed.next_follow_up_at || null,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/bd");
  redirect(`/bd/${data.id}`);
}

export async function updateLeadStage(leadId: string, stage: string) {
  await requireAuth();
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from("bd_leads").update({ stage }).eq("id", leadId);
  if (error) throw new Error(error.message);
  revalidatePath("/bd");
}

export async function addBdActivity(formData: FormData) {
  const { profile } = await requireAuth();
  const lead_id = String(formData.get("lead_id") ?? "");
  const activity_type = String(formData.get("activity_type") ?? "note");
  const subject = (formData.get("subject") as string | null) ?? null;
  const body = (formData.get("body") as string | null) ?? null;
  if (!lead_id) throw new Error("lead_id required");
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from("bd_activities").insert({
    lead_id, author_id: profile.id, activity_type, subject, body,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/bd/${lead_id}`);
}

export async function convertLeadToClient(leadId: string) {
  await requireAuth();
  const supabase = await getSupabaseServerClient();
  const { data: lead } = await supabase
    .from("bd_leads")
    .select("company_name, industry")
    .eq("id", leadId)
    .single();
  if (!lead) throw new Error("Lead not found");

  const { data: client, error } = await supabase
    .from("clients")
    .insert({ name: lead.company_name, industry: lead.industry, status: "active" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await supabase
    .from("bd_leads")
    .update({ stage: "converted", converted_client_id: client.id, converted_at: new Date().toISOString() })
    .eq("id", leadId);

  revalidatePath("/bd");
  revalidatePath("/clients");
  redirect(`/clients/${client.id}`);
}
