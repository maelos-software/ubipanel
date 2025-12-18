import { describe, it, expect } from "vitest";
import {
  parseInfluxResults,
  parseInfluxGroupByResults,
  createValueGetter,
  buildLatestQuery,
  escapeInfluxString,
  escapeInfluxIdentifier,
  validateTimeRange,
  validateIdentifier,
  getNumberValue,
  getStringValue,
  getBooleanValue,
} from "../../src/lib/influx";
import type { InfluxResponse } from "../../src/types/influx";

describe("parseInfluxResults", () => {
  it("returns empty array for empty results", () => {
    const response: InfluxResponse = { results: [{ statement_id: 0 }] };
    const result = parseInfluxResults(response, () => ({}));
    expect(result).toEqual([]);
  });

  it("returns empty array when series is missing", () => {
    const response: InfluxResponse = { results: [{ statement_id: 0, series: undefined }] };
    const result = parseInfluxResults(response, () => ({}));
    expect(result).toEqual([]);
  });

  it("parses single series with multiple rows", () => {
    const response: InfluxResponse = {
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "clients",
              columns: ["time", "rx_bytes", "signal"],
              values: [
                ["2025-12-12T00:00:00Z", 1024, -65],
                ["2025-12-12T00:01:00Z", 2048, -60],
              ],
            },
          ],
        },
      ],
    };

    interface ClientRow {
      time: string;
      rxBytes: number;
      signal: number;
    }

    const result = parseInfluxResults<ClientRow>(response, (columns, values) => ({
      time: values[columns.indexOf("time")] as string,
      rxBytes: values[columns.indexOf("rx_bytes")] as number,
      signal: values[columns.indexOf("signal")] as number,
    }));

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      time: "2025-12-12T00:00:00Z",
      rxBytes: 1024,
      signal: -65,
    });
    expect(result[1]).toEqual({
      time: "2025-12-12T00:01:00Z",
      rxBytes: 2048,
      signal: -60,
    });
  });

  it("handles missing columns gracefully", () => {
    const response: InfluxResponse = {
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "clients",
              columns: ["time", "rx_bytes"],
              values: [["2025-12-12T00:00:00Z", 1024]],
            },
          ],
        },
      ],
    };

    const result = parseInfluxResults(response, (columns, values) => ({
      rxBytes: values[columns.indexOf("rx_bytes")] as number,
      signal: values[columns.indexOf("signal")] ?? null, // missing column
    }));

    expect(result[0]).toEqual({
      rxBytes: 1024,
      signal: null,
    });
  });
});

describe("parseInfluxGroupByResults", () => {
  it("returns empty array for empty results", () => {
    const response: InfluxResponse = { results: [{ statement_id: 0 }] };
    const result = parseInfluxGroupByResults(response, () => ({}));
    expect(result).toEqual([]);
  });

  it("parses multiple series with tags", () => {
    const response: InfluxResponse = {
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "clients",
              tags: { mac: "aa:bb:cc:dd:ee:ff", name: "iPhone" },
              columns: ["time", "rx_bytes"],
              values: [["2025-12-12T00:00:00Z", 1024]],
            },
            {
              name: "clients",
              tags: { mac: "11:22:33:44:55:66", name: "MacBook" },
              columns: ["time", "rx_bytes"],
              values: [["2025-12-12T00:00:00Z", 2048]],
            },
          ],
        },
      ],
    };

    interface Client {
      mac: string;
      name: string;
      rxBytes: number;
    }

    const result = parseInfluxGroupByResults<Client>(response, (columns, values, tags) => ({
      mac: tags?.mac || "",
      name: tags?.name || "",
      rxBytes: values[columns.indexOf("rx_bytes")] as number,
    }));

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ mac: "aa:bb:cc:dd:ee:ff", name: "iPhone", rxBytes: 1024 });
    expect(result[1]).toEqual({ mac: "11:22:33:44:55:66", name: "MacBook", rxBytes: 2048 });
  });

  it("handles series with multiple values per group", () => {
    const response: InfluxResponse = {
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "clients",
              tags: { mac: "aa:bb:cc:dd:ee:ff" },
              columns: ["time", "rx_bytes"],
              values: [
                ["2025-12-12T00:00:00Z", 1024],
                ["2025-12-12T00:01:00Z", 2048],
              ],
            },
          ],
        },
      ],
    };

    const result = parseInfluxGroupByResults(response, (columns, values, tags) => ({
      mac: tags?.mac,
      rxBytes: values[columns.indexOf("rx_bytes")],
    }));

    expect(result).toHaveLength(2);
    expect(result[0].rxBytes).toBe(1024);
    expect(result[1].rxBytes).toBe(2048);
  });

  it("handles series without tags", () => {
    const response: InfluxResponse = {
      results: [
        {
          statement_id: 0,
          series: [
            {
              name: "clients",
              columns: ["time", "count"],
              values: [["2025-12-12T00:00:00Z", 42]],
            },
          ],
        },
      ],
    };

    const result = parseInfluxGroupByResults(response, (columns, values, tags) => ({
      hasTags: !!tags,
      count: values[columns.indexOf("count")],
    }));

    expect(result[0]).toEqual({ hasTags: false, count: 42 });
  });
});

