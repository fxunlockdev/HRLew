import { Suspense } from "react";
import { LoginCard } from "./login-card";

export const metadata = { title: "Sign in · HRLew" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-indigo-50 px-4">
      <Suspense>
        <LoginCard />
      </Suspense>
    </main>
  );
}
