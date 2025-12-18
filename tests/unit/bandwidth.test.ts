import { describe, it, expect } from "vitest";
import {
  parseBandwidthValue,
  parseBandwidthTotals,
  aggregateBandwidthByTime,
  getIntervalForRange,
  buildTrafficMap,
  buildTrafficMapComposite,
} from "../../src/lib/bandwidth";
import type { InfluxResponse } from "../../src/types/influx";

// Local series type matching what bandwidth.ts functions accept
interface TestSeries {
  name?: string;
  tags: Record<string, string>;
  columns: string[];
  values: unknown[][];
}

describe("bandwidth utilities", () => {
  describe("parseBandwidthValue", () => {
    it("parses valid positive numbers", () => {
      expect(parseBandwidthValue(1234)).toBe(1234);
      expect(parseBandwidthValue(0)).toBe(0);
      expect(parseBandwidthValue(1.5)).toBe(1.5);
    });

    it("parses string numbers", () => {
      expect(parseBandwidthValue("1234")).toBe(1234);
      expect(parseBandwidthValue("0")).toBe(0);
    });

    it("returns 0 for null and undefined", () => {
      expect(parseBandwidthValue(null)).toBe(0);
      expect(parseBandwidthValue(undefined)).toBe(0);
    });

    it("returns 0 for NaN and Infinity", () => {
      expect(parseBandwidthValue(NaN)).toBe(0);
      expect(parseBandwidthValue(Infinity)).toBe(0);
      expect(parseBandwidthValue(-Infinity)).toBe(0);
    });

    it("allows negative numbers (for delta calculations)", () => {
      // Negative values are valid for LAST-FIRST deltas when counter resets
      // Caller is responsible for clamping to 0 if needed
      expect(parseBandwidthValue(-100)).toBe(-100);
    });

    it("returns 0 for non-numeric strings", () => {
      expect(parseBandwidthValue("abc")).toBe(0);
      expect(parseBandwidthValue("")).toBe(0);
    });
  });

  describe("aggregateBandwidthByTime", () => {
    it("aggregates single series correctly", () => {
      const series: TestSeries[] = [
        {
          tags: { mac: "aa:bb:cc:dd:ee:ff" },
          columns: ["time", "rx", "tx"],
          values: [
            ["2024-01-01T00:00:00Z", 100, 50],
            ["2024-01-01T00:01:00Z", 200, 100],
          ],
        },
      ];

      const result = aggregateBandwidthByTime(series, 1, 2);

      expect(result).toHaveLength(2);
      expect(result[0].rx).toBe(100);
      expect(result[0].tx).toBe(50);
      expect(result[1].rx).toBe(200);
      expect(result[1].tx).toBe(100);
    });

    it("aggregates multiple series at same time points", () => {
      const series: TestSeries[] = [
        {
          tags: { mac: "aa:bb:cc:dd:ee:f1" },
          columns: ["time", "rx", "tx"],
          values: [["2024-01-01T00:00:00Z", 100, 50]],
        },
        {
          tags: { mac: "aa:bb:cc:dd:ee:f2" },
          columns: ["time", "rx", "tx"],
          values: [["2024-01-01T00:00:00Z", 200, 100]],
        },
      ];

      const result = aggregateBandwidthByTime(series, 1, 2);

      expect(result).toHaveLength(1);
      expect(result[0].rx).toBe(300); // 100 + 200
      expect(result[0].tx).toBe(150); // 50 + 100
    });

    it("handles null values by skipping them", () => {
      const series: TestSeries[] = [
        {
          tags: { mac: "aa:bb:cc:dd:ee:ff" },
          columns: ["time", "rx", "tx"],
          values: [
            ["2024-01-01T00:00:00Z", null, null],
            ["2024-01-01T00:01:00Z", 200, 100],
          ],
        },
      ];

      const result = aggregateBandwidthByTime(series, 1, 2);

      expect(result).toHaveLength(1);
      expect(result[0].rx).toBe(200);
    });

    it("returns empty array for empty series", () => {
      const result = aggregateBandwidthByTime([], 1, 2);
      expect(result).toHaveLength(0);
    });

    it("sorts results by time ascending", () => {
      const series: TestSeries[] = [
        {
          tags: { mac: "aa:bb:cc:dd:ee:ff" },
          columns: ["time", "rx", "tx"],
          values: [
            ["2024-01-01T00:02:00Z", 300, 150],
            ["2024-01-01T00:00:00Z", 100, 50],
            ["2024-01-01T00:01:00Z", 200, 100],
          ],
        },
      ];

      const result = aggregateBandwidthByTime(series, 1, 2);

      expect(result).toHaveLength(3);
      expect(result[0].rx).toBe(100);
      expect(result[1].rx).toBe(200);
      expect(result[2].rx).toBe(300);
    });
  });

  describe("parseBandwidthTotals", () => {
    it("parses series with valid data", () => {
      const series: TestSeries[] = [
        {
          tags: { mac: "aa:bb:cc:dd:ee:f1", name: "Device 1", vlan: "10" },
          columns: ["time", "rx", "tx"],
          values: [["2024-01-01T00:00:00Z", 1000, 500]],
        },
        {
          tags: { mac: "aa:bb:cc:dd:ee:f2", name: "Device 2", vlan: "20" },
          columns: ["time", "rx", "tx"],
          values: [["2024-01-01T00:00:00Z", 2000, 1000]],
        },
      ];

      const result = parseBandwidthTotals(series, {
        idTag: "mac",
        nameTag: "name",
        metaTags: ["vlan"],
      });

      expect(result).toHaveLength(2);
      // Should be sorted by total descending
      expect(result[0].name).toBe("Device 2");
      expect(result[0].total).toBe(3000);
      expect(result[0].meta?.vlan).toBe("20");
      expect(result[1].name).toBe("Device 1");
      expect(result[1].total).toBe(1500);
    });

    it("clamps negative values to 0 (counter reset)", () => {
      const series: TestSeries[] = [
        {
          tags: { mac: "aa:bb:cc:dd:ee:ff" },
          columns: ["time", "rx", "tx"],
          values: [["2024-01-01T00:00:00Z", -500, 1000]],
        },
      ];

      const result = parseBandwidthTotals(series, { idTag: "mac" });

      expect(result).toHaveLength(1);
      expect(result[0].rx).toBe(0); // Clamped from -500
      expect(result[0].tx).toBe(1000);
      expect(result[0].total).toBe(1000);
    });

    it("filters out entries with zero total", () => {
      const series: TestSeries[] = [
        {
          tags: { mac: "aa:bb:cc:dd:ee:f1" },
          columns: ["time", "rx", "tx"],
          values: [["2024-01-01T00:00:00Z", 0, 0]],
        },
        {
          tags: { mac: "aa:bb:cc:dd:ee:f2" },
          columns: ["time", "rx", "tx"],
          values: [["2024-01-01T00:00:00Z", 100, 50]],
        },
      ];

      const result = parseBandwidthTotals(series, { idTag: "mac" });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("aa:bb:cc:dd:ee:f2");
    });

    it("uses idTag as name when nameTag is missing", () => {
      const series: TestSeries[] = [
        {
          tags: { mac: "aa:bb:cc:dd:ee:ff" },
          columns: ["time", "rx", "tx"],
          values: [["2024-01-01T00:00:00Z", 100, 50]],
        },
      ];

      const result = parseBandwidthTotals(series, { idTag: "mac" });

      expect(result[0].name).toBe("aa:bb:cc:dd:ee:ff");
    });

    it("handles missing values array", () => {
      const series: TestSeries[] = [
        {
          tags: { mac: "aa:bb:cc:dd:ee:ff" },
          columns: ["time", "rx", "tx"],
          values: [],
        },
      ];

      const result = parseBandwidthTotals(series, { idTag: "mac" });

      expect(result).toHaveLength(0);
    });
  });

  describe("getIntervalForRange", () => {
    it("returns correct intervals for standard ranges", () => {
      expect(getIntervalForRange("1h")).toBe("2m");
      expect(getIntervalForRange("3h")).toBe("5m");
      expect(getIntervalForRange("6h")).toBe("10m");
      expect(getIntervalForRange("12h")).toBe("15m");
      expect(getIntervalForRange("24h")).toBe("30m");
      expect(getIntervalForRange("7d")).toBe("2h");
      expect(getIntervalForRange("30d")).toBe("6h");
    });

    it("returns default for unknown ranges", () => {
      expect(getIntervalForRange("2h")).toBe("5m");
      expect(getIntervalForRange("unknown")).toBe("5m");
    });
  });

  describe("buildTrafficMap", () => {
    it("builds traffic map from response with single tag key", () => {
      const response: InfluxResponse = {
        results: [
          {
            statement_id: 0,
            series: [
              {
                name: "clients",
                tags: { mac: "aa:bb:cc:dd:ee:f1" },
                columns: ["time", "rx_bytes", "tx_bytes"],
                values: [["2024-01-01T00:00:00Z", 1000, 500]],
              },
              {
                name: "clients",
                tags: { mac: "aa:bb:cc:dd:ee:f2" },
                columns: ["time", "rx_bytes", "tx_bytes"],
                values: [["2024-01-01T00:00:00Z", 2000, 1000]],
              },
            ],
          },
        ],
      };

      const result = buildTrafficMap(response, "mac");

      expect(result.size).toBe(2);
      expect(result.get("aa:bb:cc:dd:ee:f1")).toEqual({ rx: 1000, tx: 500 });
      expect(result.get("aa:bb:cc:dd:ee:f2")).toEqual({ rx: 2000, tx: 1000 });
    });

    it("uses custom field names when provided", () => {
      const response: InfluxResponse = {
        results: [
          {
            statement_id: 0,
            series: [
              {
                name: "clients",
                tags: { mac: "aa:bb:cc:dd:ee:ff" },
                columns: ["time", "download", "upload"],
                values: [["2024-01-01T00:00:00Z", 5000, 2500]],
              },
            ],
          },
        ],
      };

      const result = buildTrafficMap(response, "mac", {
        rxField: "download",
        txField: "upload",
      });

      expect(result.get("aa:bb:cc:dd:ee:ff")).toEqual({ rx: 5000, tx: 2500 });
    });

    it("skips series with missing key tag", () => {
      const response: InfluxResponse = {
        results: [
          {
            statement_id: 0,
            series: [
              {
                name: "clients",
                tags: { other: "value" },
                columns: ["time", "rx_bytes", "tx_bytes"],
                values: [["2024-01-01T00:00:00Z", 1000, 500]],
              },
              {
                name: "clients",
                tags: { mac: "aa:bb:cc:dd:ee:ff" },
                columns: ["time", "rx_bytes", "tx_bytes"],
                values: [["2024-01-01T00:00:00Z", 2000, 1000]],
              },
            ],
          },
        ],
      };

      const result = buildTrafficMap(response, "mac");

      expect(result.size).toBe(1);
      expect(result.get("aa:bb:cc:dd:ee:ff")).toEqual({ rx: 2000, tx: 1000 });
    });

    it("clamps negative values to 0", () => {
      const response: InfluxResponse = {
        results: [
          {
            statement_id: 0,
            series: [
              {
                name: "clients",
                tags: { mac: "aa:bb:cc:dd:ee:ff" },
                columns: ["time", "rx_bytes", "tx_bytes"],
                values: [["2024-01-01T00:00:00Z", -500, 1000]],
              },
            ],
          },
        ],
      };

      const result = buildTrafficMap(response, "mac");

      expect(result.get("aa:bb:cc:dd:ee:ff")).toEqual({ rx: 0, tx: 1000 });
    });

    it("returns empty map for empty response", () => {
      const response: InfluxResponse = {
        results: [{ statement_id: 0 }],
      };

      const result = buildTrafficMap(response, "mac");

      expect(result.size).toBe(0);
    });

    it("handles missing field columns gracefully", () => {
      const response: InfluxResponse = {
        results: [
          {
            statement_id: 0,
            series: [
              {
                name: "clients",
                tags: { mac: "aa:bb:cc:dd:ee:ff" },
                columns: ["time", "other_field"],
                values: [["2024-01-01T00:00:00Z", 9999]],
              },
            ],
          },
        ],
      };

      const result = buildTrafficMap(response, "mac");

      expect(result.get("aa:bb:cc:dd:ee:ff")).toEqual({ rx: 0, tx: 0 });
    });
  });

  describe("buildTrafficMapComposite", () => {
    it("builds traffic map with composite key from multiple tags", () => {
      const response: InfluxResponse = {
        results: [
          {
            statement_id: 0,
            series: [
              {
                name: "uap_vaps",
                tags: { device_name: "AP-1", essid: "MySSID", radio: "na" },
                columns: ["time", "rx_bytes", "tx_bytes"],
                values: [["2024-01-01T00:00:00Z", 1000, 500]],
              },
              {
                name: "uap_vaps",
                tags: { device_name: "AP-1", essid: "MySSID", radio: "ng" },
                columns: ["time", "rx_bytes", "tx_bytes"],
                values: [["2024-01-01T00:00:00Z", 2000, 1000]],
              },
            ],
          },
        ],
      };

      const result = buildTrafficMapComposite(response, ["device_name", "essid", "radio"]);

      expect(result.size).toBe(2);
      expect(result.get("AP-1|MySSID|na")).toEqual({ rx: 1000, tx: 500 });
      expect(result.get("AP-1|MySSID|ng")).toEqual({ rx: 2000, tx: 1000 });
    });

    it("uses custom field names when provided", () => {
      const response: InfluxResponse = {
        results: [
          {
            statement_id: 0,
            series: [
              {
                name: "ports",
                tags: { device_name: "Switch-1", port_idx: "1" },
                columns: ["time", "rx_rate", "tx_rate"],
                values: [["2024-01-01T00:00:00Z", 5000, 2500]],
              },
            ],
          },
        ],
      };

      const result = buildTrafficMapComposite(response, ["device_name", "port_idx"], {
        rxField: "rx_rate",
        txField: "tx_rate",
      });

      expect(result.get("Switch-1|1")).toEqual({ rx: 5000, tx: 2500 });
    });

    it("skips series where all key tags are empty", () => {
      const response: InfluxResponse = {
        results: [
          {
            statement_id: 0,
            series: [
              {
                name: "test",
                tags: { other: "value" },
                columns: ["time", "rx_bytes", "tx_bytes"],
                values: [["2024-01-01T00:00:00Z", 1000, 500]],
              },
              {
                name: "test",
                tags: { key1: "a", key2: "b" },
                columns: ["time", "rx_bytes", "tx_bytes"],
                values: [["2024-01-01T00:00:00Z", 2000, 1000]],
              },
            ],
          },
        ],
      };

      const result = buildTrafficMapComposite(response, ["key1", "key2"]);

      expect(result.size).toBe(1);
      expect(result.get("a|b")).toEqual({ rx: 2000, tx: 1000 });
    });

    it("includes series with partial key tags", () => {
      const response: InfluxResponse = {
        results: [
          {
            statement_id: 0,
            series: [
              {
                name: "test",
                tags: { key1: "a" },
                columns: ["time", "rx_bytes", "tx_bytes"],
                values: [["2024-01-01T00:00:00Z", 1000, 500]],
              },
            ],
          },
        ],
      };

      const result = buildTrafficMapComposite(response, ["key1", "key2"]);

      // key2 is missing, so composite key is "a|"
      expect(result.size).toBe(1);
      expect(result.get("a|")).toEqual({ rx: 1000, tx: 500 });
    });

    it("clamps negative values to 0", () => {
      const response: InfluxResponse = {
        results: [
          {
            statement_id: 0,
            series: [
              {
                name: "test",
                tags: { key1: "a", key2: "b" },
                columns: ["time", "rx_bytes", "tx_bytes"],
                values: [["2024-01-01T00:00:00Z", -500, -200]],
              },
            ],
          },
        ],
      };

      const result = buildTrafficMapComposite(response, ["key1", "key2"]);

      expect(result.get("a|b")).toEqual({ rx: 0, tx: 0 });
    });

    it("returns empty map for empty response", () => {
      const response: InfluxResponse = {
        results: [{ statement_id: 0 }],
      };

      const result = buildTrafficMapComposite(response, ["key1", "key2"]);

      expect(result.size).toBe(0);
    });
  });
});
