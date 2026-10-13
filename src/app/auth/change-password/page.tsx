import { requireActor } from "@/lib/auth";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ChangePasswordCard } from "./change-password-card";

export const metadata = { title: "Change password · HR OS" };

export default async function ChangePasswordPage() {
  // Deliberately requireActor, not requireAuth: this is the page the
  // must-change-password gate redirects to, so it cannot depend on that gate
  // having been satisfied.
  const actor = await requireActor();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-br from-brand-soft via-background to-background px-4">
      <ChangePasswordCard forced={actor.mustChangePassword} />
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>Signed in as {actor.email}</span>
        <SignOutButton variant="ghost" className="h-auto px-2 py-1 text-xs" />
      </div>
    </main>
  );
}
