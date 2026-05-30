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
import { createStaff, updateStaff } from "@/server/actions/staff";
import type { StaffMember } from "@/lib/types";

interface Props {
  mode: "create" | "edit";
  staff?: StaffMember;
  managers: { id: string; full_name: string }[];
  profiles: { id: string; full_name: string | null }[];
  canEditSalary: boolean;
}

// Radix Select cannot use an empty string as an item value, so we use a
// sentinel for the "none" option and strip it out on the server.
const NONE = "__none__";

export function StaffForm({ mode, staff, managers, profiles, canEditSalary }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        if (mode === "create") await createStaff(fd);
        else if (staff) {
          await updateStaff(staff.id, fd);
          toast.success("Saved");
          router.refresh();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  const s = staff;
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
          <Field label="Full name *"><Input name="full_name" defaultValue={s?.full_name ?? ""} required /></Field>
          <Field label="Email"><Input type="email" name="email" defaultValue={s?.email ?? ""} /></Field>
          <Field label="Phone"><Input name="phone" defaultValue={s?.phone ?? ""} /></Field>
          <Field label="Designation"><Input name="designation" defaultValue={s?.designation ?? ""} /></Field>
          <Field label="Department"><Input name="department" defaultValue={s?.department ?? ""} /></Field>
          <Field label="Joining date"><Input type="date" name="joining_date" defaultValue={s?.joining_date ?? ""} /></Field>
          <Field label="Manager">
            <Select name="manager_id" defaultValue={s?.manager_id ?? NONE}>
              <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No manager</SelectItem>
                {managers
                  .filter((m) => m.id !== staff?.id)
                  .map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Linked profile (login)">
            <Select name="profile_id" defaultValue={s?.profile_id ?? NONE}>
              <SelectTrigger><SelectValue placeholder="Link an active profile" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No linked profile</SelectItem>
                {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? "—"}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Employment status">
            <Select name="employment_status" defaultValue={s?.employment_status ?? "active"}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="on_notice">On notice</SelectItem>
                <SelectItem value="ex_employee">Ex-employee</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {canEditSalary && (
            <>
              <Field label="Salary"><Input type="number" name="salary" defaultValue={s?.salary ?? ""} /></Field>
              <Field label="Incentive structure" className="md:col-span-2">
                <Textarea name="incentive_structure" defaultValue={s?.incentive_structure ?? ""} rows={2} />
              </Field>
            </>
          )}
          <Field label="Notes" className="md:col-span-2"><Textarea name="notes" defaultValue={s?.notes ?? ""} rows={3} /></Field>
        </CardContent>
      </Card>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : mode === "create" ? "Add staff" : "Save"}</Button>
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
