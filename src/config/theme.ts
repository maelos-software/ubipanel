// Recharts tooltip prop types
export interface ChartTooltipPayload {
  value: number;
  dataKey: string;
  color?: string;
  name?: string;
  payload?: Record<string, unknown>;
}

export interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipPayload[];
  label?: string | number;
}

// Recharts label prop types for pie charts
export interface PieLabelProps {
  cx: number;
  cy: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  percent?: number;
  index?: number;
  name?: string;
  value?: number;
}

// Common chart data point types
// Note: BandwidthPoint is defined in @/lib/bandwidth (time: number, rx, tx)
// and @/hooks/history/types (time: string, rxRate, txRate) for different use cases.
// This file only contains chart-specific types.

export interface SignalPoint {
  time: string;
  signal: number;
  rssi?: number;
}

// Chart styling constants
export const CHART_TOOLTIP_STYLE = {
  backgroundColor: "white",
  border: "1px solid #E5E7EB",
  borderRadius: "8px",
  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
};

export const CHART_COLORS = {
  pastel: [
    "#A78BFA",
    "#60A5FA",
    "#34D399",
    "#FBBF24",
    "#F87171",
    "#A3E635",
    "#38BDF8",
    "#FB7185",
    "#C084FC",
    "#4ADE80",
    "#FACC15",
    "#22D3EE",
    "#E879F9",
    "#818CF8",
    "#2DD4BF",
  ],
  // Primary palette for charts with many categories (pie charts, stacked areas)
  accent: [
    "#8b5cf6",
    "#6366f1",
    "#3b82f6",
    "#0ea5e9",
    "#14b8a6",
    "#22c55e",
    "#84cc16",
    "#eab308",
    "#f97316",
    "#ef4444",
  ],
  // Alternative palette (Gateway, ClientInsights)
  vivid: [
    "#8b5cf6",
    "#06b6d4",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#ec4899",
    "#6366f1",
    "#14b8a6",
    "#84cc16",
    "#f97316",
  ],
  // Named semantic colors for specific use cases
  semantic: {
    success: "#22c55e",
    warning: "#f59e0b",
    error: "#ef4444",
    info: "#3b82f6",
    download: "#10b981",
    upload: "#3b82f6",
  },
  // Radio report specific colors
  radio: {
    "6GHz": "#06b6d4",
    "5GHz": "#8b5cf6",
    "2.4GHz": "#22c55e",
    purple: "#8b5cf6",
    blue: "#3b82f6",
    green: "#22c55e",
    amber: "#f59e0b",
    red: "#ef4444",
    cyan: "#06b6d4",
  },
  // WiFi Channel Colors
  channels: {
    "Ch 1": "#A78BFA",
    "Ch 6": "#60A5FA",
    "Ch 11": "#34D399",
    "Ch 36": "#FBBF24",
    "Ch 40": "#F87171",
    "Ch 44": "#F472B6",
    "Ch 48": "#2DD4BF",
    "Ch 52": "#A3E635",
    "Ch 100": "#FB923C",
    "Ch 149": "#818CF8",
    "Ch 153": "#C084FC",
    "Ch 157": "#38BDF8",
  },
};
