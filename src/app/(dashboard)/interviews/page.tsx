import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
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

export const metadata = { title: "Interviews · HRLew" };

export default async function InterviewsPage() {
  const { profile, permissions } = await requireAuth();
  const supabase = await getSupabaseServerClient();
  const [{ data: rows }, statuses] = await Promise.all([
    supabase
      .from("interviews")
      .select("id, scheduled_at, status, round_label, interview_type, interviewer_name, candidate:candidates(id, full_name), job:job_requirements(id, title), client:clients(id, name)")
      .order("scheduled_at", { ascending: false })
      .limit(200),
    getSettingsList("interview_status"),
  ]);

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
          {(rows ?? []).length === 0 ? (
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
          <InterviewCalendar rows={(rows ?? []) as any} statuses={statuses} />
        </TabsContent>
      </Tabs>
    </>
  );
}
