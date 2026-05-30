"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { updateLeadStage } from "@/server/actions/bd";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { SettingsListItem } from "@/lib/types";

interface Row {
  id: string;
  company_name: string;
  contact_name: string | null;
  stage: string;
  expected_value: number | null;
  next_follow_up_at: string | null;
  owner: { full_name: string | null } | null;
}

export function BdKanban({ rows, stages }: { rows: Row[]; stages: SettingsListItem[] }) {
  const [, startTransition] = useTransition();
  const [dragged, setDragged] = useState<string | null>(null);

  const grouped = new Map<string, Row[]>();
  stages.forEach((s) => grouped.set(s.value, []));
  rows.forEach((r) => {
    if (!grouped.has(r.stage)) grouped.set(r.stage, []);
    grouped.get(r.stage)!.push(r);
  });

  function onDrop(stage: string) {
    if (!dragged) return;
    const id = dragged;
    setDragged(null);
    startTransition(async () => {
      try {
        await updateLeadStage(id, stage);
        toast.success("Stage updated");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-3 min-w-max pb-3">
        {stages.map((s) => {
          const items = grouped.get(s.value) ?? [];
          const totalValue = items.reduce((sum, i) => sum + (i.expected_value ?? 0), 0);
          return (
            <div
              key={s.value}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(s.value)}
              className="w-72 shrink-0 rounded-lg bg-slate-100/70 p-2"
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <StatusBadge label={s.label} color={s.color} />
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{items.length}</p>
                  {totalValue > 0 && <p className="text-[10px] text-muted-foreground">{formatCurrency(totalValue)}</p>}
                </div>
              </div>
              <ul className="space-y-2">
                {items.map((it) => (
                  <li
                    key={it.id}
                    draggable
                    onDragStart={() => setDragged(it.id)}
                    className="cursor-grab rounded-md border bg-white p-3 shadow-sm"
                  >
                    <Link href={`/bd/${it.id}`} className="block">
                      <p className="text-sm font-medium truncate">{it.company_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{it.contact_name ?? ""}</p>
                      {it.expected_value && (
                        <p className="mt-1 text-xs font-medium">{formatCurrency(it.expected_value)}</p>
                      )}
                      <div className="mt-1 flex items-center justify-between">
                        <span className="text-[10px] uppercase text-muted-foreground">{it.owner?.full_name ?? ""}</span>
                        {it.next_follow_up_at && (
                          <span className="text-[10px] text-muted-foreground">Follow up {formatDate(it.next_follow_up_at)}</span>
                        )}
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
