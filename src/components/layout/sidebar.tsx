"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  Sparkles,
  Briefcase,
  GitBranch,
  CalendarClock,
  Trophy,
  ChartLine,
  UserCog,
  ListChecks,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { NAV_MODULES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { hasPermission, isAdmin, type PermissionTuple } from "@/lib/rbac";
import type { Profile } from "@/lib/types";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  Building2,
  Sparkles,
  Briefcase,
  GitBranch,
  CalendarClock,
  Trophy,
  ChartLine,
  UserCog,
  ListChecks,
  Settings,
  ShieldCheck,
};

interface SidebarProps {
  profile: Profile;
  permissions: PermissionTuple[];
}

export function Sidebar({ profile, permissions }: SidebarProps) {
  const pathname = usePathname();
  const admin = isAdmin(profile);

  const visible = NAV_MODULES.filter((m) => {
    if (m.key === "dashboard") return true;
    if (m.key === "rbac") return admin || hasPermission(profile, permissions, "rbac", "view");
    if (m.key === "settings") return hasPermission(profile, permissions, "settings", "view");
    if (m.key === "staff") return hasPermission(profile, permissions, "staff", "view");
    return hasPermission(profile, permissions, m.key, "view") || admin;
  });

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col border-r bg-white">
      <div className="flex h-14 items-center gap-2 px-4 border-b">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-ink text-white text-sm font-bold">
          HR
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold">HRLew</span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Recruitment OS</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-0.5">
          {visible.map((m) => {
            const Icon = ICONS[m.icon];
            const isActive = pathname === m.href || pathname.startsWith(`${m.href}/`);
            return (
              <li key={m.key}>
                <Link
                  href={m.href}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground/70 hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  <span>{m.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t p-3">
        <div className="rounded-lg bg-slate-50 p-3 text-xs">
          <p className="font-medium">{profile.full_name ?? profile.email}</p>
          <p className="text-muted-foreground capitalize">{profile.role?.name ?? "pending"}</p>
        </div>
      </div>
    </aside>
  );
}
