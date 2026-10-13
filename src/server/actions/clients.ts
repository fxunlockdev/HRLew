"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { withProfile } from "@/lib/db";
import { orNull, parseFormData } from "@/lib/form";

const clientSchema = z.object({
  name: z.string().min(2),
  website: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  // Either an external image URL or an object key in the bucket.
  logo_url: z.string().optional(),
  logo_file_name: z.string().optional(),
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

type ClientInput = z.infer<typeof clientSchema>;

const contactSchema = z.object({
  client_id: z.string().uuid(),
  name: z.string().min(2),
  designation: z.string().optional(),
  email: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  phone: z.string().optional(),
  is_primary: z.coerce.boolean().optional(),
});

function clientColumns(parsed: ClientInput) {
  return {
    name: parsed.name,
    website: orNull(parsed.website),
    logo_url: orNull(parsed.logo_url),
    logo_file_name: orNull(parsed.logo_file_name),
    industry: orNull(parsed.industry),
    company_size: orNull(parsed.company_size),
    location: orNull(parsed.location),
    account_owner_id: orNull(parsed.account_owner_id),
    contract_type: orNull(parsed.contract_type),
    commercial_terms: orNull(parsed.commercial_terms),
    replacement_period_days: orNull(parsed.replacement_period_days),
    payment_terms_days: orNull(parsed.payment_terms_days),
    notes: orNull(parsed.notes),
  };
}

export async function createClient(formData: FormData) {
  const { profile } = await requireAuth();
  const parsed = clientSchema.parse(parseFormData(formData));

  const id = await withProfile(profile.id, async (trx) => {
    const row = await trx
      .insertInto("clients")
      .values({
        ...clientColumns(parsed),
        status: parsed.status ?? "prospect",
        created_by: profile.id,
      })
      .returning("id")
      .executeTakeFirstOrThrow();
    return row.id;
  });

  revalidatePath("/clients");
  redirect(`/clients/${id}`);
}

export async function updateClient(id: string, formData: FormData) {
  const { profile } = await requireAuth();
  const parsed = clientSchema.parse(parseFormData(formData));

  await withProfile(profile.id, (trx) =>
    trx
      .updateTable("clients")
      .set({
        ...clientColumns(parsed),
        status: parsed.status ?? "prospect",
      })
      .where("id", "=", id)
      .execute(),
  );

  revalidatePath(`/clients/${id}`);
  revalidatePath("/clients");
}

export async function deleteClient(id: string) {
  const { profile } = await requireAuth();
  await withProfile(profile.id, (trx) => trx.deleteFrom("clients").where("id", "=", id).execute());
  revalidatePath("/clients");
  redirect("/clients");
}

export async function addClientContact(formData: FormData) {
  const { profile } = await requireAuth();
  const parsed = contactSchema.parse(parseFormData(formData));

  await withProfile(profile.id, (trx) =>
    trx
      .insertInto("client_contacts")
      .values({
        client_id: parsed.client_id,
        name: parsed.name,
        designation: orNull(parsed.designation),
        email: orNull(parsed.email),
        phone: orNull(parsed.phone),
        is_primary: parsed.is_primary ?? false,
      })
      .execute(),
  );

  revalidatePath(`/clients/${parsed.client_id}`);
}

export async function addClientNote(clientId: string, body: string) {
  const { profile } = await requireAuth();
  if (!body.trim()) return;

  await withProfile(profile.id, (trx) =>
    trx
      .insertInto("client_notes")
      .values({ client_id: clientId, author_id: profile.id, body })
      .execute(),
  );

  revalidatePath(`/clients/${clientId}`);
}
