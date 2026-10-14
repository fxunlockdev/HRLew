import { test, expect } from "@playwright/test";

/**
 * Authenticated journeys. Point these at a migrated database and an account
 * that has already chosen its password:
 *
 *   E2E_EMAIL=admin@example.com E2E_PASSWORD=... npm run test:e2e
 *
 * They skip themselves when those are absent, so the smoke suite can run alone.
 */

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

test.describe("Authenticated dashboard", () => {
  test.skip(!email || !password, "Set E2E_EMAIL and E2E_PASSWORD to run these.");

  test.beforeEach(async ({ page }) => {
    await page.goto("/auth/login");
    await page.getByLabel(/work email/i).fill(email!);
    await page.getByLabel(/password/i).fill(password!);
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("dashboard renders KPI cards", async ({ page }) => {
    await expect(page.getByText(/Active candidates/i)).toBeVisible();
    await expect(page.getByText(/Open requirements/i)).toBeVisible();
    await expect(page.getByText(/In pipeline/i)).toBeVisible();
  });

  test("candidates list loads", async ({ page }) => {
    await page.goto("/candidates");
    await expect(page.getByRole("heading", { name: /Candidates/i })).toBeVisible();
  });

  test("can create a candidate", async ({ page }) => {
    await page.goto("/candidates/new");
    const stamp = Date.now();
    // Selected by field name: the forms render labels as text without an
    // htmlFor association, so getByLabel cannot see them (see README).
    await page.locator('input[name="full_name"]').fill(`E2E Test ${stamp}`);
    await page.locator('input[name="email"]').fill(`e2e+${stamp}@example.com`);
    await page.getByRole("button", { name: /Create candidate/i }).click();
    await expect(page).toHaveURL(/\/candidates\/[0-9a-f-]+/);
    await expect(page.getByRole("heading", { name: `E2E Test ${stamp}` })).toBeVisible();
  });

  test("pipeline kanban loads", async ({ page }) => {
    await page.goto("/pipeline");
    await expect(page.getByRole("heading", { name: /Pipeline/i })).toBeVisible();
  });

  test("an admin can provision and then delete a user", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/permissions");

    // This test creates its own subject, so it never deletes anyone real.
    const stamp = Date.now();
    const subject = `e2e.delete.${stamp}@example.test`;

    await page.getByRole("button", { name: /add user/i }).click();
    await page.locator('input[name="full_name"]').fill(`E2E Delete ${stamp}`);
    await page.locator('input[name="email"]').fill(subject);
    await page.getByRole("button", { name: /create user/i }).click();

    // Provisioning shows the one-time password and the user appears in the table.
    await expect(page.getByText(/temporary password issued/i)).toBeVisible();
    const row = page.locator("tr", { hasText: subject });
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: /delete/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(new RegExp(`Delete E2E Delete ${stamp}`))).toBeVisible();

    // A brand-new user owns nothing, so no reassignment is required.
    await expect(dialog.getByText(/do not own any records/i)).toBeVisible();
    await dialog.getByRole("button", { name: /delete user/i }).click();

    await expect(page.locator("tr", { hasText: subject })).toHaveCount(0);
  });

  test("an admin cannot delete their own account", async ({ page }) => {
    await page.goto("/permissions");
    const ownRow = page.locator("tr", { hasText: email! });
    await expect(ownRow).toBeVisible();
    await expect(ownRow.getByRole("button", { name: /delete/i })).toHaveCount(0);
  });

  test("signing out ends the session", async ({ page }) => {
    await page.goto("/dashboard");
    await page.locator("header button").last().click();
    await page.getByRole("button", { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/auth\/login/);

    // The cookie is gone, so a protected route bounces again.
    await page.goto("/candidates");
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
