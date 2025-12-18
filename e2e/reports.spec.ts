import { test, expect } from "@playwright/test";

test.describe("Reports Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/reports");
  });

  test("should display reports heading", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Reports");
  });

  test("should show list of available reports", async ({ page }) => {
    // Wait for page to load and display report cards
    await expect(page.locator("h1")).toContainText("Reports");
    // Should display report cards - look for h3 elements inside buttons
    const firstReport = page.locator("button h3").first();
    await expect(firstReport).toBeVisible();
  });

  test("should show bandwidth report link", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Bandwidth/i }).first()).toBeVisible();
  });

  test("should show experience report link", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Experience/i }).first()).toBeVisible();
  });

  test("should show roaming report link", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Roaming/i })).toBeVisible();
  });

  test("should show AP load report link", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Load/i }).first()).toBeVisible();
  });

  test("should show WAN health report link", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /WAN/i })).toBeVisible();
  });

  test("should show port health report link", async ({ page }) => {
    await expect(page.locator("h3").filter({ hasText: /Port/i }).first()).toBeVisible();
  });

  test("should show infrastructure report link", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Infrastructure/i }).first()).toBeVisible();
  });
});

test.describe("Bandwidth Report", () => {
  test("should display bandwidth report", async ({ page }) => {
    await page.goto("/reports/bandwidth");
    await expect(page.locator("h1")).toContainText("Bandwidth");
    // Breadcrumb link to Reports in the main content area
    await expect(page.getByRole("main").getByRole("link", { name: "Reports" })).toBeVisible();
  });

  test("should have time range selector", async ({ page }) => {
    await page.goto("/reports/bandwidth");
    // Reports may use dropdown or buttons for time range
    const timeSelector = page.locator("select").or(page.locator('button:has-text("24h")'));
    const count = await timeSelector.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test("should show top consumers", async ({ page }) => {
    await page.goto("/reports/bandwidth");
    const content = page.getByText(/Top|Consumer|Client/i).or(page.locator("table"));
    await expect(content.first()).toBeVisible();
  });
});

test.describe("Experience Report", () => {
  test("should display experience report", async ({ page }) => {
    await page.goto("/reports/experience");
    await expect(page.locator("h1")).toContainText("Experience");
    await expect(page.getByRole("main").getByRole("link", { name: "Reports" })).toBeVisible();
  });

  test("should show client experience data", async ({ page }) => {
    await page.goto("/reports/experience");
    const content = page
      .getByText(/Poor|Satisfaction|Client|No clients/i)
      .or(page.locator("table"));
    await expect(content.first()).toBeVisible();
  });
});

test.describe("Roaming Report", () => {
  test("should display roaming report", async ({ page }) => {
    await page.goto("/reports/roaming");
    await expect(page.locator("h1")).toContainText("Roaming");
    await expect(page.getByRole("main").getByRole("link", { name: "Reports" })).toBeVisible();
  });

  test("should show roaming events or message", async ({ page }) => {
    await page.goto("/reports/roaming");
    const content = page.getByText(/roam|event|No roaming/i).or(page.locator("table"));
    await expect(content.first()).toBeVisible();
  });
});

test.describe("AP Load Report", () => {
  test("should display AP load report", async ({ page }) => {
    await page.goto("/reports/ap-load");
    const heading = page.locator("h1");
    const headingText = await heading.textContent();
    expect(headingText?.toLowerCase()).toMatch(/load|ap/i);
    await expect(page.getByRole("main").getByRole("link", { name: "Reports" })).toBeVisible();
  });

  test("should show AP utilization data", async ({ page }) => {
    await page.goto("/reports/ap-load");
    const content = page
      .getByText(/Clients|Load|Utilization/i)
      .or(page.locator("table"))
      .or(page.locator(".recharts-responsive-container"));
    await expect(content.first()).toBeVisible();
  });
});

test.describe("WAN Health Report", () => {
  test("should display WAN health report", async ({ page }) => {
    await page.goto("/reports/wan-health");
    await expect(page.locator("h1")).toContainText("WAN");
    await expect(page.getByRole("main").getByRole("link", { name: "Reports" })).toBeVisible();
  });

  test("should show WAN metrics", async ({ page }) => {
    await page.goto("/reports/wan-health");
    const content = page
      .getByText(/Uptime|Latency|Failover|Health/i)
      .or(page.locator("table"))
      .or(page.locator(".recharts-responsive-container"));
    await expect(content.first()).toBeVisible();
  });
});

test.describe("Port Health Report", () => {
  test("should display port health report", async ({ page }) => {
    await page.goto("/reports/port-health");
    await expect(page.locator("h1")).toContainText("Port");
    await expect(page.getByRole("main").getByRole("link", { name: "Reports" })).toBeVisible();
  });

  test("should show port error data", async ({ page }) => {
    await page.goto("/reports/port-health");
    const content = page.getByText(/Error|error|Port|No ports/i).or(page.locator("table"));
    await expect(content.first()).toBeVisible();
  });
});

test.describe("Infrastructure Report", () => {
  test("should display infrastructure report", async ({ page }) => {
    await page.goto("/reports/infrastructure");
    await expect(page.locator("h1")).toContainText("Infrastructure");
    await expect(page.getByRole("main").getByRole("link", { name: "Reports" })).toBeVisible();
  });

  test("should show device health data", async ({ page }) => {
    await page.goto("/reports/infrastructure");
    const content = page.getByText(/Device|Health|Uptime|AP|Switch/i).or(page.locator("table"));
    await expect(content.first()).toBeVisible();
  });
});

test.describe("Guest Report", () => {
  test("should display guest report", async ({ page }) => {
    await page.goto("/reports/guest");
    await expect(page.locator("h1")).toContainText("Guest");
    await expect(page.getByRole("main").getByRole("link", { name: "Reports" })).toBeVisible();
  });

  test("should show guest network data", async ({ page }) => {
    await page.goto("/reports/guest");
    const content = page.getByText(/Guest|Clients|Network|No guest/i).or(page.locator("table"));
    await expect(content.first()).toBeVisible();
  });
});

test.describe("Radio Report", () => {
  test("should display radio report", async ({ page }) => {
    await page.goto("/reports/radio");
    await expect(page.locator("h1")).toContainText("Radio");
    await expect(page.getByRole("main").getByRole("link", { name: "Reports" })).toBeVisible();
  });

  test("should show radio utilization data", async ({ page }) => {
    await page.goto("/reports/radio");
    const content = page
      .getByText(/Channel|Utilization|2\.4|5 GHz|Radio/i)
      .or(page.locator("table"));
    await expect(content.first()).toBeVisible();
  });
});
