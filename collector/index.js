#!/usr/bin/env node

/**
 * UniFi Traffic Collector
 *
 * Polls UniFi controller v2 APIs for traffic/DPI data and writes to InfluxDB.
 * Designed to run alongside UnPoller to supplement its data collection.
 *
 * This collector is designed to be resilient - it will never stop trying
 * to connect to services and will continue running through any errors.
 */

// Disable TLS certificate verification for self-signed certs (UniFi uses self-signed)
// This must be set before any imports that use fetch/https
if (process.env.UNIFI_VERIFY_SSL !== "true") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

import "dotenv/config";
import { UniFiClient } from "./lib/unifi.js";
import { InfluxWriter } from "./lib/influx.js";

// Configuration from environment
const config = {
  unifi: {
    url: process.env.UNIFI_URL || "https://192.168.8.1",
    username: process.env.UNIFI_USER || "unpoller",
    password: process.env.UNIFI_PASS,
    site: process.env.UNIFI_SITE || "default",
    logLevel: process.env.LOG_LEVEL || "info",
    timeout: parseInt(process.env.REQUEST_TIMEOUT || "30000", 10),
    maxRetries: parseInt(process.env.MAX_RETRIES || "3", 10),
    retryDelay: parseInt(process.env.RETRY_DELAY || "5000", 10),
  },
  influx: {
    url: process.env.INFLUX_URL || "http://localhost:8086",
    database: process.env.INFLUX_DB || "unpoller",
    username: process.env.INFLUX_USER,
    password: process.env.INFLUX_PASS,
    logLevel: process.env.LOG_LEVEL || "info",
    timeout: parseInt(process.env.REQUEST_TIMEOUT || "30000", 10),
    maxRetries: parseInt(process.env.MAX_RETRIES || "3", 10),
    retryDelay: parseInt(process.env.RETRY_DELAY || "5000", 10),
  },
  collectionInterval: parseInt(process.env.COLLECTION_INTERVAL || "300000", 10), // 5 minutes default
  startupRetryDelay: parseInt(process.env.STARTUP_RETRY_DELAY || "30000", 10), // 30 seconds
  logLevel: process.env.LOG_LEVEL || "info",
};

// Validate required configuration
if (!config.unifi.password) {
  console.error("ERROR: UNIFI_PASS environment variable is required");
  process.exit(1);
}

// Initialize clients
const unifi = new UniFiClient(config.unifi);
const influx = new InfluxWriter(config.influx);

// Health tracking
const health = {
  consecutiveFailures: 0,
  lastSuccess: null,
  lastError: null,
  totalCollections: 0,
  totalErrors: 0,
  influxConnected: false,
  unifiConnected: false,
};

