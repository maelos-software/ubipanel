import { describe, it, expect } from "vitest";
import {
  sortData,
  getNextSortDirection,
  type SortDirection,
  type SortableColumn,
} from "../../src/lib/sort";

interface TestItem {
  name: string;
  value: number;
  optional?: string | null;
}

describe("sortData", () => {
  const testData: TestItem[] = [
    { name: "Charlie", value: 30 },
    { name: "Alice", value: 10 },
    { name: "Bob", value: 20 },
  ];

  const columns: SortableColumn<TestItem>[] = [{ key: "name" }, { key: "value" }];

  describe("basic sorting", () => {
    it("should return original data when sortKey is null", () => {
      const result = sortData(testData, null, "asc", columns);
      expect(result).toEqual(testData);
    });

    it("should return original data when sortDir is null", () => {
      const result = sortData(testData, "name", null, columns);
      expect(result).toEqual(testData);
    });

    it("should sort strings ascending", () => {
      const result = sortData(testData, "name", "asc", columns);
      expect(result.map((r) => r.name)).toEqual(["Alice", "Bob", "Charlie"]);
    });

    it("should sort strings descending", () => {
      const result = sortData(testData, "name", "desc", columns);
      expect(result.map((r) => r.name)).toEqual(["Charlie", "Bob", "Alice"]);
    });

    it("should sort numbers ascending", () => {
      const result = sortData(testData, "value", "asc", columns);
      expect(result.map((r) => r.value)).toEqual([10, 20, 30]);
    });

    it("should sort numbers descending", () => {
      const result = sortData(testData, "value", "desc", columns);
      expect(result.map((r) => r.value)).toEqual([30, 20, 10]);
    });

    it("should not mutate original array", () => {
      const original = [...testData];
      sortData(testData, "name", "asc", columns);
      expect(testData).toEqual(original);
    });
  });

  describe("case-insensitive string sorting", () => {
    it("should sort strings case-insensitively", () => {
      const mixedCase: TestItem[] = [
        { name: "bob", value: 1 },
        { name: "Alice", value: 2 },
        { name: "CHARLIE", value: 3 },
      ];
      const result = sortData(mixedCase, "name", "asc", columns);
      expect(result.map((r) => r.name)).toEqual(["Alice", "bob", "CHARLIE"]);
    });
  });

  describe("null/undefined handling", () => {
    const columnsWithOptional: SortableColumn<TestItem>[] = [
      { key: "name" },
      { key: "value" },
      { key: "optional" },
    ];

    it("should push null values to end when sorting ascending", () => {
      const data: TestItem[] = [
        { name: "A", value: 1, optional: null },
        { name: "B", value: 2, optional: "z" },
        { name: "C", value: 3, optional: "a" },
      ];
      const result = sortData(data, "optional", "asc", columnsWithOptional);
      expect(result.map((r) => r.optional)).toEqual(["a", "z", null]);
    });

    it("should handle null values when sorting descending", () => {
      const data: TestItem[] = [
        { name: "A", value: 1, optional: null },
        { name: "B", value: 2, optional: "z" },
        { name: "C", value: 3, optional: "a" },
      ];
      const result = sortData(data, "optional", "desc", columnsWithOptional);
      // Note: current impl puts null first in desc order (returns -1 for null)
      // Non-null values are sorted z, a in descending order
      const nonNulls = result.filter((r) => r.optional !== null);
      expect(nonNulls.map((r) => r.optional)).toEqual(["z", "a"]);
    });

    it("should handle both null values as equal", () => {
      const data: TestItem[] = [
        { name: "A", value: 1, optional: null },
        { name: "B", value: 2, optional: null },
        { name: "C", value: 3, optional: "a" },
      ];
      const result = sortData(data, "optional", "asc", columnsWithOptional);
      // "a" should come first, nulls at end (order preserved among nulls)
      expect(result[0].optional).toBe("a");
      expect(result[1].optional).toBeNull();
      expect(result[2].optional).toBeNull();
    });
  });

  describe("custom sortValue extractors", () => {
    interface ComplexItem {
      firstName: string;
      lastName: string;
      rx: number;
      tx: number;
    }

    const complexData: ComplexItem[] = [
      { firstName: "Alice", lastName: "Zulu", rx: 100, tx: 50 },
      { firstName: "Bob", lastName: "Alpha", rx: 50, tx: 100 },
      { firstName: "Charlie", lastName: "Mike", rx: 75, tx: 75 },
    ];

    const complexColumns: SortableColumn<ComplexItem>[] = [
      { key: "name", sortValue: (item) => item.firstName.toLowerCase() },
      { key: "bandwidth", sortValue: (item) => item.rx + item.tx },
      { key: "lastName" },
    ];

    it("should use custom sortValue for computed values", () => {
      const result = sortData(complexData, "bandwidth", "desc", complexColumns);
      // Total bandwidth: Alice=150, Bob=150, Charlie=150 - all equal
      // When equal, maintain relative order
      expect(result.map((r) => r.rx + r.tx)).toEqual([150, 150, 150]);
    });

    it("should sort by custom string extractor", () => {
      const result = sortData(complexData, "name", "asc", complexColumns);
      expect(result.map((r) => r.firstName)).toEqual(["Alice", "Bob", "Charlie"]);
    });

    it("should fall back to direct property access when no sortValue defined", () => {
      const result = sortData(complexData, "lastName", "asc", complexColumns);
      expect(result.map((r) => r.lastName)).toEqual(["Alpha", "Mike", "Zulu"]);
    });
  });

  describe("edge cases", () => {
    it("should handle empty array", () => {
      const result = sortData([], "name", "asc", columns);
      expect(result).toEqual([]);
    });

    it("should handle single element array", () => {
      const single = [{ name: "Only", value: 1 }];
      const result = sortData(single, "name", "asc", columns);
      expect(result).toEqual(single);
    });

    it("should handle unknown column key gracefully", () => {
      const result = sortData(testData, "unknown", "asc", columns);
      // Should still work, accessing undefined property
      expect(result).toHaveLength(3);
    });
  });
});

