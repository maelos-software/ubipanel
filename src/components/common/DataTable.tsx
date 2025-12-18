import { ReactNode, useState, useMemo } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { sortData, getNextSortDirection, type SortDirection } from "@/lib/sort";

/** Column definition for DataTable */
interface Column<T> {
  /** Unique key for the column (used for sorting state) */
  key: string;
  /** Header text or component displayed in the table header */
  header: ReactNode;
  /** Custom render function for cell content */
  render?: (item: T) => ReactNode;
  /** Additional CSS classes for the column */
  className?: string;
  /** Whether the column is sortable (default: true) */
  sortable?: boolean;
  /** Function to extract sortable value from item */
  sortValue?: (item: T) => string | number | null;
  /** Text alignment for the column */
  align?: "left" | "center" | "right";
}

interface DataTableProps<T> {
  /** Array of data items to display */
  data: T[];
  /** Column definitions */
  columns: Column<T>[];
  /** Function to extract unique key from each item */
  keyExtractor: (item: T) => string;
  /** Click handler for row clicks */
  onRowClick?: (item: T) => void;
  /** Message to show when data is empty */
  emptyMessage?: string;
  /** Initial sort column key */
  defaultSortKey?: string;
  /** Initial sort direction */
  defaultSortDir?: "asc" | "desc";
}

/**
 * A generic, sortable data table component.
 * Supports custom rendering, sorting, and row click handling.
 * Enhanced for accessibility (A11y).
 */
export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  emptyMessage = "No data available",
  defaultSortKey,
  defaultSortDir = "asc",
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey || null);
  const [sortDir, setSortDir] = useState<SortDirection>(defaultSortKey ? defaultSortDir : null);

  const handleSort = (key: string, column: Column<T>) => {
    if (column.sortable === false) return;

    const next = getNextSortDirection(sortKey, sortDir, key);
    setSortKey(next.key);
    setSortDir(next.direction);
  };

  // Sort data - columns is included in dependencies since sortValue functions may change
  const sortedData = useMemo(
    () => sortData(data, sortKey, sortDir, columns),
    [data, sortKey, sortDir, columns]
  );

  if (data.length === 0) {
    return (
      <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] p-12 text-center text-[var(--text-tertiary)]">
        {emptyMessage}
      </div>
    );
  }

  const getAlignClass = (align?: "left" | "center" | "right") => {
    switch (align) {
      case "center":
        return "text-center";
      case "right":
        return "text-right";
      default:
        return "text-left";
    }
  };

  return (
    <div className="bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--bg-tertiary)]/50">
              {columns.map((col) => {
                const isSortable = col.sortable !== false;
                const isActive = sortKey === col.key;

                return (
                  <th
                    key={col.key}
                    onClick={() => isSortable && handleSort(col.key, col)}
                    onKeyDown={(e) => {
                      if (isSortable && (e.key === "Enter" || e.key === " ")) {
                        handleSort(col.key, col);
                        e.preventDefault();
                      }
                    }}
                    tabIndex={isSortable ? 0 : undefined}
                    aria-sort={
                      isActive ? (sortDir === "asc" ? "ascending" : "descending") : undefined
                    }
                    className={`px-6 font-semibold uppercase tracking-wider text-[var(--text-tertiary)] ${getAlignClass(col.align)} ${col.className || ""} ${
                      isSortable
                        ? "cursor-pointer hover:bg-[var(--bg-tertiary)] select-none transition-colors focus-visible:bg-[var(--bg-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-500"
                        : ""
                    }`}
                    style={{
                      paddingTop: "var(--density-table-cell-py)",
                      paddingBottom: "var(--density-table-cell-py)",
                      fontSize: "var(--density-text-xs)",
                    }}
                  >
                    <div
                      className={`flex items-center gap-1 ${col.align === "right" ? "justify-end" : col.align === "center" ? "justify-center" : ""}`}
                    >
                      <span>{col.header}</span>
                      {isSortable && (
                        <span className="text-[var(--text-muted)]">
                          {isActive && sortDir === "asc" && (
                            <ChevronUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          )}
                          {isActive && sortDir === "desc" && (
                            <ChevronDown className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          )}
                          {(!isActive || !sortDir) && (
                            <ChevronsUpDown className="w-4 h-4 opacity-40" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-secondary)]">
            {sortedData.map((item) => (
              <tr
                key={keyExtractor(item)}
                onClick={() => onRowClick?.(item)}
                onKeyDown={(e) => {
                  if (onRowClick && (e.key === "Enter" || e.key === " ")) {
                    onRowClick?.(item);
                    e.preventDefault();
                  }
                }}
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? "button" : undefined}
                className={`hover:bg-[var(--bg-tertiary)]/50 transition-colors ${
                  onRowClick
                    ? "cursor-pointer focus-visible:bg-[var(--bg-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-purple-500"
                    : ""
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-6 text-[var(--text-primary)] ${getAlignClass(col.align)} ${col.className || ""}`}
                    style={{
                      paddingTop: "var(--density-table-cell-py)",
                      paddingBottom: "var(--density-table-cell-py)",
                      fontSize: "var(--density-text-sm)",
                    }}
                  >
                    {col.render
                      ? col.render(item)
                      : ((item as Record<string, unknown>)[col.key] as ReactNode)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
