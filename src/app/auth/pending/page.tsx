import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignOutButton } from "@/components/auth/sign-out-button";

export const metadata = { title: "Awaiting approval · HR OS" };

// Asks the database whether this instance has any accounts yet, so it must
// not be prerendered — a baked-in answer would strand users on the wrong page.
export const dynamic = "force-dynamic";

export default function PendingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Awaiting approval</CardTitle>
          <CardDescription>
            Your sign-in succeeded, but an administrator must approve your account before you
            can access the CRM.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal pl-4 text-sm text-muted-foreground space-y-1">
            <li>Notify your HR OS admin that you have signed in.</li>
            <li>They will assign you a role from the Permissions module.</li>
            <li>Refresh this page once activated.</li>
          </ol>
          <SignOutButton />
        </CardContent>
      </Card>
    </main>
  );
}
