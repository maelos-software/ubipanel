import { useState, useMemo } from "react";
import {
  sortData,
  getNextSortDirection,
  type SortDirection,
  type SortableColumn,
} from "@/lib/sort";

// Re-export types for convenience
export type { SortDirection, SortableColumn };

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

/**
 * Hook for managing sortable data with state.
 * Provides sorted data and handlers for toggling sort.
 *
 * @param data - Array of items to sort
 * @param columns - Column definitions with optional sortValue extractors
 * @param defaultSortKey - Initial sort key (optional)
 * @param defaultSortDir - Initial sort direction (default: "asc")
 *
 * @example
 * ```typescript
 * const columns = [
 *   { key: "name", sortValue: (c) => c.name },
 *   { key: "bandwidth", sortValue: (c) => c.rxBytes + c.txBytes },
 * ];
 * const { sortedData, sortKey, sortDir, handleSort } = useSortableData(
 *   clients,
 *   columns,
 *   "bandwidth",
 *   "desc"
 * );
 * ```
 */
export function useSortableData<T>(
  data: T[],
  columns: SortableColumn<T>[],
  defaultSortKey?: string,
  defaultSortDir: SortDirection = "asc"
) {
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey || null);
  const [sortDir, setSortDir] = useState<SortDirection>(defaultSortKey ? defaultSortDir : null);

  const handleSort = (key: string) => {
    const next = getNextSortDirection(sortKey, sortDir, key);
    setSortKey(next.key);
    setSortDir(next.direction);
  };

  // Sort data - columns is included in dependencies since sortValue functions may change
  const sortedData = useMemo(
    () => sortData(data, sortKey, sortDir, columns),
    [data, sortKey, sortDir, columns]
  );

  return {
    sortedData,
    sortKey,
    sortDir,
    handleSort,
  };
}
