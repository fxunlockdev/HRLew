import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { setupAvailable } from "@/server/actions/auth";
import { LoginCard } from "./login-card";

export const metadata = { title: "Sign in · HR OS" };

// Asks the database whether this instance has any accounts yet, so it must
// not be prerendered — a baked-in answer would strand users on the wrong page.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // A database with no accounts means this is a fresh install.
  if (await setupAvailable()) redirect("/auth/setup");
  if (await getAuthContext()) redirect("/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-soft via-background to-background px-4">
      <Suspense>
        <LoginCard />
      </Suspense>
    </main>
  );
}
