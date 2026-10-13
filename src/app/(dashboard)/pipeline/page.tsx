import { withProfile, type DB } from "@/lib/db";
import type { ExpressionBuilder } from "kysely";
import { requireAuth } from "@/lib/auth";
import { getSettingsList } from "@/lib/settings";
import { PageHeader } from "@/components/ui/page-header";
import { PipelineKanban } from "@/components/pipeline/pipeline-kanban";
import { PipelineFilters } from "@/components/pipeline/pipeline-filters";

export const metadata = { title: "Pipeline · HR OS" };

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string; client?: string; recruiter?: string }>;
}) {
  const { profile } = await requireAuth();
  const sp = await searchParams;

  const { rows, stages, jobs, clients, recruiters } = await withProfile(profile.id, async (trx) => {
    const filters = (eb: ExpressionBuilder<DB, "v_pipeline_overview">) => {
      const conditions = [eb("is_active", "=", true)];
      if (sp.job) conditions.push(eb("job_id", "=", sp.job));
      if (sp.client) conditions.push(eb("client_id", "=", sp.client));
      if (sp.recruiter) conditions.push(eb("recruiter_id", "=", sp.recruiter));
      return eb.and(conditions);
    };

    return {
      rows: await trx
        .selectFrom("v_pipeline_overview")
        .selectAll()
        .where(filters)
        .orderBy("last_activity_at", "desc")
        .limit(500)
        .execute(),
      stages: await getSettingsList(trx, "pipeline_stage"),
      jobs: await trx
        .selectFrom("job_requirements")
        .select(["id", "title"])
        .where("status", "=", "open")
        .orderBy("title", "asc")
        .execute(),
      clients: await trx.selectFrom("clients").select(["id", "name"]).orderBy("name", "asc").execute(),
      recruiters: await trx
        .selectFrom("profiles")
        .select(["id", "full_name"])
        .where("status", "=", "active")
        .orderBy("full_name", "asc")
        .execute(),
    };
  });

  return (
    <>
      <PageHeader
        title="Pipeline"
        description="Job-specific candidate flow. Move candidates by changing their stage."
      />
      <PipelineFilters jobs={jobs} clients={clients} recruiters={recruiters} />
      <PipelineKanban rows={rows} stages={stages} />
    </>
  );
}
