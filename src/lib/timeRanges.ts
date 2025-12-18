export interface TimeRange {
  label: string;
  value: string;
  /** Grouping interval for InfluxDB queries (e.g., "1m", "5m") */
  group: string;
}

/**
 * Short time ranges for Overview page.
 * 4 options: 1h, 3h, 12h, 24h
 */
export const TIME_RANGES_SHORT: TimeRange[] = [
  { label: "1h", value: "1h", group: "1m" },
  { label: "3h", value: "3h", group: "2m" },
  { label: "12h", value: "12h", group: "10m" },
  { label: "24h", value: "24h", group: "15m" },
];

/**
 * Standard time ranges for most detail pages.
 * 5 options: 1h, 3h, 6h, 12h, 24h
 */
export const TIME_RANGES_DETAIL: TimeRange[] = [
  { label: "1h", value: "1h", group: "1m" },
  { label: "3h", value: "3h", group: "2m" },
  { label: "6h", value: "6h", group: "5m" },
  { label: "12h", value: "12h", group: "10m" },
  { label: "24h", value: "24h", group: "15m" },
];

/**
 * Extended time ranges including 7d option.
 * Used by ClientDetail for longer historical views.
 * 6 options: 1h, 3h, 6h, 12h, 24h, 7d
 */
export const TIME_RANGES_EXTENDED: TimeRange[] = [
  { label: "1h", value: "1h", group: "1m" },
  { label: "3h", value: "3h", group: "2m" },
  { label: "6h", value: "6h", group: "5m" },
  { label: "12h", value: "12h", group: "10m" },
  { label: "24h", value: "24h", group: "15m" },
  { label: "7d", value: "7d", group: "1h" },
];

/**
 * Long time ranges for historical reports.
 * Uses longer labels with larger grouping intervals.
 */
export const TIME_RANGES_LONG: TimeRange[] = [
  { label: "1 Hour", value: "1h", group: "5m" },
  { label: "24 Hours", value: "24h", group: "1h" },
  { label: "7 Days", value: "7d", group: "6h" },
  { label: "30 Days", value: "30d", group: "1d" },
];

/**
 * Report time ranges with full labels.
 * Used by BandwidthReport for spelled-out time labels.
 */
export const TIME_RANGES_REPORT_FULL: TimeRange[] = [
  { label: "1 Hour", value: "1h", group: "2m" },
  { label: "3 Hours", value: "3h", group: "5m" },
  { label: "12 Hours", value: "12h", group: "15m" },
  { label: "24 Hours", value: "24h", group: "30m" },
];

/**
 * Report time ranges with short labels.
 * Used by RadioReport and similar pages.
 */
export const TIME_RANGES_REPORT: TimeRange[] = [
  { label: "1h", value: "1h", group: "2m" },
  { label: "3h", value: "3h", group: "5m" },
  { label: "12h", value: "12h", group: "15m" },
  { label: "24h", value: "24h", group: "30m" },
];

/**
 * Get interval string for a given time range value.
 * Useful when you have just the value string and need the grouping interval.
 */
export function getIntervalForRange(value: string): string {
  const allRanges = [
    ...TIME_RANGES_SHORT,
    ...TIME_RANGES_DETAIL,
    ...TIME_RANGES_EXTENDED,
    ...TIME_RANGES_LONG,
  ];
  const found = allRanges.find((r) => r.value === value);
  return found?.group || "5m";
}
