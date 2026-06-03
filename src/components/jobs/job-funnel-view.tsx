import Link from "next/link";
import { CompanyLogo } from "@/components/ui/company-logo";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { SettingsListItem } from "@/lib/types";

interface Row {
  id: string;
  current_stage: string;
  candidate: { id: string; full_name: string | null } | null;
}

interface Props {
  rows: Row[];
  stages: SettingsListItem[];
  clientName: string;
  clientLogoUrl?: string | null;
}

const KEY_STAGES = new Set([
  "submitted",
  "client_shortlisted",
  "interview_scheduled",
  "interview_round_1",
  "interview_round_2",
  "final_interview",
  "offer_discussion",
  "offer_released",
  "offer_accepted",
  "joined",
  "rejected",
]);

export function JobFunnelView({ rows, stages, clientName, clientLogoUrl }: Props) {
  if (rows.length === 0) {
    return <EmptyState title="No funnel data yet" description="Submit candidates to this job to start tracking stage conversion." />;
  }

  const grouped = new Map<string, Row[]>();
  rows.forEach((row) => {
    const list = grouped.get(row.current_stage) ?? [];
    list.push(row);
    grouped.set(row.current_stage, list);
  });

  const visibleStages = stages.filter((stage) => KEY_STAGES.has(stage.value) || (grouped.get(stage.value)?.length ?? 0) > 0);
  const maxCount = Math.max(...visibleStages.map((stage) => grouped.get(stage.value)?.length ?? 0), 1);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-blue-100 bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 p-5 text-white shadow-md">
        <div className="flex items-center gap-3">
          <CompanyLogo
            name={clientName}
            logoUrl={clientLogoUrl}
            className="h-12 w-12 border-white/30 bg-white/10"
            fallbackClassName="bg-white/15 text-white"
          />
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-white/80">Job funnel</p>
            <h3 className="text-lg font-semibold">{clientName}</h3>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {visibleStages.map((stage, index) => {
          const candidates = grouped.get(stage.value) ?? [];
          const width = 100 - index * 4;

          return (
            <section key={stage.value} className="mx-auto" style={{ width: `${Math.max(width, 58)}%` }}>
              <div className="rounded-[28px] border border-blue-100 bg-white px-5 py-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge label={stage.label} color={stage.color} />
                    <span className="text-sm text-muted-foreground">
                      {candidates.length} candidate{candidates.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="h-2 w-28 overflow-hidden rounded-full bg-blue-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400"
                      style={{ width: `${Math.max((candidates.length / maxCount) * 100, candidates.length > 0 ? 18 : 0)}%` }}
                    />
                  </div>
                </div>

                {candidates.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {candidates.map((candidate) => (
                      <Link
                        key={candidate.id}
                        href={candidate.candidate ? `/candidates/${candidate.candidate.id}` : "#"}
                        className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                      >
                        {candidate.candidate?.full_name ?? "Unknown candidate"}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">No candidates in this stage yet.</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
