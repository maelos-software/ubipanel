import { describe, it, expect } from "vitest";
import { getCategoryName, getApplicationName, getTrafficLabel } from "../lib/mappings.js";

describe("mappings", () => {
  describe("getCategoryName", () => {
    it("returns known category name", () => {
      expect(getCategoryName(0)).toBe("Network Protocol");
      expect(getCategoryName(24)).toBe("Gaming");
    });

    it("returns fallback for unknown category", () => {
      expect(getCategoryName(999)).toBe("Category 999");
    });
  });

  describe("getApplicationName", () => {
    it("returns known application name with category context", () => {
      expect(getApplicationName(27, 0)).toBe("ICMP");
      expect(getApplicationName(95, 5)).toBe("YouTube");
    });

    it("returns fallback for unknown application", () => {
      expect(getApplicationName(99999, 0)).toBe("App 99999");
    });
  });

  describe("getTrafficLabel", () => {
    it("returns both names", () => {
      const result = getTrafficLabel(95, 5);
      expect(result).toEqual({
        application: "YouTube",
        category: "Video",
      });
    });

    it("handles unknowns", () => {
      const result = getTrafficLabel(999, 888);
      expect(result).toEqual({
        application: "App 999",
        category: "Category 888",
      });
    });
  });
});
