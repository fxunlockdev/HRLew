"use client";

import { useTransition } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { updateUserRole } from "@/server/actions/settings";
import { toast } from "sonner";
import { formatDate, relativeTime } from "@/lib/utils";

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  status: string;
  role_id: string | null;
  role: { id: string; name: string } | null;
  last_seen_at: string | null;
  created_at: string;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
}

export function UserRoleEditor({ profiles, roles }: { profiles: Profile[]; roles: Role[] }) {
  const [pending, startTransition] = useTransition();

  function update(profileId: string, roleId: string, status: string) {
    startTransition(async () => {
      try {
        await updateUserRole(profileId, roleId || null, status);
        toast.success("Updated");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <div className="rounded-lg border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last seen</TableHead>
            <TableHead>Joined</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {profiles.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <p className="font-medium">{p.full_name ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{p.email}</p>
              </TableCell>
              <TableCell>
                <Select
                  defaultValue={p.role_id ?? ""}
                  onValueChange={(v) => update(p.id, v, p.status)}
                  disabled={pending}
                >
                  <SelectTrigger className="w-36"><SelectValue placeholder="No role" /></SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Select
                  defaultValue={p.status}
                  onValueChange={(v) => update(p.id, p.role_id ?? "", v)}
                  disabled={pending}
                >
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{p.last_seen_at ? relativeTime(p.last_seen_at) : "—"}</TableCell>
              <TableCell className="text-xs text-muted-foreground">{formatDate(p.created_at)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
