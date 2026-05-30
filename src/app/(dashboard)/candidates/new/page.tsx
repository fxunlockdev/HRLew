import { getSettingsList } from "@/lib/settings";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { CandidateForm } from "@/components/candidates/candidate-form";

export const metadata = { title: "New candidate · HRLew" };

export default async function NewCandidatePage() {
  await requirePermission("candidates", "create");
  const supabase = await getSupabaseServerClient();
  const [statuses, sources, { data: recruiters }] = await Promise.all([
    getSettingsList("candidate_status"),
    getSettingsList("candidate_source"),
    supabase.from("profiles").select("id, full_name").eq("status", "active").order("full_name"),
  ]);

  return (
    <>
      <PageHeader title="New candidate" description="Add a candidate to the central database." />
      <CandidateForm
        statuses={statuses}
        sources={sources}
        recruiters={recruiters ?? []}
        mode="create"
      />
    </>
  );
}
