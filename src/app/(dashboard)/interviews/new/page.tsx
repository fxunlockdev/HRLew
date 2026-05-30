import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { getSettingsList } from "@/lib/settings";
import { PageHeader } from "@/components/ui/page-header";
import { InterviewForm } from "@/components/interviews/interview-form";

export const metadata = { title: "Schedule interview · HR OS" };

export default async function NewInterviewPage() {
  await requirePermission("interviews", "create");
  const supabase = await getSupabaseServerClient();
  const [statuses, { data: candidates }, { data: jobs }] = await Promise.all([
    getSettingsList("interview_status"),
    supabase.from("candidates").select("id, full_name").order("full_name").limit(500),
    supabase.from("job_requirements").select("id, title, client:clients(name)").eq("status", "open").order("title").limit(500),
  ]);
  return (
    <>
      <PageHeader title="Schedule interview" />
      <InterviewForm
        mode="create"
        statuses={statuses}
        candidates={candidates ?? []}
        jobs={(jobs ?? []) as any}
      />
    </>
  );
}
