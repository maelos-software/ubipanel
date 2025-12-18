/**
 * Bandwidth calculation utilities
 *
 * UnPoller stores bandwidth data in two forms:
 * 1. Cumulative counters (rx_bytes, tx_bytes) - total bytes since device boot
 * 2. Pre-calculated rates (rx_bytes_r, tx_bytes_r) - bytes per second at collection time
 *
 * Common mistakes to avoid:
 * - Never SUM() cumulative counters - use LAST() - FIRST() for deltas
 * - Never SUM() rate fields across time - use MEAN() then aggregate across entities
 *
 * Correct patterns:
 * - Bytes transferred: LAST(rx_bytes) - FIRST(rx_bytes)
 * - Current rate: LAST(rx_bytes_r)
 * - Average rate: MEAN(rx_bytes_r) grouped by entity, then sum across entities
 * - Rate trend for VAPs: NON_NEGATIVE_DERIVATIVE(SUM(rx_bytes), 1s) (no rate fields available)
 */

import type {
  InfluxSeries as BaseInfluxSeries,
  InfluxResponse as BaseInfluxResponse,
} from "@/types/influx";

// Local aliases - only use the fields needed in this module
type InfluxSeries = Pick<BaseInfluxSeries, "tags" | "columns" | "values">;
type InfluxResponse = Pick<BaseInfluxResponse, "results">;

/**
 * A single bandwidth data point for time series charts.
 */
export interface BandwidthPoint {
  time: number;
  rx: number;
  tx: number;
}

/**
 * Bandwidth totals for a single entity (client, VLAN, etc).
 */
export interface BandwidthTotal {
  id: string;
  name: string;
  rx: number;
  tx: number;
  total: number;
  meta?: Record<string, string>;
}

/**
 * Field name mappings for different UnPoller tables.
 * UnPoller uses inconsistent naming (underscores vs hyphens).
 */
export const BANDWIDTH_FIELDS = {
  clients: {
    table: "clients",
    counter: { rx: "rx_bytes", tx: "tx_bytes" },
    rate: { rx: "rx_bytes_r", tx: "tx_bytes_r" },
  },
  wan: {
    table: "usg_wan_ports",
    counter: { rx: "rx_bytes", tx: "tx_bytes" },
    rate: { rx: '"rx_bytes-r"', tx: '"tx_bytes-r"' }, // Hyphenated, needs quotes
  },
  switchPorts: {
    table: "usw_ports",
    counter: { rx: "rx_bytes", tx: "tx_bytes" },
    rate: { rx: '"rx_bytes-r"', tx: '"tx_bytes-r"' }, // Hyphenated, needs quotes
  },
  uapVaps: {
    table: "uap_vaps",
    counter: { rx: "rx_bytes", tx: "tx_bytes" },
    rate: null, // No rate fields, use derivative of counters
  },
} as const;

export type BandwidthSource = keyof typeof BANDWIDTH_FIELDS;

/**
 * Safely parse a bandwidth value from InfluxDB.
 * Handles null, undefined, NaN, and negative values.
 *
 * @param value - Raw value from InfluxDB
 * @returns Parsed number, or 0 if invalid
 */
export function parseBandwidthValue(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  // Allow negative for delta calculations, caller should handle with Math.max(0, ...)
  return num;
}

/**
 * Aggregate bandwidth data from multiple series into time buckets.
 * Used when querying with GROUP BY entity (mac, ifname, etc) and need to sum across entities.
 *
 * @param series - Array of series from InfluxDB result
 * @param rxIndex - Column index for rx value (1-based after time column)
 * @param txIndex - Column index for tx value (1-based after time column)
 * @returns Array of bandwidth points sorted by time
 */
export function aggregateBandwidthByTime(
  series: InfluxSeries[],
  rxIndex: number,
  txIndex: number
): BandwidthPoint[] {
  const timeMap = new Map<number, { rx: number; tx: number }>();

  for (const s of series) {
    if (!s.values) continue;

    for (const row of s.values) {
      const timestamp = row[0];
      if (!timestamp) continue;

      const time = new Date(timestamp as string).getTime();
      const rx = parseBandwidthValue(row[rxIndex]);
      const tx = parseBandwidthValue(row[txIndex]);

      // Skip null/zero entries
      if (rx === 0 && tx === 0) continue;

      const existing = timeMap.get(time) || { rx: 0, tx: 0 };
      existing.rx += rx;
      existing.tx += tx;
      timeMap.set(time, existing);
    }
  }

  return Array.from(timeMap.entries())
    .map(([time, { rx, tx }]) => ({ time, rx, tx }))
    .sort((a, b) => a.time - b.time);
}

/**
 * Parse bandwidth totals from InfluxDB series with LAST-FIRST delta pattern.
 * Handles counter resets by treating negative deltas as 0.
 *
 * @param series - Array of series from InfluxDB result
 * @param options - Parsing options
 * @returns Array of bandwidth totals sorted by total descending
 */