describe("createValueGetter", () => {
  it("returns value for existing column", () => {
    const columns = ["time", "rx_bytes", "signal"];
    const values = ["2025-12-12T00:00:00Z", 1024, -65];
    const getValue = createValueGetter(columns, values);

    expect(getValue("time")).toBe("2025-12-12T00:00:00Z");
    expect(getValue("rx_bytes")).toBe(1024);
    expect(getValue("signal")).toBe(-65);
  });

  it("returns null for missing column", () => {
    const columns = ["time", "rx_bytes"];
    const values = ["2025-12-12T00:00:00Z", 1024];
    const getValue = createValueGetter(columns, values);

    expect(getValue("signal")).toBeNull();
    expect(getValue("nonexistent")).toBeNull();
  });

  it("handles empty columns/values", () => {
    const getValue = createValueGetter([], []);
    expect(getValue("anything")).toBeNull();
  });
});

describe("buildLatestQuery", () => {
  it("builds basic query without where or group by", () => {
    const query = buildLatestQuery("clients", ["last(rx_bytes)", "last(tx_bytes)"]);
    expect(query).toContain("SELECT last(rx_bytes), last(tx_bytes)");
    expect(query).toContain("FROM clients");
    expect(query).toContain("ORDER BY time DESC LIMIT 1");
  });

  it("includes WHERE clause when provided", () => {
    const query = buildLatestQuery("clients", ["last(rx_bytes)"], undefined, "time > now() - 5m");
    expect(query).toContain("WHERE time > now() - 5m");
  });

  it("includes GROUP BY clause when provided", () => {
    const query = buildLatestQuery("clients", ["last(rx_bytes)"], ["mac", "name"]);
    expect(query).toContain('GROUP BY "mac", "name"');
  });

  it("includes both WHERE and GROUP BY", () => {
    const query = buildLatestQuery(
      "clients",
      ["last(rx_bytes)", "last(signal)"],
      ["mac"],
      "time > now() - 5m"
    );
    expect(query).toContain("SELECT last(rx_bytes), last(signal)");
    expect(query).toContain("FROM clients");
    expect(query).toContain("WHERE time > now() - 5m");
    expect(query).toContain('GROUP BY "mac"');
  });
});

// ============================================================================
// Query Safety Utilities Tests
// ============================================================================

