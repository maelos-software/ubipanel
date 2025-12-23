import { chromium } from "@playwright/test";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
  });
  const page = await context.newPage();

  // Helper to enable dark mode in localStorage
  async function enableDarkMode() {
    await page.evaluate(() => {
      localStorage.setItem(
        "ubipanel-preferences",
        JSON.stringify({
          theme: "dark",
          refreshInterval: 30000,
          defaultTimeRange: "1h",
          density: "comfortable",
          clientListView: "detailed",
        })
      );
    });
    await page.reload();
  }

  console.log("Verifying Applications page...");
  await page.goto("http://localhost:4820/applications");
  await enableDarkMode();
  await page.waitForTimeout(2000); // Wait for charts to render
  await page.screenshot({ path: "debug-apps-dark.png" });

  console.log("Verifying Access Points page...");
  await page.goto("http://localhost:4820/access-points");
  await page.waitForTimeout(2000);
  await page.screenshot({ path: "debug-aps-dark.png" });

  console.log("Verifying Radio Report page...");
  await page.goto("http://localhost:4820/reports/radio");
  await page.waitForTimeout(2000);

  // Hover over a bar in the "5GHz Channel Utilization" chart
  const bar = await page.locator(".recharts-bar-rectangle").first();
  if ((await bar.count()) > 0) {
    await bar.hover();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "debug-radio-report-hover.png" });
  }

  await browser.close();
}

run().catch(console.error);
