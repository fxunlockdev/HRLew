"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { updateTaskStatus } from "@/server/actions/tasks";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime, relativeTime } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";

interface Row {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  due_at: string | null;
  related_entity_type: string | null;
  assignee: { full_name: string | null } | null;
}

export function TaskList({ rows }: { rows: Row[] }) {
  const [pending, startTransition] = useTransition();

  function complete(id: string) {
    startTransition(async () => {
      try {
        await updateTaskStatus(id, "completed");
        toast.success("Marked complete");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  if (rows.length === 0) {
    return <EmptyState title="No tasks here" />;
  }
  return (
    <ul className="space-y-2">
      {rows.map((t) => {
        const overdue = t.due_at && new Date(t.due_at) < new Date() && t.status !== "completed";
        return (
          <li key={t.id} className="rounded-md border bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{t.title}</p>
                {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="capitalize">priority: {t.priority}</span>
                  {t.related_entity_type && <span>· {t.related_entity_type}</span>}
                  <span>· assignee: {t.assignee?.full_name ?? "—"}</span>
                  {t.due_at && (
                    <span className={overdue ? "text-red-600 font-medium" : ""}>
                      · due {formatDateTime(t.due_at)} ({relativeTime(t.due_at)})
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge label={t.status} color={t.status === "completed" ? "green" : overdue ? "red" : "slate"} />
                {t.status !== "completed" && (
                  <Button size="sm" variant="outline" disabled={pending} onClick={() => complete(t.id)}>
                    Complete
                  </Button>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
