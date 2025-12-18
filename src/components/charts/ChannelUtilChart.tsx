import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useChartColors } from "@/hooks/useChartColors";
import { ChartTooltipProps, CHART_COLORS } from "@/config/theme";
import { THRESHOLDS } from "@/lib/config";

interface ChannelData {
  radio: string;
  channel: number;
  cuTotal: number;
  cuSelfTx: number;
  cuSelfRx: number;
  numSta: number;
}

interface ChannelUtilChartProps {
  data: ChannelData[];
  height?: number;
}

const getBarColor = (utilization: number) => {
  if (utilization >= THRESHOLDS.utilization.critical) return CHART_COLORS.semantic.error; // Red - congested
  if (utilization >= THRESHOLDS.utilization.high) return CHART_COLORS.semantic.warning; // Amber - busy
  if (utilization >= THRESHOLDS.utilization.moderate) return CHART_COLORS.radio.amber; // Yellow - moderate
  return CHART_COLORS.semantic.success; // Green - good
};

function CustomTooltip({ active, payload }: ChartTooltipProps) {
  if (active && payload && payload.length) {
    const channelData = payload[0].payload as unknown as ChannelData;
    return (
      <div className="bg-[var(--bg-secondary)] rounded-lg shadow-md border border-[var(--border-primary)] p-3">
        <p className="font-medium text-[var(--text-primary)] mb-2">{channelData.radio}</p>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between gap-4">
            <span className="text-[var(--text-tertiary)]">Channel:</span>
            <span className="font-medium text-[var(--text-primary)]">{channelData.channel}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[var(--text-tertiary)]">Total Utilization:</span>
            <span className="font-medium text-[var(--text-primary)]">
              {channelData.cuTotal.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[var(--text-tertiary)]">Self TX:</span>
            <span className="font-medium text-[var(--text-primary)]">
              {channelData.cuSelfTx.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[var(--text-tertiary)]">Self RX:</span>
            <span className="font-medium text-[var(--text-primary)]">
              {channelData.cuSelfRx.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-[var(--text-tertiary)]">Clients:</span>
            <span className="font-medium text-[var(--text-primary)]">{channelData.numSta}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

export function ChannelUtilChart({ data, height = 200 }: ChannelUtilChartProps) {
  const colors = useChartColors();

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 60, bottom: 5 }}>
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fontSize: 11, fill: colors.tickText }}
            axisLine={{ stroke: colors.axisLine }}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <YAxis
            type="category"
            dataKey="radio"
            tick={{ fontSize: 12, fill: colors.tickTextDark }}
            axisLine={false}
            tickLine={false}
            width={55}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="cuTotal" radius={[0, 4, 4, 0]} maxBarSize={30}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.cuTotal)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 text-xs text-[var(--text-tertiary)]">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-emerald-500" />
          <span>&lt;{THRESHOLDS.utilization.moderate}% Good</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-yellow-400" />
          <span>
            {THRESHOLDS.utilization.moderate}-{THRESHOLDS.utilization.high}% Moderate
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-amber-500" />
          <span>
            {THRESHOLDS.utilization.high}-{THRESHOLDS.utilization.critical}% Busy
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-500" />
          <span>&gt;{THRESHOLDS.utilization.critical}% Congested</span>
        </div>
      </div>
    </div>
  );
}
