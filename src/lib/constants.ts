export const APP_NAME = "HRLew";
export const APP_TAGLINE = "Recruitment operations OS";

export const NAV_MODULES = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
  { key: "candidates", label: "Candidates", href: "/candidates", icon: "Users" },
  { key: "clients", label: "Clients", href: "/clients", icon: "Building2" },
  { key: "bd", label: "Business Dev", href: "/bd", icon: "Sparkles" },
  { key: "jobs", label: "Jobs", href: "/jobs", icon: "Briefcase" },
  { key: "pipeline", label: "Pipeline", href: "/pipeline", icon: "GitBranch" },
  { key: "interviews", label: "Interviews", href: "/interviews", icon: "CalendarClock" },
  { key: "placements", label: "Placements", href: "/placements", icon: "Trophy" },
  { key: "kpi", label: "KPIs & Reports", href: "/kpis", icon: "ChartLine" },
  { key: "staff", label: "Staff", href: "/staff", icon: "UserCog" },
  { key: "tasks", label: "Tasks", href: "/tasks", icon: "ListChecks" },
  { key: "settings", label: "Settings", href: "/settings", icon: "Settings" },
  { key: "rbac", label: "Permissions", href: "/permissions", icon: "ShieldCheck" },
] as const;

export const STATUS_COLOR_MAP: Record<string, string> = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-blue-100 text-blue-700 ring-blue-200",
  indigo: "bg-indigo-100 text-indigo-700 ring-indigo-200",
  violet: "bg-violet-100 text-violet-700 ring-violet-200",
  fuchsia: "bg-fuchsia-100 text-fuchsia-700 ring-fuchsia-200",
  amber: "bg-amber-100 text-amber-800 ring-amber-200",
  orange: "bg-orange-100 text-orange-800 ring-orange-200",
  green: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  red: "bg-red-100 text-red-700 ring-red-200",
  zinc: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  gray: "bg-gray-100 text-gray-700 ring-gray-200",
  black: "bg-neutral-800 text-white ring-neutral-700",
};
