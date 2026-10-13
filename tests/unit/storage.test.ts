import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  fileUrl,
  getStorageConfig,
  isAllowedKey,
  isStorageConfigured,
  sanitizeFileName,
} from "@/lib/storage";

const BUCKET_VARS = [
  "S3_BUCKET",
  "BUCKET",
  "S3_ENDPOINT",
  "ENDPOINT",
  "AWS_ENDPOINT_URL_S3",
  "S3_ACCESS_KEY_ID",
  "ACCESS_KEY_ID",
  "AWS_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "SECRET_ACCESS_KEY",
  "AWS_SECRET_ACCESS_KEY",
  "S3_REGION",
  "REGION",
  "AWS_REGION",
];

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(BUCKET_VARS.map((k) => [k, process.env[k]]));
  BUCKET_VARS.forEach((k) => delete process.env[k]);
});

afterEach(() => {
  BUCKET_VARS.forEach((k) => {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  });
});

describe("getStorageConfig", () => {
  it("reports unconfigured when nothing is set", () => {
    expect(getStorageConfig()).toBeNull();
    expect(isStorageConfigured()).toBe(false);
  });

  it("reads the variable names Railway injects for a Bucket", () => {
    process.env.BUCKET = "hros-assets-ab12cd";
    process.env.ENDPOINT = "https://t3.storageapi.dev";
    process.env.ACCESS_KEY_ID = "key";
    process.env.SECRET_ACCESS_KEY = "secret";
    expect(getStorageConfig()).toEqual({
      bucket: "hros-assets-ab12cd",
      endpoint: "https://t3.storageapi.dev",
      region: "auto",
      accessKeyId: "key",
      secretAccessKey: "secret",
    });
  });

  it("prefers S3_-prefixed names over the bare ones", () => {
    process.env.BUCKET = "bare";
    process.env.S3_BUCKET = "prefixed";
    process.env.ENDPOINT = "https://t3.storageapi.dev";
    process.env.ACCESS_KEY_ID = "key";
    process.env.SECRET_ACCESS_KEY = "secret";
    expect(getStorageConfig()?.bucket).toBe("prefixed");
  });

  it("stays unconfigured when only some variables are present", () => {
    process.env.BUCKET = "hros-assets";
    process.env.ENDPOINT = "https://t3.storageapi.dev";
    expect(getStorageConfig()).toBeNull();
  });
});

describe("isAllowedKey", () => {
  it("allows the two prefixes the app writes", () => {
    expect(isAllowedKey("resumes/abc/1700000000_cv.pdf")).toBe(true);
    expect(isAllowedKey("client-logos/acme/1700000000-acme.png")).toBe(true);
  });

  it("refuses traversal, absolute paths and unknown prefixes", () => {
    expect(isAllowedKey("../../etc/passwd")).toBe(false);
    expect(isAllowedKey("resumes/../../etc/passwd")).toBe(false);
    expect(isAllowedKey("/resumes/x")).toBe(false);
    expect(isAllowedKey("secrets/x")).toBe(false);
    expect(isAllowedKey("resumes")).toBe(false);
    expect(isAllowedKey("")).toBe(false);
  });
});

describe("sanitizeFileName", () => {
  it("keeps a readable name", () => {
    expect(sanitizeFileName("Aarav Mehta CV.pdf")).toBe("Aarav-Mehta-CV.pdf");
  });

  it("strips path separators so a name cannot escape its prefix", () => {
    expect(sanitizeFileName("../../etc/passwd")).not.toContain("/");
    expect(sanitizeFileName("../../etc/passwd")).not.toContain("..");
  });

  it("never returns an empty string", () => {
    expect(sanitizeFileName("...")).not.toBe("");
    expect(sanitizeFileName("###")).not.toBe("");
  });
});

describe("fileUrl", () => {
  it("builds an in-app URL and encodes each segment", () => {
    expect(fileUrl("resumes/abc/my cv.pdf")).toBe("/api/files/resumes/abc/my%20cv.pdf");
  });

  it("keeps the path separators intact", () => {
    expect(fileUrl("client-logos/acme/logo.png")).toBe("/api/files/client-logos/acme/logo.png");
  });
});
