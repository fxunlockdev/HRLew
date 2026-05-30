"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  profile_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  full_name: z.string().min(2),
  email: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  phone: z.string().optional(),
  designation: z.string().optional(),
  department: z.string().optional(),
  manager_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  joining_date: z.string().optional(),
  employment_status: z.string().default("active"),
  salary: z.coerce.number().min(0).optional(),
  incentive_structure: z.string().optional(),
  notes: z.string().optional(),
});

function parseFormData(formData: FormData) {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  Object.keys(raw).forEach((k) => {
    // Drop blanks and the "none" sentinel coming from optional Select fields.
    if (raw[k] === "" || raw[k] === "__none__") delete raw[k];
  });
  return raw;
}

export async function createStaff(formData: FormData) {
  await requirePermission("staff", "create");
  const parsed = schema.parse(parseFormData(formData));
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("staff")
    .insert({ ...parsed, joining_date: parsed.joining_date || null })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/staff");
  redirect(`/staff/${data.id}`);
}

export async function updateStaff(id: string, formData: FormData) {
  await requirePermission("staff", "edit");
  const parsed = schema.partial().parse(parseFormData(formData));
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase
    .from("staff")
    .update({ ...parsed, joining_date: parsed.joining_date || null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/staff/${id}`);
  revalidatePath("/staff");
}
