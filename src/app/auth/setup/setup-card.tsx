"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP_NAME } from "@/lib/constants";
import { completeSetup, type AuthFormState } from "@/server/actions/auth";

export function SetupCard() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(completeSetup, {});

  return (
    <Card className="w-full max-w-md shadow-xl border-slate-200/80">
      <CardHeader className="space-y-2 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white p-2 shadow-md ring-1 ring-blue-100">
          <BrandLogo className="h-12 w-12" />
        </div>
        <CardTitle className="text-2xl">Set up {APP_NAME}</CardTitle>
        <CardDescription>
          Create the first administrator account. This page closes itself once an account exists.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Your name</Label>
            <Input id="full_name" name="full_name" required autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Work email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              placeholder="you@company.com"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
            />
            <p className="text-[11px] text-muted-foreground">At least 10 characters.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm_password">Confirm password</Label>
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
            {pending ? "Creating account…" : "Create admin account"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