describe("escapeInfluxString", () => {
  it("escapes single quotes by doubling them", () => {
    expect(escapeInfluxString("O'Brien")).toBe("O''Brien");
    expect(escapeInfluxString("it's")).toBe("it''s");
    expect(escapeInfluxString("'quoted'")).toBe("''quoted''");
  });

  it("handles strings without quotes", () => {
    expect(escapeInfluxString("simple")).toBe("simple");
    expect(escapeInfluxString("test-value")).toBe("test-value");
  });

  it("handles empty strings", () => {
    expect(escapeInfluxString("")).toBe("");
  });

  it("handles multiple quotes", () => {
    expect(escapeInfluxString("'''")).toBe("''''''");
    expect(escapeInfluxString("a'b'c")).toBe("a''b''c");
  });

  it("converts non-strings to strings", () => {
    expect(escapeInfluxString(123 as unknown as string)).toBe("123");
    expect(escapeInfluxString(null as unknown as string)).toBe("null");
  });
});

describe("escapeInfluxIdentifier", () => {
  it("escapes double quotes by doubling them", () => {
    expect(escapeInfluxIdentifier('my"field')).toBe('my""field');
    expect(escapeInfluxIdentifier('"quoted"')).toBe('""quoted""');
  });

  it("handles identifiers without quotes", () => {
    expect(escapeInfluxIdentifier("simple_field")).toBe("simple_field");
    expect(escapeInfluxIdentifier("rx_bytes")).toBe("rx_bytes");
  });

  it("handles empty strings", () => {
    expect(escapeInfluxIdentifier("")).toBe("");
  });

  it("converts non-strings to strings", () => {
    expect(escapeInfluxIdentifier(123 as unknown as string)).toBe("123");
  });
});

describe("validateTimeRange", () => {
  it("accepts valid time ranges", () => {
    expect(validateTimeRange("1m")).toBe("1m");
    expect(validateTimeRange("5m")).toBe("5m");
    expect(validateTimeRange("1h")).toBe("1h");
    expect(validateTimeRange("24h")).toBe("24h");
    expect(validateTimeRange("7d")).toBe("7d");
    expect(validateTimeRange("30d")).toBe("30d");
  });

  it("rejects invalid time ranges", () => {
    expect(() => validateTimeRange("")).toThrow("Invalid time range");
    expect(() => validateTimeRange("abc")).toThrow("Invalid time range");
    expect(() => validateTimeRange("1")).toThrow("Invalid time range");
    expect(() => validateTimeRange("h")).toThrow("Invalid time range");
    expect(() => validateTimeRange("1x")).toThrow("Invalid time range");
    expect(() => validateTimeRange("-1h")).toThrow("Invalid time range");
    expect(() => validateTimeRange("1h; DROP")).toThrow("Invalid time range");
  });
});

describe("validateIdentifier", () => {
  it("accepts valid identifiers", () => {
    expect(validateIdentifier("rx_bytes")).toBe("rx_bytes");
    expect(validateIdentifier("tx_bytes")).toBe("tx_bytes");
    expect(validateIdentifier("device_name")).toBe("device_name");
    expect(validateIdentifier("MyField")).toBe("MyField");
    expect(validateIdentifier("_private")).toBe("_private");
    expect(validateIdentifier("field-name")).toBe("field-name");
  });

  it("rejects invalid identifiers", () => {
    expect(() => validateIdentifier("")).toThrow("Invalid identifier");
    expect(() => validateIdentifier("123start")).toThrow("Invalid identifier");
    expect(() => validateIdentifier("has space")).toThrow("Invalid identifier");
    expect(() => validateIdentifier("has'quote")).toThrow("Invalid identifier");
    expect(() => validateIdentifier('has"quote')).toThrow("Invalid identifier");
    expect(() => validateIdentifier("has;semicolon")).toThrow("Invalid identifier");
  });
});

// ============================================================================
// Typed Value Getters Tests
// ============================================================================

