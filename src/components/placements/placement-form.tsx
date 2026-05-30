"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createPlacement, updatePlacement } from "@/server/actions/placements";
import type { Placement, SettingsListItem } from "@/lib/types";

interface Props {
  mode: "create" | "edit";
  placement?: Placement;
  statuses: SettingsListItem[];
  candidates: { id: string; full_name: string }[];
  clients: { id: string; name: string }[];
  jobs: { id: string; title: string }[];
  recruiters: { id: string; full_name: string | null }[];
  canEditFinancial: boolean;
}

export function PlacementForm({
  mode,
  placement,
  statuses,
  candidates,
  clients,
  jobs,
  recruiters,
  canEditFinancial,
}: Props) {
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
          await createPlacement(fd);
          toast.success("Placement created");
        } else if (placement) {
          await updatePlacement(placement.id, fd);
          toast.success("Placement updated");
          router.refresh();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  const p = placement;
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Identity</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Candidate *">
            <Select name="candidate_id" defaultValue={p?.candidate_id ?? ""} required>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {candidates.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Client *">
            <Select name="client_id" defaultValue={p?.client_id ?? ""} required>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Job *">
            <Select name="job_id" defaultValue={p?.job_id ?? ""} required>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {jobs.map((j) => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Recruiter">
            <Select name="recruiter_id" defaultValue={p?.recruiter_id ?? ""}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {recruiters.map((r) => <SelectItem key={r.id} value={r.id}>{r.full_name ?? "—"}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Offered designation"><Input name="offered_designation" defaultValue={p?.offered_designation ?? ""} /></Field>
          <Field label="Joining date"><Input type="date" name="joining_date" defaultValue={p?.joining_date ?? ""} /></Field>
          <Field label="Status">
            <Select name="status" defaultValue={p?.status ?? "offer_accepted"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {statuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Joining status">
            <Select name="joining_status" defaultValue={p?.joining_status ?? ""}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="joined">Joined</SelectItem>
                <SelectItem value="backed_out_before">Backed out before joining</SelectItem>
                <SelectItem value="backed_out_after">Backed out after joining</SelectItem>
                <SelectItem value="replacement_required">Replacement required</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Replacement period (days)"><Input type="number" name="replacement_period_days" defaultValue={p?.replacement_period_days ?? ""} /></Field>
          <Field label="Replacement ends on"><Input type="date" name="replacement_end_date" defaultValue={p?.replacement_end_date ?? ""} /></Field>
        </CardContent>
      </Card>

      {canEditFinancial && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Commercials</CardTitle>
            <p className="text-xs text-muted-foreground">Admin-only. RLS prevents non-admins from changing these fields.</p>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Offered CTC"><Input type="number" name="offered_ctc" defaultValue={p?.offered_ctc ?? ""} /></Field>
            <Field label="Billing %"><Input type="number" step="0.1" name="billing_percentage" defaultValue={p?.billing_percentage ?? ""} /></Field>
            <Field label="Placement revenue"><Input type="number" name="placement_revenue" defaultValue={p?.placement_revenue ?? ""} /></Field>
            <Field label="Invoice status">
              <Select name="invoice_status" defaultValue={p?.invoice_status ?? "not_raised"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_raised">Not raised</SelectItem>
                  <SelectItem value="raised">Raised</SelectItem>
                  <SelectItem value="partially_paid">Partially paid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Payment status">
              <Select name="payment_status" defaultValue={p?.payment_status ?? "pending"}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="written_off">Written off</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Invoice number"><Input name="invoice_number" defaultValue={p?.invoice_number ?? ""} /></Field>
            <Field label="Invoice date"><Input type="date" name="invoice_date" defaultValue={p?.invoice_date ?? ""} /></Field>
            <Field label="Invoice amount"><Input type="number" name="invoice_amount" defaultValue={p?.invoice_amount ?? ""} /></Field>
            <Field label="Payment received on"><Input type="date" name="payment_received_date" defaultValue={p?.payment_received_date ?? ""} /></Field>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <Field label="Notes"><Textarea name="notes" rows={3} defaultValue={p?.notes ?? ""} /></Field>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : mode === "create" ? "Create placement" : "Save changes"}</Button>
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
