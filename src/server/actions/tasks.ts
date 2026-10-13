"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { withProfile } from "@/lib/db";
import { orNull, parseFormData } from "@/lib/form";

const schema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  related_entity_type: z
    .enum(["candidate", "client", "bd_lead", "job", "interview", "placement", "pipeline"])
    .optional(),
  related_entity_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  assigned_to_id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  due_at: z.string().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  status: z.enum(["pending", "in_progress", "completed", "overdue", "cancelled"]).default("pending"),
});

export async function createTask(formData: FormData) {
  const { profile } = await requireAuth();
  const parsed = schema.parse(parseFormData(formData));

  await withProfile(profile.id, (trx) =>
    trx
      .insertInto("tasks")
      .values({
        title: parsed.title,
        description: orNull(parsed.description),
        related_entity_type: orNull(parsed.related_entity_type),
        related_entity_id: orNull(parsed.related_entity_id),
        assigned_to_id: parsed.assigned_to_id ?? profile.id,
        due_at: orNull(parsed.due_at),
        priority: parsed.priority,
        status: parsed.status,
        created_by: profile.id,
      })
      .execute(),
  );

  revalidatePath("/tasks");
}

const taskStatusSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "overdue",
  "cancelled",
]);

export async function updateTaskStatus(id: string, status: string) {
  const parsedStatus = taskStatusSchema.parse(status);
  const { profile } = await requireAuth();

  await withProfile(profile.id, (trx) =>
    trx
      .updateTable("tasks")
      .set({
        status: parsedStatus,
        completed_at: parsedStatus === "completed" ? new Date().toISOString() : null,
      })
      .where("id", "=", id)
      .execute(),
  );

  revalidatePath("/tasks");
}
