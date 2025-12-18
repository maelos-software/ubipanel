import { useContext } from "react";
import { PreferencesContext } from "@/lib/preferencesContext";

/**
 * Hook to access and update theme settings.
 * Must be used within a PreferencesProvider.
 *
 * @returns Theme context with:
 *   - theme: Current theme preference ("light" | "dark" | "system")
 *   - effectiveTheme: Resolved theme ("light" | "dark")
 *   - setTheme: Function to update theme preference
 *
 * @example
 * ```tsx
 * const { theme, effectiveTheme, setTheme } = useTheme();
 * // theme = "system", effectiveTheme = "dark" (if system prefers dark)
 * setTheme("light"); // Switch to light mode
 * ```
 */
export function useTheme() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("useTheme must be used within a PreferencesProvider");
  }
  return {
    theme: context.theme,
    effectiveTheme: context.effectiveTheme,
    setTheme: context.setTheme,
  };
}
