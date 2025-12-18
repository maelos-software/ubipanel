import { useMemo, useContext } from "react";
import { PreferencesContext } from "@/lib/preferencesContext";
import type { TimeRange } from "@/lib/timeRanges";

/**
 * Hook to get the user's preferred default time range.
 *
 * Finds the matching TimeRange object from the provided array,
 * falling back to the first item if no match is found.
 *
 * @param ranges - Array of TimeRange options to search through
 * @returns The default TimeRange to use for initial state
 *
 * @example
 * ```tsx
 * import { TIME_RANGES_SHORT } from "@/lib/timeRanges";
 *
 * function MyComponent() {
 *   const defaultRange = useDefaultTimeRange(TIME_RANGES_SHORT);
 *   const [timeRange, setTimeRange] = useState(defaultRange);
 *   // ...
 * }
 * ```
 */
export function useDefaultTimeRange(ranges: TimeRange[]): TimeRange {
  const context = useContext(PreferencesContext);
  const preferredValue = context?.defaultTimeRange ?? "1h";

  return useMemo(() => {
    // Find a range that matches the user's preference
    const match = ranges.find((r) => r.value === preferredValue);
    // Fallback to first range if no match (e.g., 7d preference with SHORT ranges)
    return match || ranges[0];
  }, [ranges, preferredValue]);
}
