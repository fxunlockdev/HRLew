"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { withProfile } from "@/lib/db";
import { orNull, parseFormData } from "@/lib/form";

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

export async function createLead(formData: FormData) {
  const { profile } = await requireAuth();
  const parsed = leadSchema.parse(parseFormData(formData));

  const id = await withProfile(profile.id, async (trx) => {
    const row = await trx
      .insertInto("bd_leads")
      .values({
        company_name: parsed.company_name,
        contact_name: orNull(parsed.contact_name),
        contact_email: orNull(parsed.contact_email),
        contact_phone: orNull(parsed.contact_phone),
        linkedin_url: orNull(parsed.linkedin_url),
        industry: orNull(parsed.industry),
        source: orNull(parsed.source),
        owner_id: parsed.owner_id ?? profile.id,
        stage: parsed.stage ?? "new_lead",
        expected_value: orNull(parsed.expected_value),
        next_follow_up_at: orNull(parsed.next_follow_up_at),
        notes: orNull(parsed.notes),
        created_by: profile.id,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    return row.id;
  });

  revalidatePath("/bd");
  redirect(`/bd/${id}`);
}

export async function updateLeadStage(leadId: string, stage: string) {
  const { profile } = await requireAuth();

  await withProfile(profile.id, (trx) =>
    trx.updateTable("bd_leads").set({ stage }).where("id", "=", leadId).execute(),
  );

  revalidatePath("/bd");
}

const activityTypeSchema = z
  .enum(["call", "email", "meeting", "note", "proposal_sent", "other"])
  .default("note");

export async function addBdActivity(formData: FormData) {
  const { profile } = await requireAuth();
  const leadId = String(formData.get("lead_id") ?? "");
  const activityType = activityTypeSchema.parse(
    formData.get("activity_type") ?? undefined,
  );
  const subject = (formData.get("subject") as string | null) || null;
  const body = (formData.get("body") as string | null) || null;
  if (!leadId) throw new Error("lead_id required");

  await withProfile(profile.id, (trx) =>
    trx
      .insertInto("bd_activities")
      .values({
        lead_id: leadId,
        author_id: profile.id,
        activity_type: activityType,
        subject,
        body,
      })
      .execute(),
  );

  revalidatePath(`/bd/${leadId}`);
}

export async function convertLeadToClient(leadId: string) {
  const { profile } = await requireAuth();

  // One transaction: a converted lead always has the client it points at.
  const clientId = await withProfile(profile.id, async (trx) => {
    const lead = await trx
      .selectFrom("bd_leads")
      .select(["company_name", "industry", "converted_client_id"])
      .where("id", "=", leadId)
      .executeTakeFirst();
    if (!lead) throw new Error("Lead not found");
    if (lead.converted_client_id) return lead.converted_client_id;

    const client = await trx
      .insertInto("clients")
      .values({
        name: lead.company_name,
        industry: lead.industry,
        status: "active",
        created_by: profile.id,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    await trx
      .updateTable("bd_leads")
      .set({
        stage: "converted",
        converted_client_id: client.id,
        converted_at: new Date().toISOString(),
      })
      .where("id", "=", leadId)
      .execute();

    return client.id;
  });

  revalidatePath("/bd");
  revalidatePath("/clients");
  redirect(`/clients/${clientId}`);
}
