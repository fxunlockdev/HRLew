import Link from "next/link";
import { withProfile } from "@/lib/db";
import { jsonObjectFrom } from "kysely/helpers/postgres";
import { requireAuth } from "@/lib/auth";
import { getSettingsList } from "@/lib/settings";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { hasPermission } from "@/lib/rbac";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { InterviewCalendar } from "@/components/interviews/interview-calendar";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "Interviews · HR OS" };

export default async function InterviewsPage() {
  const { profile, permissions } = await requireAuth();
  const { rows, statuses } = await withProfile(profile.id, async (trx) => ({
    rows: await trx
      .selectFrom("interviews")
      .select((eb) => [
        "interviews.id",
        "interviews.scheduled_at",
        "interviews.status",
        "interviews.round_label",
        "interviews.interview_type",
        "interviews.interviewer_name",
        jsonObjectFrom(
          eb
            .selectFrom("candidates")
            .select(["candidates.id", "candidates.full_name"])
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
            .select(["clients.id", "clients.name"])
            .whereRef("clients.id", "=", "interviews.client_id"),
        ).as("client"),
      ])
      .orderBy("scheduled_at", "desc")
      .limit(200)
      .execute(),
    statuses: await getSettingsList(trx, "interview_status"),
  }));

  return (
    <>
      <PageHeader
        title="Interviews"
        description="Schedule, track and capture feedback for every interview."
        actions={
          hasPermission(profile, permissions, "interviews", "create") && (
            <Button asChild>
              <Link href="/interviews/new"><Plus className="h-4 w-4" /> Schedule interview</Link>
            </Button>
          )
        }
      />

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>
        <TabsContent value="list">
          {rows.length === 0 ? (
            <EmptyState title="No interviews scheduled" />
          ) : (
            <div className="rounded-lg border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Candidate</TableHead>
                    <TableHead>Job / Client</TableHead>
                    <TableHead>Round</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Interviewer</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows!.map((r: any) => {
                    const stat = statuses.find((s) => s.value === r.status);
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <Link href={`/interviews/${r.id}`} className="text-sm font-medium hover:underline">
                            {formatDateTime(r.scheduled_at)}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Link href={`/candidates/${r.candidate?.id}`} className="hover:underline">{r.candidate?.full_name}</Link>
                        </TableCell>
                        <TableCell>
                          <Link href={`/jobs/${r.job?.id}`} className="text-sm hover:underline">{r.job?.title}</Link>
                          <p className="text-xs text-muted-foreground">{r.client?.name}</p>
                        </TableCell>
                        <TableCell>{r.round_label ?? "—"}</TableCell>
                        <TableCell className="capitalize">{r.interview_type?.replace("_", " ") ?? "—"}</TableCell>
                        <TableCell>{r.interviewer_name ?? "—"}</TableCell>
                        <TableCell><StatusBadge label={stat?.label ?? r.status} color={stat?.color} /></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
        <TabsContent value="calendar">
          <InterviewCalendar rows={rows} statuses={statuses} />
        </TabsContent>
      </Tabs>
    </>
  );
}
