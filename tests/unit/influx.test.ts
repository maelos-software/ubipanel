import { describe, it, expect } from "vitest";
import {
  parseInfluxResults,
  parseInfluxGroupByResults,
  buildLatestQuery,
  createValueGetter,
  getNumberValue,
  getStringValue,
  getBooleanValue,
  escapeInfluxString,
  escapeInfluxIdentifier,
  validateTimeRange,
  validateIdentifier,
} from "../../src/lib/influx";
import type { InfluxResponse } from "../../src/types/influx";

describe("parseInfluxResults", () => {
  it("should parse basic single series results", () => {
    const response: InfluxResponse = {
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "test",
              columns: ["time", "name", "value"],
              values: [
                ["2024-01-01T00:00:00Z", "item1", 100],
                ["2024-01-01T00:01:00Z", "item2", 200],
              ],
            },
          ],
        },
      ],
    };

    const result = parseInfluxResults(response, (cols, vals) => ({
      time: vals[cols.indexOf("time")] as string,
      name: vals[cols.indexOf("name")] as string,
      value: vals[cols.indexOf("value")] as number,
    }));

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ time: "2024-01-01T00:00:00Z", name: "item1", value: 100 });
    expect(result[1]).toEqual({ time: "2024-01-01T00:01:00Z", name: "item2", value: 200 });
  });

  it("should return empty array for missing series", () => {
    const response: InfluxResponse = {
      results: [{ statement_id: 0 }],
    };
    const result = parseInfluxResults(response, () => ({}));
    expect(result).toEqual([]);
  });

  it("should return empty array for empty results", () => {
    const response: InfluxResponse = {
      results: [],
    };
    const result = parseInfluxResults(response, () => ({}));
    expect(result).toEqual([]);
  });
});

describe("parseInfluxGroupByResults", () => {
  it("should parse multiple series with tags", () => {
    const response: InfluxResponse = {
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "clients",
              tags: { mac: "aa:bb:cc:dd:ee:01" },
              columns: ["time", "rx_bytes"],
              values: [["2024-01-01T00:00:00Z", 1000]],
            },
            {
              name: "clients",
              tags: { mac: "aa:bb:cc:dd:ee:02" },
              columns: ["time", "rx_bytes"],
              values: [["2024-01-01T00:00:00Z", 2000]],
            },
          ],
        },
      ],
    };

    const result = parseInfluxGroupByResults(response, (cols, vals, tags) => ({
      mac: tags?.mac,
      rx: vals[cols.indexOf("rx_bytes")] as number,
    }));

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ mac: "aa:bb:cc:dd:ee:01", rx: 1000 });
    expect(result[1]).toEqual({ mac: "aa:bb:cc:dd:ee:02", rx: 2000 });
  });

  it("should handle multiple values per series", () => {
    const response: InfluxResponse = {
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "test",
              tags: { device: "ap1" },
              columns: ["time", "value"],
              values: [
                ["2024-01-01T00:00:00Z", 10],
                ["2024-01-01T00:01:00Z", 20],
              ],
            },
          ],
        },
      ],
    };

    const result = parseInfluxGroupByResults(response, (cols, vals, tags) => ({
      device: tags?.device,
      value: vals[cols.indexOf("value")] as number,
    }));

    expect(result).toHaveLength(2);
    expect(result[0].device).toBe("ap1");
    expect(result[1].device).toBe("ap1");
  });

  it("should return empty array for missing series", () => {
    const response: InfluxResponse = {
      results: [{ statement_id: 0 }],
    };
    const result = parseInfluxGroupByResults(response, () => ({}));
    expect(result).toEqual([]);
  });
});