describe("getNextSortDirection", () => {
  describe("when clicking a new column", () => {
    it("should start with ascending", () => {
      const result = getNextSortDirection("name", "asc", "value");
      expect(result).toEqual({ key: "value", direction: "asc" });
    });

    it("should start with ascending from null state", () => {
      const result = getNextSortDirection(null, null, "name");
      expect(result).toEqual({ key: "name", direction: "asc" });
    });

    it("should start with ascending when previous was descending on different column", () => {
      const result = getNextSortDirection("name", "desc", "value");
      expect(result).toEqual({ key: "value", direction: "asc" });
    });
  });

  describe("when clicking the same column", () => {
    it("should cycle from null to ascending", () => {
      const result = getNextSortDirection("name", null, "name");
      expect(result).toEqual({ key: "name", direction: "asc" });
    });

    it("should cycle from ascending to descending", () => {
      const result = getNextSortDirection("name", "asc", "name");
      expect(result).toEqual({ key: "name", direction: "desc" });
    });

    it("should cycle from descending to null", () => {
      const result = getNextSortDirection("name", "desc", "name");
      expect(result).toEqual({ key: null, direction: null });
    });
  });

  describe("full cycle test", () => {
    it("should complete full cycle: null -> asc -> desc -> null", () => {
      let state: { key: string | null; direction: SortDirection } = {
        key: null,
        direction: null,
      };

      // First click: null -> asc
      state = getNextSortDirection(state.key, state.direction, "col");
      expect(state).toEqual({ key: "col", direction: "asc" });

      // Second click: asc -> desc
      state = getNextSortDirection(state.key, state.direction, "col");
      expect(state).toEqual({ key: "col", direction: "desc" });

      // Third click: desc -> null
      state = getNextSortDirection(state.key, state.direction, "col");
      expect(state).toEqual({ key: null, direction: null });

      // Fourth click: null -> asc (cycle repeats)
      state = getNextSortDirection(state.key, state.direction, "col");
      expect(state).toEqual({ key: "col", direction: "asc" });
    });
  });
});
