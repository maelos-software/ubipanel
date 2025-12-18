import { UniFiClient } from "./lib/unifi.js";
import fs from "fs";

const config = {
  url: "https://192.168.8.1",
  username: "unpoller",
  password: "XXrVh6tRB..kWx3rh4cxGXnYCpCjCzJ3YN7LVHZnGjLenqEP3A",
  site: "default",
  logLevel: "error",
};

const unifi = new UniFiClient(config);

async function scanForEndpoints() {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  await unifi.login();

  console.log("Fetching Network App index...");
  // Try to get the main HTML to find script tags
  // The path might vary, trying a few common ones
  const htmlPaths = ["/network/", "/network/index.html", "/"];

  let jsUrls = [];

  for (const path of htmlPaths) {
    try {
      const html = await (await unifi.fetchWithTimeout(config.url + path)).text();
      // Simple regex to find script src
      const scripts = html.match(/src=["']([^"']+\.js)["']/g);
      if (scripts) {
        console.log(`Found scripts in ${path}`);
        scripts.forEach((s) => {
          const url = s.match(/src=["']([^"']+)["']/)[1];
          jsUrls.push(url.startsWith("http") ? url : config.url + url);
        });
        break; // Found some, stop looking
      }
    } catch (e) {}
  }

  if (jsUrls.length === 0) {
    console.log("Could not find script tags via HTML scraping. Trying known patterns...");
    // Fallback to what we saw in system_apps_dump.json earlier if possible,
    // or just try to hit the API endpoints blindly again with a "verbose" probe?
    // Actually, let's try to fetch the traffic fingerprint endpoint with a different method/payload
    return;
  }

  console.log(`Analyzing ${jsUrls.length} JS files...`);

  const apiPatterns = [
    /api\/v2\/fingerprint\/[a-zA-Z0-9_/]+/g,
    /api\/s\/[^/]+\/stat\/dpi\/[a-zA-Z0-9_]+/g,
    /api\/s\/[^/]+\/rest\/dpi[a-zA-Z0-9_]+/g,
    /"\/api\/[^"]+"/g,
    /'\/api\/[^']+'/g,
  ];

  const foundEndpoints = new Set();

  for (const url of jsUrls) {
    try {
      console.log(`Fetching ${url}...`);
      const js = await (await fetch(url, { signal: AbortSignal.timeout(10000) })).text();

      for (const pattern of apiPatterns) {
        const matches = js.match(pattern);
        if (matches) {
          matches.forEach((m) => foundEndpoints.add(m.replace(/['"]/g, "")));
        }
      }
    } catch (e) {
      console.log(`Failed to fetch JS: ${e.message}`);
    }
  }

  console.log("\nPotential API Endpoints Found:");
  [...foundEndpoints]
    .sort()
    .filter((e) => e.includes("dpi") || e.includes("fingerprint") || e.includes("app"))
    .forEach((e) => console.log(e));
}

scanForEndpoints().catch(console.error);
