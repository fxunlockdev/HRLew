"use client";

import { useActionState, useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CredentialsCallout } from "@/components/permissions/credentials-callout";
import { createUser, type UserAdminState } from "@/server/actions/users";

interface Role {
  id: string;
  name: string;
  description: string | null;
}

export function CreateUserForm({ roles }: { roles: Role[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<UserAdminState, FormData>(createUser, {});

  if (!open && !state.credentials) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" /> Add user
      </Button>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">Add a user</CardTitle>
        <CardDescription>
          A temporary password is generated for you; the user replaces it when they first sign in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {state.credentials && (
          <CredentialsCallout
            email={state.credentials.email}
            temporaryPassword={state.credentials.temporaryPassword}
          />
        )}

        <form action={formAction} className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" name="full_name" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Work email</Label>
            <Input id="email" name="email" type="email" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role_id">Role</Label>
            <Select name="role_id" defaultValue={roles.find((r) => r.name === "recruiter")?.id}>
              <SelectTrigger id="role_id">
                <SelectValue placeholder="No role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <Select name="status" defaultValue="active">
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active — can sign in now</SelectItem>
                <SelectItem value="pending">Pending — needs approval</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {state.error && (
            <p
              role="alert"
              className="md:col-span-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {state.error}
            </p>
          )}

          <div className="flex gap-2 md:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create user"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
