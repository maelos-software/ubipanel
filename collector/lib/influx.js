/**
 * InfluxDB Writer for Traffic Data
 *
 * Writes traffic data to InfluxDB using the line protocol over HTTP API.
 * Uses InfluxDB 1.x compatible API.
 */

export class InfluxWriter {
  constructor(config) {
    this.baseUrl = config.url.replace(/\/$/, "");
    this.database = config.database;
    this.username = config.username;
    this.password = config.password;
    this.logLevel = config.logLevel || "info";
    this.timeout = config.timeout || 30000; // 30 second default timeout
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 5000; // 5 seconds between retries
    this.batchSize = 500; // Write in batches of 500 points
  }

  log(level, message, data = null) {
    const levels = ["debug", "info", "warn", "error"];
    if (levels.indexOf(level) >= levels.indexOf(this.logLevel)) {
      const entry = {
        timestamp: new Date().toISOString(),
        level: level.toUpperCase(),
        service: "influx",
        message,
        ...(data && { data }),
      };
      console.log(JSON.stringify(entry));
    }
  }

  /**
   * Fetch with timeout support
   */
  async fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error(`Request timeout after ${this.timeout}ms: ${url}`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Sleep helper for retry delays
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Escape special characters in tag values
   */
  escapeTag(value) {
    if (value === null || value === undefined) return "unknown";
    return String(value).replace(/,/g, "\\,").replace(/ /g, "\\ ").replace(/=/g, "\\=");
  }

  /**
   * Escape special characters in field string values
   */
  escapeFieldString(value) {
    if (value === null || value === undefined) return '""';
    return `"${String(value).replace(/"/g, '\\"')}"`;
  }

  /**
   * Convert traffic by app data to InfluxDB line protocol (Generator)
   * Yields one line at a time to allow streaming/batching
   */
  *trafficByAppToLineProtocol(data, timestamp) {
    const ts = timestamp * 1000000; // Convert ms to nanoseconds

    if (!data.client_usage_by_app) return;

    for (const clientData of data.client_usage_by_app) {
      const client = clientData.client;
      if (!client) continue;

      const clientMac = this.escapeTag(client.mac);
      const clientName = this.escapeTag(client.name || client.hostname || client.mac);
      const isWired = client.is_wired ? "true" : "false";

      for (const usage of clientData.usage_by_app || []) {
        const appId = usage.application;
        const categoryId = usage.category;
        const appName = this.escapeTag(usage.application_name || "");
        const categoryName = this.escapeTag(usage.category_name || "");

        // traffic_by_app measurement
        const tags = [
          `client_mac=${clientMac}`,
          `client_name=${clientName}`,
          `is_wired=${isWired}`,
          `application=${appId}`,
          `category=${categoryId}`,
          ...(appName ? [`application_name=${appName}`] : []),
          ...(categoryName ? [`category_name=${categoryName}`] : []),
        ].join(",");

        const fields = [
          `bytes_rx=${usage.bytes_received || 0}i`,
          `bytes_tx=${usage.bytes_transmitted || 0}i`,
          `bytes_total=${usage.total_bytes || 0}i`,
          `activity_seconds=${usage.activity_seconds || 0}i`,
        ].join(",");

        yield `traffic_by_app,${tags} ${fields} ${ts}`;
      }
    }
  }

  /**
   * Convert total usage by app data to InfluxDB line protocol (Generator)
   */
  *totalUsageByAppToLineProtocol(data, timestamp) {
    const ts = timestamp * 1000000; // Convert ms to nanoseconds

    if (!data.total_usage_by_app) return;

    for (const appData of data.total_usage_by_app) {
      const appName = this.escapeTag(appData.application_name || "");
      const categoryName = this.escapeTag(appData.category_name || "");

      const tags = [
        `application=${appData.application}`,
        `category=${appData.category}`,
        ...(appName ? [`application_name=${appName}`] : []),
        ...(categoryName ? [`category_name=${categoryName}`] : []),
      ].join(",");

      const fields = [
        `bytes_rx=${appData.bytes_received || 0}i`,
        `bytes_tx=${appData.bytes_transmitted || 0}i`,
        `bytes_total=${appData.total_bytes || 0}i`,
        `client_count=${appData.client_count || 0}i`,
      ].join(",");

      yield `traffic_total_by_app,${tags} ${fields} ${ts}`;
    }
  }

  /**
   * Convert traffic by country data to InfluxDB line protocol (Generator)
   */
  *trafficByCountryToLineProtocol(data, timestamp) {
    const ts = timestamp * 1000000; // Convert ms to nanoseconds

    if (!data.usage_by_country) return;

    for (const countryData of data.usage_by_country) {
      const country = this.escapeTag(countryData.country);

      const tags = `country=${country}`;

      const fields = [
        `bytes_rx=${countryData.bytes_received || 0}i`,
        `bytes_tx=${countryData.bytes_transmitted || 0}i`,
        `bytes_total=${countryData.total_bytes || 0}i`,
      ].join(",");

      yield `traffic_by_country,${tags} ${fields} ${ts}`;
    }
  }

  /**
   * Write data points to InfluxDB with retry logic
   */
  async writeBatch(lines) {
    if (!lines || lines.length === 0) return 0;

    const body = lines.join("\n");
    const url = `${this.baseUrl}/write?db=${this.database}&precision=ns`;

    const headers = {
      "Content-Type": "text/plain",
    };

    // Add basic auth if credentials provided
    if (this.username && this.password) {
      const auth = Buffer.from(`${this.username}:${this.password}`).toString("base64");
      headers["Authorization"] = `Basic ${auth}`;
    }

    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url, {
          method: "POST",
          headers,
          body,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `InfluxDB write failed: ${response.status} ${response.statusText} - ${errorText}`
          );
        }

        return lines.length;
      } catch (error) {
        lastError = error;
        this.log("warn", `Write attempt ${attempt}/${this.maxRetries} failed: ${error.message}`);

        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * attempt;
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Consume a generator and write in batches
   */
  async writeGenerator(generator) {
    let batch = [];
    let totalWritten = 0;

    for (const line of generator) {
      batch.push(line);

      if (batch.length >= this.batchSize) {
        await this.writeBatch(batch);
        totalWritten += batch.length;
        batch = [];
      }
    }

    // Write remaining lines
    if (batch.length > 0) {
      await this.writeBatch(batch);
      totalWritten += batch.length;
    }

    return totalWritten;
  }

  /**
   * Write traffic by app data
   */
  async writeTrafficByApp(data, timestamp) {
    const generator = this.trafficByAppToLineProtocol(data, timestamp);
    return await this.writeGenerator(generator);
  }

  /**
   * Write traffic by country data
   */
  async writeTrafficByCountry(data, timestamp) {
    const generator = this.trafficByCountryToLineProtocol(data, timestamp);
    return await this.writeGenerator(generator);
  }

  /**
   * Write total usage by app data (aggregates)
   */
  async writeTotalUsageByApp(data, timestamp) {
    const generator = this.totalUsageByAppToLineProtocol(data, timestamp);
    return await this.writeGenerator(generator);
  }

  /**
   * Test connection to InfluxDB with retry logic
   */
  async ping() {
    const url = `${this.baseUrl}/ping`;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(url);
        if (response.ok) {
          return true;
        }
        throw new Error(`Ping failed: ${response.status}`);
      } catch (error) {
        this.log("warn", `Ping attempt ${attempt}/${this.maxRetries} failed: ${error.message}`);

        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * attempt;
          this.log("info", `Retrying in ${delay / 1000}s...`);
          await this.sleep(delay);
        }
      }
    }

    return false;
  }
}
