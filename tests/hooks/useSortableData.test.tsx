import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSortableData } from "../../src/hooks/useSortableData";

interface TestItem {
  name: string;
  value: number;
  nullable?: number | null;
}

const testData: TestItem[] = [
  { name: "Charlie", value: 30 },
  { name: "Alice", value: 10 },
  { name: "Bob", value: 20 },
];

const columns = [
  { key: "name", sortValue: (item: TestItem) => item.name },
  { key: "value", sortValue: (item: TestItem) => item.value },
];

describe("useSortableData", () => {
  it("returns unsorted data when no default sort is provided", () => {
    const { result } = renderHook(() => useSortableData(testData, columns));

    expect(result.current.sortedData).toEqual(testData);
    expect(result.current.sortKey).toBeNull();
    expect(result.current.sortDir).toBeNull();
  });

  it("sorts data by default sort key ascending", () => {
    const { result } = renderHook(() => useSortableData(testData, columns, "name", "asc"));

    expect(result.current.sortedData[0].name).toBe("Alice");
    expect(result.current.sortedData[1].name).toBe("Bob");
    expect(result.current.sortedData[2].name).toBe("Charlie");
  });

  it("sorts data by default sort key descending", () => {
    const { result } = renderHook(() => useSortableData(testData, columns, "value", "desc"));

    expect(result.current.sortedData[0].value).toBe(30);
    expect(result.current.sortedData[1].value).toBe(20);
    expect(result.current.sortedData[2].value).toBe(10);
  });

  it("cycles through sort directions: null -> asc -> desc -> null", () => {
    const { result } = renderHook(() => useSortableData(testData, columns));

    // Initial state: no sort
    expect(result.current.sortKey).toBeNull();
    expect(result.current.sortDir).toBeNull();

    // First click: asc
    act(() => {
      result.current.handleSort("name");
    });
    expect(result.current.sortKey).toBe("name");
    expect(result.current.sortDir).toBe("asc");

    // Second click: desc
    act(() => {
      result.current.handleSort("name");
    });
    expect(result.current.sortKey).toBe("name");
    expect(result.current.sortDir).toBe("desc");

    // Third click: null (reset)
    act(() => {
      result.current.handleSort("name");
    });
    expect(result.current.sortKey).toBeNull();
    expect(result.current.sortDir).toBeNull();
  });

  it("switches to new column on different column click", () => {
    const { result } = renderHook(() => useSortableData(testData, columns, "name", "asc"));

    expect(result.current.sortKey).toBe("name");

    act(() => {
      result.current.handleSort("value");
    });

    expect(result.current.sortKey).toBe("value");
    expect(result.current.sortDir).toBe("asc");
  });

  it("handles null values in sort", () => {
    const dataWithNulls: TestItem[] = [
      { name: "A", value: 10, nullable: 5 },
      { name: "B", value: 20, nullable: null },
      { name: "C", value: 30, nullable: 15 },
    ];

    const columnsWithNull = [
      ...columns,
      { key: "nullable", sortValue: (item: TestItem) => item.nullable ?? null },
    ];

    const { result } = renderHook(() =>
      useSortableData(dataWithNulls, columnsWithNull, "nullable", "asc")
    );

    // Null values should sort to the end in ascending order
    expect(result.current.sortedData[0].nullable).toBe(5);
    expect(result.current.sortedData[1].nullable).toBe(15);
    expect(result.current.sortedData[2].nullable).toBeNull();
  });

  it("maintains stable reference when data doesn't change", () => {
    const { result, rerender } = renderHook(() =>
      useSortableData(testData, columns, "name", "asc")
    );

    const firstSortedData = result.current.sortedData;

    rerender();

    expect(result.current.sortedData).toBe(firstSortedData);
  });
});
