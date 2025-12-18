import { test, expect } from "@playwright/test";

test.describe("Access Points Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/access-points");
  });

  test("should display access points list", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Access Points");
  });

  test("should show AP status indicators", async ({ page }) => {
    // Look for status badges (Online/Offline)
    const statusBadge = page.getByText("Online").or(page.getByText("Offline"));
    await expect(statusBadge.first()).toBeVisible();
  });

  test("should display radio band information", async ({ page }) => {
    // APs should show radio bands (2.4/5/6 GHz) or Radio text
    const radioBand = page.getByText(/2\.4|5\s*GHz|6\s*GHz|Radio/i);
    await expect(radioBand.first()).toBeVisible();
  });

  test("should show client counts", async ({ page }) => {
    // Should display client count per AP - look for numbers with "clients" nearby
    await expect(page.getByText(/\d+\s*(clients|Clients)/).first()).toBeVisible();
  });

  test("should navigate to AP detail page", async ({ page }) => {
    // Click on an AP link (look for links to /access-points/)
    const apLink = page.locator("a[href^='/access-points/']").first();
    const hasApLink = (await apLink.count()) > 0;

    if (hasApLink) {
      await apLink.click();
      await expect(page).toHaveURL(/\/access-points\/.+/);
    }
  });

  test("should have time range selector", async ({ page }) => {
    await expect(page.locator('button:has-text("1h")')).toBeVisible();
    await expect(page.locator('button:has-text("24h")')).toBeVisible();
  });
});

test.describe("Access Point Detail Page", () => {
  test("should display AP name and back link", async ({ page }) => {
    await page.goto("/access-points");
    const apLink = page.locator("a[href^='/access-points/']").first();
    const hasApLink = (await apLink.count()) > 0;
    if (hasApLink) {
      await apLink.click();
      await expect(page).toHaveURL(/\/access-points\/.+/);
      await expect(page.getByText("Back to Access Points")).toBeVisible();
    }
  });

  test("should show bandwidth stats", async ({ page }) => {
    await page.goto("/access-points");
    const apLink = page.locator("a[href^='/access-points/']").first();
    const hasApLink = (await apLink.count()) > 0;
    if (hasApLink) {
      await apLink.click();
      await expect(page.getByText("Download").first()).toBeVisible();
      await expect(page.getByText("Upload").first()).toBeVisible();
    }
  });

  test("should display connected clients section", async ({ page }) => {
    await page.goto("/access-points");
    const apLink = page.locator("a[href^='/access-points/']").first();
    const hasApLink = (await apLink.count()) > 0;
    if (hasApLink) {
      await apLink.click();
      await expect(page.getByRole("heading", { name: /Clients|Connected/ }).first()).toBeVisible();
    }
  });

  test("should show radio information", async ({ page }) => {
    await page.goto("/access-points");
    const apLink = page.locator("a[href^='/access-points/']").first();
    const hasApLink = (await apLink.count()) > 0;
    if (hasApLink) {
      await apLink.click();
      const radioInfo = page.getByText(/Channel|Radio|2\.4 GHz|5 GHz/i);
      await expect(radioInfo.first()).toBeVisible();
    }
  });

  test("should have bandwidth history chart", async ({ page }) => {
    await page.goto("/access-points");
    const apLink = page.locator("a[href^='/access-points/']").first();
    const hasApLink = (await apLink.count()) > 0;
    if (hasApLink) {
      await apLink.click();
      await expect(page.getByText("Bandwidth").first()).toBeVisible();
      await expect(page.locator(".recharts-responsive-container").first()).toBeVisible();
    }
  });

  test("should have time range selector", async ({ page }) => {
    await page.goto("/access-points");
    const apLink = page.locator("a[href^='/access-points/']").first();
    const hasApLink = (await apLink.count()) > 0;
    if (hasApLink) {
      await apLink.click();
      await expect(page.locator('button:has-text("1h")')).toBeVisible();
    }
  });
});
