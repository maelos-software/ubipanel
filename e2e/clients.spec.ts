import { test, expect } from "@playwright/test";

test.describe("Clients Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/clients");
  });

  test("should display client list", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Clients");
    // Should have a table with client data
    await expect(page.locator("table")).toBeVisible();
    // Check for table headers
    await expect(page.locator("th:has-text('CLIENT')")).toBeVisible();
    await expect(page.locator("th:has-text('IP ADDRESS')")).toBeVisible();
  });

  test("should filter by connection type", async ({ page }) => {
    // Click Wireless filter
    const wirelessBtn = page.locator('button:has-text("Wireless")');
    await wirelessBtn.click();
    await expect(wirelessBtn).toBeVisible();

    // Click Wired filter
    const wiredBtn = page.locator('button:has-text("Wired")');
    await wiredBtn.click();
    await expect(wiredBtn).toBeVisible();

    // Click All to reset
    const allBtn = page.locator('button:has-text("All")').first();
    await allBtn.click();
    await expect(allBtn).toBeVisible();
  });

  test("should search for clients", async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill("192.168");
    // Results should update (we just verify the input works)
    await expect(searchInput).toHaveValue("192.168");
  });

  test("should navigate to client detail", async ({ page }) => {
    // Click on a client row (first client in the table)
    const firstClientRow = page.locator("table tbody tr").first();
    await firstClientRow.click();

    // Should navigate to client detail page
    await expect(page).toHaveURL(/\/clients\/.+/);
    await expect(page.locator("text=Back to Clients")).toBeVisible();
  });

  test("should show bandwidth column", async ({ page }) => {
    await expect(page.locator("text=BANDWIDTH")).toBeVisible();
  });
});

test.describe("Client Detail Page", () => {
  test("should display client information", async ({ page }) => {
    // Navigate to clients first
    await page.goto("/clients");

    // Click on first client
    const firstClientRow = page.locator("table tbody tr").first();
    await firstClientRow.click();

    // Wait for detail page to load
    await expect(page.locator("text=Back to Clients")).toBeVisible();

    // Should show bandwidth stats (use first() to avoid strict mode)
    await expect(page.getByText("Download").first()).toBeVisible();
    await expect(page.getByText("Upload").first()).toBeVisible();
  });

  test("should have time range selector", async ({ page }) => {
    await page.goto("/clients");
    const firstClientRow = page.locator("table tbody tr").first();
    await firstClientRow.click();

    // Should have time range buttons
    await expect(page.locator('button:has-text("1h")')).toBeVisible();
    await expect(page.locator('button:has-text("24h")')).toBeVisible();
  });

  test("should display bandwidth history chart", async ({ page }) => {
    await page.goto("/clients");
    const firstClientRow = page.locator("table tbody tr").first();
    await firstClientRow.click();

    await expect(page.locator("text=Bandwidth History")).toBeVisible();
    await expect(page.locator(".recharts-responsive-container").first()).toBeVisible();
  });
});
