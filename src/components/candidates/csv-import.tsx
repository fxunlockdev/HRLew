"use client";

import { useState, useTransition } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { importCandidates } from "@/server/actions/candidates";

interface Preview {
  rows: Record<string, string>[];
  errors: string[];
}

/**
 * Parses the CSV in the browser for a preview, then hands the rows to a server
 * action that inserts them in one transaction. The previous version inserted
 * row-by-row straight from the browser, so a failure part-way through left half
 * an import behind.
 */
export function CandidateCsvImport() {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pending, startTransition] = useTransition();

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const errors: string[] = [];
        const rows: Record<string, string>[] = [];
        res.data.forEach((row, i) => {
          if (!row.full_name?.trim()) {
            errors.push(`Row ${i + 2}: full_name is required`);
            return;
          }
          // Skills may be separated by ; or , in the file; the action expects commas.
          rows.push({ ...row, skills: (row.skills ?? "").split(/[;,]/).join(",") });
        });
        setPreview({ rows, errors });
      },
      error: (err) => toast.error(err.message || "Could not read that file"),
    });
  }

  function commit() {
    if (!preview) return;
    startTransition(async () => {
      try {
        const result = await importCandidates(preview.rows);
        const noun = result.imported === 1 ? "candidate" : "candidates";
        toast.success(
          `Imported ${result.imported} ${noun}` +
            (result.skipped ? `, skipped ${result.skipped} duplicate${result.skipped === 1 ? "" : "s"}` : ""),
        );
        if (result.failures.length > 0) {
          toast.error(`${result.failures.length} row(s) rejected: ${result.failures[0]}`);
        }
        router.push("/candidates");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Import failed");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Input type="file" accept=".csv" onChange={onFile} disabled={pending} />

      {preview && (
        <div className="rounded-md border bg-white p-3 text-sm">
          <p className="font-medium">{preview.rows.length} rows ready to import</p>
          {preview.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-red-700 text-xs">
              {preview.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex gap-2">
            <Button onClick={commit} disabled={pending || preview.rows.length === 0}>
              {pending ? "Importing…" : `Import ${preview.rows.length} candidates`}
            </Button>
            <Button variant="ghost" onClick={() => setPreview(null)} disabled={pending}>
              Reset
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
