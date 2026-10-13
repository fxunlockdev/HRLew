import { redirect } from "next/navigation";
import { setupAvailable } from "@/server/actions/auth";
import { SetupCard } from "./setup-card";

export const metadata = { title: "Set up · HR OS" };

// Asks the database whether this instance has any accounts yet, so it must
// not be prerendered — a baked-in answer would strand users on the wrong page.
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (!(await setupAvailable())) redirect("/auth/login");

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-soft via-background to-background px-4">
      <SetupCard />
    </main>
  );
}
