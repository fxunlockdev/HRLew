import { test, expect } from "@playwright/test";

/**
 * Round-trips a file through object storage: upload via /api/uploads, then
 * download through /api/files, which must redirect to a presigned bucket URL.
 *
 * Needs an instance with a bucket configured, so it is opt-in:
 *
 *   E2E_STORAGE=1 E2E_EMAIL=... E2E_PASSWORD=... \
 *   PLAYWRIGHT_BASE_URL=https://your-app.up.railway.app CI=1 npm run test:e2e
 */

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe("Object storage", () => {
  test.skip(
    process.env.E2E_STORAGE !== "1" || !email || !password,
    "Set E2E_STORAGE=1 plus credentials, against an instance with a bucket.",
  );

  test("a resume round-trips through the bucket", async ({ page, baseURL }) => {
    test.setTimeout(120_000);

    await page.goto("/auth/login");
    await page.getByLabel(/work email/i).fill(email!);
    await page.getByLabel(/password/i).fill(password!);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/candidates/new");
    const stamp = Date.now();
    await page.locator('input[name="full_name"]').fill(`Upload Check ${stamp}`);
    await page.getByRole("button", { name: /Create candidate/i }).click();
    await expect(page).toHaveURL(/\/candidates\/[0-9a-f-]+/);

    await page.getByRole("tab", { name: /resume/i }).click();
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");
    await page.locator('input[type="file"]').setInputFiles({
      name: "upload-check.pdf",
      mimeType: "application/pdf",
      buffer: pdf,
    });

    await expect(page.getByText("upload-check.pdf")).toBeVisible({ timeout: 30_000 });

    const href = await page.getByRole("link", { name: /download/i }).first().getAttribute("href");
    expect(href).toMatch(/^\/api\/files\/resumes\//);

    // The app authorises, then hands off to the bucket — it never proxies bytes.
    const redirect = await page.request.get(`${baseURL}${href}`, { maxRedirects: 0 });
    expect(redirect.status()).toBe(302);
    const signed = redirect.headers()["location"];
    expect(signed).toContain("X-Amz-Signature");

    const file = await page.request.get(signed);
    expect(file.status()).toBe(200);
    expect(await file.body()).toEqual(pdf);
  });
});