describe("getNumberValue", () => {
  const columns = ["time", "rx_bytes", "signal", "null_val", "string_num"];
  const values = ["2025-12-12T00:00:00Z", 1024, -65, null, "42.5"];

  it("returns number for existing column", () => {
    expect(getNumberValue(columns, values, "rx_bytes")).toBe(1024);
    expect(getNumberValue(columns, values, "signal")).toBe(-65);
  });

  it("returns default for missing column", () => {
    expect(getNumberValue(columns, values, "nonexistent")).toBe(0);
    expect(getNumberValue(columns, values, "nonexistent", -1)).toBe(-1);
  });

  it("returns default for null value", () => {
    expect(getNumberValue(columns, values, "null_val")).toBe(0);
    expect(getNumberValue(columns, values, "null_val", 999)).toBe(999);
  });

  it("parses string numbers", () => {
    expect(getNumberValue(columns, values, "string_num")).toBe(42.5);
  });

  it("handles NaN and Infinity", () => {
    const cols = ["nan", "inf", "ninf"];
    const vals = [NaN, Infinity, -Infinity];
    expect(getNumberValue(cols, vals, "nan")).toBe(0);
    expect(getNumberValue(cols, vals, "inf")).toBe(0);
    expect(getNumberValue(cols, vals, "ninf")).toBe(0);
  });

  it("handles empty arrays", () => {
    expect(getNumberValue([], [], "anything")).toBe(0);
    expect(getNumberValue([], [], "anything", 42)).toBe(42);
  });
});

describe("getStringValue", () => {
  const columns = ["time", "name", "hostname", "null_val", "number_val"];
  const values = ["2025-12-12T00:00:00Z", "iPhone", "", null, 123];

  it("returns string for existing column", () => {
    expect(getStringValue(columns, values, "name")).toBe("iPhone");
    expect(getStringValue(columns, values, "time")).toBe("2025-12-12T00:00:00Z");
  });

  it("returns empty string for empty value", () => {
    expect(getStringValue(columns, values, "hostname")).toBe("");
  });

  it("returns default for missing column", () => {
    expect(getStringValue(columns, values, "nonexistent")).toBe("");
    expect(getStringValue(columns, values, "nonexistent", "default")).toBe("default");
  });

  it("returns default for null value", () => {
    expect(getStringValue(columns, values, "null_val")).toBe("");
    expect(getStringValue(columns, values, "null_val", "unknown")).toBe("unknown");
  });

  it("converts numbers to strings", () => {
    expect(getStringValue(columns, values, "number_val")).toBe("123");
  });

  it("handles empty arrays", () => {
    expect(getStringValue([], [], "anything")).toBe("");
    expect(getStringValue([], [], "anything", "default")).toBe("default");
  });
});

describe("getBooleanValue", () => {
  const columns = ["is_wired", "is_guest", "null_val", "string_true", "string_false", "number_one"];
  const values = [true, false, null, "true", "false", 1];

  it("returns boolean for existing column", () => {
    expect(getBooleanValue(columns, values, "is_wired")).toBe(true);
    expect(getBooleanValue(columns, values, "is_guest")).toBe(false);
  });

  it("returns default for missing column", () => {
    expect(getBooleanValue(columns, values, "nonexistent")).toBe(false);
    expect(getBooleanValue(columns, values, "nonexistent", true)).toBe(true);
  });

  it("returns default for null value", () => {
    expect(getBooleanValue(columns, values, "null_val")).toBe(false);
    expect(getBooleanValue(columns, values, "null_val", true)).toBe(true);
  });

  it("parses string booleans (case insensitive)", () => {
    expect(getBooleanValue(columns, values, "string_true")).toBe(true);
    expect(getBooleanValue(columns, values, "string_false")).toBe(false);

    const cols2 = ["upper"];
    const vals2 = ["TRUE"];
    expect(getBooleanValue(cols2, vals2, "upper")).toBe(true);
  });

  it("treats non-zero numbers as true", () => {
    expect(getBooleanValue(columns, values, "number_one")).toBe(true);

    const cols2 = ["zero"];
    const vals2 = [0];
    expect(getBooleanValue(cols2, vals2, "zero")).toBe(false);
  });

  it("handles empty arrays", () => {
    expect(getBooleanValue([], [], "anything")).toBe(false);
    expect(getBooleanValue([], [], "anything", true)).toBe(true);
  });
});
