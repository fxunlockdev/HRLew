"use client";

import { useActionState, useTransition } from "react";
import { KeyRound, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CredentialsCallout } from "@/components/permissions/credentials-callout";
import { resetUserPassword, revokeUserSessions, type UserAdminState } from "@/server/actions/users";

interface Props {
  profileId: string;
  email: string;
}

export function UserRowActions({ profileId, email }: Props) {
  const [state, formAction, resetting] = useActionState<UserAdminState, FormData>(
    resetUserPassword,
    {},
  );
  const [signingOut, startSignOut] = useTransition();

  function signOutEverywhere() {
    startSignOut(async () => {
      try {
        await revokeUserSessions(profileId);
        toast.success(`${email} signed out on all devices`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed");
      }
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <form action={formAction}>
          <input type="hidden" name="profile_id" value={profileId} />
          <Button type="submit" variant="outline" size="sm" disabled={resetting}>
            <KeyRound className="h-3.5 w-3.5" />
            {resetting ? "Resetting…" : "Reset password"}
          </Button>
        </form>
        <Button variant="ghost" size="sm" onClick={signOutEverywhere} disabled={signingOut}>
          <LogOut className="h-3.5 w-3.5" />
          {signingOut ? "Signing out…" : "Sign out"}
        </Button>
      </div>

      {state.error && <p className="text-xs text-red-700">{state.error}</p>}
      {state.credentials && (
        <CredentialsCallout
          email={state.credentials.email}
          temporaryPassword={state.credentials.temporaryPassword}
        />
      )}
    </div>
  );
}
