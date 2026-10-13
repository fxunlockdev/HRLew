import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { putObject, sanitizeFileName } from "@/lib/storage";
import { slugify } from "@/lib/utils";

/**
 * Uploads go through the app so every file is checked before it lands in the
 * bucket: who is asking, what kind of file it is, and how big it is. The
 * browser never holds bucket credentials.
 */

const RESUME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const RESUME_EXTENSIONS = /\.(pdf|doc|docx)$/i;
const RESUME_MAX_BYTES = 10 * 1024 * 1024;

const LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
const LOGO_EXTENSIONS = /\.(png|jpe?g|webp|svg)$/i;
const LOGO_MAX_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected a multipart upload." }, { status: 400 });
  }

  const kind = String(form.get("kind") ?? "");
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was attached." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  }

  let key: string;

  if (kind === "resume") {
    if (!hasPermission(ctx.profile, ctx.permissions, "candidates", "edit")) {
      return NextResponse.json({ error: "You cannot edit candidates." }, { status: 403 });
    }
    const candidateId = String(form.get("candidate_id") ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(candidateId)) {
      return NextResponse.json({ error: "Missing candidate." }, { status: 400 });
    }
    if (file.size > RESUME_MAX_BYTES) {
      return NextResponse.json({ error: "Resumes must be 10 MB or smaller." }, { status: 413 });
    }
    if (!RESUME_TYPES.has(file.type) && !RESUME_EXTENSIONS.test(file.name)) {
      return NextResponse.json({ error: "Upload a PDF, DOC or DOCX." }, { status: 415 });
    }
    key = `resumes/${candidateId}/${Date.now()}_${sanitizeFileName(file.name)}`;
  } else if (kind === "client-logo") {
    if (!hasPermission(ctx.profile, ctx.permissions, "clients", "edit")) {
      return NextResponse.json({ error: "You cannot edit clients." }, { status: 403 });
    }
    if (file.size > LOGO_MAX_BYTES) {
      return NextResponse.json({ error: "Logos must be 2 MB or smaller." }, { status: 413 });
    }
    if (!LOGO_TYPES.has(file.type) && !LOGO_EXTENSIONS.test(file.name)) {
      return NextResponse.json({ error: "Upload a PNG, JPG, WEBP or SVG." }, { status: 415 });
    }
    const company = slugify(String(form.get("company") ?? "").trim() || "company");
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "png";
    key = `client-logos/${company}/${Date.now()}-${company}.${extension.replace(/[^a-z0-9]/g, "")}`;
  } else {
    return NextResponse.json({ error: "Unknown upload kind." }, { status: 400 });
  }

  try {
    await putObject(key, Buffer.from(await file.arrayBuffer()), file.type);
  } catch (err) {
    console.error("[uploads] failed", err);
    const message = err instanceof Error && err.message.includes("not configured")
      ? "File storage is not configured yet."
      : "Upload failed. Try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ key, fileName: file.name, size: file.size, type: file.type });
}
