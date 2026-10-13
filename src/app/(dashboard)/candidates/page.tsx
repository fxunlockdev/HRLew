import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { withProfile, type DB } from "@/lib/db";
import { countAll, ilikeContains } from "@/lib/db/sql-helpers";
import { jsonObjectFrom } from "kysely/helpers/postgres";
import type { ExpressionBuilder } from "kysely";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Plus, Upload } from "lucide-react";
import { CandidatesTable } from "@/components/candidates/candidates-table";
import { CandidatesFilters } from "@/components/candidates/candidates-filters";
import { getSettingsList } from "@/lib/settings";
import { hasPermission } from "@/lib/rbac";

export const metadata = { title: "Candidates · HR OS" };

interface SearchParams {
  q?: string;
  status?: string;
  recruiter?: string;
  page?: string;
}

const PAGE_SIZE = 20;

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { profile, permissions } = await requireAuth();
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const { candidates, total, statuses, recruiters } = await withProfile(profile.id, async (trx) => {
    // One predicate, used by both the page query and the count, so they can
    // never disagree about what is being filtered.
    const filters = (eb: ExpressionBuilder<DB, "candidates">) => {
      const conditions = [];
      if (sp.q) {
        conditions.push(
          eb.or([
            ilikeContains("full_name", sp.q),
            ilikeContains("email", sp.q),
            ilikeContains("phone", sp.q),
            ilikeContains("current_company", sp.q),
          ]),
        );
      }
      if (sp.status) conditions.push(eb("status", "=", sp.status));
      if (sp.recruiter) conditions.push(eb("assigned_recruiter_id", "=", sp.recruiter));
      return eb.and(conditions);
    };

    const rows = await trx
      .selectFrom("candidates")
      .select((eb) => [
        "id",
        "display_id",
        "full_name",
        "email",
        "phone",
        "current_company",
        "current_designation",
        "current_location",
        "total_experience_years",
        "expected_ctc",
        "status",
        "skills",
        "assigned_recruiter_id",
        "created_at",
        jsonObjectFrom(
          eb
            .selectFrom("profiles")
            .select("profiles.full_name")
            .whereRef("profiles.id", "=", "candidates.assigned_recruiter_id"),
        ).as("recruiter"),
      ])
      .where(filters)
      .orderBy("created_at", "desc")
      .limit(PAGE_SIZE)
      .offset(offset)
      .execute();

    const counted = await trx
      .selectFrom("candidates")
      .select(countAll.as("count"))
      .where(filters)
      .executeTakeFirst();

    return {
      candidates: rows,
      total: counted?.count ?? 0,
      statuses: await getSettingsList(trx, "candidate_status"),
      recruiters: await trx
        .selectFrom("profiles")
        .select(["id", "full_name"])
        .where("status", "=", "active")
        .orderBy("full_name", "asc")
        .execute(),
    };
  });

  const canCreate = hasPermission(profile, permissions, "candidates", "create");

  return (
    <>
      <PageHeader
        title="Candidates"
        description="Central candidate database. Add, search, filter and submit to jobs."
        actions={
          canCreate && (
            <>
              <Button asChild variant="outline">
                <Link href="/candidates/import">
                  <Upload className="h-4 w-4" /> Import CSV
                </Link>
              </Button>
              <Button asChild>
                <Link href="/candidates/new">
                  <Plus className="h-4 w-4" /> New candidate
                </Link>
              </Button>
            </>
          )
        }
      />

      <CandidatesFilters statuses={statuses} recruiters={recruiters} />

      <CandidatesTable
        rows={candidates}
        statuses={statuses}
        canViewCtc={hasPermission(profile, permissions, "candidates", "view_sensitive")}
        page={page}
        pageSize={PAGE_SIZE}
        total={total}
      />
    </>
  );
}
