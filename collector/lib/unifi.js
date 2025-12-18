/**
 * UniFi API Client for v2 Traffic Endpoints
 *
 * Handles authentication and data retrieval from UniFi controller's
 * new v2 API endpoints for traffic/DPI data.
 */

export class UniFiClient {
  constructor(config) {
    this.baseUrl = config.url.replace(/\/$/, "");
    this.username = config.username;
    this.password = config.password;
    this.site = config.site || "default";
    this.cookies = null;
    this.csrfToken = null;
    this.logLevel = config.logLevel || "info";
    this.timeout = config.timeout || 30000; // 30 second default timeout
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 5000; // 5 seconds between retries
  }

  log(level, message, data = null) {
    const levels = ["debug", "info", "warn", "error"];
    if (levels.indexOf(level) >= levels.indexOf(this.logLevel)) {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [${level.toUpperCase()}] [unifi] ${message}`;
      if (data) {
        console.log(logMessage, data);
      } else {
        console.log(logMessage);
      }
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
   * Authenticate with the UniFi controller
   */
  async login() {
    this.log("debug", "Authenticating with UniFi controller...");

    const response = await this.fetchWithTimeout(`${this.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: this.username,
        password: this.password,
      }),
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
    }

    // Extract cookies from response headers
    const setCookieHeader = response.headers.get("set-cookie");
    if (setCookieHeader) {
      this.cookies = setCookieHeader
        .split(",")
        .map((cookie) => cookie.split(";")[0].trim())
        .join("; ");
    }

    // Extract CSRF token
    const csrfHeader = response.headers.get("x-csrf-token");
    if (csrfHeader) {
      this.csrfToken = csrfHeader;
    }

    this.log("info", "Successfully authenticated with UniFi controller");
    return true;
  }

  /**
   * Login with retry logic
   */
  async loginWithRetry() {
    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.login();
      } catch (error) {
        lastError = error;
        this.log("warn", `Login attempt ${attempt}/${this.maxRetries} failed: ${error.message}`);

        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * attempt; // Exponential-ish backoff
          this.log("info", `Retrying in ${delay / 1000}s...`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Make an authenticated request to the UniFi API with retry logic
   */
  async request(path, options = {}) {
    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Ensure we're authenticated
        if (!this.cookies) {
          await this.loginWithRetry();
        }

        const url = `${this.baseUrl}${path}`;
        const headers = {
          "Content-Type": "application/json",
          Cookie: this.cookies,
          ...(this.csrfToken && { "X-CSRF-Token": this.csrfToken }),
          ...options.headers,
        };

        this.log("debug", `Requesting: ${url} (attempt ${attempt})`);

        const response = await this.fetchWithTimeout(url, {
          ...options,
          headers,
        });

        // Handle session expiry - re-authenticate and retry
        if (response.status === 401 || response.status === 403) {
          this.log("warn", "Session expired, re-authenticating...");
          this.cookies = null;
          this.csrfToken = null;
          await this.loginWithRetry();

          // Retry the request with new credentials
          continue;
        }

        return response;
      } catch (error) {
        lastError = error;

        // Clear auth on connection errors (might be stale)
        if (
          error.message.includes("timeout") ||
          error.code === "ECONNREFUSED" ||
          error.code === "ENOTFOUND"
        ) {
          this.cookies = null;
          this.csrfToken = null;
        }

        this.log("warn", `Request attempt ${attempt}/${this.maxRetries} failed: ${error.message}`);

        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * attempt;
          this.log("info", `Retrying in ${delay / 1000}s...`);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Get traffic data by application for all clients
   * @param {number} start - Start timestamp in milliseconds
   * @param {number} end - End timestamp in milliseconds
   */
  async getTrafficByApp(start, end) {
    const path = `/proxy/network/v2/api/site/${this.site}/traffic?start=${start}&end=${end}`;

    const response = await this.request(path);

    if (!response.ok) {
      throw new Error(`Failed to get traffic data: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    this.log("debug", `Got traffic data for ${data.client_usage_by_app?.length || 0} clients`);

    return data;
  }

  /**
   * Get traffic data for a specific client
   * @param {string} mac - Client MAC address
   * @param {number} start - Start timestamp in milliseconds
   * @param {number} end - End timestamp in milliseconds
   */
  async getClientTraffic(mac, start, end) {
    const path = `/proxy/network/v2/api/site/${this.site}/traffic/${mac}?start=${start}&end=${end}`;

    const response = await this.request(path);

    if (!response.ok) {
      throw new Error(`Failed to get client traffic: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get traffic data by country
   * @param {number} start - Start timestamp in milliseconds
   * @param {number} end - End timestamp in milliseconds
   */
  async getTrafficByCountry(start, end) {
    const path = `/proxy/network/v2/api/site/${this.site}/country-traffic?start=${start}&end=${end}`;

    const response = await this.request(path);

    if (!response.ok) {
      throw new Error(`Failed to get country traffic: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    this.log("debug", `Got traffic data for ${data.usage_by_country?.length || 0} countries`);

    return data;
  }

  /**
   * Logout from the UniFi controller
   */
  async logout() {
    if (!this.cookies) return;

    try {
      await this.fetchWithTimeout(`${this.baseUrl}/api/auth/logout`, {
        method: "POST",
        headers: {
          Cookie: this.cookies,
          ...(this.csrfToken && { "X-CSRF-Token": this.csrfToken }),
        },
      });
      this.log("debug", "Logged out from UniFi controller");
    } catch (error) {
      this.log("warn", `Logout failed (non-critical): ${error.message}`);
    } finally {
      this.cookies = null;
      this.csrfToken = null;
    }
  }
}
