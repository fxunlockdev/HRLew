"use client";

import { FilterBar } from "@/components/layout/filter-bar";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SettingsListItem } from "@/lib/types";

interface Props {
  statuses: SettingsListItem[];
  recruiters: { id: string; full_name: string | null }[];
}

export function CandidatesFilters({ statuses, recruiters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "_all") next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <FilterBar searchPlaceholder="Search by name, email, phone, company…">
      <Select value={params.get("status") ?? "_all"} onValueChange={(v) => update("status", v)}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">All statuses</SelectItem>
          {statuses.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={params.get("recruiter") ?? "_all"} onValueChange={(v) => update("recruiter", v)}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="Recruiter" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">All recruiters</SelectItem>
          {recruiters.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {r.full_name ?? "Unknown"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterBar>
  );
}
