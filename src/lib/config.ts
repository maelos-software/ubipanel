export interface SiteConfig {
  siteName: string;
}

/**
 * Application version from build-time environment variable.
 * Set via VITE_APP_VERSION during CI builds.
 * Falls back to 'dev' for local development.
 */
export const APP_VERSION = import.meta.env.VITE_APP_VERSION || "dev";

// Default refetch interval for all queries (30 seconds)
export const REFETCH_INTERVAL = 30000;

/**
 * Default time range for calculating traffic totals.
 * Used across all data hooks for consistent "total transferred" calculations.
 */
export const TRAFFIC_TOTAL_RANGE = "24h";

/**
 * Time window for "current" data queries (e.g., latest state).
 * Used in WHERE clauses like: WHERE time > now() - 5m
 */
export const CURRENT_DATA_WINDOW = "5m";

/**
 * Standard chart heights for consistent UI across the application.
 * Use these constants instead of magic numbers for chart heights.
 */
export const CHART_HEIGHT = {
  /** Extra small - mini sparklines (60px) */
  xs: 60,
  /** Small - compact inline charts (150px) */
  sm: 150,
  /** Medium-small - overview widgets (160px) */
  ms: 160,
  /** Medium - standard charts (200px) */
  md: 200,
  /** Medium-large - detail page charts (220px) */
  ml: 220,
  /** Large - feature charts (250px) */
  lg: 250,
  /** Extra large - hero/primary charts (280px) */
  xl: 280,
  /** Extra extra large - full-width dashboard charts (300px) */
  xxl: 300,
} as const;

/**
 * UnPoller field naming conventions for client signal data:
 *
 * In the UniFi API and UnPoller:
 * - "signal" = actual RSSI in dBm (negative values like -65, -50, etc.)
 * - "rssi" = signal quality percentage (0-100, where higher is better)
 *
 * This is confusing because "RSSI" traditionally means the dBm value,
 * but UniFi/UnPoller uses "signal" for dBm and "rssi" for percentage.
 *
 * Our internal data model uses:
 * - rssi = dBm value (what UnPoller calls "signal")
 * - signal = percentage (what UnPoller calls "rssi")
 */

/**
 * Performance thresholds for health indicators and color coding.
 * These values define the boundaries for "good", "warning", and "error" states.
 */
export const THRESHOLDS = {
  signal: {
    excellent: -50,
    good: -60,
    fair: -70,
    poor: -75,
  },
  satisfaction: {
    excellent: 90,
    good: 80,
    warning: 70,
    poor: 60,
  },
  utilization: {
    critical: 80,
    high: 60,
    moderate: 40,
  },
  resource: {
    critical: 90,
    high: 80,
    moderate: 60,
  },
  uptime: {
    recent: 86400, // 24 hours
    justRestarted: 3600, // 1 hour
  },
} as const;

/**
 * Standard stale times for React Query.
 */
export const STALE_TIME = {
  short: 30000, // 30 seconds
  medium: 60000, // 1 minute
  long: 300000, // 5 minutes
  config: Infinity, // Never stale
} as const;

let cachedConfig: SiteConfig | null = null;

export async function fetchConfig(): Promise<SiteConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const response = await fetch(`${import.meta.env.BASE_URL}api/config`);
    if (!response.ok) {
      throw new Error("Failed to fetch config");
    }
    cachedConfig = await response.json();
    return cachedConfig!;
  } catch {
    // Return defaults if config endpoint unavailable
    return { siteName: "UniFi Network" };
  }
}

// React hook for config
import { useQuery } from "@tanstack/react-query";

export function useConfig() {
  return useQuery({
    queryKey: ["config"],
    queryFn: fetchConfig,
    staleTime: Infinity, // Config doesn't change during session
  });
}
