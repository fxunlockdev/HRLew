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
import { createLead } from "@/server/actions/bd";
import type { SettingsListItem } from "@/lib/types";

interface Props {
  stages: SettingsListItem[];
  sources: SettingsListItem[];
  owners: { id: string; full_name: string | null }[];
}

export function BdLeadForm({ stages, sources, owners }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        await createLead(fd);
        toast.success("Lead created");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
          <Field label="Company name *"><Input name="company_name" required /></Field>
          <Field label="Contact name"><Input name="contact_name" /></Field>
          <Field label="Contact email"><Input type="email" name="contact_email" /></Field>
          <Field label="Contact phone"><Input name="contact_phone" /></Field>
          <Field label="LinkedIn URL"><Input name="linkedin_url" placeholder="https://" /></Field>
          <Field label="Industry"><Input name="industry" /></Field>
          <Field label="Source">
            <Select name="source"><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {sources.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Owner">
            <Select name="owner_id"><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {owners.map((o) => <SelectItem key={o.id} value={o.id}>{o.full_name ?? "—"}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Stage">
            <Select name="stage" defaultValue="new_lead"><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {stages.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Expected value"><Input type="number" name="expected_value" /></Field>
          <Field label="Next follow-up"><Input type="datetime-local" name="next_follow_up_at" /></Field>
          <Field label="Notes" className="md:col-span-2"><Textarea name="notes" rows={3} /></Field>
        </CardContent>
      </Card>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Create lead"}</Button>
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
