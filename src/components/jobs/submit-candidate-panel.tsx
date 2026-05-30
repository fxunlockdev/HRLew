"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { submitCandidateToJob } from "@/server/actions/jobs";
import { toast } from "sonner";

interface Hit {
  id: string;
  full_name: string;
  email: string | null;
  current_company: string | null;
}

export function SubmitCandidatePanel({ jobId }: { jobId: string }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [pending, startTransition] = useTransition();

  async function search(term: string) {
    setQ(term);
    if (term.length < 2) {
      setHits([]);
      return;
    }
    const supabase = getSupabaseBrowserClient();
    const { data } = await supabase
      .from("candidates")
      .select("id, full_name, email, current_company")
      .or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
      .limit(20);
    setHits((data ?? []) as Hit[]);
  }

  function submit(candidateId: string) {
    startTransition(async () => {
      try {
        await submitCandidateToJob(jobId, candidateId);
        toast.success("Candidate added to pipeline");
        setQ("");
        setHits([]);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <Input value={q} onChange={(e) => search(e.target.value)} placeholder="Search candidates by name or email…" />
        {hits.length > 0 && (
          <ul className="rounded-md border bg-white divide-y">
            {hits.map((h) => (
              <li key={h.id} className="flex items-center justify-between p-3">
                <div>
                  <p className="text-sm font-medium">{h.full_name}</p>
                  <p className="text-xs text-muted-foreground">{h.email ?? ""} {h.current_company ? `· ${h.current_company}` : ""}</p>
                </div>
                <Button size="sm" onClick={() => submit(h.id)} disabled={pending}>Submit</Button>
              </li>
            ))}
          </ul>
        )}
        {q.length >= 2 && hits.length === 0 && <p className="text-sm text-muted-foreground">No matches.</p>}
      </CardContent>
    </Card>
  );
}
