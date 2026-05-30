import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth";
import { getSettingsList } from "@/lib/settings";
import { PageHeader } from "@/components/ui/page-header";
import { PipelineKanban } from "@/components/pipeline/pipeline-kanban";
import { PipelineFilters } from "@/components/pipeline/pipeline-filters";

export const metadata = { title: "Pipeline · HRLew" };

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string; client?: string; recruiter?: string }>;
}) {
  await requireAuth();
  const sp = await searchParams;
  const supabase = await getSupabaseServerClient();

  let q = supabase
    .from("v_pipeline_overview")
    .select("*")
    .eq("is_active", true)
    .limit(500);

  if (sp.job) q = q.eq("job_id", sp.job);
  if (sp.client) q = q.eq("client_id", sp.client);
  if (sp.recruiter) q = q.eq("recruiter_id", sp.recruiter);

  const [{ data: rows }, stages, { data: jobs }, { data: clients }, { data: recruiters }] = await Promise.all([
    q,
    getSettingsList("pipeline_stage"),
    supabase.from("job_requirements").select("id, title").eq("status", "open").order("title"),
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("profiles").select("id, full_name").eq("status", "active").order("full_name"),
  ]);

  return (
    <>
      <PageHeader
        title="Pipeline"
        description="Job-specific candidate flow. Move candidates by changing their stage."
      />
      <PipelineFilters jobs={jobs ?? []} clients={clients ?? []} recruiters={recruiters ?? []} />
      <PipelineKanban rows={(rows ?? []) as any} stages={stages} />
    </>
  );
}
