/* eslint-disable react-refresh/only-export-components */
/**
 * Test utilities for rendering components with required providers
 */

import type { ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { PreferencesContext, type PreferencesContextValue } from "../src/lib/preferencesContext";
import type { Preferences } from "../src/lib/preferences";

/**
 * Default preferences for testing
 */
const defaultPreferences: Preferences = {
  theme: "light",
  refreshInterval: 30000,
  defaultTimeRange: "1h",
  density: "comfortable",
  clientListView: "detailed",
};

/**
 * Default context value for testing
 */
const defaultContextValue: PreferencesContextValue = {
  preferences: defaultPreferences,
  theme: "light",
  effectiveTheme: "light",
  setTheme: () => {},
  refreshInterval: 30000,
  setRefreshInterval: () => {},
  defaultTimeRange: "1h",
  setDefaultTimeRange: () => {},
  density: "comfortable",
  setDensity: () => {},
  clientListView: "detailed",
  setClientListView: () => {},
  isSettingsOpen: false,
  openSettings: () => {},
  closeSettings: () => {},
};

interface TestProviderProps {
  children: ReactNode;
  preferencesValue?: Partial<PreferencesContextValue>;
}

/**
 * Test provider wrapper that includes all necessary context providers
 */
export function TestProviders({ children, preferencesValue }: TestProviderProps) {
  const contextValue = {
    ...defaultContextValue,
    ...preferencesValue,
  };

  return <PreferencesContext.Provider value={contextValue}>{children}</PreferencesContext.Provider>;
}

/**
 * Custom render function that wraps components with required providers
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper"> & { preferencesValue?: Partial<PreferencesContextValue> }
) {
  const { preferencesValue, ...renderOptions } = options || {};

  return render(ui, {
    wrapper: ({ children }) => (
      <TestProviders preferencesValue={preferencesValue}>{children}</TestProviders>
    ),
    ...renderOptions,
  });
}

/**
 * Create a dark theme context value for testing dark mode
 */
export function createDarkThemeContext(): Partial<PreferencesContextValue> {
  return {
    theme: "dark",
    effectiveTheme: "dark",
    preferences: { ...defaultPreferences, theme: "dark" },
  };
}

// Re-export everything from @testing-library/react
export * from "@testing-library/react";

// Override the render function
export { renderWithProviders as render };
