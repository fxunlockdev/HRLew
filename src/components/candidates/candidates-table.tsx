import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency, formatDate, truncate } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import type { SettingsListItem } from "@/lib/types";

interface Row {
  id: string;
  display_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  current_company: string | null;
  current_designation: string | null;
  current_location: string | null;
  total_experience_years: number | null;
  expected_ctc: number | null;
  status: string;
  skills: string[];
  recruiter: { full_name: string | null } | null;
  created_at: string;
}

interface Props {
  rows: Row[];
  statuses: SettingsListItem[];
  canViewCtc: boolean;
  page: number;
  pageSize: number;
  total: number;
}

export function CandidatesTable({ rows, statuses, canViewCtc, page, pageSize, total }: Props) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No candidates yet"
        description="Add your first candidate or import a CSV to get started."
      />
    );
  }

  return (
    <div className="rounded-lg border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Candidate</TableHead>
            <TableHead>Current role</TableHead>
            <TableHead>Skills</TableHead>
            <TableHead>Exp.</TableHead>
            {canViewCtc && <TableHead>Exp. CTC</TableHead>}
            <TableHead>Status</TableHead>
            <TableHead>Recruiter</TableHead>
            <TableHead>Added</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => {
            const stat = statuses.find((s) => s.value === c.status);
            return (
              <TableRow key={c.id}>
                <TableCell>
                  <Link href={`/candidates/${c.id}`} className="block">
                    <div className="font-medium hover:underline">{c.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.email ?? c.phone ?? c.display_id}
                    </div>
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="text-sm">{c.current_designation ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.current_company ?? ""} {c.current_location ? `· ${c.current_location}` : ""}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-xs">{truncate(c.skills.join(", "), 60) || "—"}</span>
                </TableCell>
                <TableCell>{c.total_experience_years ?? "—"} yr</TableCell>
                {canViewCtc && <TableCell>{formatCurrency(c.expected_ctc ?? null)}</TableCell>}
                <TableCell>
                  <StatusBadge label={stat?.label ?? c.status} color={stat?.color ?? "slate"} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {c.recruiter?.full_name ?? "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(c.created_at)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <Pagination page={page} pageSize={pageSize} total={total} />
    </div>
  );
}
