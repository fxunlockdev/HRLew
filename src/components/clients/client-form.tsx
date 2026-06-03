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
import { createClient, updateClient } from "@/server/actions/clients";
import { ClientLogoField } from "@/components/clients/client-logo-field";
import type { Client, SettingsListItem } from "@/lib/types";

interface Props {
  mode: "create" | "edit";
  client?: Client;
  statuses: SettingsListItem[];
  owners: { id: string; full_name: string | null }[];
  canEditCommercial?: boolean;
}

export function ClientForm({ mode, client, statuses, owners, canEditCommercial = true }: Props) {
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
          await createClient(fd);
          toast.success("Client created");
        } else if (client) {
          await updateClient(client.id, fd);
          toast.success("Client updated");
          router.refresh();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
          <Field label="Company name *"><Input name="name" defaultValue={client?.name ?? ""} required /></Field>
          <Field label="Website"><Input name="website" defaultValue={client?.website ?? ""} placeholder="https://" /></Field>
          <Field label="Brand assets" className="md:col-span-2">
            <ClientLogoField
              companyName={client?.name ?? ""}
              initialUrl={client?.logo_url}
              initialFileName={client?.logo_file_name}
            />
          </Field>
          <Field label="Industry"><Input name="industry" defaultValue={client?.industry ?? ""} /></Field>
          <Field label="Company size"><Input name="company_size" defaultValue={client?.company_size ?? ""} /></Field>
          <Field label="Location"><Input name="location" defaultValue={client?.location ?? ""} /></Field>
          <Field label="Status">
            <Select name="status" defaultValue={client?.status ?? "prospect"}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                {statuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Account owner">
            <Select name="account_owner_id" defaultValue={client?.account_owner_id ?? ""}>
              <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
              <SelectContent>
                {owners.map((o) => <SelectItem key={o.id} value={o.id}>{o.full_name ?? "—"}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          {canEditCommercial && (
            <>
              <Field label="Contract type"><Input name="contract_type" defaultValue={client?.contract_type ?? ""} placeholder="Contingent / Retained" /></Field>
              <Field label="Replacement period (days)"><Input type="number" name="replacement_period_days" defaultValue={client?.replacement_period_days ?? ""} /></Field>
              <Field label="Payment terms (days)"><Input type="number" name="payment_terms_days" defaultValue={client?.payment_terms_days ?? ""} /></Field>
              <Field label="Commercial terms" className="md:col-span-2">
                <Textarea name="commercial_terms" defaultValue={client?.commercial_terms ?? ""} rows={3} />
              </Field>
            </>
          )}
          <Field label="Notes" className="md:col-span-2">
            <Textarea name="notes" defaultValue={client?.notes ?? ""} rows={3} />
          </Field>
        </CardContent>
      </Card>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Create client" : "Save changes"}
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
