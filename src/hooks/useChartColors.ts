import { useTheme } from "@/hooks/useTheme";

/**
 * Hook that returns theme-aware colors for Recharts components.
 * Since Recharts uses inline SVG props that don't support CSS variables,
 * this hook provides the appropriate colors based on the current theme.
 */
export function useChartColors() {
  const { effectiveTheme } = useTheme();
  const isDark = effectiveTheme === "dark";

  return {
    // Grid and axis colors
    grid: isDark ? "#334155" : "#f0f0f0",
    axisLine: isDark ? "#475569" : "#E5E7EB",
    tickText: isDark ? "#94a3b8" : "#9CA3AF",
    tickTextDark: isDark ? "#cbd5e1" : "#4B5563", // For more prominent labels

    // Tooltip colors (used as classes, but also for inline)
    tooltipBg: isDark ? "#1e293b" : "#ffffff",
    tooltipBorder: isDark ? "#475569" : "#e5e7eb",
    tooltipText: isDark ? "#f1f5f9" : "#111827",
    tooltipTextMuted: isDark ? "#94a3b8" : "#6b7280",

    // Gauge background
    gaugeBg: isDark ? "#475569" : "#E5E7EB",

    // Pie chart center text
    centerTextPrimary: isDark ? "#f1f5f9" : "#111827",
    centerTextSecondary: isDark ? "#94a3b8" : "#6b7280",
  };
}
