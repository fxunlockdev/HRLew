import { test, expect } from "@playwright/test";

/**
 * Smoke tests that don't require Supabase credentials. They verify the public
 * surfaces (login, health endpoint) and assert basic redirect behavior.
 */

test.describe("Public surfaces", () => {
  test("/api/health returns 200 with status ok", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.name).toBe("hrlew");
  });

  test("root redirects to /auth/login when unauthenticated", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByText("Continue with Google")).toBeVisible();
  });

  test("login page renders the Google CTA", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.getByText("Welcome to HRLew")).toBeVisible();
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
  });

  test("any protected route bounces to login with ?next= param", async ({ page }) => {
    await page.goto("/candidates");
    await expect(page).toHaveURL(/\/auth\/login\?next=%2Fcandidates/);
  });
});

test.describe("Auth callback error handling", () => {
  test("missing code parameter still redirects gracefully", async ({ page }) => {
    await page.goto("/auth/callback");
    // Redirected to dashboard (will then bounce to login since no session)
    await expect(page).toHaveURL(/\/(auth\/login|dashboard)/);
  });
});
