"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { attachResume } from "@/server/actions/candidates";
import { toast } from "sonner";
import { Download, FileText } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Doc {
  id: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  category: string;
  created_at: string;
}

interface Props {
  candidate: { id: string; resume_file_name: string | null };
  documents: Doc[];
}

export function CandidateResume({ candidate, documents }: Props) {
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const path = `${candidate.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("resumes").upload(path, file);
      if (error) throw error;
      startTransition(async () => {
        try {
          await attachResume(candidate.id, file.name, path, file.type, file.size);
          toast.success("Resume uploaded");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Upload failed");
        }
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function download(path: string) {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.storage.from("resumes").createSignedUrl(path, 60);
    if (error || !data) {
      toast.error("Could not download");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Upload resume</p>
          <Input type="file" accept=".pdf,.doc,.docx" onChange={onFile} disabled={uploading || pending} />
          <p className="text-xs text-muted-foreground">PDF / DOC / DOCX accepted.</p>
        </CardContent>
      </Card>

      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground px-2">No documents uploaded.</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between rounded-md border bg-white p-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{d.file_name}</p>
                  <p className="text-xs text-muted-foreground">{d.category} · {formatDate(d.created_at)}</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => download(d.storage_path)}>
                <Download className="h-4 w-4" /> Download
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
