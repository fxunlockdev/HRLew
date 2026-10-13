import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { isAllowedKey, presignGetUrl } from "@/lib/storage";

/**
 * Resolves an object key to its file.
 *
 * Authorises the viewer, then redirects to a short-lived presigned URL so the
 * bytes come straight from the bucket instead of through this service. Replaces
 * Supabase's createSignedUrl() and getPublicUrl() — nothing is public now.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const ctx = await getAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { key: segments } = await params;
  const key = segments.map(decodeURIComponent).join("/");

  if (!isAllowedKey(key)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // Resumes are candidate data; logos are company branding every user sees.
  if (key.startsWith("resumes/") && !hasPermission(ctx.profile, ctx.permissions, "candidates", "view")) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  try {
    const url = await presignGetUrl(key, 300);
    return NextResponse.redirect(url, {
      status: 302,
      // The redirect target is signed and expires; never let it be cached.
      headers: { "cache-control": "private, no-store" },
    });
  } catch (err) {
    console.error("[files] presign failed", err);
    return NextResponse.json({ error: "File unavailable." }, { status: 500 });
  }
}
