import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { InfluxWriter } from "../lib/influx.js";

describe("InfluxWriter", () => {
  let writer;
  const config = {
    url: "http://localhost:8086",
    database: "test_db",
    username: "user",
    password: "pass",
    maxRetries: 2,
    retryDelay: 10, // Fast retry for tests
  };

  beforeEach(() => {
    writer = new InfluxWriter(config);
    // Mock fetch globally
    global.fetch = vi.fn();
    // Mock log to avoid console spam
    writer.log = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("configuration", () => {
    it("removes trailing slash from URL", () => {
      const w = new InfluxWriter({ ...config, url: "http://localhost:8086/" });
      expect(w.baseUrl).toBe("http://localhost:8086");
    });

    it("sets defaults correctly", () => {
      const w = new InfluxWriter({ url: "http://localhost:8086", database: "db" });
      expect(w.logLevel).toBe("info");
      expect(w.timeout).toBe(30000);
      expect(w.maxRetries).toBe(3);
    });
  });

  describe("generators", () => {
    it("yields traffic lines correctly", () => {
      const data = {
        client_usage_by_app: [
          {
            client: { mac: "AA:BB:CC", name: "Device" },
            usage_by_app: [
              {
                application: 1,
                category: 2,
                bytes_received: 100,
                bytes_transmitted: 200,
              },
            ],
          },
        ],
      };

      const generator = writer.trafficByAppToLineProtocol(data, 1000);
      const result = generator.next();

      expect(result.done).toBe(false);
      expect(result.value).toContain("traffic_by_app");
      expect(result.value).toContain("client_mac=AA:BB:CC");
      expect(result.value).toContain("bytes_rx=100i");
    });

    it("handles empty data gracefully", () => {
      const generator = writer.trafficByAppToLineProtocol({}, 1000);
      expect(generator.next().done).toBe(true);
    });
  });

  describe("write batching", () => {
    it("writes in batches", async () => {
      writer.batchSize = 2; // Small batch size for testing

      // Mock successful fetch
      global.fetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(""),
      });

      // Generator that produces 5 items
      function* testGen() {
        yield "line1";
        yield "line2";
        yield "line3";
        yield "line4";
        yield "line5";
      }

      await writer.writeGenerator(testGen());

      // Should be called 3 times:
      // 1. [line1, line2]
      // 2. [line3, line4]
      // 3. [line5]
      expect(global.fetch).toHaveBeenCalledTimes(3);

      const call1 = global.fetch.mock.calls[0][1].body;
      expect(call1).toBe("line1\nline2");

      const call3 = global.fetch.mock.calls[2][1].body;
      expect(call3).toBe("line5");
    });

    it("writes total usage by app", async () => {
      global.fetch.mockResolvedValue({ ok: true, text: () => "" });
      const data = {
        total_usage_by_app: [
          {
            application: 1,
            category: 2,
            bytes_received: 1000,
            bytes_transmitted: 2000,
            total_bytes: 3000,
            client_count: 5,
          },
        ],
      };

      await writer.writeTotalUsageByApp(data, 1234567890);

      expect(global.fetch).toHaveBeenCalled();
      const body = global.fetch.mock.calls[0][1].body;
      expect(body).toContain("traffic_total_by_app");
      expect(body).toContain("client_count=5i");
    });

    it("writes traffic by country", async () => {
      global.fetch.mockResolvedValue({ ok: true, text: () => "" });
      const data = {
        usage_by_country: [
          {
            country: "US",
            bytes_received: 500,
            bytes_transmitted: 500,
            total_bytes: 1000,
          },
        ],
      };

      await writer.writeTrafficByCountry(data, 1234567890);

      expect(global.fetch).toHaveBeenCalled();
      const body = global.fetch.mock.calls[0][1].body;
      expect(body).toContain("traffic_by_country");
      expect(body).toContain("country=US");
    });
  });

  describe("ping", () => {
    it("returns true on success", async () => {
      global.fetch.mockResolvedValue({ ok: true });
      const result = await writer.ping();
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith("http://localhost:8086/ping", expect.anything());
    });

    it("returns false on failure", async () => {
      global.fetch.mockResolvedValue({ ok: false, status: 500 });
      const result = await writer.ping();
      expect(result).toBe(false);
    });

    it("returns false on network error", async () => {
      global.fetch.mockRejectedValue(new Error("Network error"));
      const result = await writer.ping();
      expect(result).toBe(false);
    });
  });

  describe("error handling", () => {
    it("retries on failure", async () => {
      global.fetch
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({ ok: true });

      await writer.writeBatch(["test"]);

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(writer.log).toHaveBeenCalledWith(
        "warn",
        expect.stringContaining("Write attempt 1/2 failed")
      );
    });

    it("throws after max retries", async () => {
      global.fetch.mockRejectedValue(new Error("Persistent error"));

      await expect(writer.writeBatch(["test"])).rejects.toThrow("Persistent error");
      expect(global.fetch).toHaveBeenCalledTimes(2); // Initial + 1 retry (maxRetries is 2)
    });
  });

  describe("escaping", () => {
    it("escapes tags correctly", () => {
      expect(writer.escapeTag("tag,with,commas")).toBe("tag\\,with\\,commas");
      expect(writer.escapeTag("tag with spaces")).toBe("tag\\ with\\ spaces");
      expect(writer.escapeTag("tag=equals")).toBe("tag\\=equals");
      expect(writer.escapeTag(undefined)).toBe("unknown");
    });

    it("escapes fields correctly", () => {
      expect(writer.escapeFieldString('string with "quotes"')).toBe('"string with \\"quotes\\""');
      expect(writer.escapeFieldString(undefined)).toBe('""');
    });
  });

  describe("fetchWithTimeout", () => {
    it("aborts on timeout", async () => {
      vi.useFakeTimers();
      const delay = writer.timeout + 1000;

      global.fetch.mockImplementation(() => {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            const err = new Error("The operation was aborted");
            err.name = "AbortError";
            reject(err);
          }, delay);
        });
      });

      const promise = writer.fetchWithTimeout("/slow");
      vi.advanceTimersByTime(delay);

      await expect(promise).rejects.toThrow(`Request timeout after ${writer.timeout}ms`);
      vi.useRealTimers();
    });

    it("rethrows other errors", async () => {
      global.fetch.mockRejectedValue(new Error("Network error"));
      await expect(writer.fetchWithTimeout("/fail")).rejects.toThrow("Network error");
    });
  });
});
