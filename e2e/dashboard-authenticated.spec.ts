import { test, expect } from "@playwright/test";

/**
 * Authenticated journey tests. These rely on a pre-seeded admin session via
 * a storage state file. To run them locally:
 *
 *   1. Run the app against a real Supabase project with at least one approved user
 *   2. Sign in once and save state:
 *        npx playwright codegen --save-storage=e2e/.auth/admin.json
 *   3. Set PLAYWRIGHT_STORAGE_STATE=e2e/.auth/admin.json
 *   4. npm run test:e2e
 *
 * They are tagged so they can be skipped in CI when no storage state is set.
 */

const storageState = process.env.PLAYWRIGHT_STORAGE_STATE;

test.describe("Authenticated dashboard", () => {
  test.skip(!storageState, "Set PLAYWRIGHT_STORAGE_STATE to run these tests.");
  test.use({ storageState: storageState ?? "ignored" });

  test("dashboard renders KPI cards", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/Active candidates/i)).toBeVisible();
    await expect(page.getByText(/Open requirements/i)).toBeVisible();
    await expect(page.getByText(/In pipeline/i)).toBeVisible();
  });

  test("candidates list page loads", async ({ page }) => {
    await page.goto("/candidates");
    await expect(page.getByRole("heading", { name: /Candidates/i })).toBeVisible();
  });

  test("can create a candidate", async ({ page }) => {
    await page.goto("/candidates/new");
    const stamp = Date.now();
    await page.getByLabel(/Full name/i).fill(`E2E Test ${stamp}`);
    await page.getByLabel(/Email/i).fill(`e2e+${stamp}@example.com`);
    await page.getByRole("button", { name: /Create candidate/i }).click();
    await expect(page).toHaveURL(/\/candidates\/[0-9a-f-]+/);
    await expect(page.getByText(`E2E Test ${stamp}`)).toBeVisible();
  });

  test("pipeline page loads Kanban", async ({ page }) => {
    await page.goto("/pipeline");
    await expect(page.getByRole("heading", { name: /Pipeline/i })).toBeVisible();
  });
});
