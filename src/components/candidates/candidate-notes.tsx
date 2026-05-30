"use client";

import { useTransition, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addCandidateNote } from "@/server/actions/candidates";
import { relativeTime } from "@/lib/utils";
import { toast } from "sonner";

interface Note {
  id: string;
  body: string;
  created_at: string;
  author: { full_name: string | null } | null;
}

export function CandidateNotes({ candidateId, notes }: { candidateId: string; notes: Note[] }) {
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");

  function submit() {
    if (!body.trim()) return;
    startTransition(async () => {
      try {
        await addCandidateNote(candidateId, body.trim());
        setBody("");
        toast.success("Note added");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to add note");
      }
    });
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4 space-y-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a note, screening summary, or follow-up reminder…"
            rows={3}
          />
          <div className="flex justify-end">
            <Button onClick={submit} disabled={pending || !body.trim()}>
              {pending ? "Posting…" : "Post note"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground px-2">No notes yet.</p>
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
