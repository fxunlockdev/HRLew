"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  page: number;
  pageSize: number;
  total: number;
}

export function Pagination({ page, pageSize, total }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pathname = usePathname();
  const params = useSearchParams();

  function withPage(p: number) {
    const next = new URLSearchParams(params.toString());
    next.set("page", String(p));
    return `${pathname}?${next.toString()}`;
  }

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t px-3 py-2 text-sm">
      <span className="text-muted-foreground">
        Page {page} of {totalPages} · {total} total
      </span>
      <div className="flex items-center gap-1">
        <Button asChild variant="outline" size="sm" disabled={page <= 1}>
          <Link href={withPage(Math.max(1, page - 1))} aria-disabled={page <= 1}>
            <ChevronLeft className="h-4 w-4" /> Prev
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm" disabled={page >= totalPages}>
          <Link href={withPage(Math.min(totalPages, page + 1))} aria-disabled={page >= totalPages}>
            Next <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
