import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { getSupabaseServerClient } from "@/lib/supabase/server";
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
  await requireAuth();
  const supabase = await getSupabaseServerClient();
  const { data: iv } = await supabase
    .from("interviews")
    .select("*, candidate:candidates(id, full_name, email), job:job_requirements(id, title), client:clients(name)")
    .eq("id", id)
    .maybeSingle();
  if (!iv) notFound();

  const [statuses, { data: candidates }, { data: jobs }] = await Promise.all([
    getSettingsList("interview_status"),
    supabase.from("candidates").select("id, full_name").order("full_name").limit(500),
    supabase.from("job_requirements").select("id, title, client:clients(name)").order("title").limit(500),
  ]);
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
            <InterviewFeedbackForm interviewId={id} current={iv as any} />
          </TabsContent>
          <TabsContent value="edit">
            <InterviewForm
              mode="edit"
              interview={iv as any}
              statuses={statuses}
              candidates={candidates ?? []}
              jobs={(jobs ?? []) as any}
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
