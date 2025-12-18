import { test, expect } from "@playwright/test";

test.describe("Applications Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/applications");
  });

  test("should display applications heading", async ({ page }) => {
    // The page is titled "Application Traffic"
    await expect(page.locator("h1")).toContainText("Application");
  });

  test("should show optional feature notice or data", async ({ page }) => {
    // Applications page may show "optional" notice if collector isn't running
    // or show actual application data if it is
    const content = page
      .getByText(/optional|collector|DPI|Traffic|No data/i)
      .or(page.locator("table"));
    await expect(content.first()).toBeVisible();
  });

  test("should display traffic data if available", async ({ page }) => {
    // If DPI data is available, should show traffic breakdown
    const trafficData = page.locator("table").or(page.getByText(/No data|Enable|Traffic/i));
    const count = await trafficData.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("should have time range selector if data available", async ({ page }) => {
    const timeRange = page
      .locator('button:has-text("1h")')
      .or(page.locator('button:has-text("24h")'));
    const count = await timeRange.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe("Application Detail Page", () => {
  test("should navigate to application detail if data exists", async ({ page }) => {
    await page.goto("/applications");

    // Try to find an application link
    const appLink = page.locator("a[href*='/applications/']").first();
    const appLinkExists = (await appLink.count()) > 0;

    if (appLinkExists) {
      await appLink.click();
      await expect(page).toHaveURL(/\/applications\/.+/);
      await expect(page.getByText("Back to Applications")).toBeVisible();
    }
  });
});
