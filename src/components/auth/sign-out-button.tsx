"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface Props {
  variant?: "default" | "outline" | "ghost";
  className?: string;
}

export function SignOutButton({ variant = "outline", className }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/auth/login");
    router.refresh();
  }

  return (
    <Button onClick={handleSignOut} variant={variant} disabled={loading} className={className}>
      {loading ? "Signing out…" : "Sign out"}
    </Button>
  );
}
