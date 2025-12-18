import { CHART_COLORS } from "@/config/theme";

/**
 * Chart configuration utilities
 */

interface ChartColors {
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
}

/**
 * Returns consistent tooltip styling for Recharts Tooltip component.
 * Use this when you don't need the full ChartTooltip component.
 */
export function getTooltipStyle(chartColors: ChartColors) {
  return {
    contentStyle: {
      backgroundColor: chartColors.tooltipBg,
      border: `1px solid ${chartColors.tooltipBorder}`,
      borderRadius: "8px",
      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
    },
    labelStyle: {
      color: chartColors.tooltipText,
    },
  };
}

/**
 * Predefined colors for WiFi channels
 * @deprecated Use CHART_COLORS.channels from @/config/theme instead
 */
export const CHANNEL_COLORS = CHART_COLORS.channels;

/**
 * Colors for switch ports based on bandwidth and status
 */
export const PORT_COLORS = {
  down: "bg-[var(--bg-tertiary)]",
  error: "bg-red-400",
  bandwidthHigh: "bg-purple-500", // > 100MB/s
  bandwidthMedium: "bg-emerald-500", // > 10MB/s
  bandwidthNormal: "bg-emerald-400", // > 1MB/s
  bandwidthLow: "bg-emerald-300",
};
