import { test, expect } from "@playwright/test";

/**
 * Public surfaces. These need the app running against a migrated database,
 * but no credentials.
 */

test.describe("Public surfaces", () => {
  test("/api/health returns 200 with status ok", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.name).toBe("hr-os");
  });

  test("login page asks for email and password", async ({ page }) => {
    await page.goto("/auth/login");
    // A database with no accounts redirects to first-run setup instead.
    if (page.url().includes("/auth/setup")) {
      await expect(page.getByRole("button", { name: /create admin account/i })).toBeVisible();
      return;
    }
    await expect(page.getByText("Welcome to HROS")).toBeVisible();
    await expect(page.getByLabel(/work email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible();
  });

  test("a protected route bounces to login with ?next=", async ({ page }) => {
    await page.goto("/candidates");
    await expect(page).toHaveURL(/\/auth\/(login\?next=%2Fcandidates|setup)/);
  });

  test("wrong credentials give a generic error", async ({ page }) => {
    await page.goto("/auth/login");
    test.skip(page.url().includes("/auth/setup"), "Instance has no accounts yet.");

    await page.getByLabel(/work email/i).fill("nobody@example.com");
    await page.getByLabel(/password/i).fill("definitely-not-the-password");
    await page.getByRole("button", { name: /^sign in$/i }).click();

    // Generic on purpose: it must not reveal whether the account exists.
    // Scoped to the form, because Next's route announcer is also role="alert".
    await expect(
      page.locator("form p[role=alert]", { hasText: /email or password is incorrect/i }),
    ).toBeVisible();
  });
});

test.describe("API guards", () => {
  test("uploads reject anonymous callers", async ({ request }) => {
    const res = await request.post("/api/uploads", {
      multipart: {
        kind: "resume",
        candidate_id: "00000000-0000-0000-0000-000000000000",
        file: { name: "x.pdf", mimeType: "application/pdf", buffer: Buffer.from("x") },
      },
    });
    expect(res.status()).toBe(401);
  });

  test("file downloads reject anonymous callers", async ({ request }) => {
    const res = await request.get("/api/files/resumes/abc/def.pdf");
    expect(res.status()).toBe(401);
  });
});
