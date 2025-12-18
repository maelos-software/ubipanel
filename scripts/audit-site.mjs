#!/usr/bin/env node
/**
 * Comprehensive Site Audit Script
 *
 * Captures screenshots and data from every page, extracts key metrics for review.
 * Useful for visual regression testing and validating data accuracy.
 *
 * USAGE:
 *   node scripts/audit-site.mjs [options]
 *
 * OPTIONS:
 *   --url <url>      Base URL (default: http://localhost:4820)
 *   --api <url>      API URL (default: http://localhost:4821)
 *   --output <dir>   Output directory (default: ./audit-results)
 *
 * EXAMPLES:
 *   # Audit local dev server
 *   node scripts/audit-site.mjs
 *
 *   # Audit production server
 *   node scripts/audit-site.mjs --url http://192.168.8.21/dashboard --api http://192.168.8.21:4880
 *
 * OUTPUT:
 *   - Screenshots of each page in the output directory
 *   - audit-results.json with extracted metrics and any issues found
 */

import { chromium } from "playwright";
import fs from "fs";
import path from "path";

// Parse command line arguments
const args = process.argv.slice(2);
let BASE_URL = "http://localhost:4820";
let API_URL = "http://localhost:4821";
let AUDIT_DIR = "./audit-results";

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--url") BASE_URL = args[++i];
  else if (args[i] === "--api") API_URL = args[++i];
  else if (args[i] === "--output") AUDIT_DIR = args[++i];
}

// Ensure audit directory exists
if (!fs.existsSync(AUDIT_DIR)) {
  fs.mkdirSync(AUDIT_DIR, { recursive: true });
}

// Helper to query InfluxDB directly via POST
async function queryInflux(query) {
  try {
    const response = await fetch(`${API_URL}/api/query`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `q=${encodeURIComponent(query)}`,
    });
    return response.json();
  } catch (err) {
    console.log(`   Query failed: ${err.message}`);
    return { results: [] };
  }
}

// Audit results collector
const auditResults = {
  timestamp: new Date().toISOString(),
  pages: [],
  issues: [],
  rawData: {},
};

// Extract visible text data from page
async function extractPageMetrics(page) {
  return page.evaluate(() => {
    const metrics = {
      stats: [],
      tableData: [],
      chartPresent: false,
      errors: [],
    };

    // Extract from stat-card like elements
    document.querySelectorAll('[class*="rounded"]').forEach((el) => {
      const label = el
        .querySelector('[class*="text-gray-500"], [class*="text-sm"]')
        ?.textContent?.trim();
      const value = el
        .querySelector('[class*="font-bold"], [class*="text-2xl"], [class*="text-3xl"]')
        ?.textContent?.trim();
      if (label && value && !label.includes(value)) {
        metrics.stats.push({ label, value });
      }
    });

    // Extract table headers and first few rows
    document.querySelectorAll("table").forEach((table) => {
      const headers = Array.from(table.querySelectorAll("th")).map((th) => th.textContent?.trim());
      const rows = Array.from(table.querySelectorAll("tbody tr"))
        .slice(0, 3)
        .map((row) =>
          Array.from(row.querySelectorAll("td")).map((td) =>
            td.textContent?.trim().substring(0, 50)
          )
        );
      if (headers.length > 0 && rows.length > 0) {
        metrics.tableData.push({ headers, sampleRows: rows });
      }
    });

    // Check for charts
    metrics.chartPresent =
      document.querySelectorAll("svg.recharts-surface, canvas, [class*='chart']").length > 0;

    // Check for visible errors
    document.querySelectorAll('[class*="error" i]').forEach((el) => {
      const text = el.textContent?.trim();
      if (text && text.length < 200) {
        metrics.errors.push(text);
      }
    });

    return metrics;
  });
}