describe("buildLatestQuery", () => {
  it("should build basic query", () => {
    const query = buildLatestQuery("clients", ["rx_bytes", "tx_bytes"]);
    // Note: double spaces between clauses when optional clauses are empty
    expect(query).toContain("SELECT rx_bytes, tx_bytes FROM clients");
    expect(query).toContain("ORDER BY time DESC LIMIT 1");
  });

  it("should include GROUP BY clause", () => {
    const query = buildLatestQuery("clients", ["rx_bytes"], ["mac", "name"]);
    expect(query).toContain('GROUP BY "mac", "name"');
  });

  it("should include WHERE clause", () => {
    const query = buildLatestQuery("clients", ["rx_bytes"], undefined, "time > now() - 1h");
    expect(query).toContain("WHERE time > now() - 1h");
  });

  it("should include both GROUP BY and WHERE", () => {
    const query = buildLatestQuery("clients", ["rx_bytes"], ["mac"], "is_wired = 'false'");
    expect(query).toContain("WHERE is_wired = 'false'");
    expect(query).toContain('GROUP BY "mac"');
  });
});

describe("createValueGetter", () => {
  const columns = ["time", "name", "value", "optional"];
  const values = ["2024-01-01", "test", 42, null];

  it("should get values by column name", () => {
    const get = createValueGetter(columns, values);
    expect(get("name")).toBe("test");
    expect(get("value")).toBe(42);
  });

  it("should return null for unknown columns", () => {
    const get = createValueGetter(columns, values);
    expect(get("unknown")).toBeNull();
  });

  it("should return null for null values", () => {
    const get = createValueGetter(columns, values);
    expect(get("optional")).toBeNull();
  });
});

describe("getNumberValue", () => {
  const columns = ["id", "count", "rate", "empty", "string_num"];
  const values = [1, 100, 3.14, null, "42"];

  it("should get number values", () => {
    expect(getNumberValue(columns, values, "id")).toBe(1);
    expect(getNumberValue(columns, values, "count")).toBe(100);
    expect(getNumberValue(columns, values, "rate")).toBe(3.14);
  });

  it("should return default for null values", () => {
    expect(getNumberValue(columns, values, "empty")).toBe(0);
    expect(getNumberValue(columns, values, "empty", -1)).toBe(-1);
  });

  it("should return default for missing columns", () => {
    expect(getNumberValue(columns, values, "unknown")).toBe(0);
    expect(getNumberValue(columns, values, "unknown", 99)).toBe(99);
  });

  it("should parse string numbers", () => {
    expect(getNumberValue(columns, values, "string_num")).toBe(42);
  });

  it("should return default for NaN results", () => {
    const cols = ["bad"];
    const vals = ["not a number"];
    expect(getNumberValue(cols, vals, "bad")).toBe(0);
  });

  it("should handle Infinity by returning default", () => {
    const cols = ["inf"];
    const vals = [Infinity];
    expect(getNumberValue(cols, vals, "inf")).toBe(0);
  });
});

describe("getStringValue", () => {
  const columns = ["name", "empty", "number"];
  const values = ["test", null, 42];

  it("should get string values", () => {
    expect(getStringValue(columns, values, "name")).toBe("test");
  });

  it("should return default for null values", () => {
    expect(getStringValue(columns, values, "empty")).toBe("");
    expect(getStringValue(columns, values, "empty", "default")).toBe("default");
  });

  it("should return default for missing columns", () => {
    expect(getStringValue(columns, values, "unknown")).toBe("");
  });

  it("should convert numbers to strings", () => {
    expect(getStringValue(columns, values, "number")).toBe("42");
  });
});

describe("getBooleanValue", () => {
  const columns = ["active", "empty", "string_true", "string_false", "num_true", "num_false"];
  const values = [true, null, "true", "false", 1, 0];

  it("should get boolean values", () => {
    expect(getBooleanValue(columns, values, "active")).toBe(true);
  });

  it("should return default for null values", () => {
    expect(getBooleanValue(columns, values, "empty")).toBe(false);
    expect(getBooleanValue(columns, values, "empty", true)).toBe(true);
  });

  it("should return default for missing columns", () => {
    expect(getBooleanValue(columns, values, "unknown")).toBe(false);
  });

  it("should parse string booleans", () => {
    expect(getBooleanValue(columns, values, "string_true")).toBe(true);
    expect(getBooleanValue(columns, values, "string_false")).toBe(false);
  });

  it("should convert numbers to booleans", () => {
    expect(getBooleanValue(columns, values, "num_true")).toBe(true);
    expect(getBooleanValue(columns, values, "num_false")).toBe(false);
  });

  it("should handle case-insensitive string booleans", () => {
    const cols = ["upper", "mixed"];
    const vals = ["TRUE", "True"];
    expect(getBooleanValue(cols, vals, "upper")).toBe(true);
    expect(getBooleanValue(cols, vals, "mixed")).toBe(true);
  });
});

