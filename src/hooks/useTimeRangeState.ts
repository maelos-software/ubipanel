import { useState, useCallback } from "react";
import { useDefaultTimeRange } from "./useDefaultTimeRange";
import type { TimeRange } from "@/lib/timeRanges";

/**
 * Hook to manage time range state with user preference support.
 *
 * Combines useState with useDefaultTimeRange to provide:
 * - Initial value from user preferences
 * - Current time range object (not just the value string)
 * - Setter function
 * - Access to the grouping interval
 *
 * @param ranges - Array of TimeRange options available for selection
 * @returns Object with timeRange, setTimeRange, and derived values
 *
 * @example
 * ```tsx
 * import { TIME_RANGES_DETAIL } from "@/lib/timeRanges";
 *
 * function MyComponent() {
 *   const { timeRange, setTimeRange } = useTimeRangeState(TIME_RANGES_DETAIL);
 *
 *   // Use timeRange.value for queries: "1h", "3h", etc.
 *   // Use timeRange.group for grouping interval: "1m", "2m", etc.
 *   const { data } = useHistoryHook(id, timeRange.value, timeRange.group);
 *
 *   return (
 *     <TimeRangeSelector
 *       ranges={TIME_RANGES_DETAIL}
 *       selected={timeRange}
 *       onChange={setTimeRange}
 *     />
 *   );
 * }
 * ```
 */
export function useTimeRangeState(ranges: TimeRange[]) {
  const defaultRange = useDefaultTimeRange(ranges);
  const [timeRange, setTimeRangeInternal] = useState<TimeRange>(defaultRange);

  // Ensure the setter always receives a TimeRange object
  const setTimeRange = useCallback((range: TimeRange) => {
    setTimeRangeInternal(range);
  }, []);

  return {
    /** The currently selected time range object */
    timeRange,
    /** Function to update the selected time range */
    setTimeRange,
    /** The available ranges (passed through for convenience) */
    ranges,
    /** Shortcut to timeRange.value */
    value: timeRange.value,
    /** Shortcut to timeRange.group (the grouping interval) */
    interval: timeRange.group,
  };
}
