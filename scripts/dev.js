#!/usr/bin/env node

/**
 * Development environment manager for UbiPanel
 *
 * Usage:
 *   npm run dev:start   - Start both proxy and frontend servers
 *   npm run dev:stop    - Stop all dev servers
 *   npm run dev:status  - Check if servers are running
 */

import { spawn } from "child_process";
import { existsSync, readFileSync, writeFileSync, unlinkSync, openSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const PID_FILE = join(ROOT_DIR, ".dev-pids.json");
const LOG_DIR = ROOT_DIR;

// Load environment from .env.development if it exists
function loadEnv() {
  const envFile = join(ROOT_DIR, ".env.development");
  const env = { ...process.env };

  if (existsSync(envFile)) {
    const content = readFileSync(envFile, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts.join("=").trim();
        }
      }
    }
  }

  return env;
}

function savePids(pids) {
  writeFileSync(PID_FILE, JSON.stringify(pids, null, 2));
}

function loadPids() {
  if (existsSync(PID_FILE)) {
    try {
      return JSON.parse(readFileSync(PID_FILE, "utf-8"));
    } catch {
      return {};
    }
  }
  return {};
}

function clearPids() {
  if (existsSync(PID_FILE)) {
    unlinkSync(PID_FILE);
  }
}

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function stopProcess(pid, name) {
  if (isProcessRunning(pid)) {
    try {
      // Kill the process group (negative PID) to get all children
      process.kill(-pid, "SIGTERM");
      console.log(`  Stopped ${name} (PID: ${pid})`);
      return true;
    } catch {
      // Try killing just the process if group kill fails
      try {
        process.kill(pid, "SIGTERM");
        console.log(`  Stopped ${name} (PID: ${pid})`);
        return true;
      } catch (err) {
        console.error(`  Failed to stop ${name}: ${err.message}`);
        return false;
      }
    }
  }
  return false;
}

async function waitForServer(url, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return false;
}

async function startServers() {
  const env = loadEnv();
  const proxyPort = env.DEV_PROXY_PORT || "4821";
  const vitePort = env.DEV_VITE_PORT || "4820";

  // Check if already running
  const existingPids = loadPids();
  if (existingPids.proxy && isProcessRunning(existingPids.proxy)) {
    console.log("\n⚠️  Dev servers already running.");
    console.log("   Run 'npm run dev:stop' first, or 'npm run dev:status' to check.\n");
    process.exit(1);
  }

  console.log("\n🚀 Starting UbiPanel development environment...\n");

  // Check for server/.env
  const serverEnvFile = join(ROOT_DIR, "server", ".env");
  if (!existsSync(serverEnvFile)) {
    console.error("❌ Missing server/.env file!\n");
    console.log("   Create it by copying the example:");
    console.log("   cp server/.env.example server/.env\n");
    console.log("   Then edit server/.env with your InfluxDB connection details.\n");
    process.exit(1);
  }

  const pids = {};

  // Open log files
  const proxyLogFile = join(LOG_DIR, ".dev-proxy.log");
  const viteLogFile = join(LOG_DIR, ".dev-vite.log");
  const proxyOut = openSync(proxyLogFile, "w");
  const viteOut = openSync(viteLogFile, "w");

  // Start proxy server (fully detached)
  console.log(`   Starting proxy server on port ${proxyPort}...`);
  const proxyEnv = { ...process.env, PORT: proxyPort };
  const proxy = spawn("node", ["index.js"], {
    cwd: join(ROOT_DIR, "server"),
    env: proxyEnv,
    stdio: ["ignore", proxyOut, proxyOut],
    detached: true,
  });
  proxy.unref();
  pids.proxy = proxy.pid;

  // Wait for proxy to be ready
  const proxyReady = await waitForServer(`http://localhost:${proxyPort}/api/health`);
  if (!proxyReady) {
    console.error("   ❌ Proxy server failed to start. Check .dev-proxy.log for details.");
    stopProcess(proxy.pid, "proxy");
    process.exit(1);
  }
  console.log(`   ✅ Proxy server ready`);

  // Start Vite dev server (fully detached)
  console.log(`   Starting Vite dev server on port ${vitePort}...`);
  const viteEnv = {
    ...process.env,
    VITE_API_URL: `http://localhost:${proxyPort}`,
    FORCE_COLOR: "0", // Disable colors in log file
  };
  const vite = spawn("npx", ["vite", "--port", vitePort, "--strictPort"], {
    cwd: ROOT_DIR,
    env: viteEnv,
    stdio: ["ignore", viteOut, viteOut],
    detached: true,
  });
  vite.unref();
  pids.vite = vite.pid;

  // Wait for Vite to be ready
  const viteReady = await waitForServer(`http://localhost:${vitePort}/`);
  if (!viteReady) {
    console.error("   ❌ Vite server failed to start. Check .dev-vite.log for details.");
    stopProcess(proxy.pid, "proxy");
    stopProcess(vite.pid, "vite");
    process.exit(1);
  }
  console.log(`   ✅ Vite dev server ready`);

  // Save PIDs
  savePids(pids);

  console.log("\n" + "─".repeat(50));
  console.log(`  🎉 Development environment ready!`);
  console.log("");
  console.log(`     Dashboard:  http://localhost:${vitePort}`);
  console.log(`     Proxy API:  http://localhost:${proxyPort}/api`);
  console.log("");
  console.log(`     Logs: .dev-proxy.log, .dev-vite.log`);
  console.log("─".repeat(50));
  console.log(`\n  Run 'npm run dev:stop' to stop the servers.\n`);

  // Exit cleanly - servers continue in background
  process.exit(0);
}

