import { withProfile } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getSettingsList } from "@/lib/settings";
import { PageHeader } from "@/components/ui/page-header";
import { PlacementForm } from "@/components/placements/placement-form";
import { hasPermission } from "@/lib/rbac";

export const metadata = { title: "New placement · HR OS" };

export default async function NewPlacementPage() {
  const ctx = await requirePermission("placements", "create");
  const { statuses, candidates, clients, jobs, recruiters } = await withProfile(
    ctx.profile.id,
    async (trx) => ({
      statuses: await getSettingsList(trx, "placement_status"),
      candidates: await trx
        .selectFrom("candidates")
        .select(["id", "full_name"])
        .orderBy("full_name", "asc")
        .limit(500)
        .execute(),
      clients: await trx
        .selectFrom("clients")
        .select(["id", "name"])
        .orderBy("name", "asc")
        .limit(500)
        .execute(),
      jobs: await trx
        .selectFrom("job_requirements")
        .select(["id", "title"])
        .orderBy("title", "asc")
        .limit(500)
        .execute(),
      recruiters: await trx
        .selectFrom("profiles")
        .select(["id", "full_name"])
        .where("status", "=", "active")
        .orderBy("full_name", "asc")
        .execute(),
    }),
  );
  return (
    <>
      <PageHeader title="New placement" description="Records a successful hire and unlocks revenue tracking." />
      <PlacementForm
        mode="create"
        statuses={statuses}
        candidates={candidates}
        clients={clients}
        jobs={jobs}
        recruiters={recruiters}
        canEditFinancial={hasPermission(ctx.profile, ctx.permissions, "placements", "edit_financial") || ctx.profile.role?.name === "admin"}
      />
    </>
  );
}
