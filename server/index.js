import express from "express";
import cors from "cors";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";
import "dotenv/config";
import { validateQuery } from "./lib/validateQuery.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

const {
  INFLUX_URL = "http://localhost:8086",
  INFLUX_DB = "unpoller",
  INFLUX_USER = "unpoller",
  INFLUX_PASS = "",
  PORT = "3001",
  SITE_NAME = "UniFi Network",
  SERVE_STATIC = "false",
} = process.env;

app.use(cors());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Site config (non-sensitive)
app.get("/api/config", (req, res) => {
  res.json({ siteName: SITE_NAME });
});

// Proxy InfluxDB queries
app.post("/api/query", async (req, res) => {
  const query = req.body.q;

  if (!query) {
    return res.status(400).json({ error: "Missing query parameter 'q'" });
  }

  // Validate query before forwarding to InfluxDB
  const validation = validateQuery(query);
  if (!validation.valid) {
    console.warn(`Blocked query: ${validation.error} - "${query.substring(0, 100)}"`);
    return res.status(403).json({ error: validation.error });
  }

  try {
    const auth = Buffer.from(`${INFLUX_USER}:${INFLUX_PASS}`).toString("base64");
    const url = `${INFLUX_URL}/query?db=${INFLUX_DB}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `q=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("InfluxDB proxy error:", err.message);
    res.status(500).json({ error: "Failed to query InfluxDB" });
  }
});

// Serve static files in production
if (SERVE_STATIC === "true") {
  const staticDir = join(__dirname, "..", "dist");

  if (existsSync(staticDir)) {
    // Serve static assets
    app.use(express.static(staticDir));

    // SPA fallback - serve index.html for all non-API routes
    app.get("*", (req, res) => {
      res.sendFile(join(staticDir, "index.html"));
    });

    console.log(`Serving static files from ${staticDir}`);
  } else {
    console.warn(`Static directory not found: ${staticDir}`);
  }
}

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ error: "Internal server error" });
});

// Prevent crashes from unhandled rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err.message);
});

// Sanitize URL for logging (remove credentials if accidentally included)
function sanitizeUrlForLog(urlString) {
  try {
    const url = new URL(urlString);
    if (url.password) url.password = "***";
    if (url.username) url.username = "***";
    return url.toString();
  } catch {
    return urlString; // Return as-is if not a valid URL
  }
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`Proxying to InfluxDB at ${sanitizeUrlForLog(INFLUX_URL)}`);
});
