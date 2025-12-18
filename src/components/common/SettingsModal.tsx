import { useCallback } from "react";
import { X, Monitor, Sun, Moon } from "lucide-react";
import { usePreferences } from "@/hooks/usePreferences";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { APP_VERSION } from "@/lib/config";
import type {
  Theme,
  RefreshInterval,
  DefaultTimeRange,
  Density,
  ClientListView,
} from "@/lib/preferences";

/**
 * Settings modal for user preferences.
 * Provides controls for theme, refresh interval, time range, density, and client list view.
 */
export function SettingsModal() {
  const {
    isSettingsOpen,
    closeSettings,
    theme,
    setTheme,
    refreshInterval,
    setRefreshInterval,
    defaultTimeRange,
    setDefaultTimeRange,
    density,
    setDensity,
    clientListView,
    setClientListView,
  } = usePreferences();

  // Trap focus inside modal for keyboard accessibility
  const containerRef = useFocusTrap(isSettingsOpen);

  // Close on escape key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        closeSettings();
      }
    },
    [closeSettings]
  );

  // Close when clicking backdrop
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        closeSettings();
      }
    },
    [closeSettings]
  );

  if (!isSettingsOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      aria-describedby="settings-description"
    >
      <div
        ref={containerRef}
        className="w-full max-w-md bg-[var(--bg-secondary)] rounded-xl shadow-2xl border border-[var(--border-primary)] outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
          <div className="flex flex-col">
            <h2 id="settings-title" className="text-lg font-semibold text-[var(--text-primary)]">
              Settings
            </h2>
            <p id="settings-description" className="sr-only">
              Customize your dashboard preferences, including theme, refresh interval, and display
              density.
            </p>
          </div>
          <button
            onClick={closeSettings}
            className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 outline-none"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-6">
          {/* Theme */}
          <SettingSection title="Theme" description="Choose your preferred color scheme">
            <ThemeSelector value={theme} onChange={setTheme} />
          </SettingSection>

          {/* Refresh Interval */}
          <SettingSection title="Refresh Interval" description="How often to update data">
            <RefreshIntervalSelector value={refreshInterval} onChange={setRefreshInterval} />
          </SettingSection>

          {/* Default Time Range */}
          <SettingSection title="Default Time Range" description="Initial time range for charts">
            <TimeRangeSelector value={defaultTimeRange} onChange={setDefaultTimeRange} />
          </SettingSection>

          {/* Density */}
          <SettingSection title="Display Density" description="Adjust spacing and sizing">
            <DensitySelector value={density} onChange={setDensity} />
          </SettingSection>

          {/* Client List View */}
          <SettingSection title="Client List View" description="Default columns in client tables">
            <ClientListViewSelector value={clientListView} onChange={setClientListView} />
          </SettingSection>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border-primary)] flex items-center justify-between text-xs text-[var(--text-tertiary)]">
          <span>Changes are saved automatically</span>
          <span>v{APP_VERSION}</span>
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function SettingSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">{title}</h3>
        <p className="text-xs text-[var(--text-tertiary)]">{description}</p>
      </div>
      {children}
    </section>
  );
}

function ThemeSelector({ value, onChange }: { value: Theme; onChange: (v: Theme) => void }) {
  const options: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: "system", label: "System", icon: <Monitor className="w-4 h-4" /> },
    { value: "light", label: "Light", icon: <Sun className="w-4 h-4" /> },
    { value: "dark", label: "Dark", icon: <Moon className="w-4 h-4" /> },
  ];

  return (
    <div className="flex gap-2" role="group" aria-label="Theme selection">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 outline-none ${
            value === opt.value
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
              : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border-primary)]"
          }`}
          aria-pressed={value === opt.value}
        >
          <span aria-hidden="true">{opt.icon}</span>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function RefreshIntervalSelector({
  value,
  onChange,
}: {
  value: RefreshInterval;
  onChange: (v: RefreshInterval) => void;
}) {
  const options: { value: RefreshInterval; label: string }[] = [
    { value: 10000, label: "10s" },
    { value: 30000, label: "30s" },
    { value: 60000, label: "1m" },
    { value: 300000, label: "5m" },
    { value: 0, label: "Manual" },
  ];

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Refresh interval selection">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 outline-none ${
            value === opt.value
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
              : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border-primary)]"
          }`}
          aria-pressed={value === opt.value}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function TimeRangeSelector({
  value,
  onChange,
}: {
  value: DefaultTimeRange;
  onChange: (v: DefaultTimeRange) => void;
}) {
  const options: { value: DefaultTimeRange; label: string }[] = [
    { value: "1h", label: "1 Hour" },
    { value: "3h", label: "3 Hours" },
    { value: "6h", label: "6 Hours" },
    { value: "12h", label: "12 Hours" },
    { value: "24h", label: "24 Hours" },
  ];

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Default time range selection">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 outline-none ${
            value === opt.value
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
              : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border-primary)]"
          }`}
          aria-pressed={value === opt.value}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function DensitySelector({ value, onChange }: { value: Density; onChange: (v: Density) => void }) {
  const options: { value: Density; label: string; description: string }[] = [
    { value: "compact", label: "Compact", description: "More data, less space" },
    { value: "comfortable", label: "Comfortable", description: "Balanced layout" },
    { value: "spacious", label: "Spacious", description: "Easier to read" },
  ];

  return (
    <div className="flex flex-col gap-2" role="group" aria-label="Display density selection">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex flex-col items-start px-3 py-2 rounded-lg text-left transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 outline-none ${
            value === opt.value
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
              : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border-primary)]"
          }`}
          aria-pressed={value === opt.value}
        >
          <span className="text-sm font-medium">{opt.label}</span>
          <span
            className={`text-xs ${value === opt.value ? "opacity-80" : "text-[var(--text-tertiary)]"}`}
          >
            {opt.description}
          </span>
        </button>
      ))}
    </div>
  );
}

function ClientListViewSelector({
  value,
  onChange,
}: {
  value: ClientListView;
  onChange: (v: ClientListView) => void;
}) {
  const options: { value: ClientListView; label: string; description: string }[] = [
    { value: "minimal", label: "Minimal", description: "Name, bandwidth" },
    { value: "standard", label: "Standard", description: "Name, IP, connection, bandwidth" },
    { value: "detailed", label: "Detailed", description: "All available columns" },
  ];

  return (
    <div className="flex flex-col gap-2" role="group" aria-label="Client list view selection">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex flex-col items-start px-3 py-2 rounded-lg text-left transition-colors focus-visible:ring-2 focus-visible:ring-purple-500 outline-none ${
            value === opt.value
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
              : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border-primary)]"
          }`}
          aria-pressed={value === opt.value}
        >
          <span className="text-sm font-medium">{opt.label}</span>
          <span
            className={`text-xs ${value === opt.value ? "opacity-80" : "text-[var(--text-tertiary)]"}`}
          >
            {opt.description}
          </span>
        </button>
      ))}
    </div>
  );
}
