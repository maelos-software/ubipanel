import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { UniFiClient } from "../lib/unifi.js";

describe("UniFiClient", () => {
  let client;
  const config = {
    url: "https://unifi.local",
    username: "admin",
    password: "password",
    maxRetries: 2,
    retryDelay: 10,
  };

  beforeEach(() => {
    client = new UniFiClient(config);
    global.fetch = vi.fn();
    client.log = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("login", () => {
    it("sets cookies and csrf token on success", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        headers: {
          get: (key) => {
            if (key === "set-cookie") return "csrf_token=abc; Path=/";
            if (key === "x-csrf-token") return "xyz-token";
            return null;
          },
        },
      });

      await client.login();

      expect(client.cookies).toContain("csrf_token=abc");
      expect(client.csrfToken).toBe("xyz-token");
    });

    it("throws on auth failure", async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      await expect(client.login()).rejects.toThrow("Authentication failed: 401 Unauthorized");
    });
  });

  describe("request", () => {
    it("automatically logs in if not authenticated", async () => {
      // Mock login response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "cookie=123" },
      });

      // Mock data response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      await client.request("/test");

      // Should have called login endpoint first
      expect(global.fetch).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("/api/auth/login"),
        expect.anything()
      );
      // Then the actual request
      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("/test"),
        expect.objectContaining({
          headers: expect.objectContaining({ Cookie: expect.stringContaining("cookie=123") }),
        })
      );
    });

    it("re-authenticates on 401 response", async () => {
      client.cookies = "old-cookie";

      // 1. Request fails with 401
      global.fetch.mockResolvedValueOnce({ status: 401 });

      // 2. Login succeeds
      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "new-cookie" },
      });

      // 3. Retry request succeeds
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await client.request("/test");

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(client.cookies).toContain("new-cookie");
    });
  });

  describe("data fetching", () => {
    beforeEach(() => {
      client.cookies = "valid";
    });

    it("fetches traffic by app", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ client_usage_by_app: [] }),
      });

      const result = await client.getTrafficByApp(1000, 2000);
      expect(result).toEqual({ client_usage_by_app: [] });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("start=1000&end=2000"),
        expect.anything()
      );
    });

    it("fetches traffic by country", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ usage_by_country: [] }),
      });

      const result = await client.getTrafficByCountry(1000, 2000);
      expect(result).toEqual({ usage_by_country: [] });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("country-traffic"),
        expect.anything()
      );
    });

    it("fetches single client traffic", async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ client_usage: {} }),
      });

      await client.getClientTraffic("aa:bb:cc", 1000, 2000);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("aa:bb:cc"),
        expect.anything()
      );
    });

    it("handles api errors", async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Server Error",
      });

      await expect(client.getTrafficByApp(1, 2)).rejects.toThrow("Failed to get traffic data: 500");
    });

    it("handles country api errors", async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Server Error",
      });

      await expect(client.getTrafficByCountry(1, 2)).rejects.toThrow(
        "Failed to get country traffic: 500"
      );
    });

    it("handles client traffic api errors", async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Server Error",
      });

      await expect(client.getClientTraffic("aa:bb:cc", 1, 2)).rejects.toThrow(
        "Failed to get client traffic: 500"
      );
    });
  });

  describe("retry logic", () => {
    it("retries on network error", async () => {
      client.cookies = "valid";

      // 1. Network error (triggers cookie clear)
      global.fetch.mockRejectedValueOnce(new Error("Network timeout"));

      // 2. Login success (called because cookies were cleared)
      global.fetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "cookie=new" },
      });

      // 3. Request success
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await client.request("/test");

      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(client.log).toHaveBeenCalledWith(
        "warn",
        expect.stringContaining("Request attempt 1/2 failed")
      );
    });

    it("clears cookies on connection refused", async () => {
      client.cookies = "stale";
      const error = new Error("Connection refused");
      error.code = "ECONNREFUSED";
      global.fetch.mockRejectedValue(error);

      await expect(client.request("/test")).rejects.toThrow("Connection refused");
      expect(client.cookies).toBeNull();
    });
  });

  describe("fetchWithTimeout", () => {
    it("aborts on timeout", async () => {
      vi.useFakeTimers();
      const delay = client.timeout + 1000;

      global.fetch.mockImplementation(() => {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            const err = new Error("The operation was aborted");
            err.name = "AbortError";
            reject(err);
          }, delay);
        });
      });

      const promise = client.fetchWithTimeout("/slow");
      vi.advanceTimersByTime(delay);

      await expect(promise).rejects.toThrow(`Request timeout after ${client.timeout}ms`);
      vi.useRealTimers();
    });
  });

  describe("logout", () => {
    it("calls logout api if logged in", async () => {
      client.cookies = "valid";
      global.fetch.mockResolvedValue({ ok: true });

      await client.logout();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("logout"),
        expect.anything()
      );
      expect(client.cookies).toBeNull();
    });

    it("does nothing if not logged in", async () => {
      client.cookies = null;
      await client.logout();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("clears state even if logout fails", async () => {
      client.cookies = "valid";
      global.fetch.mockRejectedValue(new Error("Network error"));

      await client.logout();
      expect(client.cookies).toBeNull();
    });
  });
});