export function parseBandwidthTotals(
  series: InfluxSeries[],
  options: {
    idTag: string;
    nameTag?: string;
    rxIndex?: number;
    txIndex?: number;
    metaTags?: string[];
  }
): BandwidthTotal[] {
  const { idTag, nameTag, rxIndex = 1, txIndex = 2, metaTags = [] } = options;

  return series
    .filter((s) => s.values?.[0])
    .map((s) => {
      // Handle counter resets (negative delta) by clamping to 0
      const rx = Math.max(0, parseBandwidthValue(s.values[0][rxIndex]));
      const tx = Math.max(0, parseBandwidthValue(s.values[0][txIndex]));

      const meta: Record<string, string> = {};
      for (const tag of metaTags) {
        if (s.tags?.[tag]) {
          meta[tag] = s.tags[tag];
        }
      }

      return {
        id: s.tags?.[idTag] || "",
        name: s.tags?.[nameTag || idTag] || s.tags?.[idTag] || "Unknown",
        rx,
        tx,
        total: rx + tx,
        meta: Object.keys(meta).length > 0 ? meta : undefined,
      };
    })
    .filter((t) => t.total > 0)
    .sort((a, b) => b.total - a.total);
}

/**
 * Get the appropriate time grouping interval for a given time range.
 * Provides reasonable defaults for chart readability.
 *
 * @param timeRange - Time range string (e.g., "1h", "24h", "7d")
 * @returns Interval string for GROUP BY time()
 */
export function getIntervalForRange(timeRange: string): string {
  switch (timeRange) {
    case "1h":
      return "2m";
    case "3h":
      return "5m";
    case "6h":
      return "10m";
    case "12h":
      return "15m";
    case "24h":
      return "30m";
    case "7d":
      return "2h";
    case "30d":
      return "6h";
    default:
      return "5m";
  }
}

/**
 * Build a traffic map from an InfluxDB LAST-FIRST query response.
 * Used to efficiently look up traffic totals by a key (e.g., MAC address).
 *
 * @param response - InfluxDB query response
 * @param keyTag - Tag name to use as the map key (e.g., "mac", "ifname")
 * @param options - Optional field name overrides
 * @returns Map from key to traffic totals { rx, tx }
 *
 * @example
 * ```typescript
 * const trafficResponse = await queryInflux(`
 *   SELECT LAST(rx_bytes) - FIRST(rx_bytes) as rx_bytes,
 *          LAST(tx_bytes) - FIRST(tx_bytes) as tx_bytes
 *   FROM clients
 *   WHERE time > now() - 24h
 *   GROUP BY "mac"
 * `);
 * const trafficByMac = buildTrafficMap(trafficResponse, "mac");
 * const traffic = trafficByMac.get("aa:bb:cc:dd:ee:ff");
 * ```
 */
export function buildTrafficMap(
  response: InfluxResponse,
  keyTag: string,
  options?: {
    rxField?: string;
    txField?: string;
  }
): Map<string, { rx: number; tx: number }> {
  const { rxField = "rx_bytes", txField = "tx_bytes" } = options || {};
  const trafficMap = new Map<string, { rx: number; tx: number }>();
  const series = response.results?.[0]?.series || [];

  for (const s of series) {
    const key = s.tags?.[keyTag] || "";
    if (!key) continue;

    const cols = s.columns;
    const vals = s.values?.[0] || [];
    const getVal = (field: string): number => {
      const idx = cols.indexOf(field);
      return idx >= 0 ? Math.max(0, (vals[idx] as number) || 0) : 0;
    };

    trafficMap.set(key, {
      rx: getVal(rxField),
      tx: getVal(txField),
    });
  }

  return trafficMap;
}

/**
 * Build a traffic map with a composite key from multiple tags.
 * Useful when the key needs to combine multiple values (e.g., device_name + port_idx).
 *
 * @param response - InfluxDB query response
 * @param keyTags - Array of tag names to combine as the key (joined with "|")
 * @param options - Optional field name overrides
 * @returns Map from composite key to traffic totals { rx, tx }
 *
 * @example
 * ```typescript
 * const trafficByVap = buildTrafficMapComposite(response, ["device_name", "essid", "radio"]);
 * const traffic = trafficByVap.get("ap-name|MySSID|na");
 * ```
 */
export function buildTrafficMapComposite(
  response: InfluxResponse,
  keyTags: string[],
  options?: {
    rxField?: string;
    txField?: string;
  }
): Map<string, { rx: number; tx: number }> {
  const { rxField = "rx_bytes", txField = "tx_bytes" } = options || {};
  const trafficMap = new Map<string, { rx: number; tx: number }>();
  const series = response.results?.[0]?.series || [];

  for (const s of series) {
    const keyParts = keyTags.map((tag) => s.tags?.[tag] || "");
    const key = keyParts.join("|");
    if (keyParts.every((p) => p === "")) continue;

    const cols = s.columns;
    const vals = s.values?.[0] || [];
    const getVal = (field: string): number => {
      const idx = cols.indexOf(field);
      return idx >= 0 ? Math.max(0, (vals[idx] as number) || 0) : 0;
    };

    trafficMap.set(key, {
      rx: getVal(rxField),
      tx: getVal(txField),
    });
  }

  return trafficMap;
}
