import "server-only";
import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Object storage on a Railway Bucket (S3-compatible, private).
 *
 * Railway injects BUCKET / ACCESS_KEY_ID / SECRET_ACCESS_KEY / ENDPOINT /
 * REGION when you reference a bucket from a service. The S3_-prefixed and AWS_
 * names are also accepted so the AWS-SDK variable preset works unchanged.
 *
 * Replaces Supabase Storage. Two differences worth knowing:
 *   - uploads go through the app (validated server-side) rather than straight
 *     from the browser, so no bucket CORS configuration is needed;
 *   - downloads are a redirect to a short-lived presigned URL, so the file
 *     comes from the bucket (free egress) and not through the app.
 */

const pick = (...names: string[]) => {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
};

export interface StorageConfig {
  bucket: string;
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export function getStorageConfig(): StorageConfig | null {
  const bucket = pick("S3_BUCKET", "BUCKET");
  const endpoint = pick("S3_ENDPOINT", "ENDPOINT", "AWS_ENDPOINT_URL_S3");
  const accessKeyId = pick("S3_ACCESS_KEY_ID", "ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID");
  const secretAccessKey = pick(
    "S3_SECRET_ACCESS_KEY",
    "SECRET_ACCESS_KEY",
    "AWS_SECRET_ACCESS_KEY",
  );
  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey) return null;

  return {
    bucket,
    endpoint,
    region: pick("S3_REGION", "REGION", "AWS_REGION") ?? "auto",
    accessKeyId,
    secretAccessKey,
  };
}

export function isStorageConfigured(): boolean {
  return getStorageConfig() !== null;
}

const globalForS3 = globalThis as unknown as { __hrosS3?: S3Client };

function client(): { s3: S3Client; bucket: string } {
  const config = getStorageConfig();
  if (!config) {
    throw new Error(
      "Object storage is not configured. Set BUCKET, ENDPOINT, ACCESS_KEY_ID and " +
        "SECRET_ACCESS_KEY (Railway provides these when you reference a Bucket).",
    );
  }

  const s3 =
    globalForS3.__hrosS3 ??
    new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  if (process.env.NODE_ENV !== "production") globalForS3.__hrosS3 = s3;

  return { s3, bucket: config.bucket };
}

/** Key prefixes the app is allowed to read or write. */
export const STORAGE_PREFIXES = ["resumes", "client-logos"] as const;
export type StoragePrefix = (typeof STORAGE_PREFIXES)[number];

export function isAllowedKey(key: string): key is string {
  if (!key || key.includes("..") || key.startsWith("/")) return false;
  return STORAGE_PREFIXES.some((prefix) => key.startsWith(`${prefix}/`));
}

/** Strip anything that would make a key awkward to handle or read back. */
export function sanitizeFileName(name: string): string {
  const cleaned = name
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.\-]+/, "")
    .slice(-120);
  return cleaned || `file-${randomUUID().slice(0, 8)}`;
}

export async function putObject(
  key: string,
  body: Buffer,
  contentType: string | undefined,
): Promise<void> {
  const { s3, bucket } = client();
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType || "application/octet-stream",
      // Uploaded files are user content: never let a browser decide to run them.
      ContentDisposition: "attachment",
    }),
  );
}

export async function presignGetUrl(key: string, expiresInSeconds = 300): Promise<string> {
  const { s3, bucket } = client();
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: expiresInSeconds,
  });
}

export async function deleteObject(key: string): Promise<void> {
  const { s3, bucket } = client();
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/** The in-app URL that resolves an object key to its file. */
export function fileUrl(key: string): string {
  return `/api/files/${key.split("/").map(encodeURIComponent).join("/")}`;
}
