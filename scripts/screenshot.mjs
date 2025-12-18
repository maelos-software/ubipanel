#!/usr/bin/env node
/**
 * Screenshot Utility for UbiPanel
 *
 * Takes screenshots of dashboard pages for visual testing and debugging.
 * Uses Playwright to capture full-page screenshots with proper wait times.
 *
 * USAGE:
 *   node scripts/screenshot.mjs [options] [pages...]
 *
 * OPTIONS:
 *   --url <url>      Base URL (default: http://localhost:4820 or from env)
 *   --output <dir>   Output directory (default: ./tmp)
 *   --full           Take full-page screenshots (default: viewport only)
 *   --wait <ms>      Wait time after page load (default: 3000)
 *   --dark           Force dark mode
 *   --light          Force light mode
 *
 * PAGES:
 *   all              All pages (default if no pages specified)
 *   dashboard        Overview/Dashboard page
 *   clients          Clients list
 *   insights         Client Insights
 *   aps              Access Points list
 *   switches         Switches list
 *   gateway          Gateway page
 *   events           Events page
 *   reports          Reports index
 *   applications     Applications page
 *
 * EXAMPLES:
 *   # Screenshot all pages using local dev server
 *   node scripts/screenshot.mjs
 *
 *   # Screenshot specific pages
 *   node scripts/screenshot.mjs dashboard gateway
 *
 *   # Screenshot production server
 *   node scripts/screenshot.mjs --url http://192.168.8.21/dashboard
 *
 *   # Full page screenshots in dark mode
 *   node scripts/screenshot.mjs --full --dark insights
 *
 * ENVIRONMENT VARIABLES:
 *   SCREENSHOT_URL   Base URL for screenshots
 */

import { chromium } from "playwright";
import { mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

// Default configuration
const DEFAULT_URL = process.env.SCREENSHOT_URL || "http://localhost:4820";
const DEFAULT_OUTPUT = "./tmp";
const DEFAULT_WAIT = 3000;
const VIEWPORT = { width: 1400, height: 900 };

// Page definitions
const PAGES = {
  dashboard: { path: "/", name: "dashboard", description: "Overview/Dashboard" },
  clients: { path: "/clients", name: "clients", description: "Clients list" },
  insights: { path: "/insights", name: "insights", description: "Client Insights" },
  aps: { path: "/access-points", name: "access-points", description: "Access Points" },
  switches: { path: "/switches", name: "switches", description: "Switches" },
  gateway: { path: "/gateway", name: "gateway", description: "Gateway" },
  events: { path: "/events", name: "events", description: "Events" },
  reports: { path: "/reports", name: "reports", description: "Reports" },
  applications: { path: "/applications", name: "applications", description: "Applications" },
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    url: DEFAULT_URL,
    output: DEFAULT_OUTPUT,
    fullPage: false,
    wait: DEFAULT_WAIT,
    darkMode: null, // null = use system default
    pages: [],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--url":
        options.url = args[++i];
        break;
      case "--output":
        options.output = args[++i];
        break;
      case "--full":
        options.fullPage = true;
        break;
      case "--wait":
        options.wait = parseInt(args[++i], 10);
        break;
      case "--dark":
        options.darkMode = true;
        break;
      case "--light":
        options.darkMode = false;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      default:
        if (!arg.startsWith("-")) {
          options.pages.push(arg);
        }
    }
  }

  // Default to all pages if none specified
  if (options.pages.length === 0 || options.pages.includes("all")) {
    options.pages = Object.keys(PAGES);
  }

  return options;
}

function printHelp() {
  console.log(`
Screenshot Utility for UbiPanel

Usage: node scripts/screenshot.mjs [options] [pages...]

Options:
  --url <url>      Base URL (default: ${DEFAULT_URL})
  --output <dir>   Output directory (default: ${DEFAULT_OUTPUT})
  --full           Take full-page screenshots
  --wait <ms>      Wait time after page load (default: ${DEFAULT_WAIT})
  --dark           Force dark mode
  --light          Force light mode
  --help, -h       Show this help

Pages: ${Object.keys(PAGES).join(", ")}, all

Examples:
  node scripts/screenshot.mjs                          # All pages
  node scripts/screenshot.mjs dashboard gateway        # Specific pages
  node scripts/screenshot.mjs --url http://server/dashboard --full
`);
}

// Claude vision limits: max 8000x8000 px per image, but images are resized if > 1.15 megapixels
// For a 1400px wide viewport, limit height to ~5000px to stay well under limits
// This keeps total pixels under 7 million (1400 * 5000 = 7M) for reliable processing
const MAX_SCREENSHOT_HEIGHT = 5000;

async function takeScreenshot(page, pageKey, options) {
  const pageConfig = PAGES[pageKey];
  if (!pageConfig) {
    console.log(`  Unknown page: ${pageKey}`);
    return false;
  }

  const url = `${options.url}${pageConfig.path}`;
  const filename = `${pageConfig.name}.png`;
  const filepath = path.join(options.output, filename);

  try {
    console.log(`  ${pageConfig.description}...`);
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(options.wait);

    // For full page screenshots, check page height and clip if too tall
    if (options.fullPage) {
      const pageHeight = await page.evaluate(() => document.body.scrollHeight);

      if (pageHeight > MAX_SCREENSHOT_HEIGHT) {
        console.log(`    Page too tall (${pageHeight}px), clipping to ${MAX_SCREENSHOT_HEIGHT}px`);
        await page.screenshot({
          path: filepath,
          clip: { x: 0, y: 0, width: VIEWPORT.width, height: MAX_SCREENSHOT_HEIGHT },
        });
      } else {
        await page.screenshot({
          path: filepath,
          fullPage: true,
        });
      }
    } else {
      await page.screenshot({
        path: filepath,
        fullPage: false,
      });
    }

    console.log(`    Saved: ${filepath}`);
    return true;
  } catch (err) {
    console.log(`    Failed: ${err.message}`);
    return false;
  }
}

async function main() {
  const options = parseArgs();

  console.log(`\nUbiPanel Screenshot Utility`);
  console.log(`${"─".repeat(40)}`);
  console.log(`  URL: ${options.url}`);
  console.log(`  Output: ${options.output}`);
  console.log(`  Pages: ${options.pages.join(", ")}`);
  console.log(`  Full page: ${options.fullPage}`);
  if (options.darkMode !== null) {
    console.log(`  Theme: ${options.darkMode ? "dark" : "light"}`);
  }
  console.log(`${"─".repeat(40)}\n`);

  // Ensure output directory exists
  if (!existsSync(options.output)) {
    await mkdir(options.output, { recursive: true });
  }

  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const contextOptions = {
    viewport: VIEWPORT,
  };

  // Set color scheme if specified
  if (options.darkMode !== null) {
    contextOptions.colorScheme = options.darkMode ? "dark" : "light";
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  // Take screenshots
  let success = 0;
  let failed = 0;

  console.log("Taking screenshots...\n");

  for (const pageKey of options.pages) {
    const result = await takeScreenshot(page, pageKey, options);
    if (result) {
      success++;
    } else {
      failed++;
    }
  }

  await browser.close();

  // Summary
  console.log(`\n${"─".repeat(40)}`);
  console.log(`  Complete: ${success} captured, ${failed} failed`);
  console.log(`  Output: ${path.resolve(options.output)}`);
  console.log(`${"─".repeat(40)}\n`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
