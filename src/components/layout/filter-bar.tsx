"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface FilterBarProps {
  searchKey?: string;
  searchPlaceholder?: string;
  children?: React.ReactNode;
}

export function FilterBar({
  searchKey = "q",
  searchPlaceholder = "Search…",
  children,
}: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  function update(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value && value.length) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.replace(`${pathname}?${next.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-white p-3">
      <div className="relative flex-1 min-w-[220px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          defaultValue={params.get(searchKey) ?? ""}
          onChange={(e) => update(searchKey, e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-9"
        />
      </div>
      {children}
    </div>
  );
}
