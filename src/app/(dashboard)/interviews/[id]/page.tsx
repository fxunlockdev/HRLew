import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { withProfile } from "@/lib/db";
import { jsonObjectFrom } from "kysely/helpers/postgres";
import { getSettingsList } from "@/lib/settings";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { InterviewForm } from "@/components/interviews/interview-form";
import { InterviewFeedbackForm } from "@/components/interviews/interview-feedback-form";
import { formatDateTime } from "@/lib/utils";

export default async function InterviewDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireAuth();

  const data = await withProfile(profile.id, async (trx) => {
    const iv = await trx
      .selectFrom("interviews")
      .selectAll("interviews")
      .select((eb) => [
        jsonObjectFrom(
          eb
            .selectFrom("candidates")
            .select(["candidates.id", "candidates.full_name", "candidates.email"])
            .whereRef("candidates.id", "=", "interviews.candidate_id"),
        ).as("candidate"),
        jsonObjectFrom(
          eb
            .selectFrom("job_requirements")
            .select(["job_requirements.id", "job_requirements.title"])
            .whereRef("job_requirements.id", "=", "interviews.job_id"),
        ).as("job"),
        jsonObjectFrom(
          eb
            .selectFrom("clients")
            .select("clients.name")
            .whereRef("clients.id", "=", "interviews.client_id"),
        ).as("client"),
      ])
      .where("interviews.id", "=", id)
      .executeTakeFirst();
    if (!iv) return null;

    return {
      iv,
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
        .orderBy("title", "asc")
        .limit(500)
        .execute(),
    };
  });

  if (!data) notFound();
  const { iv, statuses, candidates, jobs } = data;
  const stat = statuses.find((s) => s.value === iv.status);

  return (
    <>
      <PageHeader
        title={`${iv.candidate?.full_name} · ${iv.job?.title}`}
        description={`${iv.round_label ?? "Interview"} · ${formatDateTime(iv.scheduled_at)}`}
        actions={
          <Button asChild variant="outline"><Link href="/interviews">← Back</Link></Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{iv.candidate?.full_name}</CardTitle>
            <div className="mt-1"><StatusBadge label={stat?.label ?? iv.status} color={stat?.color} /></div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Job" value={iv.job?.title} />
            <Row label="Client" value={iv.client?.name} />
            <Row label="Round" value={iv.round_label} />
            <Row label="Type" value={iv.interview_type} />
            <Row label="When" value={formatDateTime(iv.scheduled_at)} />
            <Row label="Interviewer" value={iv.interviewer_name} />
            <Row label="Email" value={iv.interviewer_email} />
            <Row label="Location" value={iv.location} />
            {iv.meeting_link && (
              <a href={iv.meeting_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                Open meeting link →
              </a>
            )}
            {iv.outcome && (
              <div>
                <p className="text-xs uppercase text-muted-foreground">Outcome</p>
                <p className="capitalize">{iv.outcome}</p>
              </div>
            )}
            {iv.feedback && (
              <div>
                <p className="text-xs uppercase text-muted-foreground">Feedback</p>
                <p className="whitespace-pre-wrap">{iv.feedback}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue={iv.status === "completed" ? "edit" : "feedback"}>
          <TabsList>
            <TabsTrigger value="feedback">Record feedback</TabsTrigger>
            <TabsTrigger value="edit">Edit</TabsTrigger>
          </TabsList>
          <TabsContent value="feedback">
            <InterviewFeedbackForm interviewId={id} current={iv} />
          </TabsContent>
          <TabsContent value="edit">
            <InterviewForm
              mode="edit"
              interview={iv}
              statuses={statuses}
              candidates={candidates}
              jobs={jobs}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-2">
      <span className="text-xs uppercase text-muted-foreground">{label}</span>
      <span className="text-right capitalize">{value}</span>
    </div>
  );
}
