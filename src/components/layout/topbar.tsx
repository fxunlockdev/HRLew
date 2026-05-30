"use client";

import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { initials } from "@/lib/utils";
import type { Profile } from "@/lib/types";
import { roleLabel } from "@/lib/rbac";

interface TopbarProps {
  profile: Profile;
}

export function Topbar({ profile }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-white px-4 md:px-6">
      <div className="relative flex-1 max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search candidates, clients, jobs…"
          className="pl-9 bg-slate-50 border-slate-200"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/tasks?filter=mine"
          className="hidden md:flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-slate-50"
        >
          <Bell className="h-3.5 w-3.5" />
          Tasks
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full border bg-white p-1 pr-3 hover:bg-slate-50">
              <Avatar className="h-7 w-7">
                <AvatarImage src={profile.avatar_url ?? undefined} />
                <AvatarFallback>{initials(profile.full_name)}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{profile.full_name ?? "User"}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{profile.full_name}</span>
                <span className="text-xs text-muted-foreground">{profile.email}</span>
                <span className="mt-1 text-xs text-muted-foreground">
                  Role: {roleLabel(profile.role?.name)}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/permissions">Permissions</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <div className="p-1">
              <SignOutButton variant="ghost" className="w-full justify-start" />
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
