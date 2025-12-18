import type { TimeRange } from "@/lib/timeRanges";

interface TimeRangeSelectorProps {
  /** Available time ranges to display */
  ranges: TimeRange[];
  /** Currently selected time range */
  selected: TimeRange;
  /** Callback when a time range is selected */
  onChange: (range: TimeRange) => void;
  /** Color theme for the selector (default: "purple") */
  color?: "purple" | "amber" | "pink" | "blue" | "emerald";
  /** Size variant (default: "md") */
  size?: "sm" | "md";
}

/**
 * A horizontal button group for selecting time ranges.
 * Used for filtering historical data in charts and tables.
 *
 * @example
 * ```tsx
 * import { TIME_RANGES_SHORT } from "@/lib/timeRanges";
 *
 * const [timeRange, setTimeRange] = useState(TIME_RANGES_SHORT[0]);
 *
 * <TimeRangeSelector
 *   ranges={TIME_RANGES_SHORT}
 *   selected={timeRange}
 *   onChange={setTimeRange}
 *   color="purple"
 * />
 * ```
 */

const colorClasses = {
  purple: {
    active: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300",
    inactive:
      "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border-primary)]",
  },
  amber: {
    active: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
    inactive:
      "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border-primary)]",
  },
  pink: {
    active: "bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300",
    inactive:
      "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border-primary)]",
  },
  blue: {
    active: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
    inactive:
      "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border-primary)]",
  },
  emerald: {
    active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
    inactive:
      "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border-primary)]",
  },
};

export function TimeRangeSelector({
  ranges,
  selected,
  onChange,
  color = "purple",
  size = "md",
}: TimeRangeSelectorProps) {
  const colors = colorClasses[color];
  const sizeClasses = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";

  return (
    <div className="flex items-center gap-1">
      {ranges.map((range) => (
        <button
          key={range.value}
          onClick={() => onChange(range)}
          className={`${sizeClasses} rounded-lg font-medium transition-all ${
            selected.value === range.value ? colors.active : colors.inactive
          }`}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}
