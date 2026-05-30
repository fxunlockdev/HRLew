"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createJob, updateJob } from "@/server/actions/jobs";
import type { JobRequirement, SettingsListItem } from "@/lib/types";

interface Props {
  mode: "create" | "edit";
  job?: JobRequirement;
  statuses: SettingsListItem[];
  clients: { id: string; name: string }[];
  defaultClient?: string;
  canEditSalary: boolean;
}

export function JobForm({ mode, job, statuses, clients, defaultClient, canEditSalary }: Props) {
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
          await createJob(fd);
          toast.success("Requirement created");
        } else if (job) {
          await updateJob(job.id, fd);
          toast.success("Requirement updated");
          router.refresh();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
          <Field label="Title *"><Input name="title" defaultValue={job?.title ?? ""} required /></Field>
          <Field label="Client *">
            <Select name="client_id" defaultValue={job?.client_id ?? defaultClient ?? ""} required>
              <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Department"><Input name="department" defaultValue={job?.department ?? ""} /></Field>
          <Field label="Location"><Input name="location" defaultValue={job?.location ?? ""} /></Field>
          <Field label="Work mode">
            <Select name="work_mode" defaultValue={job?.work_mode ?? ""}>
              <SelectTrigger><SelectValue placeholder="Onsite / Hybrid / Remote" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="onsite">Onsite</SelectItem>
                <SelectItem value="hybrid">Hybrid</SelectItem>
                <SelectItem value="remote">Remote</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Employment type">
            <Select name="employment_type" defaultValue={job?.employment_type ?? ""}>
              <SelectTrigger><SelectValue placeholder="Full-time / Contract / Part-time" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full_time">Full-time</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="part_time">Part-time</SelectItem>
                <SelectItem value="internship">Internship</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Openings"><Input type="number" name="openings" defaultValue={job?.openings ?? 1} /></Field>
          <Field label="Priority">
            <Select name="priority" defaultValue={job?.priority ?? "normal"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Min experience (yrs)"><Input type="number" step="0.1" name="min_experience_years" defaultValue={job?.min_experience_years ?? ""} /></Field>
          <Field label="Max experience (yrs)"><Input type="number" step="0.1" name="max_experience_years" defaultValue={job?.max_experience_years ?? ""} /></Field>
          {canEditSalary && (
            <>
              <Field label="Min salary"><Input type="number" name="min_salary" defaultValue={job?.min_salary ?? ""} /></Field>
              <Field label="Max salary"><Input type="number" name="max_salary" defaultValue={job?.max_salary ?? ""} /></Field>
            </>
          )}
          <Field label="Status">
            <Select name="status" defaultValue={job?.status ?? "open"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {statuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Target closure date"><Input type="date" name="target_closure_date" defaultValue={job?.target_closure_date ?? ""} /></Field>
          <Field label="Required skills (comma-separated)" className="md:col-span-2">
            <Input name="required_skills" defaultValue={job?.required_skills?.join(", ") ?? ""} />
          </Field>
          <Field label="Good-to-have skills (comma-separated)" className="md:col-span-2">
            <Input name="good_to_have_skills" defaultValue={job?.good_to_have_skills?.join(", ") ?? ""} />
          </Field>
          <Field label="Description" className="md:col-span-2">
            <Textarea name="description" rows={6} defaultValue={job?.description ?? ""} />
          </Field>
        </CardContent>
      </Card>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Create requirement" : "Save changes"}
        </Button>
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
