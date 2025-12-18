/**
 * Utility functions for parsing InfluxDB results into time-series data
 */

import type { InfluxSeries, InfluxResponse } from "@/types/influx";

// Re-export createValueGetter from the canonical location
export { createValueGetter } from "@/lib/influx";

/**
 * Parse grouped InfluxDB results with tags.
 * Handles empty series and missing values gracefully.
 */
export function parseGroupedResults<T>(
  response: InfluxResponse,
  mapper: (tags: Record<string, string>, columns: string[], values: unknown[]) => T
): T[] {
  const series = response.results?.[0]?.series;
  if (!series || !Array.isArray(series)) return [];

  return series.map((s) => {
    const tags = s.tags || {};
    const columns = s.columns || [];
    const values = s.values?.[0] || [];
    return mapper(tags, columns, values);
  });
}

/**
 * Helper function for parsing basic time series results.
 * Handles empty results gracefully.
 */
export function parseTimeSeriesResults<T>(
  response: InfluxResponse,
  mapper: (columns: string[], values: unknown[]) => T
): T[] {
  const series = response.results?.[0]?.series?.[0];
  if (!series || !Array.isArray(series.values)) return [];
  return series.values.map((row) => mapper(series.columns || [], row || []));
}

/**
 * Parses an InfluxDB series into an array of objects where each key
 * matches the column name. Useful for ad-hoc queries like events.
 */
export function parseSeriesToObjects<T>(series: InfluxSeries): T[] {
  const { columns, values } = series;
  if (!values || !Array.isArray(values)) return [];

  return values.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj as T;
  });
}

/**
 * Configuration for aggregating time series data from multiple entities (APs, WANs, etc.)
 */
export interface AggregateTimeSeriesConfig<P extends { time: string }> {
  /** InfluxDB response with multiple series */
  response: { results: { series?: InfluxSeries[] }[] };
  /** Tag name to extract entity identifier from (e.g., "name", "device_name", "ifname") */
  entityTag: string;
  /** Map each row to dynamic key-value pairs for the point. Keys will be added to the point object. */
  rowMapper: (row: unknown[], columns: string[], entityName: string) => Record<string, number>;
  /** Optional filter function - return false to skip a point */
  filter?: (point: P) => boolean;
  /** Optional value transformer (e.g., isValidSignal check) - return false to skip the value */
  valueFilter?: (value: number, key: string) => boolean;
}

/**
 * Aggregates time series data from multiple entities into a single time-indexed structure.
 */
export function aggregateMultiEntityTimeSeries<P extends { time: string }>(
  config: AggregateTimeSeriesConfig<P>
): { data: P[]; entities: string[] } {
  const { response, entityTag, rowMapper, filter, valueFilter } = config;
  const allSeries = response.results[0]?.series || [];
  const timeMap = new Map<string, P>();

  for (const series of allSeries) {
    const entityName = series.tags?.[entityTag] || "unknown";

    for (const row of series.values) {
      const time = row[0] as string;
      const mappedValues = rowMapper(row, series.columns, entityName);

      // Apply value filter if provided
      if (valueFilter) {
        const allFiltered = Object.entries(mappedValues).every(
          ([key, value]) => !valueFilter(value, key)
        );
        if (allFiltered) continue;
      }

      if (!timeMap.has(time)) {
        timeMap.set(time, { time } as P);
      }

      const point = timeMap.get(time)!;
      for (const [key, value] of Object.entries(mappedValues)) {
        if (!valueFilter || valueFilter(value, key)) {
          (point as Record<string, unknown>)[key] = value;
        }
      }
    }
  }

  // Convert to sorted array
  let result = Array.from(timeMap.values()).sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  );

  // Apply filter if provided
  if (filter) {
    result = result.filter(filter);
  }

  // Extract unique entity names
  const entities = [...new Set(allSeries.map((s) => s.tags?.[entityTag] || "unknown"))];

  return { data: result, entities };
}

/**
 * Default filter that removes points where all numeric values are 0
 */
export function filterZeroPoints<P extends { time: string }>(point: P): boolean {
  const values = Object.values(point).filter((v) => typeof v === "number") as number[];
  return values.some((v) => v > 0);
}
