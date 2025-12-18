import { useState, useEffect, useRef } from "react";
import { useIsFetching } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { usePreferences } from "@/hooks/usePreferences";

// Minimum time to show "Refreshing..." to prevent flickering
const MIN_REFRESH_DISPLAY_MS = 500;

/**
 * Displays a countdown timer until the next data refresh.
 * Shows a spinning icon and "Refreshing..." when data is being fetched.
 * Resets the countdown when a fetch completes.
 * Shows "Manual refresh" when auto-refresh is disabled.
 *
 * @example
 * ```tsx
 * // Typically placed in a header or toolbar
 * <div className="flex items-center gap-4">
 *   <h1>Dashboard</h1>
 *   <RefreshIndicator />
 * </div>
 * ```
 */
export function RefreshIndicator() {
  const fetchingCount = useIsFetching();
  const { refreshInterval } = usePreferences();

  // Convert milliseconds to seconds for countdown display
  const intervalSeconds = refreshInterval === 0 ? 0 : refreshInterval / 1000;

  const [countdown, setCountdown] = useState(intervalSeconds);
  // Debounced "showing refresh" state to prevent flickering
  const [showRefreshing, setShowRefreshing] = useState(false);
  const refreshStartTimeRef = useRef<number | null>(null);

  // Reset countdown when interval preference changes
  useEffect(() => {
    setCountdown(intervalSeconds);
  }, [intervalSeconds]);

  // Debounce the refreshing display state
  const isActuallyFetching = fetchingCount > 0;
  useEffect(() => {
    if (isActuallyFetching) {
      // Start showing "Refreshing..." immediately when fetching starts
      if (!showRefreshing) {
        setShowRefreshing(true);
        refreshStartTimeRef.current = Date.now();
      }
    } else if (showRefreshing) {
      // When fetching stops, wait for minimum display time before hiding
      const elapsed = Date.now() - (refreshStartTimeRef.current || 0);
      const remaining = Math.max(0, MIN_REFRESH_DISPLAY_MS - elapsed);

      const timeout = setTimeout(() => {
        setShowRefreshing(false);
        refreshStartTimeRef.current = null;
        // Reset countdown after refresh completes
        setCountdown(intervalSeconds);
      }, remaining);

      return () => clearTimeout(timeout);
    }
  }, [isActuallyFetching, showRefreshing, intervalSeconds]);

  // Run countdown timer only when not showing refresh state and not disabled
  useEffect(() => {
    if (intervalSeconds === 0 || showRefreshing) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        // Stop at 1, don't go to 0 (fetch should trigger before we need to loop)
        if (prev <= 1) return prev;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [intervalSeconds, showRefreshing]);

  // Show appropriate state
  const isDisabled = intervalSeconds === 0;

  // Format countdown with leading zero to maintain consistent width
  const countdownDisplay = countdown < 10 ? `0${countdown}` : `${countdown}`;

  return (
    <div
      className="flex items-center gap-2 text-sm text-gray-500 min-w-[120px] justify-end"
      aria-live="polite"
      aria-atomic="true"
    >
      <RefreshCw
        className={`w-4 h-4 ${showRefreshing ? "animate-spin text-purple-500" : ""}`}
        aria-hidden="true"
      />
      {showRefreshing ? (
        <span className="text-purple-500">Refreshing...</span>
      ) : isDisabled ? (
        <span className="text-[var(--text-tertiary)]">Manual refresh</span>
      ) : (
        <span className="tabular-nums">Refresh in {countdownDisplay}s</span>
      )}
    </div>
  );
}
