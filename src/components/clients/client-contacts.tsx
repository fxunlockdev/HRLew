"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addClientContact } from "@/server/actions/clients";
import { toast } from "sonner";
import { Plus, Mail, Phone, Star } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  designation: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
}

export function ClientContacts({ clientId, contacts }: { clientId: string; contacts: Contact[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("client_id", clientId);
    startTransition(async () => {
      try {
        await addClientContact(fd);
        (e.target as HTMLFormElement).reset();
        setOpen(false);
        toast.success("Contact added");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <div className="space-y-3">
      {!open ? (
        <Button variant="outline" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Add contact
        </Button>
      ) : (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Name *</Label>
                <Input name="name" required />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Designation</Label>
                <Input name="designation" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input type="email" name="email" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Phone</Label>
                <Input name="phone" />
              </div>
              <label className="col-span-2 flex items-center gap-2 text-sm">
                <input type="checkbox" name="is_primary" value="true" /> Mark as primary contact
              </label>
              <div className="col-span-2 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Add contact"}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">No contacts yet.</p>
      ) : (
        <ul className="space-y-2">
          {contacts.map((c) => (
            <li key={c.id} className="rounded-md border bg-white p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium flex items-center gap-1.5">
                    {c.name}
                    {c.is_primary && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-400" />}
                  </p>
                  <p className="text-xs text-muted-foreground">{c.designation}</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {c.email}</span>}
                {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {c.phone}</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
