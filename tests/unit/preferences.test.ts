import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  loadPreferences,
  savePreferences,
  getDefaultPreferences,
  getEffectiveTheme,
  type Preferences,
} from "../../src/lib/preferences";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Mock matchMedia
const mockMatchMedia = vi.fn();
Object.defineProperty(window, "matchMedia", {
  value: mockMatchMedia,
});

describe("preferences.ts", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe("getDefaultPreferences", () => {
    it("returns default preferences", () => {
      const prefs = getDefaultPreferences();

      expect(prefs.theme).toBe("system");
      expect(prefs.refreshInterval).toBe(30000);
      expect(prefs.defaultTimeRange).toBe("1h");
      expect(prefs.density).toBe("comfortable");
      expect(prefs.clientListView).toBe("detailed");
    });

    it("returns a new object each time", () => {
      const prefs1 = getDefaultPreferences();
      const prefs2 = getDefaultPreferences();

      expect(prefs1).not.toBe(prefs2);
      expect(prefs1).toEqual(prefs2);
    });
  });

  describe("loadPreferences", () => {
    it("returns defaults when localStorage is empty", () => {
      const prefs = loadPreferences();

      expect(prefs).toEqual(getDefaultPreferences());
    });

    it("loads stored preferences", () => {
      const stored: Preferences = {
        theme: "dark",
        refreshInterval: 60000,
        defaultTimeRange: "3h",
        density: "compact",
        clientListView: "detailed",
      };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(stored));

      const prefs = loadPreferences();

      expect(prefs).toEqual(stored);
    });

    it("merges partial stored preferences with defaults", () => {
      const partial = { theme: "dark" };
      localStorageMock.getItem.mockReturnValue(JSON.stringify(partial));

      const prefs = loadPreferences();

      expect(prefs.theme).toBe("dark");
      expect(prefs.refreshInterval).toBe(30000); // Default
      expect(prefs.defaultTimeRange).toBe("1h"); // Default
    });

    it("returns defaults on invalid JSON", () => {
      localStorageMock.getItem.mockReturnValue("invalid json{");

      const prefs = loadPreferences();

      expect(prefs).toEqual(getDefaultPreferences());
    });

    it("returns defaults on localStorage error", () => {
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error("localStorage error");
      });

      const prefs = loadPreferences();

      expect(prefs).toEqual(getDefaultPreferences());
    });
  });

  describe("savePreferences", () => {
    it("saves preferences to localStorage", () => {
      const prefs: Preferences = {
        theme: "dark",
        refreshInterval: 60000,
        defaultTimeRange: "6h",
        density: "spacious",
        clientListView: "minimal",
      };

      savePreferences(prefs);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        "ubipanel-preferences",
        JSON.stringify(prefs)
      );
    });

    it("handles localStorage errors gracefully", () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

      // Should not throw
      expect(() => savePreferences(getDefaultPreferences())).not.toThrow();
    });
  });

  describe("getEffectiveTheme", () => {
    it("returns light when theme is light", () => {
      expect(getEffectiveTheme("light")).toBe("light");
    });

    it("returns dark when theme is dark", () => {
      expect(getEffectiveTheme("dark")).toBe("dark");
    });

    it("returns dark when theme is system and prefers-color-scheme is dark", () => {
      mockMatchMedia.mockReturnValue({ matches: true });

      expect(getEffectiveTheme("system")).toBe("dark");
      expect(mockMatchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
    });

    it("returns light when theme is system and prefers-color-scheme is light", () => {
      mockMatchMedia.mockReturnValue({ matches: false });

      expect(getEffectiveTheme("system")).toBe("light");
    });
  });
});
