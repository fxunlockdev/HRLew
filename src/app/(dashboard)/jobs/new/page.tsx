import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth";
import { getSettingsList } from "@/lib/settings";
import { PageHeader } from "@/components/ui/page-header";
import { JobForm } from "@/components/jobs/job-form";
import { hasPermission } from "@/lib/rbac";

export const metadata = { title: "New requirement · HRLew" };

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const ctx = await requirePermission("jobs", "create");
  const supabase = await getSupabaseServerClient();
  const sp = await searchParams;
  const [statuses, { data: clients }] = await Promise.all([
    getSettingsList("job_status"),
    supabase.from("clients").select("id, name").order("name"),
  ]);

  const canEditSalary = hasPermission(ctx.profile, ctx.permissions, "jobs", "edit_salary") || ctx.profile.role?.name === "admin";

  return (
    <>
      <PageHeader title="New requirement" />
      <JobForm
        mode="create"
        statuses={statuses}
        clients={clients ?? []}
        defaultClient={sp.client}
        canEditSalary={canEditSalary}
      />
    </>
  );
}
