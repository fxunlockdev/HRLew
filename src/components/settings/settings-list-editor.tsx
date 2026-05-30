"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { upsertSettingsListItem, deactivateSettingsListItem } from "@/server/actions/settings";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

interface Row {
  id: string;
  list_key: string;
  value: string;
  label: string;
  sort_order: number;
  color: string | null;
  is_system: boolean;
  is_active: boolean;
}

export function SettingsListEditor({ listKey, rows }: { listKey: string; rows: Row[] }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("list_key", listKey);
    startTransition(async () => {
      try {
        await upsertSettingsListItem(fd);
        toast.success("Saved");
        (e.target as HTMLFormElement).reset();
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  function remove(id: string) {
    if (!confirm("Deactivate this item?")) return;
    startTransition(async () => {
      try {
        await deactivateSettingsListItem(id);
        toast.success("Deactivated");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-3">
          {!open ? (
            <Button variant="outline" onClick={() => setOpen(true)}>+ Add value</Button>
          ) : (
            <form onSubmit={onSubmit} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_1fr_1fr_auto]">
              <Input name="value" placeholder="value (snake_case)" required />
              <Input name="label" placeholder="Display label" required />
              <Input name="sort_order" type="number" defaultValue={Math.max(0, ...rows.map((r) => r.sort_order)) + 10} />
              <Input name="color" placeholder="color (slate, blue, …)" />
              <div className="flex gap-1">
                <Button type="submit" disabled={pending}>{pending ? "…" : "Save"}</Button>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>×</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Value</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>System</TableHead>
              <TableHead>Active</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell><code className="text-xs">{r.value}</code></TableCell>
                <TableCell><StatusBadge label={r.label} color={r.color ?? "slate"} /></TableCell>
                <TableCell>{r.sort_order}</TableCell>
                <TableCell>{r.color ?? "—"}</TableCell>
                <TableCell>{r.is_system ? "yes" : "no"}</TableCell>
                <TableCell>{r.is_active ? "yes" : "no"}</TableCell>
                <TableCell>
                  {!r.is_system && (
                    <Button variant="ghost" size="sm" onClick={() => remove(r.id)} disabled={pending}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
