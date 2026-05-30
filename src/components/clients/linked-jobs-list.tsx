import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Row {
  id: string;
  title: string;
  status: string;
  openings: number;
  priority: string;
  target_closure_date: string | null;
  created_at: string;
}

export function LinkedJobsList({ clientId, rows }: { clientId: string; rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No jobs for this client"
        action={
          <Button asChild>
            <Link href={`/jobs/new?client=${clientId}`}><Plus className="h-4 w-4" /> Add requirement</Link>
          </Button>
        }
      />
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button asChild size="sm">
          <Link href={`/jobs/new?client=${clientId}`}><Plus className="h-4 w-4" /> Add requirement</Link>
        </Button>
      </div>
      <ul className="space-y-2">
        {rows.map((j) => (
          <li key={j.id} className="rounded-md border bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Link href={`/jobs/${j.id}`} className="font-medium hover:underline">{j.title}</Link>
                <p className="text-xs text-muted-foreground">{j.openings} opening{j.openings === 1 ? "" : "s"} · Priority {j.priority}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge label={j.status} />
                <span className="text-xs text-muted-foreground">{formatDate(j.created_at)}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
