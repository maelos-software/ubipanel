import { useContext } from "react";
import { PreferencesContext } from "@/lib/preferencesContext";
import { REFETCH_INTERVAL } from "@/lib/config";

/**
 * Hook to get the user's preferred refresh interval for data queries.
 *
 * Returns:
 * - The user's preferred interval in milliseconds
 * - `false` if refresh is disabled (manual only)
 * - Falls back to REFETCH_INTERVAL if used outside PreferencesProvider
 *
 * @example
 * ```tsx
 * const refetchInterval = useRefreshInterval();
 *
 * const { data } = useQuery({
 *   queryKey: ["clients"],
 *   queryFn: fetchClients,
 *   refetchInterval,
 * });
 * ```
 */
export function useRefreshInterval(): number | false {
  const context = useContext(PreferencesContext);

  // Fallback to default if not in a PreferencesProvider
  if (!context) {
    return REFETCH_INTERVAL;
  }

  // 0 means manual refresh only
  if (context.refreshInterval === 0) {
    return false;
  }

  return context.refreshInterval;
}
