import { getSettingsList } from "@/lib/settings";
import { withProfile } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { CandidateForm } from "@/components/candidates/candidate-form";

export const metadata = { title: "New candidate · HR OS" };

export default async function NewCandidatePage() {
  const { profile } = await requirePermission("candidates", "create");

  const { statuses, sources, recruiters } = await withProfile(profile.id, async (trx) => ({
    statuses: await getSettingsList(trx, "candidate_status"),
    sources: await getSettingsList(trx, "candidate_source"),
    recruiters: await trx
      .selectFrom("profiles")
      .select(["id", "full_name"])
      .where("status", "=", "active")
      .orderBy("full_name", "asc")
      .execute(),
  }));

  return (
    <>
      <PageHeader title="New candidate" description="Add a candidate to the central database." />
      <CandidateForm
        statuses={statuses}
        sources={sources}
        recruiters={recruiters}
        mode="create"
      />
    </>
  );
}
