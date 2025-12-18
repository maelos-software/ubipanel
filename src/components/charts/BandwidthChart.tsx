import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { formatBytesRate, formatChartTime } from "@/lib/format";
import { useChartColors } from "@/hooks/useChartColors";
import { ChartTooltipProps, CHART_COLORS } from "@/config/theme";

interface DataPoint {
  time: string;
  rxRate: number;
  txRate: number;
}

interface BandwidthLabels {
  tx: string;
  rx: string;
}

interface BandwidthChartProps {
  data: DataPoint[];
  height?: number;
  showLegend?: boolean;
  /** Labels for the chart. Defaults to Download/Upload (user perspective).
   *  Use { tx: 'TX', rx: 'RX' } for infrastructure/port context. */
  labels?: BandwidthLabels;
}

const DEFAULT_LABELS: BandwidthLabels = { tx: "Download", rx: "Upload" };

interface CustomTooltipProps extends ChartTooltipProps {
  labels: BandwidthLabels;
}

function CustomTooltip({ active, payload, label, labels }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[var(--bg-secondary)] rounded-lg shadow-md border border-[var(--border-primary)] p-3">
        <p className="text-xs text-[var(--text-tertiary)] mb-2">
          {formatChartTime(label as string)}
        </p>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-sm text-[var(--text-primary)]">
              {labels.tx}: {formatBytesRate(payload[0]?.value || 0)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-sm text-[var(--text-primary)]">
              {labels.rx}: {formatBytesRate(payload[1]?.value || 0)}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

export function BandwidthChart({
  data,
  height = 200,
  showLegend = true,
  labels = DEFAULT_LABELS,
}: BandwidthChartProps) {
  const colors = useChartColors();

  return (
    <div>
      {showLegend && (
        <div className="flex items-center gap-6 mb-4">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: CHART_COLORS.semantic.download }}
            />
            <span className="text-sm text-[var(--text-tertiary)]">{labels.tx}</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: CHART_COLORS.semantic.upload }}
            />
            <span className="text-sm text-[var(--text-tertiary)]">{labels.rx}</span>
          </div>
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="downloadGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.semantic.download} stopOpacity={0.3} />
              <stop offset="95%" stopColor={CHART_COLORS.semantic.download} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="uploadGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.semantic.upload} stopOpacity={0.3} />
              <stop offset="95%" stopColor={CHART_COLORS.semantic.upload} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} vertical={false} />
          <XAxis
            dataKey="time"
            tickFormatter={formatChartTime}
            tick={{ fontSize: 11, fill: colors.tickText }}
            axisLine={{ stroke: colors.axisLine }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => formatBytesRate(v).replace("/s", "")}
            tick={{ fontSize: 11, fill: colors.tickText }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip content={<CustomTooltip labels={labels} />} />
          <Area
            type="monotone"
            dataKey="txRate"
            stroke={CHART_COLORS.semantic.download}
            strokeWidth={2}
            fill="url(#downloadGradient)"
          />
          <Area
            type="monotone"
            dataKey="rxRate"
            stroke={CHART_COLORS.semantic.upload}
            strokeWidth={2}
            fill="url(#uploadGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
