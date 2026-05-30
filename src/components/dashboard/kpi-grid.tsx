import {
  Users,
  Building2,
  Briefcase,
  GitBranch,
  CalendarClock,
  HandCoins,
  Sparkles,
  Trophy,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatNumber, formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface KpiGridProps {
  counts: {
    totalCandidates: number;
    activeCandidates: number;
    newCandidatesThisWeek: number;
    activeClients: number;
    openJobs: number;
    pipelineCount: number;
    scheduledInterviews: number;
    offersReleased: number;
    placementsThisMonth: number;
    revenueThisMonth: number;
  };
  canViewRevenue: boolean;
}

export function KpiGrid({ counts, canViewRevenue }: KpiGridProps) {
  const cards = [
    {
      label: "Active candidates",
      value: formatNumber(counts.activeCandidates),
      hint: `${formatNumber(counts.newCandidatesThisWeek)} new this week`,
      icon: Users,
      tone: "indigo",
    },
    {
      label: "Active clients",
      value: formatNumber(counts.activeClients),
      hint: `${formatNumber(counts.totalCandidates)} candidates total`,
      icon: Building2,
      tone: "blue",
    },
    {
      label: "Open requirements",
      value: formatNumber(counts.openJobs),
      hint: "Live jobs",
      icon: Briefcase,
      tone: "violet",
    },
    {
      label: "In pipeline",
      value: formatNumber(counts.pipelineCount),
      hint: "Active candidate-job links",
      icon: GitBranch,
      tone: "amber",
    },
    {
      label: "Interviews scheduled",
      value: formatNumber(counts.scheduledInterviews),
      hint: "Upcoming",
      icon: CalendarClock,
      tone: "orange",
    },
    {
      label: "Offers released",
      value: formatNumber(counts.offersReleased),
      hint: "Awaiting acceptance/join",
      icon: Sparkles,
      tone: "fuchsia",
    },
    {
      label: "Placements (this month)",
      value: formatNumber(counts.placementsThisMonth),
      hint: "Joined this month",
      icon: Trophy,
      tone: "emerald",
    },
    {
      label: "Revenue (this month)",
      value: canViewRevenue ? formatCurrency(counts.revenueThisMonth) : "—",
      hint: canViewRevenue ? "From joined placements" : "Restricted",
      icon: HandCoins,
      tone: "emerald",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{c.label}</span>
                <span className={cn("rounded-md p-1.5", toneMap[c.tone])}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{c.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

const toneMap: Record<string, string> = {
  indigo: "bg-indigo-100 text-indigo-700",
  blue: "bg-blue-100 text-blue-700",
  violet: "bg-violet-100 text-violet-700",
  amber: "bg-amber-100 text-amber-700",
  orange: "bg-orange-100 text-orange-700",
  fuchsia: "bg-fuchsia-100 text-fuchsia-700",
  emerald: "bg-emerald-100 text-emerald-700",
};
