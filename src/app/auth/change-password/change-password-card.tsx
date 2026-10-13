"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeOwnPassword, type AuthFormState } from "@/server/actions/auth";

export function ChangePasswordCard({ forced }: { forced: boolean }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    changeOwnPassword,
    {},
  );

  return (
    <Card className="w-full max-w-md shadow-xl border-slate-200/80">
      <CardHeader className="space-y-2">
        <CardTitle className="text-xl">
          {forced ? "Choose your password" : "Change password"}
        </CardTitle>
        <CardDescription>
          {forced
            ? "Your account was created with a temporary password. Pick your own to continue."
            : "Changing your password signs you out of your other devices."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="current_password">
              {forced ? "Temporary password" : "Current password"}
            </Label>
            <Input
              id="current_password"
              name="current_password"
              type="password"
              autoComplete="current-password"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new_password">New password</Label>
            <Input
              id="new_password"
              name="new_password"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
            />
            <p className="text-[11px] text-muted-foreground">At least 10 characters.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm_password">Confirm new password</Label>
            <Input
              id="confirm_password"
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              required
            />
          </div>

          {state.error && (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {state.error}
            </p>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={pending}>
            {pending ? "Saving…" : "Save password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
