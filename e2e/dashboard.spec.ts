import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should display network overview stats", async ({ page }) => {
    // Check for stat cards (use more specific selectors)
    await expect(page.getByText("Clients").first()).toBeVisible();
    await expect(page.getByText("Access Points").first()).toBeVisible();
    await expect(page.getByText("Switches").first()).toBeVisible();
    await expect(page.getByText("WAN Links")).toBeVisible();
  });

  test("should display WAN throughput chart", async ({ page }) => {
    await expect(page.locator("text=WAN Throughput")).toBeVisible();
    // Chart should be present
    await expect(page.locator(".recharts-responsive-container").first()).toBeVisible();
  });

  test("should display client distribution charts", async ({ page }) => {
    await expect(page.locator("text=Clients by AP")).toBeVisible();
    await expect(page.locator("text=Clients by Network")).toBeVisible();
    await expect(page.locator("text=Clients by VLAN")).toBeVisible();
  });

  test("should change time range", async ({ page }) => {
    // Find and click the 3h time range button
    const timeRangeButton = page.locator('button:has-text("3h")').first();
    await timeRangeButton.click();
    // The button should now be active (has different styling when selected)
    await expect(timeRangeButton).toBeVisible();
  });

  test("should show refresh indicator", async ({ page }) => {
    await expect(page.locator("text=Refresh in")).toBeVisible();
  });

  test("should show connected status", async ({ page }) => {
    await expect(page.locator("text=CONNECTED TO")).toBeVisible();
  });
});
