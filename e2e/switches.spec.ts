import { test, expect } from "@playwright/test";

test.describe("Switches Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/switches");
  });

  test("should display switches list", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Switches");
  });

  test("should show switch status indicators", async ({ page }) => {
    // Look for status badges
    const statusBadge = page.getByText("Online").or(page.getByText("Offline"));
    await expect(statusBadge.first()).toBeVisible();
  });

  test("should display port information", async ({ page }) => {
    // Should show port counts
    await expect(page.getByText(/\d+\s*[Pp]orts?/).first()).toBeVisible();
  });

  test("should navigate to switch detail page", async ({ page }) => {
    // Click on a switch link
    const switchLink = page.locator("a[href^='/switches/']").first();
    const hasSwitchLink = (await switchLink.count()) > 0;

    if (hasSwitchLink) {
      await switchLink.click();
      await expect(page).toHaveURL(/\/switches\/.+/);
    }
  });
});

test.describe("Switch Detail Page", () => {
  test("should display switch name and back link", async ({ page }) => {
    await page.goto("/switches");
    const switchLink = page.locator("a[href^='/switches/']").first();
    const hasSwitchLink = (await switchLink.count()) > 0;
    if (hasSwitchLink) {
      await switchLink.click();
      await expect(page).toHaveURL(/\/switches\/.+/);
      await expect(page.getByText("Back to Switches")).toBeVisible();
    }
  });

  test("should show port status grid or table", async ({ page }) => {
    await page.goto("/switches");
    const switchLink = page.locator("a[href^='/switches/']").first();
    const hasSwitchLink = (await switchLink.count()) > 0;
    if (hasSwitchLink) {
      await switchLink.click();
      await expect(page.getByText(/[Pp]ort/).first()).toBeVisible();
    }
  });

  test("should display uplink/downlink information", async ({ page }) => {
    await page.goto("/switches");
    const switchLink = page.locator("a[href^='/switches/']").first();
    const hasSwitchLink = (await switchLink.count()) > 0;
    if (hasSwitchLink) {
      await switchLink.click();
      const linkInfo = page.getByText(/Uplink|TX|RX/);
      await expect(linkInfo.first()).toBeVisible();
    }
  });

  test("should navigate to port detail on click", async ({ page }) => {
    await page.goto("/switches");
    const switchLink = page.locator("a[href^='/switches/']").first();
    const hasSwitchLink = (await switchLink.count()) > 0;
    if (hasSwitchLink) {
      await switchLink.click();
      const portLink = page.locator("a[href*='/ports/']").first();
      const hasPortLink = (await portLink.count()) > 0;
      if (hasPortLink) {
        await portLink.click();
        await expect(page).toHaveURL(/\/ports\/.+/);
      }
    }
  });
});

test.describe("Port Detail Page", () => {
  test("should display port information", async ({ page }) => {
    // Navigate through switches to a port
    await page.goto("/switches");
    const switchLink = page.locator("a[href^='/switches/']").first();
    const hasSwitchLink = (await switchLink.count()) > 0;

    if (hasSwitchLink) {
      await switchLink.click();
      await expect(page).toHaveURL(/\/switches\/.+/);

      // Try to navigate to a port detail
      const portLink = page.locator("a[href*='/ports/']").first();
      const portLinkExists = (await portLink.count()) > 0;

      if (portLinkExists) {
        await portLink.click();
        await expect(page).toHaveURL(/\/ports\/.+/);
        await expect(page.getByText(/Back to/).first()).toBeVisible();
      }
    }
  });

  test("should show TX/RX statistics", async ({ page }) => {
    await page.goto("/switches");
    const switchLink = page.locator("a[href^='/switches/']").first();
    const hasSwitchLink = (await switchLink.count()) > 0;

    if (hasSwitchLink) {
      await switchLink.click();

      const portLink = page.locator("a[href*='/ports/']").first();
      const portLinkExists = (await portLink.count()) > 0;

      if (portLinkExists) {
        await portLink.click();
        await expect(page.getByText(/TX|RX/).first()).toBeVisible();
      }
    }
  });
});
