import { describe, it, expect } from "vitest";
import {
  CATEGORIES,
  CATEGORIZED_APPLICATIONS,
  getCategoryName,
  getApplicationName,
  getTrafficLabel,
} from "../../src/lib/dpiMappings";

describe("dpiMappings", () => {
  describe("CATEGORIES", () => {
    it("should have expected category mappings", () => {
      expect(CATEGORIES[0]).toBe("Network Protocol");
      expect(CATEGORIES[1]).toBe("Messaging");
      expect(CATEGORIES[3]).toBe("Web");
      expect(CATEGORIES[5]).toBe("Video");
      expect(CATEGORIES[24]).toBe("Gaming");
    });

    it("should have all categories as strings", () => {
      Object.values(CATEGORIES).forEach((name) => {
        expect(typeof name).toBe("string");
        expect(name.length).toBeGreaterThan(0);
      });
    });
  });

  describe("CATEGORIZED_APPLICATIONS", () => {
    it("should have expected application mappings", () => {
      expect(CATEGORIZED_APPLICATIONS[5][95]).toBe("YouTube");
      expect(CATEGORIZED_APPLICATIONS[13][84]).toBe("SSL/TLS");
      expect(CATEGORIZED_APPLICATIONS[13][110]).toBe("Netflix");
      expect(CATEGORIZED_APPLICATIONS[1][2]).toBe("Telegram");
      expect(CATEGORIZED_APPLICATIONS[13][209]).toBe("Discord");
    });

    it("should have network protocol applications", () => {
      expect(CATEGORIZED_APPLICATIONS[0][27]).toBe("ICMP");
      expect(CATEGORIZED_APPLICATIONS[0][39]).toBe("NTP");
      expect(CATEGORIZED_APPLICATIONS[0][21]).toBe("DNS");
    });

    it("should have gaming applications", () => {
      expect(CATEGORIZED_APPLICATIONS[24][158]).toBe("Microsoft Gaming");
    });
  });

  describe("getCategoryName", () => {
    it("should return category name for known ID", () => {
      expect(getCategoryName(0)).toBe("Network Protocol");
      expect(getCategoryName(5)).toBe("Video");
      expect(getCategoryName(24)).toBe("Gaming");
    });

    it("should return fallback for unknown ID", () => {
      expect(getCategoryName(999)).toBe("Category 999");
      expect(getCategoryName(-1)).toBe("Category -1");
    });
  });

  describe("getApplicationName", () => {
    it("should return application name for known ID and category", () => {
      expect(getApplicationName(95, 5)).toBe("YouTube");
      expect(getApplicationName(84, 13)).toBe("SSL/TLS");
      expect(getApplicationName(248, 4)).toBe("iCloud");
    });

    it("should return fallback for unknown ID", () => {
      expect(getApplicationName(99999, 1)).toBe("App 99999");
      expect(getApplicationName(-1, 1)).toBe("App -1");
    });

    it("should return fallback for unknown category", () => {
      expect(getApplicationName(95, 999)).toBe("App 95");
    });
  });

  describe("getTrafficLabel", () => {
    it("should return both application and category names", () => {
      const label = getTrafficLabel(95, 5);
      expect(label).toEqual({
        application: "YouTube",
        category: "Video",
      });
    });

    it("should handle unknown IDs", () => {
      const label = getTrafficLabel(99999, 99999);
      expect(label).toEqual({
        application: "App 99999",
        category: "Category 99999",
      });
    });

    it("should handle mixed known/unknown IDs", () => {
      const label1 = getTrafficLabel(95, 99999);
      expect(label1).toEqual({
        application: "App 95",
        category: "Category 99999",
      });

      const label2 = getTrafficLabel(99999, 5);
      expect(label2).toEqual({
        application: "App 99999",
        category: "Video",
      });
    });
  });
});
