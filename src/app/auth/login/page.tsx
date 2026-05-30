import { Suspense } from "react";
import { LoginCard } from "./login-card";

export const metadata = { title: "Sign in · HR OS" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-soft via-background to-background px-4">
      <Suspense>
        <LoginCard />
      </Suspense>
    </main>
  );
}
