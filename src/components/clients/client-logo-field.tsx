"use client";

import { useState } from "react";
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CompanyLogo } from "@/components/ui/company-logo";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { slugify } from "@/lib/utils";

interface Props {
  companyName?: string;
  initialUrl?: string | null;
  initialFileName?: string | null;
}

export function ClientLogoField({ companyName, initialUrl, initialFileName }: Props) {
  const [logoUrl, setLogoUrl] = useState(initialUrl ?? "");
  const [logoFileName, setLogoFileName] = useState(initialFileName ?? "");
  const [uploading, setUploading] = useState(false);

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const extension = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const safeCompany = slugify(companyName?.trim() || "company");
      const path = `${safeCompany}/${Date.now()}-${safeCompany}.${extension}`;
      const { error } = await supabase.storage.from("client-logos").upload(path, file, {
        cacheControl: "3600",
        upsert: true,
      });
      if (error) throw error;

      const { data } = supabase.storage.from("client-logos").getPublicUrl(path);
      setLogoUrl(data.publicUrl);
      setLogoFileName(file.name);
      toast.success("Company logo uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Logo upload failed");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  function clearLogo() {
    setLogoUrl("");
    setLogoFileName("");
  }

  return (
    <div className="space-y-3 rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 p-4">
      <input type="hidden" name="logo_url" value={logoUrl} />
      <input type="hidden" name="logo_file_name" value={logoFileName} />

      <div className="flex items-center gap-3">
        <CompanyLogo name={companyName?.trim() || "Company"} logoUrl={logoUrl} className="h-14 w-14" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Company logo</p>
          <p className="text-xs text-muted-foreground">
            Upload a PNG, JPG, SVG, or paste a hosted image URL below.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="bg-white" disabled={uploading} asChild>
          <label className="cursor-pointer">
            {uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {uploading ? "Uploading…" : "Upload logo"}
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" onChange={onFileChange} />
          </label>
        </Button>
        {logoUrl ? (
          <Button type="button" variant="ghost" onClick={clearLogo}>
            <Trash2 className="h-4 w-4" /> Remove
          </Button>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Input
          value={logoUrl}
          onChange={(event) => setLogoUrl(event.target.value)}
          placeholder="https://example.com/logo.png"
        />
        <p className="text-[11px] text-muted-foreground">
          {logoFileName ? `Stored as ${logoFileName}` : "If Supabase storage is not ready yet, a direct URL also works."}
        </p>
      </div>
    </div>
  );
}
