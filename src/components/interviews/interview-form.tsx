"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createInterview, updateInterview } from "@/server/actions/interviews";
import type { Interview, SettingsListItem } from "@/lib/types";

interface Props {
  mode: "create" | "edit";
  interview?: Interview;
  statuses: SettingsListItem[];
  candidates: { id: string; full_name: string }[];
  jobs: { id: string; title: string; client?: { name: string } | null }[];
}

export function InterviewForm({ mode, interview, statuses, candidates, jobs }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        if (mode === "create") {
          await createInterview(fd);
          toast.success("Interview scheduled");
        } else if (interview) {
          await updateInterview(interview.id, fd);
          toast.success("Interview updated");
          router.refresh();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  const localScheduled = interview?.scheduled_at
    ? new Date(interview.scheduled_at).toISOString().slice(0, 16)
    : "";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
          <Field label="Candidate *">
            <Select name="candidate_id" defaultValue={interview?.candidate_id ?? ""} required>
              <SelectTrigger><SelectValue placeholder="Select candidate" /></SelectTrigger>
              <SelectContent>
                {candidates.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Job *">
            <Select name="job_id" defaultValue={interview?.job_id ?? ""} required>
              <SelectTrigger><SelectValue placeholder="Select job" /></SelectTrigger>
              <SelectContent>
                {jobs.map((j) => <SelectItem key={j.id} value={j.id}>{j.title} {j.client?.name ? `· ${j.client.name}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Round label">
            <Input name="round_label" defaultValue={interview?.round_label ?? ""} placeholder="Round 1, Final, etc." />
          </Field>
          <Field label="Type">
            <Select name="interview_type" defaultValue={interview?.interview_type ?? ""}>
              <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="phone">Phone</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="in_person">In-person</SelectItem>
                <SelectItem value="assignment">Assignment</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Scheduled at"><Input type="datetime-local" name="scheduled_at" defaultValue={localScheduled} /></Field>
          <Field label="Duration (min)"><Input type="number" name="duration_minutes" defaultValue={interview?.duration_minutes ?? 60} /></Field>
          <Field label="Interviewer name"><Input name="interviewer_name" defaultValue={interview?.interviewer_name ?? ""} /></Field>
          <Field label="Interviewer email"><Input type="email" name="interviewer_email" defaultValue={interview?.interviewer_email ?? ""} /></Field>
          <Field label="Meeting link" className="md:col-span-2"><Input name="meeting_link" defaultValue={interview?.meeting_link ?? ""} placeholder="https://meet…" /></Field>
          <Field label="Location"><Input name="location" defaultValue={interview?.location ?? ""} /></Field>
          <Field label="Status">
            <Select name="status" defaultValue={interview?.status ?? "scheduled"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {statuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : mode === "create" ? "Schedule" : "Save"}</Button>
      </div>
    </form>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
