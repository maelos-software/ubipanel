import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("should load the dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Network Overview");
    await expect(page.locator(".sidebar-gradient")).toBeVisible();
  });

  test("should navigate to clients page", async ({ page }) => {
    await page.goto("/");
    await page.click('a[href="/clients"]');
    await expect(page).toHaveURL("/clients");
    await expect(page.locator("h1")).toContainText("Clients");
  });

  test("should navigate to access points page", async ({ page }) => {
    await page.goto("/");
    await page.click('a[href="/access-points"]');
    await expect(page).toHaveURL("/access-points");
    await expect(page.locator("h1")).toContainText("Access Points");
  });

  test("should navigate to switches page", async ({ page }) => {
    await page.goto("/");
    await page.click('a[href="/switches"]');
    await expect(page).toHaveURL("/switches");
    await expect(page.locator("h1")).toContainText("Switches");
  });

  test("should navigate to gateway page", async ({ page }) => {
    await page.goto("/");
    await page.click('a[href="/gateway"]');
    await expect(page).toHaveURL("/gateway");
    await expect(page.locator("h1")).toContainText("Gateway");
  });

  test("should navigate to events page", async ({ page }) => {
    await page.goto("/");
    await page.click('a[href="/events"]');
    await expect(page).toHaveURL("/events");
    await expect(page.locator("h1")).toContainText("Events");
  });

  test("should navigate to reports page", async ({ page }) => {
    await page.goto("/");
    await page.click('a[href="/reports"]');
    await expect(page).toHaveURL("/reports");
    await expect(page.locator("h1")).toContainText("Reports");
  });

  test("should toggle sidebar collapse", async ({ page }) => {
    await page.goto("/");
    // Sidebar should be visible initially with nav labels
    const dashboardLink = page.locator('a[href="/"]', { hasText: "Dashboard" });
    await expect(dashboardLink).toBeVisible();

    // Click collapse button (aria-label is "Collapse sidebar" when expanded)
    await page.click('button[aria-label="Collapse sidebar"]');

    // Wait for collapse animation
    await page.waitForTimeout(350);

    // In collapsed state, the text "Dashboard" should not be visible in the nav
    // The link still exists but only shows the icon
    const sidebarText = page.locator("aside nav >> text=Dashboard");
    await expect(sidebarText).toBeHidden();

    // Click expand button to restore
    await page.click('button[aria-label="Expand sidebar"]');
    await page.waitForTimeout(350);

    // Text should be visible again
    await expect(dashboardLink).toBeVisible();
  });
});