// Logging helper
function log(level, message, data = null) {
  const levels = ["debug", "info", "warn", "error"];
  if (levels.indexOf(level) >= levels.indexOf(config.logLevel)) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] [collector] ${message}`;
    if (data) {
      console.log(logMessage, data);
    } else {
      console.log(logMessage);
    }
  }
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for InfluxDB to be available - retries forever
 */
async function waitForInflux() {
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      const ok = await influx.ping();
      if (ok) {
        if (!health.influxConnected) {
          log("info", "InfluxDB connection established");
          health.influxConnected = true;
        }
        return true;
      }
    } catch (error) {
      // Ping failed, will retry
    }

    health.influxConnected = false;

    if (attempt === 1) {
      log(
        "warn",
        `InfluxDB not reachable, will keep retrying every ${config.startupRetryDelay / 1000}s...`
      );
    } else if (attempt % 10 === 0) {
      log("warn", `Still waiting for InfluxDB (attempt ${attempt})...`);
    }

    await sleep(config.startupRetryDelay);
  }
}

/**
 * Wait for UniFi to be available - retries forever
 */
async function waitForUnifi() {
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      await unifi.login();
      if (!health.unifiConnected) {
        log("info", "UniFi authentication successful");
        health.unifiConnected = true;
      }
      return true;
    } catch (error) {
      health.unifiConnected = false;

      if (attempt === 1) {
        log(
          "warn",
          `UniFi not reachable (${error.message}), will keep retrying every ${config.startupRetryDelay / 1000}s...`
        );
      } else if (attempt % 10 === 0) {
        log("warn", `Still waiting for UniFi (attempt ${attempt}): ${error.message}`);
      }

      await sleep(config.startupRetryDelay);
    }
  }
}

/**
 * Perform a single collection cycle
 */
async function collect() {
  const now = Date.now();
  const start = now - config.collectionInterval;

  log(
    "info",
    `Starting collection cycle (${new Date(start).toISOString()} to ${new Date(now).toISOString()})`
  );

  let totalPoints = 0;
  const errors = [];

  // Collect traffic by app (per-client and aggregate)
  try {
    const trafficData = await unifi.getTrafficByApp(start, now);

    // Per-client app usage
    const clientPoints = await influx.writeTrafficByApp(trafficData, now);
    totalPoints += clientPoints;
    log("debug", `Wrote ${clientPoints} traffic_by_app points`);

    // Aggregate app usage (total_usage_by_app)
    const totalPoints2 = await influx.writeTotalUsageByApp(trafficData, now);
    totalPoints += totalPoints2;
    log("debug", `Wrote ${totalPoints2} traffic_total_by_app points`);
  } catch (error) {
    log("error", `Failed to collect traffic by app: ${error.message}`);
    errors.push(`traffic_by_app: ${error.message}`);
  }

  // Collect traffic by country
  try {
    const countryData = await unifi.getTrafficByCountry(start, now);
    const points = await influx.writeTrafficByCountry(countryData, now);
    totalPoints += points;
    log("debug", `Wrote ${points} traffic_by_country points`);
  } catch (error) {
    log("error", `Failed to collect traffic by country: ${error.message}`);
    errors.push(`traffic_by_country: ${error.message}`);
  }

  // Update health tracking
  health.totalCollections++;

  if (errors.length > 0) {
    health.consecutiveFailures++;
    health.totalErrors += errors.length;
    health.lastError = { time: new Date().toISOString(), errors };
    log(
      "warn",
      `Collection completed with ${errors.length} error(s): ${totalPoints} points written (consecutive failures: ${health.consecutiveFailures})`
    );
  } else {
    health.consecutiveFailures = 0;
    health.lastSuccess = new Date().toISOString();
    log("info", `Collection completed: ${totalPoints} points written`);
  }

  // Log health warning if many consecutive failures
  if (health.consecutiveFailures > 0 && health.consecutiveFailures % 5 === 0) {
    log("error", `HEALTH WARNING: ${health.consecutiveFailures} consecutive collection failures`);
  }

  return { points: totalPoints, errors };
}

/**
 * Initialize connections - waits forever for services to be available
 */
async function initialize() {
  log("info", "=".repeat(60));
  log("info", "UniFi Traffic Collector starting");
  log("info", `UniFi URL: ${config.unifi.url}`);
  log("info", `InfluxDB URL: ${config.influx.url}`);
  log("info", `Database: ${config.influx.database}`);
  log("info", `Collection interval: ${config.collectionInterval / 1000}s`);
  log("info", `Request timeout: ${config.unifi.timeout / 1000}s`);
  log("info", `Max retries per request: ${config.unifi.maxRetries}`);
  log("info", "=".repeat(60));

  // Wait for both services - these will retry forever
  log("info", "Waiting for InfluxDB...");
  await waitForInflux();

  log("info", "Waiting for UniFi controller...");
  await waitForUnifi();

  log("info", "All services connected");
}

/**
 * Main loop
 */
async function main() {
  // Initialize - waits forever for services
  await initialize();

  // Run initial collection
  try {
    await collect();
  } catch (error) {
    log("error", `Initial collection failed: ${error.message}`);
    // Don't exit - continue with scheduled collections
  }

  // Schedule periodic collection
  setInterval(async () => {
    try {
      await collect();
    } catch (error) {
      log("error", `Collection cycle failed unexpectedly: ${error.message}`);
      health.consecutiveFailures++;
      health.totalErrors++;
      health.lastError = { time: new Date().toISOString(), errors: [error.message] };
    }
  }, config.collectionInterval);

  // Handle graceful shutdown
  const shutdown = async (signal) => {
    log("info", `Received ${signal}, shutting down...`);
    log(
      "info",
      `Final stats: ${health.totalCollections} collections, ${health.totalErrors} errors`
    );
    await unifi.logout();
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // Handle uncaught errors - log but don't crash
  process.on("uncaughtException", (error) => {
    log("error", `Uncaught exception: ${error.message}`);
    log("error", error.stack);
    // Don't exit - try to continue
  });

  process.on("unhandledRejection", (reason) => {
    log("error", `Unhandled rejection: ${reason}`);
    // Don't exit - try to continue
  });

  log("info", "Collector running. Press Ctrl+C to stop.");
}

// Run
main().catch((error) => {
  log("error", `Fatal error: ${error.message}`);
  log("error", error.stack);
  // Even on fatal error, try to keep running
  log("info", "Attempting to restart in 30 seconds...");
  setTimeout(() => main(), 30000);
});
