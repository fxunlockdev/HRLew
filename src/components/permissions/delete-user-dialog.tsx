"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deleteUser,
  getUserRecordCounts,
  type UserAdminState,
  type UserRecordCounts,
} from "@/server/actions/users";

interface ReassignTarget {
  id: string;
  full_name: string | null;
  email: string;
}

interface Props {
  profileId: string;
  email: string;
  fullName: string | null;
  reassignTargets: ReassignTarget[];
}

const LABELS: Record<string, [singular: string, plural: string]> = {
  clients: ["client", "clients"],
  candidates: ["candidate", "candidates"],
  jobs: ["job requirement", "job requirements"],
  pipeline: ["pipeline entry", "pipeline entries"],
  interviews: ["interview", "interviews"],
  placements: ["placement", "placements"],
  bd_leads: ["BD lead", "BD leads"],
  tasks: ["task", "tasks"],
};

function describe(key: string, n: number): string {
  const [singular, plural] = LABELS[key] ?? [key, key];
  return `${n} ${n === 1 ? singular : plural}`;
}

export function DeleteUserDialog({ profileId, email, fullName, reassignTargets }: Props) {
  const [open, setOpen] = useState(false);
  const [reassignTo, setReassignTo] = useState("");
  const [records, setRecords] = useState<UserRecordCounts | null>(null);
  const [loading, startLoading] = useTransition();
  const [state, formAction, pending] = useActionState<UserAdminState, FormData>(deleteUser, {});

  // Work out what the delete would move, only when the dialog is opened.
  useEffect(() => {
    if (!open || records) return;
    startLoading(async () => {
      try {
        setRecords(await getUserRecordCounts(profileId));
      } catch {
        setRecords({ total: 0, counts: {} });
      }
    });
  }, [open, records, profileId]);

  useEffect(() => {
    if (state.deleted) {
      toast.success(`${state.deleted.email} deleted`);
      setOpen(false);
    }
  }, [state.deleted]);

  const owned = records?.total ?? 0;
  const breakdown = Object.entries(records?.counts ?? {})
    .filter(([, n]) => Number(n) > 0)
    .map(([key, n]) => describe(key, Number(n)));
  // A Radix select cannot carry `required` usefully — the browser anchors the
  // validation bubble to a hidden control, so the form just silently refuses
  // to submit. Gate the button instead, and say why.
  const needsReassignment = owned > 0 && !reassignTo;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-red-700 hover:bg-red-50 hover:text-red-800"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form action={formAction}>
            <input type="hidden" name="profile_id" value={profileId} />
            <input type="hidden" name="reassign_to" value={reassignTo} />

            <DialogHeader>
              <DialogTitle>Delete {fullName ?? email}?</DialogTitle>
              <DialogDescription>
                This removes the account and signs them out everywhere. It cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {loading && !records ? (
                <p className="text-sm text-muted-foreground">Checking what they own…</p>
              ) : owned > 0 ? (
                <>
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                    <p className="text-sm font-medium text-amber-900">
                      They still own {owned} record{owned === 1 ? "" : "s"}
                    </p>
                    <p className="mt-1 text-xs text-amber-800">{breakdown.join(" · ")}</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={`reassign-${profileId}`}>Reassign their records to</Label>
                    <Select value={reassignTo} onValueChange={setReassignTo}>
                      <SelectTrigger id={`reassign-${profileId}`}>
                        <SelectValue placeholder="Choose a user" />
                      </SelectTrigger>
                      <SelectContent>
                        {reassignTargets.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.full_name ?? t.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground">
                      Notes, uploads and audit history stay where they are — they keep showing
                      that this person did the work, just without a live account behind it.
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  They do not own any records, so nothing needs reassigning.
                </p>
              )}

              {state.error && (
                <p
                  role="alert"
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  {state.error}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={pending || loading || needsReassignment}
                title={needsReassignment ? "Choose who inherits their records first" : undefined}
              >
                {pending ? "Deleting…" : "Delete user"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
