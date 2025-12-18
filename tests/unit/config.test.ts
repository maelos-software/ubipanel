import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { REFETCH_INTERVAL } from "../../src/lib/config";

describe("config", () => {
  describe("REFETCH_INTERVAL", () => {
    it("should be 30 seconds (30000ms)", () => {
      expect(REFETCH_INTERVAL).toBe(30000);
    });

    it("should be a positive number", () => {
      expect(REFETCH_INTERVAL).toBeGreaterThan(0);
    });
  });

  describe("fetchConfig", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      // Reset the cached config by reimporting the module
      vi.resetModules();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it("should return config from API on success", async () => {
      const mockConfig = { siteName: "Test Network" };
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConfig),
      });

      // Need to reimport to get fresh module without cache
      const { fetchConfig: freshFetchConfig } = await import("../../src/lib/config");
      const config = await freshFetchConfig();

      expect(config).toEqual(mockConfig);
    });

    it("should return default config when API fails", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        statusText: "Internal Server Error",
      });

      const { fetchConfig: freshFetchConfig } = await import("../../src/lib/config");
      const config = await freshFetchConfig();

      expect(config).toEqual({ siteName: "UniFi Network" });
    });

    it("should return default config when fetch throws", async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));

      const { fetchConfig: freshFetchConfig } = await import("../../src/lib/config");
      const config = await freshFetchConfig();

      expect(config).toEqual({ siteName: "UniFi Network" });
    });

    it("should cache config after first successful fetch", async () => {
      const mockConfig = { siteName: "Cached Network" };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockConfig),
      });

      const { fetchConfig: freshFetchConfig } = await import("../../src/lib/config");

      // First call
      const config1 = await freshFetchConfig();
      // Second call
      const config2 = await freshFetchConfig();

      expect(config1).toEqual(mockConfig);
      expect(config2).toEqual(mockConfig);
      // Should only fetch once due to caching
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
