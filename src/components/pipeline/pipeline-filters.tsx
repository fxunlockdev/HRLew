"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Props {
  jobs: { id: string; title: string }[];
  clients: { id: string; name: string }[];
  recruiters: { id: string; full_name: string | null }[];
}

export function PipelineFilters({ jobs, clients, recruiters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value && value !== "_all") next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2 rounded-lg border bg-white p-3">
      <Select value={params.get("job") ?? "_all"} onValueChange={(v) => update("job", v)}>
        <SelectTrigger className="w-56"><SelectValue placeholder="Job" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">All jobs</SelectItem>
          {jobs.map((j) => <SelectItem key={j.id} value={j.id}>{j.title}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={params.get("client") ?? "_all"} onValueChange={(v) => update("client", v)}>
        <SelectTrigger className="w-56"><SelectValue placeholder="Client" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">All clients</SelectItem>
          {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={params.get("recruiter") ?? "_all"} onValueChange={(v) => update("recruiter", v)}>
        <SelectTrigger className="w-56"><SelectValue placeholder="Recruiter" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">All recruiters</SelectItem>
          {recruiters.map((r) => <SelectItem key={r.id} value={r.id}>{r.full_name ?? "—"}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