function stopServers() {
  console.log("\n  Stopping development servers...\n");

  const pids = loadPids();
  let stopped = false;

  if (pids.vite && isProcessRunning(pids.vite)) {
    stopped = stopProcess(pids.vite, "Vite dev server") || stopped;
  }
  if (pids.proxy && isProcessRunning(pids.proxy)) {
    stopped = stopProcess(pids.proxy, "Proxy server") || stopped;
  }

  clearPids();

  // Clean up log files
  const proxyLogFile = join(LOG_DIR, ".dev-proxy.log");
  const viteLogFile = join(LOG_DIR, ".dev-vite.log");
  if (existsSync(proxyLogFile)) unlinkSync(proxyLogFile);
  if (existsSync(viteLogFile)) unlinkSync(viteLogFile);

  if (stopped) {
    console.log("\n  ✅ Development servers stopped.\n");
  } else {
    console.log("  No running dev servers found.\n");
  }
}

function checkStatus() {
  const env = loadEnv();
  const proxyPort = env.DEV_PROXY_PORT || "4821";
  const vitePort = env.DEV_VITE_PORT || "4820";
  const pids = loadPids();

  console.log("\n  Development Server Status");
  console.log("  " + "─".repeat(40));

  const proxyRunning = pids.proxy && isProcessRunning(pids.proxy);
  const viteRunning = pids.vite && isProcessRunning(pids.vite);

  if (proxyRunning) {
    console.log(`  ✅ Proxy server   http://localhost:${proxyPort}  (PID: ${pids.proxy})`);
  } else {
    console.log(`  ❌ Proxy server   not running`);
  }

  if (viteRunning) {
    console.log(`  ✅ Vite server    http://localhost:${vitePort}  (PID: ${pids.vite})`);
  } else {
    console.log(`  ❌ Vite server    not running`);
  }

  console.log("  " + "─".repeat(40) + "\n");

  if (!proxyRunning && !viteRunning) {
    console.log("  Run 'npm run dev:start' to start the servers.\n");
  } else if (proxyRunning && viteRunning) {
    console.log("  Run 'npm run dev:stop' to stop the servers.\n");
  }
}

// Parse command
const command = process.argv[2];

switch (command) {
  case "start":
    startServers();
    break;
  case "stop":
    stopServers();
    break;
  case "status":
    checkStatus();
    break;
  default:
    console.log(`
  UbiPanel Development Environment

  Usage:
    npm run dev:start   Start dev servers in background
    npm run dev:stop    Stop dev servers
    npm run dev:status  Check server status

  Or directly:
    node scripts/dev.js start|stop|status
`);
}
