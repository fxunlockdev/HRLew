"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const clientSchema = z.object({
  name: z.string().min(2),
  website: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  industry: z.string().optional(),
  company_size: z.string().optional(),
  location: z.string().optional(),
  status: z.string().optional(),
  account_owner_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  contract_type: z.string().optional(),
  commercial_terms: z.string().optional(),
  replacement_period_days: z.coerce.number().int().min(0).max(365).optional(),
  payment_terms_days: z.coerce.number().int().min(0).max(365).optional(),
  notes: z.string().optional(),
});

const contactSchema = z.object({
  client_id: z.string().uuid(),
  name: z.string().min(2),
  designation: z.string().optional(),
  email: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  phone: z.string().optional(),
  is_primary: z.coerce.boolean().optional(),
});

function parseFormData(formData: FormData) {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  Object.keys(raw).forEach((k) => {
    if (raw[k] === "") delete raw[k];
  });
  return raw;
}

export async function createClient(formData: FormData) {
  const { profile } = await requireAuth();
  const parsed = clientSchema.parse(parseFormData(formData));
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({ ...parsed, created_by: profile.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/clients");
  redirect(`/clients/${data.id}`);
}

export async function updateClient(id: string, formData: FormData) {
  await requireAuth();
  const parsed = clientSchema.parse(parseFormData(formData));
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from("clients").update(parsed).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/clients/${id}`);
  revalidatePath("/clients");
}

export async function deleteClient(id: string) {
  await requireAuth();
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/clients");
  redirect("/clients");
}

export async function addClientContact(formData: FormData) {
  await requireAuth();
  const parsed = contactSchema.parse(parseFormData(formData));
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from("client_contacts").insert(parsed);
  if (error) throw new Error(error.message);
  revalidatePath(`/clients/${parsed.client_id}`);
}

export async function addClientNote(clientId: string, body: string) {
  const { profile } = await requireAuth();
  if (!body.trim()) return;
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("client_notes")
    .insert({ client_id: clientId, author_id: profile.id, body });
  if (error) throw new Error(error.message);
  revalidatePath(`/clients/${clientId}`);
}
