"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createTask } from "@/server/actions/tasks";
import { toast } from "sonner";

export function CreateTaskInline({ profiles }: { profiles: { id: string; full_name: string | null }[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      try {
        await createTask(fd);
        toast.success("Task created");
        (e.target as HTMLFormElement).reset();
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <Card>
      <CardContent className="p-3">
        {!open ? (
          <Button variant="outline" onClick={() => setOpen(true)}>+ Add task</Button>
        ) : (
          <form onSubmit={onSubmit} className="grid grid-cols-1 gap-2 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
            <Input name="title" placeholder="Task title" required />
            <Input type="datetime-local" name="due_at" />
            <Select name="priority" defaultValue="normal">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
            <Select name="assigned_to_id">
              <SelectTrigger><SelectValue placeholder="Assign to" /></SelectTrigger>
              <SelectContent>
                {profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name ?? "—"}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-1">
              <Button type="submit" disabled={pending}>{pending ? "…" : "Add"}</Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>×</Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
