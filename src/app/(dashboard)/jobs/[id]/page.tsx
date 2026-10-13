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
import { JobForm } from "@/components/jobs/job-form";
import { JobFunnelView } from "@/components/jobs/job-funnel-view";
import { JobPipelineList } from "@/components/jobs/job-pipeline-list";
import { SubmitCandidatePanel } from "@/components/jobs/submit-candidate-panel";
import { CompanyLogo } from "@/components/ui/company-logo";
import { formatCurrency, formatDate } from "@/lib/utils";
import { hasPermission } from "@/lib/rbac";

export default async function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile, permissions } = await requireAuth();
  const data = await withProfile(profile.id, async (trx) => {
    const job = await trx
      .selectFrom("job_requirements")
      .selectAll("job_requirements")
      .select((eb) => [
        jsonObjectFrom(
          eb
            .selectFrom("clients")
            .select(["clients.id", "clients.name", "clients.logo_url"])
            .whereRef("clients.id", "=", "job_requirements.client_id"),
        ).as("client"),
      ])
      .where("job_requirements.id", "=", id)
      .executeTakeFirst();
    if (!job) return null;

    return {
      job,
      statuses: await getSettingsList(trx, "job_status"),
      pipelineStages: await getSettingsList(trx, "pipeline_stage"),
      clients: await trx.selectFrom("clients").select(["id", "name"]).orderBy("name", "asc").execute(),
      pipeline: await trx
        .selectFrom("candidate_job_pipeline")
        .select((eb) => [
          "candidate_job_pipeline.id",
          "candidate_job_pipeline.current_stage",
          "candidate_job_pipeline.last_activity_at",
          "candidate_job_pipeline.submitted_at",
          jsonObjectFrom(
            eb
              .selectFrom("candidates")
              .select([
                "candidates.id",
                "candidates.full_name",
                "candidates.email",
                "candidates.expected_ctc",
                "candidates.total_experience_years",
              ])
              .whereRef("candidates.id", "=", "candidate_job_pipeline.candidate_id"),
          ).as("candidate"),
        ])
        .where("job_id", "=", id)
        .orderBy("last_activity_at", "desc")
        .execute(),
      interviews: await trx
        .selectFrom("interviews")
        .select((eb) => [
          "interviews.id",
          "interviews.scheduled_at",
          "interviews.status",
          jsonObjectFrom(
            eb
              .selectFrom("candidates")
              .select("candidates.full_name")
              .whereRef("candidates.id", "=", "interviews.candidate_id"),
          ).as("candidate"),
        ])
        .where("job_id", "=", id)
        .orderBy("scheduled_at", "desc")
        .limit(20)
        .execute(),
    };
  });

  if (!data) notFound();
  const { job, statuses, pipelineStages, clients, pipeline, interviews } = data;

  const stat = statuses.find((s) => s.value === job.status);
  const canViewSalary = hasPermission(profile, permissions, "jobs", "view_salary") || profile.role?.name === "admin" || profile.role?.name === "manager";
  const canEditSalary = hasPermission(profile, permissions, "jobs", "edit_salary") || profile.role?.name === "admin";

  return (
    <>
      <PageHeader
        title={job.title}
        description={`${job.display_id} · ${job.client?.name}`}
        actions={
          <Button asChild variant="outline">
            <Link href="/jobs">← Back</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              <CompanyLogo name={job.client?.name ?? "Client"} logoUrl={job.client?.logo_url} className="h-14 w-14" />
              <div>
                <CardTitle className="text-base">{job.title}</CardTitle>
                <div className="mt-1">
                  <StatusBadge label={stat?.label ?? job.status} color={stat?.color} />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Client" value={job.client?.name} />
            <Row label="Location" value={job.location} />
            <Row label="Work mode" value={job.work_mode} />
            <Row label="Type" value={job.employment_type} />
            <Row label="Openings" value={String(job.openings)} />
            <Row label="Experience" value={`${job.min_experience_years ?? "—"} – ${job.max_experience_years ?? "—"} yrs`} />
            {canViewSalary && (
              <Row
                label="Salary band"
                value={job.min_salary || job.max_salary ? `${formatCurrency(job.min_salary ?? 0)} – ${formatCurrency(job.max_salary ?? 0)}` : null}
              />
            )}
            <Row label="Priority" value={job.priority} />
            <Row label="Target closure" value={formatDate(job.target_closure_date)} />
            <Row label="Created" value={formatDate(job.created_at)} />

            {job.required_skills.length > 0 && (
              <div>
                <p className="text-xs uppercase text-muted-foreground mb-1.5">Required skills</p>
                <div className="flex flex-wrap gap-1">
                  {job.required_skills.map((s: string) => (
                    <span key={s} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {job.description && (
              <div>
                <p className="text-xs uppercase text-muted-foreground mb-1.5">Description</p>
                <p className="text-sm whitespace-pre-wrap">{job.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="pipeline">
          <TabsList>
            <TabsTrigger value="pipeline">Pipeline ({pipeline?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="funnel">Funnel</TabsTrigger>
            <TabsTrigger value="submit">Submit candidate</TabsTrigger>
            <TabsTrigger value="interviews">Interviews ({interviews?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="edit">Edit</TabsTrigger>
          </TabsList>

          <TabsContent value="pipeline">
            <JobPipelineList rows={pipeline} canViewCtc={canViewSalary} />
          </TabsContent>

          <TabsContent value="funnel">
            <JobFunnelView
              rows={pipeline}
              stages={pipelineStages}
              clientName={job.client?.name ?? "Client"}
              clientLogoUrl={job.client?.logo_url}
            />
          </TabsContent>

          <TabsContent value="submit">
            <SubmitCandidatePanel jobId={id} />
          </TabsContent>

          <TabsContent value="interviews">
            <ul className="space-y-2">
              {(interviews ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No interviews yet.</p>
              ) : (
                interviews.map((iv) => (
                  <li key={iv.id} className="flex items-center justify-between rounded-md border bg-white p-3 text-sm">
                    <span>{iv.candidate?.full_name}</span>
                    <span className="text-xs text-muted-foreground">{formatDate(iv.scheduled_at)} · {iv.status}</span>
                  </li>
                ))
              )}
            </ul>
          </TabsContent>

          <TabsContent value="edit">
            <JobForm
              mode="edit"
              job={job}
              statuses={statuses}
              clients={clients ?? []}
              canEditSalary={canEditSalary}
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
      <span className="text-right text-sm capitalize">{value}</span>
    </div>
  );
}
