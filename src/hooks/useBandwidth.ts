/**
 * Bandwidth data hooks
 *
 * Provides consistent, correct bandwidth calculations across the app.
 * All hooks use proper query patterns to avoid common mistakes like
 * SUM'ing counters or rate fields incorrectly.
 */

import { useTimeSeries } from "./useTimeSeries";
import {
  parseBandwidthTotals,
  aggregateBandwidthByTime,
  getIntervalForRange,
  type BandwidthPoint,
  type BandwidthTotal,
} from "@/lib/bandwidth";

// ============================================================================
// Types
// ============================================================================

export interface TopConsumersOptions {
  /** Maximum number of results (default: 20) */
  limit?: number;
  /** Filter to guest clients only */
  filterGuest?: boolean;
}

export interface BandwidthTrendOptions {
  /** Custom interval override (default: auto-calculated from timeRange) */
  interval?: string;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Get top bandwidth consumers over a time period.
 *
 * Uses LAST-FIRST pattern on cumulative counters for accurate byte totals.
 * This correctly calculates bytes transferred, not inflated sums.
 *
 * @param timeRange - Time range (e.g., "1h", "24h")
 * @param options - Filter and limit options
 * @returns Query result with top consumers sorted by total bytes
 */
export function useTopBandwidthConsumers(timeRange: string, options: TopConsumersOptions = {}) {
  const { limit = 20, filterGuest } = options;

  return useTimeSeries({
    key: ["bandwidth-top-consumers", timeRange, limit, filterGuest],
    query: () => {
      const guestFilter =
        filterGuest === true
          ? "AND is_guest = 'true'"
          : filterGuest === false
            ? "AND is_guest = 'false'"
            : "";

      return `
        SELECT LAST(rx_bytes) - FIRST(rx_bytes) AS rx,
               LAST(tx_bytes) - FIRST(tx_bytes) AS tx
        FROM clients
        WHERE time > now() - ${timeRange} ${guestFilter}
        GROUP BY mac, "name", vlan
      `;
    },
    processor: (response) => {
      const series = response.results[0]?.series || [];
      const totals = parseBandwidthTotals(series, {
        idTag: "mac",
        nameTag: "name",
        metaTags: ["vlan"],
      });
      return totals.slice(0, limit);
    },
  });
}

/**
 * Get bandwidth totals grouped by VLAN.
 *
 * Uses LAST-FIRST pattern for accurate byte totals per VLAN.
 *
 * @param timeRange - Time range (e.g., "1h", "24h")
 * @returns Query result with bandwidth per VLAN
 */
export function useBandwidthByVlan(timeRange: string) {
  return useTimeSeries({
    key: ["bandwidth-by-vlan", timeRange],
    query: () => `
        SELECT LAST(rx_bytes) - FIRST(rx_bytes) AS rx,
               LAST(tx_bytes) - FIRST(tx_bytes) AS tx
        FROM clients
        WHERE time > now() - ${timeRange}
        GROUP BY vlan
      `,
    processor: (response) => {
      const series = response.results[0]?.series || [];
      return parseBandwidthTotals(series, {
        idTag: "vlan",
      });
    },
  });
}

/**
 * Get client bandwidth rate trend over time.
 *
 * Uses MEAN of rate fields grouped by client, then aggregates across all clients.
 * This gives accurate total network throughput at each time point.
 *
 * @param timeRange - Time range (e.g., "1h", "24h")
 * @param options - Optional interval override
 * @returns Query result with bandwidth points over time
 */
export function useClientBandwidthTrend(timeRange: string, options: BandwidthTrendOptions = {}) {
  const interval = options.interval || getIntervalForRange(timeRange);

  return useTimeSeries({
    key: ["bandwidth-trend-clients", timeRange, interval],
    query: () => `
        SELECT MEAN(rx_bytes_r) AS rx, MEAN(tx_bytes_r) AS tx
        FROM clients
        WHERE time > now() - ${timeRange}
        GROUP BY time(${interval}), mac
      `,
    processor: (response) => {
      const series = response.results[0]?.series || [];
      return aggregateBandwidthByTime(series, 1, 2);
    },
  });
}

/**
 * Get guest bandwidth rate trend over time.
 *
 * Same as useClientBandwidthTrend but filtered to guest clients only.
 *
 * @param timeRange - Time range (e.g., "1h", "24h")
 * @param options - Optional interval override
 * @returns Query result with guest bandwidth points over time
 */
export function useGuestBandwidthTrend(timeRange: string, options: BandwidthTrendOptions = {}) {
  const interval = options.interval || getIntervalForRange(timeRange);

  return useTimeSeries({
    key: ["bandwidth-trend-guests", timeRange, interval],
    query: () => `
        SELECT MEAN(rx_bytes_r) AS rx, MEAN(tx_bytes_r) AS tx
        FROM clients
        WHERE time > now() - ${timeRange} AND is_guest = 'true'
        GROUP BY time(${interval}), mac
      `,
    processor: (response) => {
      const series = response.results[0]?.series || [];
      return aggregateBandwidthByTime(series, 1, 2);
    },
  });
}

/**
 * Get WAN bandwidth rate trend over time.
 *
 * Uses MEAN of rate fields grouped by interface, then aggregates across all WAN ports.
 * Handles the hyphenated field names used in usg_wan_ports table.
 *
 * @param timeRange - Time range (e.g., "1h", "7d")
 * @param options - Optional interval override
 * @returns Query result with WAN bandwidth points over time
 */
export function useWANBandwidthTrend(timeRange: string, options: BandwidthTrendOptions = {}) {
  const interval = options.interval || getIntervalForRange(timeRange);

  return useTimeSeries({
    key: ["bandwidth-trend-wan", timeRange, interval],
    query: () => `
        SELECT MEAN("rx_bytes-r") AS rx, MEAN("tx_bytes-r") AS tx
        FROM usg_wan_ports
        WHERE time > now() - ${timeRange}
        GROUP BY time(${interval}), ifname
      `,
    processor: (response) => {
      const series = response.results[0]?.series || [];
      return aggregateBandwidthByTime(series, 1, 2);
    },
  });
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type { BandwidthPoint, BandwidthTotal };
