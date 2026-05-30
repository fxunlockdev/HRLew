"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  related_entity_type: z.string().optional(),
  related_entity_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  assigned_to_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  due_at: z.string().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  status: z.enum(["pending", "in_progress", "completed", "overdue", "cancelled"]).default("pending"),
});

function parseFormData(formData: FormData) {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  Object.keys(raw).forEach((k) => {
    if (raw[k] === "") delete raw[k];
  });
  return raw;
}

export async function createTask(formData: FormData) {
  const { profile } = await requireAuth();
  const parsed = schema.parse(parseFormData(formData));
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.from("tasks").insert({
    ...parsed,
    due_at: parsed.due_at || null,
    assigned_to_id: parsed.assigned_to_id ?? profile.id,
    created_by: profile.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/tasks");
}

export async function updateTaskStatus(id: string, status: string) {
  await requireAuth();
  const supabase = await getSupabaseServerClient();
  const update: Record<string, unknown> = { status };
  if (status === "completed") update.completed_at = new Date().toISOString();
  const { error } = await supabase.from("tasks").update(update).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/tasks");
}
