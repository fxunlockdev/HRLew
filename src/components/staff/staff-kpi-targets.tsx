"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { saveStaffKpiTargets } from "@/server/actions/kpi";
import { KPI_METRICS } from "@/lib/kpi-metrics";

interface Props {
  staffId: string;
  periodStart: string;
  periodLabel: string;
  targets: Record<string, number>;
}

export function StaffKpiTargets({ staffId, periodStart, periodLabel, targets }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        await saveStaffKpiTargets(staffId, periodStart, fd);
        toast.success("KPI targets saved");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">KPI targets · {periodLabel}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {KPI_METRICS.map((m) => (
            <div key={m.key} className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {m.label}
                {m.currency ? " (AED)" : ""}
              </Label>
              <Input
                type="number"
                min="0"
                step={m.currency ? "1000" : "1"}
                name={`metric_${m.key}`}
                defaultValue={targets[m.key] ?? ""}
                placeholder="No target"
              />
            </div>
          ))}
          {error && <p className="text-sm text-red-600 md:col-span-2">{error}</p>}
          <div className="flex justify-end md:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save targets"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
