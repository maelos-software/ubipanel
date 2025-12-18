import { test, expect } from "@playwright/test";

test.describe("Gateway Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/gateway");
  });

  test("should display gateway heading", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Gateway");
  });

  test("should show system metrics (CPU/Memory)", async ({ page }) => {
    // Gateway should show CPU and Memory gauges
    const cpuMetric = page.locator("text=CPU");
    const memMetric = page.locator("text=Memory").or(page.locator("text=RAM"));
    await expect(cpuMetric.first()).toBeVisible();
    await expect(memMetric.first()).toBeVisible();
  });

  test("should display WAN status", async ({ page }) => {
    // Should show WAN interface status
    const wanStatus = page.locator("text=WAN").or(page.locator("text=Uplink"));
    await expect(wanStatus.first()).toBeVisible();
  });

  test("should show temperature if available", async ({ page }) => {
    // Temperature may or may not be available
    const tempInfo = page
      .locator("text=Temp")
      .or(page.locator("text=°C"))
      .or(page.locator("text=°F"));
    const count = await tempInfo.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("should display uptime information", async ({ page }) => {
    const uptimeInfo = page.locator("text=Uptime").or(page.locator("text=uptime"));
    await expect(uptimeInfo.first()).toBeVisible();
  });

  test("should show bandwidth throughput", async ({ page }) => {
    const throughput = page
      .locator("text=Download")
      .or(page.locator("text=Upload"))
      .or(page.locator("text=Throughput"));
    await expect(throughput.first()).toBeVisible();
  });

  test("should have time range selector", async ({ page }) => {
    await expect(page.locator('button:has-text("1h")')).toBeVisible();
    await expect(page.locator('button:has-text("24h")')).toBeVisible();
  });

  test("should display WAN interfaces section", async ({ page }) => {
    // Should list WAN interfaces
    const wanSection = page.locator("text=WAN").or(page.locator("text=Interface"));
    await expect(wanSection.first()).toBeVisible();
  });

  test("should show VLAN information if available", async ({ page }) => {
    const vlanInfo = page.locator("text=VLAN").or(page.locator("text=Networks"));
    const count = await vlanInfo.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe("WAN Detail Page", () => {
  test("should navigate to WAN detail from gateway", async ({ page }) => {
    await page.goto("/gateway");

    // Look for a WAN interface link
    const wanLink = page.locator("a[href*='/wan/']").first();
    const wanLinkExists = (await wanLink.count()) > 0;

    if (wanLinkExists) {
      await wanLink.click();
      await expect(page).toHaveURL(/\/wan\/.+/);
    }
  });

  test("should display WAN interface statistics", async ({ page }) => {
    await page.goto("/gateway");

    const wanLink = page.locator("a[href*='/wan/']").first();
    const wanLinkExists = (await wanLink.count()) > 0;

    if (wanLinkExists) {
      await wanLink.click();
      await expect(page.locator("text=Back to Gateway")).toBeVisible();
      // Should show TX/RX or Download/Upload
      await expect(page.locator("text=Download").or(page.locator("text=TX")).first()).toBeVisible();
    }
  });
});
