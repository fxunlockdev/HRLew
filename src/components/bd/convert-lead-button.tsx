"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { convertLeadToClient } from "@/server/actions/bd";
import { toast } from "sonner";

export function ConvertLeadButton({ leadId }: { leadId: string }) {
  const [pending, startTransition] = useTransition();
  function onClick() {
    if (!confirm("Convert this lead into a client?")) return;
    startTransition(async () => {
      try {
        await convertLeadToClient(leadId);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Conversion failed");
      }
    });
  }
  return (
    <Button onClick={onClick} disabled={pending}>
      {pending ? "Converting…" : "Convert to client"}
    </Button>
  );
}
