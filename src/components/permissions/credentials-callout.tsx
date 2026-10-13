"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  email: string;
  temporaryPassword: string;
}

/**
 * Shows a freshly issued temporary password. This is the only time it is
 * visible — it is stored as a bcrypt hash and cannot be read back.
 */
export function CredentialsCallout({ email, temporaryPassword }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${email} / ${temporaryPassword}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 h-4 w-4 text-amber-700" />
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-sm font-medium text-amber-900">Temporary password issued</p>
            <p className="text-xs text-amber-800">
              Share this with {email} over a channel you trust. They must change it at first
              sign-in, and it will not be shown again.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-md border border-amber-300 bg-white px-2 py-1 font-mono text-sm">
              {temporaryPassword}
            </code>
            <Button type="button" size="sm" variant="outline" className="bg-white" onClick={copy}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
