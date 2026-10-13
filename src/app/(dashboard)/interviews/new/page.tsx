import { withProfile } from "@/lib/db";
import { jsonObjectFrom } from "kysely/helpers/postgres";
import { requirePermission } from "@/lib/auth";
import { getSettingsList } from "@/lib/settings";
import { PageHeader } from "@/components/ui/page-header";
import { InterviewForm } from "@/components/interviews/interview-form";

export const metadata = { title: "Schedule interview · HR OS" };

export default async function NewInterviewPage() {
  const { profile } = await requirePermission("interviews", "create");

  const { statuses, candidates, jobs } = await withProfile(profile.id, async (trx) => ({
    statuses: await getSettingsList(trx, "interview_status"),
    candidates: await trx
      .selectFrom("candidates")
      .select(["id", "full_name"])
      .orderBy("full_name", "asc")
      .limit(500)
      .execute(),
      jobs: await trx
        .selectFrom("job_requirements")
        .select((eb) => [
          "job_requirements.id",
          "job_requirements.title",
          jsonObjectFrom(
            eb
              .selectFrom("clients")
              .select("clients.name")
              .whereRef("clients.id", "=", "job_requirements.client_id"),
          ).as("client"),
        ])
        .where("status", "=", "open")
        .orderBy("title", "asc")
        .limit(500)
        .execute(),
  }));
  return (
    <>
      <PageHeader title="Schedule interview" />
      <InterviewForm
        mode="create"
        statuses={statuses}
        candidates={candidates}
        jobs={jobs}
      />
    </>
  );
}
