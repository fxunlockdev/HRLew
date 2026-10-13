import { withProfile } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getSettingsList } from "@/lib/settings";
import { PageHeader } from "@/components/ui/page-header";
import { BdLeadForm } from "@/components/bd/bd-lead-form";

export const metadata = { title: "New BD lead · HR OS" };

export default async function NewBdLeadPage() {
  const { profile } = await requirePermission("bd", "create");

  const { stages, sources, owners } = await withProfile(profile.id, async (trx) => ({
    stages: await getSettingsList(trx, "bd_stage"),
    sources: await getSettingsList(trx, "bd_source"),
    owners: await trx
      .selectFrom("profiles")
      .select(["id", "full_name"])
      .where("status", "=", "active")
      .orderBy("full_name", "asc")
      .execute(),
  }));
  return (
    <>
      <PageHeader title="New BD lead" />
      <BdLeadForm stages={stages} sources={sources} owners={owners} />
    </>
  );
}
