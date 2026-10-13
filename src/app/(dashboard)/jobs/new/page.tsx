import { withProfile } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getSettingsList } from "@/lib/settings";
import { PageHeader } from "@/components/ui/page-header";
import { JobForm } from "@/components/jobs/job-form";
import { hasPermission } from "@/lib/rbac";

export const metadata = { title: "New requirement · HR OS" };

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const ctx = await requirePermission("jobs", "create");
  const sp = await searchParams;

  const { statuses, clients } = await withProfile(ctx.profile.id, async (trx) => ({
    statuses: await getSettingsList(trx, "job_status"),
    clients: await trx.selectFrom("clients").select(["id", "name"]).orderBy("name", "asc").execute(),
  }));

  const canEditSalary = hasPermission(ctx.profile, ctx.permissions, "jobs", "edit_salary") || ctx.profile.role?.name === "admin";

  return (
    <>
      <PageHeader title="New requirement" />
      <JobForm
        mode="create"
        statuses={statuses}
        clients={clients}
        defaultClient={sp.client}
        canEditSalary={canEditSalary}
      />
    </>
  );
}