async function auditPage(page, name, url) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📄 ${name}`);
  console.log(`   ${url}`);
  console.log(`${"=".repeat(60)}`);

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1500); // Let charts render

    // Take screenshot
    const screenshotName = name.replace(/[^a-z0-9]/gi, "-").toLowerCase();
    const screenshotPath = path.join(AUDIT_DIR, `${screenshotName}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // Extract metrics
    const metrics = await extractPageMetrics(page);

    // Print stats
    if (metrics.stats.length > 0) {
      console.log("\n   📊 Stats:");
      metrics.stats.forEach((s) => {
        console.log(`      ${s.label}: ${s.value}`);
      });
    }

    // Print table sample
    if (metrics.tableData.length > 0) {
      console.log("\n   📋 Tables:");
      metrics.tableData.forEach((t, i) => {
        console.log(`      Table ${i + 1}: ${t.headers.slice(0, 5).join(" | ")}`);
        if (t.sampleRows[0]) {
          console.log(`        Row 1: ${t.sampleRows[0].slice(0, 5).join(" | ")}`);
        }
      });
    }

    // Charts
    console.log(`\n   📈 Charts present: ${metrics.chartPresent ? "Yes" : "No"}`);

    // Errors
    if (metrics.errors.length > 0) {
      console.log("\n   ❌ Errors:");
      metrics.errors.forEach((e) => console.log(`      ${e}`));
      auditResults.issues.push({ page: name, errors: metrics.errors });
    }

    auditResults.pages.push({
      name,
      url,
      screenshot: screenshotPath,
      metrics,
    });

    return metrics;
  } catch (err) {
    console.log(`   ❌ Failed: ${err.message}`);
    auditResults.issues.push({ page: name, error: err.message });
    return null;
  }
}

// Fetch raw data for cross-reference
async function fetchRawData() {
  console.log("\n📡 Fetching raw InfluxDB data for cross-reference...\n");

  const queries = {
    clientCount: "SELECT COUNT(DISTINCT(mac)) FROM clients WHERE time > now() - 5m",
    apCount: "SELECT COUNT(DISTINCT(name)) FROM uap WHERE time > now() - 5m",
    switchCount: "SELECT COUNT(DISTINCT(name)) FROM usw WHERE time > now() - 5m",
    gatewayUptime: "SELECT LAST(uptime) FROM usg WHERE time > now() - 5m",

    // Sample client data
    clientSample: `SELECT LAST(rx_bytes), LAST(tx_bytes), LAST(rssi), LAST(signal) 
                   FROM clients WHERE time > now() - 5m GROUP BY mac, "name" LIMIT 5`,

    // Sample AP data
    apSample: `SELECT LAST(num_sta), LAST(user-num_sta), LAST(guest-num_sta)
               FROM uap WHERE time > now() - 5m GROUP BY name LIMIT 5`,

    // WAN data
    wanSample: `SELECT LAST("rx_bytes-r"), LAST("tx_bytes-r") 
                FROM usg_wan_ports WHERE time > now() - 5m GROUP BY ifname`,

    // Bandwidth rates (check for reasonableness)
    clientBandwidth: `SELECT MEAN(rx_bytes_r) as rx_rate, MEAN(tx_bytes_r) as tx_rate
                      FROM clients WHERE time > now() - 1h GROUP BY time(5m) LIMIT 5`,
  };

  for (const [key, query] of Object.entries(queries)) {
    const result = await queryInflux(query);
    auditResults.rawData[key] = result;

    const series = result.results?.[0]?.series;
    if (series && series.length > 0) {
      console.log(
        `   ${key}: ${series.length} series, sample: ${JSON.stringify(series[0]?.values?.[0])?.substring(0, 80)}`
      );
    } else {
      console.log(`   ${key}: No data`);
    }
  }
}

