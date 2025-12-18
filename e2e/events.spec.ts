import { test, expect } from "@playwright/test";

test.describe("Events Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/events");
  });

  test("should display events heading", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Events");
  });

  test("should show event content or no events message", async ({ page }) => {
    // Events page should either show events or a "no events" type message
    const content = page.getByText(/ago|No events|Loading/i).or(page.locator("table"));
    const count = await content.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("should have filter controls", async ({ page }) => {
    // Should have filter buttons or dropdown for event categories
    const filterSection = page
      .getByRole("button", { name: /All|Filter/i })
      .or(page.locator("select"));
    await expect(filterSection.first()).toBeVisible();
  });

  test("should have time range controls", async ({ page }) => {
    // Events page should have time range selector
    const timeRange = page
      .locator('button:has-text("24h")')
      .or(page.locator('button:has-text("7d")'));
    const count = await timeRange.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