describe("escapeInfluxString", () => {
  it("should escape single quotes by doubling", () => {
    expect(escapeInfluxString("O'Brien")).toBe("O''Brien");
  });

  it("should handle multiple single quotes", () => {
    expect(escapeInfluxString("it's Bob's")).toBe("it''s Bob''s");
  });

  it("should not modify strings without quotes", () => {
    expect(escapeInfluxString("simple")).toBe("simple");
  });

  it("should handle empty string", () => {
    expect(escapeInfluxString("")).toBe("");
  });

  it("should convert non-strings to strings", () => {
    expect(escapeInfluxString(42 as unknown as string)).toBe("42");
    expect(escapeInfluxString(null as unknown as string)).toBe("null");
  });
});

describe("escapeInfluxIdentifier", () => {
  it("should escape double quotes by doubling", () => {
    expect(escapeInfluxIdentifier('field"name')).toBe('field""name');
  });

  it("should handle multiple double quotes", () => {
    expect(escapeInfluxIdentifier('"test"')).toBe('""test""');
  });

  it("should not modify identifiers without quotes", () => {
    expect(escapeInfluxIdentifier("simple_field")).toBe("simple_field");
  });

  it("should convert non-strings to strings", () => {
    expect(escapeInfluxIdentifier(123 as unknown as string)).toBe("123");
  });
});

describe("validateTimeRange", () => {
  it("should accept valid time ranges", () => {
    expect(validateTimeRange("1m")).toBe("1m");
    expect(validateTimeRange("5m")).toBe("5m");
    expect(validateTimeRange("1h")).toBe("1h");
    expect(validateTimeRange("24h")).toBe("24h");
    expect(validateTimeRange("7d")).toBe("7d");
    expect(validateTimeRange("30d")).toBe("30d");
  });

  it("should throw for invalid time ranges", () => {
    expect(() => validateTimeRange("invalid")).toThrow("Invalid time range");
    expect(() => validateTimeRange("1x")).toThrow("Invalid time range");
    expect(() => validateTimeRange("")).toThrow("Invalid time range");
    expect(() => validateTimeRange("h1")).toThrow("Invalid time range");
    expect(() => validateTimeRange("-1h")).toThrow("Invalid time range");
  });

  it("should reject time ranges with spaces", () => {
    expect(() => validateTimeRange("1 h")).toThrow("Invalid time range");
  });

  it("should reject SQL injection attempts", () => {
    expect(() => validateTimeRange("1h; DROP TABLE users")).toThrow("Invalid time range");
    expect(() => validateTimeRange("1h' OR '1'='1")).toThrow("Invalid time range");
  });
});

describe("validateIdentifier", () => {
  it("should accept valid identifiers", () => {
    expect(validateIdentifier("clients")).toBe("clients");
    expect(validateIdentifier("rx_bytes")).toBe("rx_bytes");
    expect(validateIdentifier("_private")).toBe("_private");
    expect(validateIdentifier("test123")).toBe("test123");
    expect(validateIdentifier("client-name")).toBe("client-name");
  });

  it("should throw for invalid identifiers", () => {
    expect(() => validateIdentifier("123start")).toThrow("Invalid identifier");
    expect(() => validateIdentifier("has space")).toThrow("Invalid identifier");
    expect(() => validateIdentifier("has.dot")).toThrow("Invalid identifier");
    expect(() => validateIdentifier("")).toThrow("Invalid identifier");
  });

  it("should reject SQL injection attempts", () => {
    expect(() => validateIdentifier("table; DROP")).toThrow("Invalid identifier");
    expect(() => validateIdentifier("col'--")).toThrow("Invalid identifier");
  });
});
