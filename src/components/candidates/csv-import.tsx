"use client";

import { useState } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Preview {
  rows: Record<string, string>[];
  errors: string[];
}

export function CandidateCsvImport() {
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pending, setPending] = useState(false);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    Papa.parse<Record<string, string>>(f, {
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
          rows.push(row);
        });
        setPreview({ rows, errors });
      },
    });
  }

  async function commit() {
    if (!preview) return;
    setPending(true);
    const supabase = getSupabaseBrowserClient();
    let ok = 0;
    let skipped = 0;
    const failures: string[] = [];

    for (const row of preview.rows) {
      const skills =
        row.skills
          ?.split(/[;,]/)
          .map((s) => s.trim())
          .filter(Boolean) ?? [];

      const payload = {
        full_name: row.full_name.trim(),
        email: row.email?.trim() || null,
        phone: row.phone?.trim() || null,
        current_company: row.current_company?.trim() || null,
        current_designation: row.current_designation?.trim() || null,
        current_location: row.current_location?.trim() || null,
        total_experience_years: row.total_experience_years ? Number(row.total_experience_years) : null,
        current_ctc: row.current_ctc ? Number(row.current_ctc) : null,
        expected_ctc: row.expected_ctc ? Number(row.expected_ctc) : null,
        notice_period_days: row.notice_period_days ? Number(row.notice_period_days) : null,
        skills,
        source: row.source?.trim() || null,
        status: "new",
      };

      if (payload.email) {
        const { data: dup } = await supabase.from("candidates").select("id").eq("email", payload.email).maybeSingle();
        if (dup) {
          skipped += 1;
          continue;
        }
      }

      const { error } = await supabase.from("candidates").insert(payload);
      if (error) failures.push(`${payload.full_name}: ${error.message}`);
      else ok += 1;
    }

    setPending(false);
    toast.success(`Imported ${ok} candidate${ok === 1 ? "" : "s"}${skipped ? `, skipped ${skipped} duplicates` : ""}`);
    if (failures.length) toast.error(`${failures.length} failed — see console for detail`);
    if (failures.length) console.warn(failures);
    router.push("/candidates");
  }

  return (
    <div className="space-y-4">
      <Input type="file" accept=".csv" onChange={onFile} />

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
            <Button variant="ghost" onClick={() => setPreview(null)}>Reset</Button>
          </div>
        </div>
      )}
    </div>
  );
}
