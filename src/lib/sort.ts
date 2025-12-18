/**
 * Shared sorting utilities for tables and lists.
 */

export type SortDirection = "asc" | "desc" | null;

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

export interface SortableColumn<T> {
  key: string;
  sortValue?: (item: T) => string | number | null;
}

/**
 * Generic sort function that works with any data type.
 * Handles null/undefined values consistently and supports custom sort value extractors.
 *
 * @param data - Array of items to sort
 * @param sortKey - Key to sort by (null returns unsorted data)
 * @param sortDir - Sort direction ("asc", "desc", or null)
 * @param columns - Column definitions with optional sortValue extractors
 * @returns Sorted copy of the data array
 *
 * @example
 * ```typescript
 * const columns = [
 *   { key: "name", sortValue: (item) => item.name.toLowerCase() },
 *   { key: "bandwidth", sortValue: (item) => item.rx + item.tx },
 * ];
 * const sorted = sortData(clients, "bandwidth", "desc", columns);
 * ```
 */
export function sortData<T>(
  data: T[],
  sortKey: string | null,
  sortDir: SortDirection,
  columns: SortableColumn<T>[]
): T[] {
  if (!sortKey || !sortDir) return data;

  const column = columns.find((c) => c.key === sortKey);

  return [...data].sort((a, b) => {
    let aVal: string | number | null;
    let bVal: string | number | null;

    if (column?.sortValue) {
      aVal = column.sortValue(a);
      bVal = column.sortValue(b);
    } else {
      aVal = (a as Record<string, unknown>)[sortKey] as string | number | null;
      bVal = (b as Record<string, unknown>)[sortKey] as string | number | null;
    }

    // Handle null/undefined - push to end regardless of sort direction
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return sortDir === "asc" ? 1 : -1;
    if (bVal == null) return sortDir === "asc" ? -1 : 1;

    // Numeric comparison
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    }

    // String comparison (case-insensitive)
    const aStr = String(aVal).toLowerCase();
    const bStr = String(bVal).toLowerCase();
    const cmp = aStr.localeCompare(bStr);
    return sortDir === "asc" ? cmp : -cmp;
  });
}

/**
 * Get the next sort direction in the cycle: null -> asc -> desc -> null
 */
export function getNextSortDirection(
  currentKey: string | null,
  currentDir: SortDirection,
  newKey: string
): { key: string | null; direction: SortDirection } {
  if (currentKey !== newKey) {
    // Different column - start with ascending
    return { key: newKey, direction: "asc" };
  }

  // Same column - cycle through directions
  if (currentDir === "asc") {
    return { key: newKey, direction: "desc" };
  } else if (currentDir === "desc") {
    return { key: null, direction: null };
  } else {
    return { key: newKey, direction: "asc" };
  }
}
