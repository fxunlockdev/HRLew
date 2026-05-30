import { relativeTime } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

interface Row {
  id: string;
  action: string;
  created_at: string;
  actor: { full_name: string | null } | null;
}

export function CandidateActivity({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return <EmptyState title="No activity recorded" />;
  }
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center justify-between rounded-md border bg-white px-3 py-2 text-sm">
          <span>
            <span className="font-medium">{r.actor?.full_name ?? "System"}</span>{" "}
            <span className="text-muted-foreground">{r.action}d this candidate</span>
          </span>
          <span className="text-xs text-muted-foreground">{relativeTime(r.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}
