"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { recordInterviewFeedback } from "@/server/actions/interviews";
import { toast } from "sonner";

export function InterviewFeedbackForm({
  interviewId,
  current,
}: {
  interviewId: string;
  current: { outcome?: string | null; feedback?: string | null; rating?: number | null; next_step?: string | null };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState(current.outcome ?? "");
  const [feedback, setFeedback] = useState(current.feedback ?? "");
  const [rating, setRating] = useState(current.rating ?? "");
  const [nextStep, setNextStep] = useState(current.next_step ?? "");

  function submit() {
    if (!feedback.trim()) {
      toast.error("Feedback is required.");
      return;
    }
    startTransition(async () => {
      try {
        await recordInterviewFeedback(
          interviewId,
          outcome,
          feedback,
          rating === "" ? null : Number(rating),
          nextStep || null,
        );
        toast.success("Feedback saved");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <Field label="Outcome">
          <Select value={outcome} onValueChange={setOutcome}>
            <SelectTrigger><SelectValue placeholder="Select outcome" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="selected">Selected</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="on_hold">On hold</SelectItem>
              <SelectItem value="rescheduled">Rescheduled</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Rating (1-5)">
          <Input type="number" min={1} max={5} value={rating} onChange={(e) => setRating(e.target.value)} />
        </Field>
        <Field label="Feedback *">
          <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={5} required />
        </Field>
        <Field label="Next step">
          <Input value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder="Schedule final round, etc." />
        </Field>
        <div className="flex justify-end">
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving…" : "Mark complete & save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
