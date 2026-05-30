"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { movePipelineStage } from "@/server/actions/pipeline";
import { StatusBadge } from "@/components/ui/status-badge";
import { relativeTime } from "@/lib/utils";
import type { SettingsListItem } from "@/lib/types";

interface Row {
  id: string;
  current_stage: string;
  candidate_id: string;
  candidate_name: string;
  candidate_email: string | null;
  job_title: string;
  client_name: string;
  recruiter_name: string | null;
  last_activity_at: string;
  offer_amount: number | null;
}

interface Props {
  rows: Row[];
  stages: SettingsListItem[];
}

export function PipelineKanban({ rows, stages }: Props) {
  const [, startTransition] = useTransition();
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const grouped = new Map<string, Row[]>();
  stages.forEach((s) => grouped.set(s.value, []));
  rows.forEach((r) => {
    if (!grouped.has(r.current_stage)) grouped.set(r.current_stage, []);
    grouped.get(r.current_stage)!.push(r);
  });

  function onDragStart(id: string) {
    setDraggedId(id);
  }
  function onDrop(stageValue: string) {
    if (!draggedId) return;
    const id = draggedId;
    setDraggedId(null);
    startTransition(async () => {
      try {
        await movePipelineStage(id, stageValue);
        toast.success("Moved");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Move failed");
      }
    });
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-3 min-w-max pb-3">
        {stages.map((s) => {
          const items = grouped.get(s.value) ?? [];
          return (
            <div
              key={s.value}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(s.value)}
              className="w-72 shrink-0 rounded-lg bg-slate-100/70 p-2"
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <StatusBadge label={s.label} color={s.color} />
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <ul className="space-y-2">
                {items.map((it) => (
                  <li
                    key={it.id}
                    draggable
                    onDragStart={() => onDragStart(it.id)}
                    className="cursor-grab rounded-md border bg-white p-3 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <Link href={`/candidates/${it.candidate_id}`} className="block">
                      <p className="text-sm font-medium truncate">{it.candidate_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{it.job_title}</p>
                      <p className="text-xs text-muted-foreground truncate">{it.client_name}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] uppercase text-muted-foreground">{it.recruiter_name ?? ""}</span>
                        <span className="text-[10px] text-muted-foreground">{relativeTime(it.last_activity_at)}</span>
                      </div>
                    </Link>
                  </li>
                ))}
                {items.length === 0 && (
                  <li className="rounded-md border border-dashed bg-white/50 p-3 text-center text-xs text-muted-foreground">
                    Drop here
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
