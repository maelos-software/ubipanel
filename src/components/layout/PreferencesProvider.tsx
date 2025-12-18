import { useEffect, useState, useCallback, type ReactNode } from "react";
import {
  type Theme,
  type RefreshInterval,
  type DefaultTimeRange,
  type Density,
  type ClientListView,
  type Preferences,
  loadPreferences,
  savePreferences,
  getEffectiveTheme,
} from "@/lib/preferences";
import { PreferencesContext } from "@/lib/preferencesContext";

/**
 * Provider component for user preferences management.
 * Wraps the app to provide preferences context to all components.
 *
 * Features:
 * - Persists all preferences to localStorage
 * - Listens for system preference changes when using "system" theme
 * - Applies "dark" class and density class to document.documentElement
 * - Manages settings modal open/close state
 */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(() => loadPreferences());
  const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark">(() =>
    getEffectiveTheme(loadPreferences().theme)
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Update effective theme when theme preference or system preference changes
  useEffect(() => {
    const updateEffective = () => {
      setEffectiveTheme(getEffectiveTheme(preferences.theme));
    };

    updateEffective();

    // Listen for system preference changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", updateEffective);

    return () => mediaQuery.removeEventListener("change", updateEffective);
  }, [preferences.theme]);

  // Apply theme class to document
  useEffect(() => {
    const root = document.documentElement;
    if (effectiveTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [effectiveTheme]);

  // Apply density class to document
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("density-compact", "density-comfortable", "density-spacious");
    root.classList.add(`density-${preferences.density}`);
  }, [preferences.density]);

  // Helper to update a single preference
  const updatePreference = useCallback(
    <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
      setPreferences((prev) => {
        const next = { ...prev, [key]: value };
        savePreferences(next);
        return next;
      });
    },
    []
  );

  const setTheme = useCallback(
    (theme: Theme) => updatePreference("theme", theme),
    [updatePreference]
  );

  const setRefreshInterval = useCallback(
    (interval: RefreshInterval) => updatePreference("refreshInterval", interval),
    [updatePreference]
  );

  const setDefaultTimeRange = useCallback(
    (range: DefaultTimeRange) => updatePreference("defaultTimeRange", range),
    [updatePreference]
  );

  const setDensity = useCallback(
    (density: Density) => updatePreference("density", density),
    [updatePreference]
  );

  const setClientListView = useCallback(
    (view: ClientListView) => updatePreference("clientListView", view),
    [updatePreference]
  );

  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);

  return (
    <PreferencesContext.Provider
      value={{
        preferences,
        theme: preferences.theme,
        effectiveTheme,
        setTheme,
        refreshInterval: preferences.refreshInterval,
        setRefreshInterval,
        defaultTimeRange: preferences.defaultTimeRange,
        setDefaultTimeRange,
        density: preferences.density,
        setDensity,
        clientListView: preferences.clientListView,
        setClientListView,
        isSettingsOpen,
        openSettings,
        closeSettings,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}
