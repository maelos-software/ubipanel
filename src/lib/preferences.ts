/**
 * User preferences system with localStorage persistence.
 * Manages theme and other user-configurable settings.
 */

export type Theme = "light" | "dark" | "system";

/**
 * Refresh interval in milliseconds.
 * 0 = manual refresh only (disabled)
 */
export type RefreshInterval = 10000 | 30000 | 60000 | 300000 | 0;

/**
 * Default time range for historical charts.
 */
export type DefaultTimeRange = "1h" | "3h" | "6h" | "12h" | "24h";

/**
 * UI density setting.
 */
export type Density = "compact" | "comfortable" | "spacious";

/**
 * Default view preset for client lists.
 */
export type ClientListView = "minimal" | "standard" | "detailed";

export interface Preferences {
  theme: Theme;
  refreshInterval: RefreshInterval;
  defaultTimeRange: DefaultTimeRange;
  density: Density;
  clientListView: ClientListView;
}

const STORAGE_KEY = "ubipanel-preferences";

const DEFAULT_PREFERENCES: Preferences = {
  theme: "system",
  refreshInterval: 30000,
  defaultTimeRange: "1h",
  density: "comfortable",
  clientListView: "detailed",
};

/**
 * Load preferences from localStorage.
 * Returns defaults if not found or invalid.
 */
export function loadPreferences(): Preferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_PREFERENCES;

    const parsed = JSON.parse(stored) as Partial<Preferences>;
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Save preferences to localStorage.
 */
export function savePreferences(prefs: Preferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage errors (e.g., private browsing)
  }
}

/**
 * Get the default preferences object.
 */
export function getDefaultPreferences(): Preferences {
  return { ...DEFAULT_PREFERENCES };
}

/**
 * Get the effective theme based on preference and system setting.
 */
export function getEffectiveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}
