import { createContext } from "react";
import type {
  Theme,
  RefreshInterval,
  DefaultTimeRange,
  Density,
  ClientListView,
  Preferences,
} from "@/lib/preferences";

export interface PreferencesContextValue {
  // All preferences
  preferences: Preferences;

  // Theme (with computed effective theme)
  theme: Theme;
  effectiveTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;

  // Refresh interval
  refreshInterval: RefreshInterval;
  setRefreshInterval: (interval: RefreshInterval) => void;

  // Default time range
  defaultTimeRange: DefaultTimeRange;
  setDefaultTimeRange: (range: DefaultTimeRange) => void;

  // Density
  density: Density;
  setDensity: (density: Density) => void;

  // Client list view
  clientListView: ClientListView;
  setClientListView: (view: ClientListView) => void;

  // Settings modal state
  isSettingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
}

/**
 * Context for user preferences management.
 * Use PreferencesProvider to wrap your app and usePreferences hook to access.
 */
export const PreferencesContext = createContext<PreferencesContextValue | null>(null);