async function runAudit() {
  console.log("🔍 UbiPanel - Comprehensive Site Audit");
  console.log(`   Started: ${new Date().toISOString()}`);
  console.log("=".repeat(60));

  // Fetch raw data first
  await fetchRawData();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // Collect console errors
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (!text.includes("favicon")) {
        auditResults.issues.push({ type: "console", message: text.substring(0, 200) });
      }
    }
  });

  try {
    // Main pages
    await auditPage(page, "Overview", `${BASE_URL}/`);
    await auditPage(page, "Gateway", `${BASE_URL}/gateway`);
    await auditPage(page, "Clients", `${BASE_URL}/clients`);
    await auditPage(page, "Client Insights", `${BASE_URL}/clients/insights`);
    await auditPage(page, "Access Points", `${BASE_URL}/access-points`);
    await auditPage(page, "Switches", `${BASE_URL}/switches`);
    await auditPage(page, "Applications", `${BASE_URL}/applications`);
    await auditPage(page, "Events", `${BASE_URL}/events`);

    // Get sample entities for detail pages
    const clientMac = auditResults.rawData.clientSample?.results?.[0]?.series?.[0]?.tags?.mac;
    const apName = auditResults.rawData.apSample?.results?.[0]?.series?.[0]?.tags?.name;

    if (clientMac) {
      await auditPage(
        page,
        "Client Detail",
        `${BASE_URL}/clients/${encodeURIComponent(clientMac)}`
      );
    }
    if (apName) {
      await auditPage(page, "AP Detail", `${BASE_URL}/access-points/${encodeURIComponent(apName)}`);
    }

    // Get switch name properly
    const switchResult = await queryInflux(
      "SELECT LAST(bytes), name FROM usw WHERE time > now() - 5m GROUP BY name LIMIT 1"
    );
    const switchNameActual = switchResult.results?.[0]?.series?.[0]?.tags?.name;
    if (switchNameActual) {
      await auditPage(
        page,
        "Switch Detail",
        `${BASE_URL}/switches/${encodeURIComponent(switchNameActual)}`
      );
    }

    // Reports
    await auditPage(page, "Reports Index", `${BASE_URL}/reports`);
    await auditPage(page, "Bandwidth Report", `${BASE_URL}/reports/bandwidth`);
    await auditPage(page, "WAN Health Report", `${BASE_URL}/reports/wan-health`);
    await auditPage(page, "Guest Report", `${BASE_URL}/reports/guests`);
    await auditPage(page, "AP Load Report", `${BASE_URL}/reports/ap-load`);
    await auditPage(page, "Experience Report", `${BASE_URL}/reports/experience`);
    await auditPage(page, "Radio Report", `${BASE_URL}/reports/radio`);
    await auditPage(page, "Roaming Report", `${BASE_URL}/reports/roaming`);
    await auditPage(page, "Infrastructure Report", `${BASE_URL}/reports/infrastructure`);
    await auditPage(page, "Port Health Report", `${BASE_URL}/reports/port-health`);
  } finally {
    await browser.close();
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 AUDIT COMPLETE");
  console.log("=".repeat(60));
  console.log(`\n   Pages audited: ${auditResults.pages.length}`);
  console.log(`   Issues found: ${auditResults.issues.length}`);
  console.log(`   Screenshots: ${AUDIT_DIR}/`);

  if (auditResults.issues.length > 0) {
    console.log("\n   ⚠️  Issues to review:");
    auditResults.issues.forEach((issue, i) => {
      if (issue.page) {
        console.log(`      ${i + 1}. ${issue.page}: ${issue.error || issue.errors?.join(", ")}`);
      } else if (issue.type === "console") {
        console.log(`      ${i + 1}. Console: ${issue.message}`);
      }
    });
  }

  // Save results
  const resultsPath = path.join(AUDIT_DIR, "audit-results.json");
  fs.writeFileSync(resultsPath, JSON.stringify(auditResults, null, 2));
  console.log(`\n   Results saved: ${resultsPath}`);

  return auditResults;
}

runAudit().catch(console.error);
