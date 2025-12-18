import { describe, it, expect } from "vitest";
import { aggregateMultiEntityTimeSeries, filterZeroPoints } from "../../src/hooks/history/types";

describe("aggregateMultiEntityTimeSeries", () => {
  it("aggregates multiple series by entity tag", () => {
    const response = {
      results: [
        {
          series: [
            {
              name: "uap",
              tags: { name: "AP-1" },
              columns: ["time", "num_sta"],
              values: [
                ["2024-01-01T00:00:00Z", 5],
                ["2024-01-01T00:01:00Z", 6],
              ],
            },
            {
              name: "uap",
              tags: { name: "AP-2" },
              columns: ["time", "num_sta"],
              values: [
                ["2024-01-01T00:00:00Z", 3],
                ["2024-01-01T00:01:00Z", 4],
              ],
            },
          ],
        },
      ],
    };

    const result = aggregateMultiEntityTimeSeries<{ time: string; [key: string]: string | number }>(
      {
        response,
        entityTag: "name",
        rowMapper: (row, columns, entityName) => ({
          [entityName]: (row[columns.indexOf("num_sta")] as number) || 0,
        }),
      }
    );

    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toEqual({
      time: "2024-01-01T00:00:00Z",
      "AP-1": 5,
      "AP-2": 3,
    });
    expect(result.data[1]).toEqual({
      time: "2024-01-01T00:01:00Z",
      "AP-1": 6,
      "AP-2": 4,
    });
    expect(result.entities).toEqual(["AP-1", "AP-2"]);
  });

  it("creates composite keys in rowMapper", () => {
    const response = {
      results: [
        {
          series: [
            {
              name: "usg_wan_ports",
              tags: { ifname: "eth9" },
              columns: ["time", "rx_rate", "tx_rate"],
              values: [["2024-01-01T00:00:00Z", 1000, 500]],
            },
          ],
        },
      ],
    };

    const result = aggregateMultiEntityTimeSeries<{ time: string; [key: string]: string | number }>(
      {
        response,
        entityTag: "ifname",
        rowMapper: (row, columns, ifname) => ({
          [`${ifname}_rx`]: (row[columns.indexOf("rx_rate")] as number) || 0,
          [`${ifname}_tx`]: (row[columns.indexOf("tx_rate")] as number) || 0,
        }),
      }
    );

    expect(result.data[0]).toEqual({
      time: "2024-01-01T00:00:00Z",
      eth9_rx: 1000,
      eth9_tx: 500,
    });
    expect(result.entities).toEqual(["eth9"]);
  });

  it("applies filter function to results", () => {
    const response = {
      results: [
        {
          series: [
            {
              name: "test",
              tags: { name: "entity" },
              columns: ["time", "value"],
              values: [
                ["2024-01-01T00:00:00Z", 0],
                ["2024-01-01T00:01:00Z", 10],
                ["2024-01-01T00:02:00Z", 0],
              ],
            },
          ],
        },
      ],
    };

    const result = aggregateMultiEntityTimeSeries<{ time: string; [key: string]: string | number }>(
      {
        response,
        entityTag: "name",
        rowMapper: (row, columns, name) => ({
          [name]: (row[columns.indexOf("value")] as number) || 0,
        }),
        filter: filterZeroPoints,
      }
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0].time).toBe("2024-01-01T00:01:00Z");
  });

  it("applies valueFilter to skip invalid values", () => {
    const response = {
      results: [
        {
          series: [
            {
              name: "test",
              tags: { name: "AP-1" },
              columns: ["time", "signal"],
              values: [
                ["2024-01-01T00:00:00Z", -50],
                ["2024-01-01T00:01:00Z", 0], // Invalid signal
                ["2024-01-01T00:02:00Z", -60],
              ],
            },
          ],
        },
      ],
    };

    const result = aggregateMultiEntityTimeSeries<{ time: string; [key: string]: string | number }>(
      {
        response,
        entityTag: "name",
        rowMapper: (row, columns, name) => ({
          [name]: (row[columns.indexOf("signal")] as number) || 0,
        }),
        valueFilter: (value) => value < 0, // Only valid if negative (signal dBm)
      }
    );

    expect(result.data).toHaveLength(2);
    expect(result.data[0]["AP-1"]).toBe(-50);
    expect(result.data[1]["AP-1"]).toBe(-60);
  });

  it("sorts results by time ascending", () => {
    const response = {
      results: [
        {
          series: [
            {
              name: "test",
              tags: { name: "entity" },
              columns: ["time", "value"],
              values: [
                ["2024-01-01T00:02:00Z", 3],
                ["2024-01-01T00:00:00Z", 1],
                ["2024-01-01T00:01:00Z", 2],
              ],
            },
          ],
        },
      ],
    };

    const result = aggregateMultiEntityTimeSeries<{ time: string; [key: string]: string | number }>(
      {
        response,
        entityTag: "name",
        rowMapper: (row, columns, name) => ({
          [name]: (row[columns.indexOf("value")] as number) || 0,
        }),
      }
    );

    expect(result.data[0].time).toBe("2024-01-01T00:00:00Z");
    expect(result.data[1].time).toBe("2024-01-01T00:01:00Z");
    expect(result.data[2].time).toBe("2024-01-01T00:02:00Z");
  });

  it("handles empty response", () => {
    const response = {
      results: [{}],
    };

    const result = aggregateMultiEntityTimeSeries<{ time: string; [key: string]: string | number }>(
      {
        response,
        entityTag: "name",
        rowMapper: () => ({}),
      }
    );

    expect(result.data).toEqual([]);
    expect(result.entities).toEqual([]);
  });

  it("uses 'unknown' for missing entity tags", () => {
    const response = {
      results: [
        {
          series: [
            {
              name: "test",
              columns: ["time", "value"],
              values: [["2024-01-01T00:00:00Z", 10]],
            },
          ],
        },
      ],
    };

    const result = aggregateMultiEntityTimeSeries<{ time: string; [key: string]: string | number }>(
      {
        response,
        entityTag: "name",
        rowMapper: (row, columns, name) => ({
          [name]: (row[columns.indexOf("value")] as number) || 0,
        }),
      }
    );

    expect(result.entities).toEqual(["unknown"]);
    expect(result.data[0]["unknown"]).toBe(10);
  });
});

describe("filterZeroPoints", () => {
  it("returns true when any numeric value is > 0", () => {
    expect(filterZeroPoints({ time: "2024-01-01T00:00:00Z", value: 10 })).toBe(true);
    expect(filterZeroPoints({ time: "2024-01-01T00:00:00Z", a: 0, b: 5 })).toBe(true);
  });

  it("returns false when all numeric values are 0", () => {
    expect(filterZeroPoints({ time: "2024-01-01T00:00:00Z", value: 0 })).toBe(false);
    expect(filterZeroPoints({ time: "2024-01-01T00:00:00Z", a: 0, b: 0 })).toBe(false);
  });

  it("ignores non-numeric values", () => {
    expect(filterZeroPoints({ time: "2024-01-01T00:00:00Z" })).toBe(false);
    expect(filterZeroPoints({ time: "2024-01-01T00:00:00Z", name: "test" })).toBe(false);
  });
});
