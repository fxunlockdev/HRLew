import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatCurrency } from "@/lib/utils";

interface Row {
  id: string;
  current_stage: string;
  submitted_at: string | null;
  last_activity_at: string;
  offer_amount: number | null;
  job: { id: string; title: string } | null;
  client: { name: string } | null;
}

export function CandidatePipelineList({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return <EmptyState title="Not submitted to any jobs yet" description="Link this candidate to a job from the Pipeline module." />;
  }
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.id} className="rounded-md border bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <Link href={r.job ? `/jobs/${r.job.id}` : "#"} className="font-medium hover:underline">
                {r.job?.title ?? "Untitled role"}
              </Link>
              <p className="text-xs text-muted-foreground">{r.client?.name}</p>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>Last activity {formatDate(r.last_activity_at)}</p>
              {r.offer_amount && <p>Offer: {formatCurrency(r.offer_amount)}</p>}
            </div>
          </div>
          <div className="mt-2">
            <StatusBadge label={r.current_stage} />
          </div>
        </li>
      ))}
    </ul>
  );
}
