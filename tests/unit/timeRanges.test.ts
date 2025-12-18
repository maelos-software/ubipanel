import { describe, it, expect } from "vitest";
import {
  TIME_RANGES_SHORT,
  TIME_RANGES_DETAIL,
  TIME_RANGES_EXTENDED,
  TIME_RANGES_LONG,
  TIME_RANGES_REPORT_FULL,
  TIME_RANGES_REPORT,
  getIntervalForRange,
} from "../../src/lib/timeRanges";

describe("timeRanges", () => {
  describe("TIME_RANGES_SHORT", () => {
    it("should have 4 time ranges", () => {
      expect(TIME_RANGES_SHORT).toHaveLength(4);
    });

    it("should have correct labels", () => {
      const labels = TIME_RANGES_SHORT.map((r) => r.label);
      expect(labels).toEqual(["1h", "3h", "12h", "24h"]);
    });

    it("should have matching values and labels", () => {
      TIME_RANGES_SHORT.forEach((range) => {
        expect(range.value).toBe(range.label);
      });
    });

    it("should have valid group intervals", () => {
      TIME_RANGES_SHORT.forEach((range) => {
        expect(range.group).toMatch(/^\d+m$/);
      });
    });
  });

  describe("TIME_RANGES_DETAIL", () => {
    it("should have 5 time ranges", () => {
      expect(TIME_RANGES_DETAIL).toHaveLength(5);
    });

    it("should include 6h option not in SHORT", () => {
      const values = TIME_RANGES_DETAIL.map((r) => r.value);
      expect(values).toContain("6h");
    });

    it("should have increasing group intervals for longer ranges", () => {
      // Convert group to minutes for comparison
      const toMinutes = (g: string) => {
        const num = parseInt(g);
        return g.endsWith("h") ? num * 60 : num;
      };

      for (let i = 1; i < TIME_RANGES_DETAIL.length; i++) {
        const prevMinutes = toMinutes(TIME_RANGES_DETAIL[i - 1].group);
        const currMinutes = toMinutes(TIME_RANGES_DETAIL[i].group);
        expect(currMinutes).toBeGreaterThanOrEqual(prevMinutes);
      }
    });
  });

  describe("TIME_RANGES_EXTENDED", () => {
    it("should have 6 time ranges including 7d", () => {
      expect(TIME_RANGES_EXTENDED).toHaveLength(6);
      const values = TIME_RANGES_EXTENDED.map((r) => r.value);
      expect(values).toContain("7d");
    });

    it("should use 1h grouping for 7d range", () => {
      const sevenDay = TIME_RANGES_EXTENDED.find((r) => r.value === "7d");
      expect(sevenDay?.group).toBe("1h");
    });
  });

  describe("TIME_RANGES_LONG", () => {
    it("should have 4 time ranges", () => {
      expect(TIME_RANGES_LONG).toHaveLength(4);
    });

    it("should use spelled-out labels", () => {
      const labels = TIME_RANGES_LONG.map((r) => r.label);
      expect(labels).toEqual(["1 Hour", "24 Hours", "7 Days", "30 Days"]);
    });

    it("should include 30d option", () => {
      const values = TIME_RANGES_LONG.map((r) => r.value);
      expect(values).toContain("30d");
    });

    it("should have appropriate grouping for long ranges", () => {
      const thirtyDay = TIME_RANGES_LONG.find((r) => r.value === "30d");
      expect(thirtyDay?.group).toBe("1d");
    });
  });

  describe("TIME_RANGES_REPORT_FULL", () => {
    it("should have 4 time ranges with full labels", () => {
      expect(TIME_RANGES_REPORT_FULL).toHaveLength(4);
      TIME_RANGES_REPORT_FULL.forEach((range) => {
        expect(range.label).toMatch(/Hour|Hours/);
      });
    });
  });

  describe("TIME_RANGES_REPORT", () => {
    it("should have 4 time ranges with short labels", () => {
      expect(TIME_RANGES_REPORT).toHaveLength(4);
      TIME_RANGES_REPORT.forEach((range) => {
        expect(range.label).toMatch(/^\d+h$/);
      });
    });

    it("should have same values as REPORT_FULL", () => {
      const reportValues = TIME_RANGES_REPORT.map((r) => r.value);
      const fullValues = TIME_RANGES_REPORT_FULL.map((r) => r.value);
      expect(reportValues).toEqual(fullValues);
    });
  });

  describe("getIntervalForRange", () => {
    it("should return correct interval for known ranges", () => {
      expect(getIntervalForRange("1h")).toBe("1m");
      expect(getIntervalForRange("3h")).toBe("2m");
      expect(getIntervalForRange("24h")).toBe("15m");
      expect(getIntervalForRange("7d")).toBe("1h");
    });

    it("should return default 5m for unknown ranges", () => {
      expect(getIntervalForRange("unknown")).toBe("5m");
      expect(getIntervalForRange("")).toBe("5m");
      expect(getIntervalForRange("100y")).toBe("5m");
    });

    it("should handle ranges defined in multiple arrays", () => {
      // "1h" is in SHORT, DETAIL, EXTENDED - should return first match
      expect(getIntervalForRange("1h")).toBe("1m");
    });
  });

  describe("TimeRange structure", () => {
    const allRanges = [
      ...TIME_RANGES_SHORT,
      ...TIME_RANGES_DETAIL,
      ...TIME_RANGES_EXTENDED,
      ...TIME_RANGES_LONG,
      ...TIME_RANGES_REPORT_FULL,
      ...TIME_RANGES_REPORT,
    ];

    it("all ranges should have required properties", () => {
      allRanges.forEach((range) => {
        expect(range).toHaveProperty("label");
        expect(range).toHaveProperty("value");
        expect(range).toHaveProperty("group");
        expect(typeof range.label).toBe("string");
        expect(typeof range.value).toBe("string");
        expect(typeof range.group).toBe("string");
      });
    });

    it("all values should be valid InfluxDB time strings", () => {
      allRanges.forEach((range) => {
        expect(range.value).toMatch(/^\d+[mhd]$/);
      });
    });

    it("all groups should be valid InfluxDB interval strings", () => {
      allRanges.forEach((range) => {
        expect(range.group).toMatch(/^\d+[mhd]$/);
      });
    });
  });
});
