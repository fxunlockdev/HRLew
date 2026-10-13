"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { withProfile } from "@/lib/db";
import { ilikeContains } from "@/lib/db/sql-helpers";
import { orNull, parseFormData, toStringArray } from "@/lib/form";

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

type CandidateInput = z.infer<typeof candidateSchema>;

function candidateColumns(parsed: CandidateInput) {
  return {
    full_name: parsed.full_name,
    email: orNull(parsed.email),
    phone: orNull(parsed.phone),
    current_company: orNull(parsed.current_company),
    current_designation: orNull(parsed.current_designation),
    current_location: orNull(parsed.current_location),
    preferred_location: orNull(parsed.preferred_location),
    total_experience_years: orNull(parsed.total_experience_years),
    relevant_experience_years: orNull(parsed.relevant_experience_years),
    current_ctc: orNull(parsed.current_ctc),
    expected_ctc: orNull(parsed.expected_ctc),
    notice_period_days: orNull(parsed.notice_period_days),
    last_working_day: orNull(parsed.last_working_day),
    skills: toStringArray(parsed.skills),
    industry: orNull(parsed.industry),
    source: orNull(parsed.source),
    linkedin_url: orNull(parsed.linkedin_url),
    portfolio_url: orNull(parsed.portfolio_url),
    notes: orNull(parsed.notes),
  };
}

export async function createCandidate(formData: FormData) {
  const { profile } = await requireAuth();
  const parsed = candidateSchema.parse(parseFormData(formData));

  const id = await withProfile(profile.id, async (trx) => {
    if (parsed.email) {
      const dup = await trx
        .selectFrom("candidates")
        .select("id")
        .where("email", "=", parsed.email)
        .executeTakeFirst();
      if (dup) throw new Error(`A candidate with email ${parsed.email} already exists.`);
    }

    const row = await trx
      .insertInto("candidates")
      .values({
        ...candidateColumns(parsed),
        status: parsed.status ?? "new",
        assigned_recruiter_id: parsed.assigned_recruiter_id ?? profile.id,
        created_by: profile.id,
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    return row.id;
  });

  revalidatePath("/candidates");
  redirect(`/candidates/${id}`);
}

export async function updateCandidate(id: string, formData: FormData) {
  const { profile } = await requireAuth();
  const parsed = candidateSchema.parse(parseFormData(formData));

  await withProfile(profile.id, (trx) =>
    trx
      .updateTable("candidates")
      .set({
        ...candidateColumns(parsed),
        status: parsed.status ?? "new",
        assigned_recruiter_id: orNull(parsed.assigned_recruiter_id),
      })
      .where("id", "=", id)
      .execute(),
  );

  revalidatePath(`/candidates/${id}`);
  revalidatePath("/candidates");
}

export async function deleteCandidate(id: string) {
  const { profile } = await requireAuth();
  await withProfile(profile.id, (trx) =>
    trx.deleteFrom("candidates").where("id", "=", id).execute(),
  );
  revalidatePath("/candidates");
  redirect("/candidates");
}

export async function addCandidateNote(candidateId: string, body: string) {
  const { profile } = await requireAuth();
  if (!body.trim()) return;

  await withProfile(profile.id, (trx) =>
    trx
      .insertInto("candidate_notes")
      .values({ candidate_id: candidateId, author_id: profile.id, body })
      .execute(),
  );

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

  await withProfile(profile.id, async (trx) => {
    await trx
      .insertInto("candidate_documents")
      .values({
        candidate_id: candidateId,
        uploaded_by: profile.id,
        file_name: fileName,
        storage_path: storagePath,
        mime_type: mime,
        size_bytes: size,
        category: "resume",
      })
      .execute();

    // Cache the latest resume on the candidate row for list views.
    await trx
      .updateTable("candidates")
      .set({ resume_file_name: fileName, resume_url: storagePath })
      .where("id", "=", candidateId)
      .execute();
  });

  revalidatePath(`/candidates/${candidateId}`);
}

/** Typeahead for the "submit candidate to job" panel. */
export async function searchCandidates(term: string) {
  const { profile } = await requireAuth();
  const trimmed = term.trim();
  if (trimmed.length < 2) return [];

  return withProfile(profile.id, (trx) =>
    trx
      .selectFrom("candidates")
      .select(["id", "full_name", "email", "current_company"])
      .where((eb) =>
        eb.or([
          ilikeContains("full_name", trimmed),
          ilikeContains("email", trimmed),
        ]),
      )
      .orderBy("full_name", "asc")
      .limit(20)
      .execute(),
  );
}

const importRowSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  current_company: z.string().optional(),
  current_designation: z.string().optional(),
  current_location: z.string().optional(),
  total_experience_years: z.coerce.number().min(0).max(60).optional(),
  current_ctc: z.coerce.number().min(0).optional(),
  expected_ctc: z.coerce.number().min(0).optional(),
  notice_period_days: z.coerce.number().int().min(0).max(365).optional(),
  skills: z.string().optional(),
  source: z.string().optional(),
});

export interface ImportResult {
  imported: number;
  skipped: number;
  failures: string[];
}

/**
 * Bulk CSV import. Runs server-side in one transaction — the Supabase version
 * inserted row-by-row from the browser, so a mid-way failure left a partial
 * import behind and every row cost a round trip.
 */
export async function importCandidates(rows: Record<string, string>[]): Promise<ImportResult> {
  const { profile } = await requireAuth();

  const MAX_ROWS = 5000;
  if (rows.length > MAX_ROWS) {
    throw new Error(`That file has ${rows.length} rows; the limit is ${MAX_ROWS}.`);
  }

  const result: ImportResult = { imported: 0, skipped: 0, failures: [] };

  await withProfile(profile.id, async (trx) => {
    for (const [index, raw] of rows.entries()) {
      const line = index + 2; // header is line 1
      const parsed = importRowSchema.safeParse(raw);
      if (!parsed.success) {
        result.failures.push(`Line ${line}: ${parsed.error.issues[0]?.message ?? "invalid row"}`);
        continue;
      }
      const data = parsed.data;

      if (data.email) {
        const dup = await trx
          .selectFrom("candidates")
          .select("id")
          .where("email", "=", data.email)
          .executeTakeFirst();
        if (dup) {
          result.skipped += 1;
          continue;
        }
      }

      await trx
        .insertInto("candidates")
        .values({
          full_name: data.full_name,
          email: orNull(data.email),
          phone: orNull(data.phone),
          current_company: orNull(data.current_company),
          current_designation: orNull(data.current_designation),
          current_location: orNull(data.current_location),
          total_experience_years: orNull(data.total_experience_years),
          current_ctc: orNull(data.current_ctc),
          expected_ctc: orNull(data.expected_ctc),
          notice_period_days: orNull(data.notice_period_days),
          skills: toStringArray(data.skills),
          source: orNull(data.source),
          status: "new",
          assigned_recruiter_id: profile.id,
          created_by: profile.id,
        })
        .execute();

      result.imported += 1;
    }
  });

  revalidatePath("/candidates");
  return result;
}
