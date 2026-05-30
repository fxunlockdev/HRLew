"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { addBdActivity } from "@/server/actions/bd";
import { toast } from "sonner";
import { relativeTime } from "@/lib/utils";

interface Activity {
  id: string;
  activity_type: string;
  subject: string | null;
  body: string | null;
  occurred_at: string;
  author: { full_name: string | null } | null;
}

export function BdActivityFeed({ leadId, activities }: { leadId: string; activities: Activity[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("lead_id", leadId);
    startTransition(async () => {
      try {
        await addBdActivity(fd);
        toast.success("Activity logged");
        (e.target as HTMLFormElement).reset();
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-base">Activity</CardTitle>
          <Button size="sm" onClick={() => setOpen((v) => !v)}>{open ? "Cancel" : "Log activity"}</Button>
        </CardHeader>
        {open && (
          <CardContent className="space-y-2">
            <form onSubmit={onSubmit} className="grid grid-cols-2 gap-2">
              <Select name="activity_type" defaultValue="note">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="proposal_sent">Proposal sent</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Input name="subject" placeholder="Subject (optional)" />
              <Textarea name="body" placeholder="Details…" className="col-span-2" rows={3} />
              <div className="col-span-2 flex justify-end">
                <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Log activity"}</Button>
              </div>
            </form>
          </CardContent>
        )}
      </Card>

      <ul className="space-y-2">
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground px-2">No activity yet.</p>
        ) : (
          activities.map((a) => (
            <li key={a.id} className="rounded-md border bg-white p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span><span className="font-medium text-foreground capitalize">{a.activity_type.replace("_", " ")}</span> · {a.author?.full_name}</span>
                <span>{relativeTime(a.occurred_at)}</span>
              </div>
              {a.subject && <p className="mt-1 text-sm font-medium">{a.subject}</p>}
              {a.body && <p className="mt-1 text-sm whitespace-pre-wrap">{a.body}</p>}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
