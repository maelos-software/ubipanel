import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import type { SortDirection } from "@/hooks/useSortableData";

interface SortableHeaderProps {
  /** Column header text */
  label: string;
  /** Unique key for this column (used for sort state) */
  sortKey: string;
  /** Currently active sort key (null if no sort) */
  currentSortKey: string | null;
  /** Current sort direction */
  currentSortDir: SortDirection;
  /** Callback when header is clicked */
  onSort: (key: string) => void;
  /** Text alignment (default: "left") */
  align?: "left" | "center" | "right";
  /** Additional CSS classes */
  className?: string;
}

/**
 * A table header cell with sort indicator icons.
 * Shows ascending/descending arrows when active, or a neutral icon when inactive.
 *
 * @example
 * ```tsx
 * const { sortKey, sortDir, handleSort } = useSortableData(data, columns, "name");
 *
 * <SortableHeader
 *   label="Name"
 *   sortKey="name"
 *   currentSortKey={sortKey}
 *   currentSortDir={sortDir}
 *   onSort={handleSort}
 * />
 * ```
 */

export function SortableHeader({
  label,
  sortKey,
  currentSortKey,
  currentSortDir,
  onSort,
  align = "left",
  className = "",
}: SortableHeaderProps) {
  const isActive = currentSortKey === sortKey;

  const alignClass =
    align === "right"
      ? "text-right justify-end"
      : align === "center"
        ? "text-center justify-center"
        : "text-left";

  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 cursor-pointer hover:bg-gray-100/50 select-none transition-colors ${className}`}
    >
      <div className={`flex items-center gap-1 ${alignClass}`}>
        <span>{label}</span>
        <span className="text-[var(--text-muted)]">
          {isActive && currentSortDir === "asc" && (
            <ChevronUp className="w-4 h-4 text-purple-600" />
          )}
          {isActive && currentSortDir === "desc" && (
            <ChevronDown className="w-4 h-4 text-purple-600" />
          )}
          {(!isActive || !currentSortDir) && <ChevronsUpDown className="w-4 h-4 opacity-40" />}
        </span>
      </div>
    </th>
  );
}
