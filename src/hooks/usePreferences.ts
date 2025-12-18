import { useContext } from "react";
import { PreferencesContext, type PreferencesContextValue } from "@/lib/preferencesContext";

/**
 * Hook to access user preferences context.
 * Must be used within a PreferencesProvider.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { theme, setTheme, refreshInterval, openSettings } = usePreferences();
 *
 *   return (
 *     <button onClick={openSettings}>Open Settings</button>
 *   );
 * }
 * ```
 */
export function usePreferences(): PreferencesContextValue {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }
  return context;
}
