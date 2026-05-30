"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import type { SettingsListItem } from "@/lib/types";

interface Row {
  id: string;
  scheduled_at: string | null;
  status: string;
  candidate: { full_name: string } | null;
  job: { title: string } | null;
}

interface Props {
  rows: Row[];
  statuses: SettingsListItem[];
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function InterviewCalendar({ rows, statuses }: Props) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  const grid = useMemo(() => {
    const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = firstDay.getDay();
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells: { date: Date | null; items: Row[] }[] = [];
    for (let i = 0; i < offset; i++) cells.push({ date: null, items: [] });
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(cursor.getFullYear(), cursor.getMonth(), i);
      const items = rows.filter((r) => {
        if (!r.scheduled_at) return false;
        const d = new Date(r.scheduled_at);
        return d.getFullYear() === date.getFullYear() && d.getMonth() === date.getMonth() && d.getDate() === date.getDate();
      });
      cells.push({ date, items });
    }
    while (cells.length % 7 !== 0) cells.push({ date: null, items: [] });
    return cells;
  }, [cursor, rows]);

  function move(months: number) {
    const d = new Date(cursor);
    d.setMonth(d.getMonth() + months);
    setCursor(d);
  }

  const monthLabel = cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const today = new Date();

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="flex items-center justify-between pb-3">
        <h2 className="text-lg font-semibold">{monthLabel}</h2>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => move(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}>Today</Button>
          <Button variant="outline" size="sm" onClick={() => move(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-px bg-slate-200 rounded overflow-hidden text-xs">
        {DAY_LABELS.map((d) => (
          <div key={d} className="bg-slate-50 p-2 font-medium text-center">{d}</div>
        ))}
        {grid.map((cell, i) => {
          const isToday =
            cell.date &&
            cell.date.getFullYear() === today.getFullYear() &&
            cell.date.getMonth() === today.getMonth() &&
            cell.date.getDate() === today.getDate();
          return (
            <div key={i} className={`bg-white min-h-[110px] p-1 ${cell.date ? "" : "opacity-30"} ${isToday ? "ring-2 ring-inset ring-indigo-300" : ""}`}>
              {cell.date && (
                <div className="text-[10px] font-medium text-muted-foreground mb-1">{cell.date.getDate()}</div>
              )}
              <ul className="space-y-1">
                {cell.items.slice(0, 3).map((it) => {
                  const stat = statuses.find((s) => s.value === it.status);
                  return (
                    <li key={it.id}>
                      <Link href={`/interviews/${it.id}`} className="block rounded bg-indigo-50 hover:bg-indigo-100 px-1.5 py-1">
                        <p className="text-[10px] font-medium truncate">{it.candidate?.full_name}</p>
                        <StatusBadge className="text-[9px] py-0" label={stat?.label ?? it.status} color={stat?.color} />
                      </Link>
                    </li>
                  );
                })}
                {cell.items.length > 3 && (
                  <li className="text-[10px] text-muted-foreground px-1">+{cell.items.length - 3} more</li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
