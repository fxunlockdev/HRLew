"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addClientNote } from "@/server/actions/clients";
import { toast } from "sonner";
import { relativeTime } from "@/lib/utils";

interface Note {
  id: string;
  body: string;
  created_at: string;
  author: { full_name: string | null } | null;
}

export function ClientNotes({ clientId, notes }: { clientId: string; notes: Note[] }) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!body.trim()) return;
    startTransition(async () => {
      try {
        await addClientNote(clientId, body.trim());
        setBody("");
        toast.success("Note posted");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4 space-y-2">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Add a client note…" />
          <div className="flex justify-end">
            <Button onClick={submit} disabled={pending || !body.trim()}>Post note</Button>
          </div>
        </CardContent>
      </Card>
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-md border bg-white p-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{n.author?.full_name ?? "Unknown"}</span>
                <span>{relativeTime(n.created_at)}</span>
              </div>
              <p className="mt-1 text-sm whitespace-pre-wrap">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
