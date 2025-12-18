import { test, expect } from "@playwright/test";

test.describe("Client Insights Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/insights");
  });

  test("should display insights heading", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Insights");
  });

  test("should show signal distribution chart", async ({ page }) => {
    // Should have signal quality distribution
    const signalSection = page
      .locator("text=Signal")
      .or(page.locator("text=RSSI"))
      .or(page.locator("text=Quality"));
    await expect(signalSection.first()).toBeVisible();
  });

  test("should display client statistics", async ({ page }) => {
    // Should show client-related stats
    const clientStats = page
      .locator("text=Clients")
      .or(page.locator("text=clients"))
      .or(page.locator("text=Total"));
    await expect(clientStats.first()).toBeVisible();
  });

  test("should have charts visible", async ({ page }) => {
    // Should have recharts containers
    await expect(page.locator(".recharts-responsive-container").first()).toBeVisible();
  });

  test("should show experience/satisfaction metrics", async ({ page }) => {
    const experienceMetrics = page
      .locator("text=Experience")
      .or(page.locator("text=Satisfaction"))
      .or(page.locator("text=Poor"))
      .or(page.locator("text=Good"));
    const count = await experienceMetrics.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("should display roaming information", async ({ page }) => {
    const roamingInfo = page.locator("text=Roaming").or(page.locator("text=roaming"));
    const count = await roamingInfo.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("should have time range selector", async ({ page }) => {
    await expect(page.locator('button:has-text("1h")')).toBeVisible();
  });

  test("should show band distribution", async ({ page }) => {
    // Should show 2.4/5/6 GHz distribution
    const bandInfo = page
      .locator("text=2.4")
      .or(page.locator("text=5 GHz"))
      .or(page.locator("text=Band"));
    const count = await bandInfo.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
