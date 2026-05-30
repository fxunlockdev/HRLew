"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { createCandidate, updateCandidate } from "@/server/actions/candidates";
import type { Candidate, SettingsListItem } from "@/lib/types";

interface Props {
  mode: "create" | "edit";
  candidate?: Candidate;
  statuses: SettingsListItem[];
  sources: SettingsListItem[];
  recruiters: { id: string; full_name: string | null }[];
}

export function CandidateForm({ mode, candidate, statuses, sources, recruiters }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        if (mode === "create") {
          await createCandidate(fd);
          toast.success("Candidate created");
        } else if (candidate) {
          await updateCandidate(candidate.id, fd);
          toast.success("Candidate updated");
          router.refresh();
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to save";
        setError(msg);
        toast.error(msg);
      }
    });
  }

  const c = candidate;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
          <Field label="Full name *">
            <Input name="full_name" defaultValue={c?.full_name ?? ""} required />
          </Field>
          <Field label="Email">
            <Input type="email" name="email" defaultValue={c?.email ?? ""} />
          </Field>
          <Field label="Phone">
            <Input name="phone" defaultValue={c?.phone ?? ""} />
          </Field>
          <Field label="Current company">
            <Input name="current_company" defaultValue={c?.current_company ?? ""} />
          </Field>
          <Field label="Current designation">
            <Input name="current_designation" defaultValue={c?.current_designation ?? ""} />
          </Field>
          <Field label="Current location">
            <Input name="current_location" defaultValue={c?.current_location ?? ""} />
          </Field>
          <Field label="Preferred location">
            <Input name="preferred_location" defaultValue={c?.preferred_location ?? ""} />
          </Field>
          <Field label="Total experience (yrs)">
            <Input type="number" step="0.1" name="total_experience_years" defaultValue={c?.total_experience_years ?? ""} />
          </Field>
          <Field label="Relevant experience (yrs)">
            <Input type="number" step="0.1" name="relevant_experience_years" defaultValue={c?.relevant_experience_years ?? ""} />
          </Field>
          <Field label="Current CTC">
            <Input type="number" name="current_ctc" defaultValue={c?.current_ctc ?? ""} />
          </Field>
          <Field label="Expected CTC">
            <Input type="number" name="expected_ctc" defaultValue={c?.expected_ctc ?? ""} />
          </Field>
          <Field label="Notice period (days)">
            <Input type="number" name="notice_period_days" defaultValue={c?.notice_period_days ?? ""} />
          </Field>
          <Field label="Last working day">
            <Input type="date" name="last_working_day" defaultValue={c?.last_working_day ?? ""} />
          </Field>
          <Field label="Source">
            <Select name="source" defaultValue={c?.source ?? ""}>
              <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
              <SelectContent>
                {sources.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={c?.status ?? "new"}>
              <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
              <SelectContent>
                {statuses.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Assigned recruiter">
            <Select name="assigned_recruiter_id" defaultValue={c?.assigned_recruiter_id ?? ""}>
              <SelectTrigger><SelectValue placeholder="Select recruiter" /></SelectTrigger>
              <SelectContent>
                {recruiters.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.full_name ?? "—"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="LinkedIn URL" className="md:col-span-2">
            <Input name="linkedin_url" defaultValue={c?.linkedin_url ?? ""} placeholder="https://linkedin.com/in/…" />
          </Field>
          <Field label="Portfolio URL" className="md:col-span-2">
            <Input name="portfolio_url" defaultValue={c?.portfolio_url ?? ""} />
          </Field>
          <Field label="Skills (comma-separated)" className="md:col-span-2">
            <Input name="skills" defaultValue={c?.skills?.join(", ") ?? ""} placeholder="React, Node.js, PostgreSQL" />
          </Field>
          <Field label="Notes" className="md:col-span-2">
            <Textarea name="notes" rows={3} defaultValue={c?.notes ?? ""} />
          </Field>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Create candidate" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
