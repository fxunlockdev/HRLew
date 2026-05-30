import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Row {
  id: string;
  current_stage: string;
  submitted_at: string | null;
  last_activity_at: string;
  candidate: { id: string; full_name: string; email: string | null; expected_ctc: number | null; total_experience_years: number | null } | null;
}

export function JobPipelineList({ rows, canViewCtc }: { rows: Row[]; canViewCtc: boolean }) {
  if (rows.length === 0) {
    return <EmptyState title="No candidates submitted yet" description="Use the Submit candidate tab to add a candidate to this requirement." />;
  }
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.id} className="rounded-md border bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <Link href={r.candidate ? `/candidates/${r.candidate.id}` : "#"} className="font-medium hover:underline">
                {r.candidate?.full_name ?? "Unknown"}
              </Link>
              <p className="text-xs text-muted-foreground">
                {r.candidate?.email ?? ""}
                {r.candidate?.total_experience_years && ` · ${r.candidate.total_experience_years} yrs`}
                {canViewCtc && r.candidate?.expected_ctc && ` · Expects ${formatCurrency(r.candidate.expected_ctc)}`}
              </p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <StatusBadge label={r.current_stage} />
              <p className="mt-1">Last move {formatDate(r.last_activity_at)}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
