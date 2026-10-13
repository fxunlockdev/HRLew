"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
      // The server validates type and size, stores the object, and tells us
      // the key to record against the candidate.
      const body = new FormData();
      body.set("kind", "resume");
      body.set("candidate_id", candidate.id);
      body.set("file", file);

      const response = await fetch("/api/uploads", { method: "POST", body });
      const payload = (await response.json()) as { key?: string; error?: string };
      if (!response.ok || !payload.key) throw new Error(payload.error ?? "Upload failed");

      const key = payload.key;
      startTransition(async () => {
        try {
          await attachResume(candidate.id, file.name, key, file.type, file.size);
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

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Upload resume</p>
          <Input
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={onFile}
            disabled={uploading || pending}
          />
          <p className="text-xs text-muted-foreground">PDF / DOC / DOCX, up to 10 MB.</p>
        </CardContent>
      </Card>

      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground px-2">No documents uploaded.</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between rounded-md border bg-white p-3"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{d.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.category} · {formatDate(d.created_at)}
                  </p>
                </div>
              </div>
              {/* Resolves to a short-lived presigned URL server-side. */}
              <Button asChild variant="outline" size="sm">
                <a
                  href={`/api/files/${d.storage_path
                    .split("/")
                    .map(encodeURIComponent)
                    .join("/")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download className="h-4 w-4" /> Download
                </a>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
