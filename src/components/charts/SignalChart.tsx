import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { formatChartTime, getSignalDomain } from "@/lib/format";
import { useChartColors } from "@/hooks/useChartColors";
import { ChartTooltipProps, CHART_COLORS } from "@/config/theme";
import { THRESHOLDS } from "@/lib/config";

interface DataPoint {
  time: string;
  /** Signal strength in dBm (typically -30 to -90) */
  rssi: number;
  /** Signal quality as percentage (0-100) */
  signal: number;
}

interface SignalChartProps {
  /** Array of signal data points over time */
  data: DataPoint[];
  /** Chart height in pixels (default: 200) */
  height?: number;
}

/**
 * A line chart for displaying WiFi signal strength (RSSI) over time.
 * Includes reference lines at standard signal thresholds.
 * Automatically adjusts Y-axis domain based on data range.
 *
 * @example
 * ```tsx
 * const { data } = useClientSignalHistory(clientMac, "1h", "1m");
 *
 * <SignalChart data={data} height={200} />
 * ```
 */

const getSignalColor = (rssi: number) => {
  if (rssi >= THRESHOLDS.signal.excellent) return CHART_COLORS.semantic.success;
  if (rssi >= THRESHOLDS.signal.good) return CHART_COLORS.semantic.success;
  if (rssi >= THRESHOLDS.signal.fair) return CHART_COLORS.semantic.warning;
  return CHART_COLORS.semantic.error;
};

function CustomTooltip({ active, payload, label }: ChartTooltipProps) {
  if (active && payload && payload.length) {
    const rssi = payload[0]?.value || 0;
    return (
      <div className="bg-[var(--bg-secondary)] rounded-lg shadow-md border border-[var(--border-primary)] p-3">
        <p className="text-xs text-[var(--text-tertiary)] mb-2">
          {formatChartTime(label as string)}
        </p>
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: getSignalColor(rssi as number) }}
          />
          <span className="text-sm font-medium text-[var(--text-primary)]">{rssi} dBm</span>
        </div>
      </div>
    );
  }
  return null;
}

export function SignalChart({ data, height = 200 }: SignalChartProps) {
  const colors = useChartColors();

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
        <XAxis
          dataKey="time"
          tickFormatter={formatChartTime}
          tick={{ fontSize: 11, fill: colors.tickText }}
          axisLine={{ stroke: colors.axisLine }}
          tickLine={false}
        />
        <YAxis
          domain={([dataMin, dataMax]) => getSignalDomain(dataMin, dataMax)}
          tick={{ fontSize: 11, fill: colors.tickText }}
          axisLine={false}
          tickLine={false}
          width={45}
          tickFormatter={(v) => `${v}`}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine
          y={THRESHOLDS.signal.excellent}
          stroke={CHART_COLORS.semantic.success}
          strokeDasharray="5 5"
          strokeOpacity={0.5}
        />
        <ReferenceLine
          y={THRESHOLDS.signal.fair}
          stroke={CHART_COLORS.semantic.warning}
          strokeDasharray="5 5"
          strokeOpacity={0.5}
        />
        <Line
          type="monotone"
          dataKey="rssi"
          stroke={CHART_COLORS.radio["5GHz"]}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: CHART_COLORS.radio["5GHz"] }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
