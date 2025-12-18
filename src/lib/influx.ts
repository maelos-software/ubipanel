import type { InfluxResponse } from "@/types/influx";

// API endpoint - uses base path from Vite config
const API_URL = `${import.meta.env.BASE_URL}api/query`;

export async function queryInflux(query: string): Promise<InfluxResponse> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `q=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    throw new Error(`InfluxDB query failed: ${response.statusText}`);
  }

  return response.json();
}

// Helper to parse InfluxDB results into objects
export function parseInfluxResults<T>(
  response: InfluxResponse,
  mapper: (columns: string[], values: unknown[]) => T
): T[] {
  const series = response.results[0]?.series?.[0];
  if (!series) return [];

  return series.values.map((row) => mapper(series.columns, row));
}

// Helper to parse InfluxDB GROUP BY results (multiple series with tags)
export function parseInfluxGroupByResults<T>(
  response: InfluxResponse,
  mapper: (columns: string[], values: unknown[], tags?: Record<string, string>) => T
): T[] {
  const allSeries = response.results[0]?.series;
  if (!allSeries) return [];

  const results: T[] = [];
  for (const series of allSeries) {
    for (const row of series.values) {
      results.push(mapper(series.columns, row, series.tags));
    }
  }
  return results;
}

// Helper to get latest value from a measurement
export function buildLatestQuery(
  measurement: string,
  fields: string[],
  groupBy?: string[],
  where?: string
): string {
  const fieldList = fields.join(", ");
  const groupByClause = groupBy ? `GROUP BY ${groupBy.map((g) => `"${g}"`).join(", ")}` : "";
  const whereClause = where ? `WHERE ${where}` : "";

  return `SELECT ${fieldList} FROM ${measurement} ${whereClause} ${groupByClause} ORDER BY time DESC LIMIT 1`;
}

/**
 * Creates an efficient, safe value getter for InfluxDB results.
 * Pre-computes column indices to avoid repeated indexOf calls.
 *
 * Returns a function that gets the raw value, with attached helpers
 * for typed access.
 *
 * @param columns Column names from InfluxDB series
 * @param values Values array for a single row
 */
export function createValueGetter(columns: string[], values: unknown[]) {
  const columnMap: Record<string, number> = {};
  for (let i = 0; i < columns.length; i++) {
    columnMap[columns[i]] = i;
  }

  const getRaw = (key: string): unknown => {
    const idx = columnMap[key];
    if (idx === undefined) {
      if (import.meta.env.DEV) {
        console.warn(`[InfluxDB] Column "${key}" not found. Available: ${columns.join(", ")}`);
      }
      return null;
    }
    return values[idx];
  };

  const getter = (key: string) => getRaw(key);

  getter.number = (key: string, defaultValue = 0): number => {
    const val = getRaw(key);
    if (val === null || val === undefined) return defaultValue;
    if (typeof val === "number") return Number.isFinite(val) ? val : defaultValue;
    if (typeof val === "string") {
      const parsed = parseFloat(val);
      return Number.isFinite(parsed) ? parsed : defaultValue;
    }
    return defaultValue;
  };

  getter.string = (key: string, defaultValue = ""): string => {
    const val = getRaw(key);
    return val !== null && val !== undefined ? String(val) : defaultValue;
  };

  getter.boolean = (key: string, defaultValue = false): boolean => {
    const val = getRaw(key);
    if (val === null || val === undefined) return defaultValue;
    if (typeof val === "boolean") return val;
    if (typeof val === "string") return val.toLowerCase() === "true";
    if (typeof val === "number") return val !== 0;
    return defaultValue;
  };

  return getter;
}

// ============================================================================
// Legacy Helpers (optimized with pre-computed map if possible, but keeping signature)
// ============================================================================

/**
 * Safely get a number value from InfluxDB column/value arrays.
 */
export function getNumberValue(
  columns: string[],
  values: unknown[],
  key: string,
  defaultValue = 0
): number {
  const idx = columns.indexOf(key);
  if (idx < 0) return defaultValue;
  const val = values[idx];
  if (val === null || val === undefined) return defaultValue;
  if (typeof val === "number") return Number.isFinite(val) ? val : defaultValue;
  if (typeof val === "string") {
    const parsed = parseFloat(val);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }
  return defaultValue;
}

/**
 * Safely get a string value from InfluxDB column/value arrays.
 */
export function getStringValue(
  columns: string[],
  values: unknown[],
  key: string,
  defaultValue = ""
): string {
  const idx = columns.indexOf(key);
  if (idx < 0) return defaultValue;
  const val = values[idx];
  return val !== null && val !== undefined ? String(val) : defaultValue;
}

/**
 * Safely get a boolean value from InfluxDB column/value arrays.
 */
export function getBooleanValue(
  columns: string[],
  values: unknown[],
  key: string,
  defaultValue = false
): boolean {
  const idx = columns.indexOf(key);
  if (idx < 0) return defaultValue;
  const val = values[idx];
  if (val === null || val === undefined) return defaultValue;
  if (typeof val === "boolean") return val;
  if (typeof val === "string") return val.toLowerCase() === "true";
  if (typeof val === "number") return val !== 0;
  return defaultValue;
}

// ============================================================================
// Query Safety Utilities
// ============================================================================

/**
 * Escapes a string value for use in InfluxQL WHERE clauses.
 * Single quotes are escaped by doubling them.
 */
export function escapeInfluxString(value: string): string {
  if (typeof value !== "string") {
    return String(value);
  }
  return value.replace(/'/g, "''");
}

/**
 * Escapes an identifier (field name, tag name) for use in InfluxQL.
 * Double quotes are escaped by doubling them.
 */
export function escapeInfluxIdentifier(identifier: string): string {
  if (typeof identifier !== "string") {
    return String(identifier);
  }
  return identifier.replace(/"/g, '""');
}

/**
 * Validates that a value is a safe time range string.
 */
export function validateTimeRange(value: string): string {
  const timeRangePattern = /^\d+[mhd]$/;
  if (!timeRangePattern.test(value)) {
    throw new Error(`Invalid time range: ${value}`);
  }
  return value;
}

/**
 * Validates that a value is a safe measurement or tag name.
 */
export function validateIdentifier(value: string): string {
  const identifierPattern = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
  if (!identifierPattern.test(value)) {
    throw new Error(`Invalid identifier: ${value}`);
  }
  return value;
}
