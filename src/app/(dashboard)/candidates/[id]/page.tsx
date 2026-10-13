import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { withProfile } from "@/lib/db";
import { jsonObjectFrom } from "kysely/helpers/postgres";
import { getSettingsList } from "@/lib/settings";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CandidateForm } from "@/components/candidates/candidate-form";
import { CandidateNotes } from "@/components/candidates/candidate-notes";
import { CandidatePipelineList } from "@/components/candidates/candidate-pipeline-list";
import { CandidateResume } from "@/components/candidates/candidate-resume";
import { CandidateActivity } from "@/components/candidates/candidate-activity";
import { hasPermission } from "@/lib/rbac";
import { formatCurrency, formatDate, initials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mail, Phone, MapPin, Briefcase, Calendar, Linkedin, ExternalLink } from "lucide-react";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CandidateDetailPage({ params }: Props) {
  const { id } = await params;
  const { profile, permissions } = await requireAuth();

  const data = await withProfile(profile.id, async (trx) => {
    const candidate = await trx
      .selectFrom("candidates")
      .selectAll("candidates")
      .select((eb) => [
        jsonObjectFrom(
          eb
            .selectFrom("profiles")
            .select(["profiles.id", "profiles.full_name"])
            .whereRef("profiles.id", "=", "candidates.assigned_recruiter_id"),
        ).as("recruiter"),
      ])
      .where("candidates.id", "=", id)
      .executeTakeFirst();

    if (!candidate) return null;

    return {
      candidate,
      statuses: await getSettingsList(trx, "candidate_status"),
      sources: await getSettingsList(trx, "candidate_source"),
      recruiters: await trx
        .selectFrom("profiles")
        .select(["id", "full_name"])
        .where("status", "=", "active")
        .orderBy("full_name", "asc")
        .execute(),
      notes: await trx
        .selectFrom("candidate_notes")
        .select((eb) => [
          "candidate_notes.id",
          "candidate_notes.body",
          "candidate_notes.created_at",
          jsonObjectFrom(
            eb
              .selectFrom("profiles")
              .select("profiles.full_name")
              .whereRef("profiles.id", "=", "candidate_notes.author_id"),
          ).as("author"),
        ])
        .where("candidate_id", "=", id)
        .orderBy("created_at", "desc")
        .execute(),
      pipeline: await trx
        .selectFrom("candidate_job_pipeline")
        .select((eb) => [
          "candidate_job_pipeline.id",
          "candidate_job_pipeline.current_stage",
          "candidate_job_pipeline.submitted_at",
          "candidate_job_pipeline.last_activity_at",
          "candidate_job_pipeline.offer_amount",
          jsonObjectFrom(
            eb
              .selectFrom("job_requirements")
              .select(["job_requirements.id", "job_requirements.title"])
              .whereRef("job_requirements.id", "=", "candidate_job_pipeline.job_id"),
          ).as("job"),
          jsonObjectFrom(
            eb
              .selectFrom("clients")
              .select("clients.name")
              .whereRef("clients.id", "=", "candidate_job_pipeline.client_id"),
          ).as("client"),
        ])
        .where("candidate_id", "=", id)
        .orderBy("last_activity_at", "desc")
        .execute(),
      docs: await trx
        .selectFrom("candidate_documents")
        .select([
          "id",
          "file_name",
          "storage_path",
          "mime_type",
          "size_bytes",
          "category",
          "created_at",
        ])
        .where("candidate_id", "=", id)
        .orderBy("created_at", "desc")
        .execute(),
      activity: await trx
        .selectFrom("activity_logs")
        .select((eb) => [
          "activity_logs.id",
          "activity_logs.action",
          "activity_logs.created_at",
          jsonObjectFrom(
            eb
              .selectFrom("profiles")
              .select("profiles.full_name")
              .whereRef("profiles.id", "=", "activity_logs.actor_id"),
          ).as("actor"),
        ])
        .where("entity_type", "=", "candidates")
        .where("entity_id", "=", id)
        .orderBy("created_at", "desc")
        .limit(20)
        .execute(),
    };
  });

  if (!data) notFound();
  const { candidate, statuses, sources, recruiters, notes, pipeline, docs, activity } = data;

  const status = statuses.find((s) => s.value === candidate.status);
  const canViewCtc = hasPermission(profile, permissions, "candidates", "view_sensitive");
  const canEdit = hasPermission(profile, permissions, "candidates", "edit");

  return (
    <>
      <PageHeader
        title={candidate.full_name}
        description={candidate.display_id + (candidate.current_designation ? ` · ${candidate.current_designation}` : "")}
        actions={
          <Button asChild variant="outline">
            <Link href="/candidates">← Back to list</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <Avatar className="h-12 w-12">
              <AvatarFallback>{initials(candidate.full_name)}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-base">{candidate.full_name}</CardTitle>
              <div className="mt-1">
                <StatusBadge label={status?.label ?? candidate.status} color={status?.color ?? "slate"} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <KeyVal icon={<Mail className="h-3.5 w-3.5" />} value={candidate.email} />
            <KeyVal icon={<Phone className="h-3.5 w-3.5" />} value={candidate.phone} />
            <KeyVal icon={<MapPin className="h-3.5 w-3.5" />} value={candidate.current_location} />
            <KeyVal icon={<Briefcase className="h-3.5 w-3.5" />} value={candidate.current_company} />
            <KeyVal icon={<Calendar className="h-3.5 w-3.5" />} value={`${candidate.total_experience_years ?? "—"} yrs experience`} />
            {canViewCtc && (
              <>
                <KeyVal label="Current CTC" value={formatCurrency(candidate.current_ctc)} />
                <KeyVal label="Expected CTC" value={formatCurrency(candidate.expected_ctc)} />
              </>
            )}
            <KeyVal label="Notice" value={candidate.notice_period_days ? `${candidate.notice_period_days} days` : null} />
            <KeyVal label="Source" value={candidate.source} />
            <KeyVal label="Recruiter" value={candidate.recruiter?.full_name ?? null} />
            <KeyVal label="Added" value={formatDate(candidate.created_at)} />

            {candidate.skills.length > 0 && (
              <div>
                <p className="text-xs uppercase text-muted-foreground mb-1.5">Skills</p>
                <div className="flex flex-wrap gap-1">
                  {candidate.skills.map((s: string) => (
                    <span key={s} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {candidate.linkedin_url && (
              <a
                href={candidate.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs"
              >
                <Linkedin className="h-3 w-3" /> LinkedIn <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Tabs defaultValue="pipeline">
            <TabsList>
              <TabsTrigger value="pipeline">Pipeline ({pipeline.length})</TabsTrigger>
              <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
              <TabsTrigger value="resume">Resume</TabsTrigger>
              <TabsTrigger value="edit" disabled={!canEdit}>Edit</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="pipeline">
              <CandidatePipelineList rows={pipeline} />
            </TabsContent>

            <TabsContent value="notes">
              <CandidateNotes candidateId={candidate.id} notes={notes} />
            </TabsContent>

            <TabsContent value="resume">
              <CandidateResume candidate={candidate} documents={docs} />
            </TabsContent>

            <TabsContent value="edit">
              {canEdit && (
                <CandidateForm
                  mode="edit"
                  candidate={candidate}
                  statuses={statuses}
                  sources={sources}
                  recruiters={recruiters}
                />
              )}
            </TabsContent>

            <TabsContent value="activity">
              <CandidateActivity rows={activity} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}

function KeyVal({ icon, label, value }: { icon?: React.ReactNode; label?: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      {icon && <span className="text-muted-foreground pt-0.5">{icon}</span>}
      {label && <span className="text-xs uppercase text-muted-foreground min-w-24">{label}</span>}
      <span className="text-sm">{value}</span>
    </div>
  );
}
