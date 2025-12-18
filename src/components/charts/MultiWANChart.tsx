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
import type { MultiWANBandwidthPoint } from "@/hooks/useHistoricalData";
import type { ChartTooltipProps, ChartTooltipPayload } from "@/config/theme";

interface MultiWANChartProps {
  data: MultiWANBandwidthPoint[];
  ifnames: string[];
  activeIfname?: string; // The currently active uplink
  height?: number;
}

// Color palette for WAN interfaces - dynamically assigned
const COLOR_PAIRS = [
  { rx: "#10B981", tx: "#3B82F6" }, // emerald / blue
  { rx: "#F59E0B", tx: "#8B5CF6" }, // amber / purple
  { rx: "#EF4444", tx: "#06B6D4" }, // red / cyan
  { rx: "#EC4899", tx: "#14B8A6" }, // pink / teal
];

// Generate colors for an interface based on its index in the list
function getColors(ifname: string, ifnames: string[]) {
  const index = ifnames.indexOf(ifname);
  const colorPair = COLOR_PAIRS[index % COLOR_PAIRS.length];
  return {
    rx: colorPair.rx,
    tx: colorPair.tx,
    rxGradient: `${ifname.replace(/[^a-zA-Z0-9]/g, "_")}RxGradient`,
    txGradient: `${ifname.replace(/[^a-zA-Z0-9]/g, "_")}TxGradient`,
  };
}

// CustomTooltip moved outside component to avoid recreation on each render
interface CustomTooltipProps extends ChartTooltipProps {
  ifnames: string[];
  activeIfname?: string;
}

function CustomTooltip({ active, payload, label, ifnames, activeIfname }: CustomTooltipProps) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[var(--bg-secondary)] rounded-lg shadow-md border border-[var(--border-primary)] p-3">
        <p className="text-xs text-[var(--text-tertiary)] mb-2">
          {formatChartTime(label as string)}
        </p>
        <div className="space-y-2">
          {ifnames.map((ifname) => {
            const rxValue = payload.find(
              (p: ChartTooltipPayload) => p.dataKey === `${ifname}_rx`
            )?.value;
            const txValue = payload.find(
              (p: ChartTooltipPayload) => p.dataKey === `${ifname}_tx`
            )?.value;
            const colors = getColors(ifname, ifnames);
            const isActive = ifname === activeIfname;

            return (
              <div key={ifname} className={isActive ? "font-medium" : "opacity-70"}>
                <div className="text-xs text-[var(--text-secondary)] mb-1">
                  {ifname} {isActive && "(Active)"}
                </div>
                <div className="flex items-center gap-3 text-sm text-[var(--text-primary)]">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.rx }} />
                    <span>↓ {formatBytesRate(rxValue || 0)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.tx }} />
                    <span>↑ {formatBytesRate(txValue || 0)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
}

export function MultiWANChart({ data, ifnames, activeIfname, height = 240 }: MultiWANChartProps) {
  const chartColors = useChartColors();

  // Sort interfaces so active one comes first
  const sortedIfnames = [...ifnames].sort((a, b) => {
    if (a === activeIfname) return -1;
    if (b === activeIfname) return 1;
    return a.localeCompare(b);
  });

  return (
    <div>
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4">
        {sortedIfnames.map((ifname) => {
          const colors = getColors(ifname, ifnames);
          const isActive = ifname === activeIfname;
          return (
            <div key={ifname} className={`flex items-center gap-3 ${isActive ? "" : "opacity-60"}`}>
              <span
                className={`text-sm text-[var(--text-primary)] ${isActive ? "font-medium" : ""}`}
              >
                {ifname}
                {isActive && " (Active)"}
              </span>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.rx }} />
                <span className="text-xs text-[var(--text-tertiary)]">↓</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors.tx }} />
                <span className="text-xs text-[var(--text-tertiary)]">↑</span>
              </div>
            </div>
          );
        })}
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <defs>
            {ifnames.map((ifname) => {
              const colors = getColors(ifname, ifnames);
              return (
                <g key={ifname}>
                  <linearGradient id={colors.rxGradient} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.rx} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={colors.rx} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id={colors.txGradient} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.tx} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={colors.tx} stopOpacity={0} />
                  </linearGradient>
                </g>
              );
            })}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
          <XAxis
            dataKey="time"
            tickFormatter={formatChartTime}
            tick={{ fontSize: 11, fill: chartColors.tickText }}
            axisLine={{ stroke: chartColors.axisLine }}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => formatBytesRate(v).replace("/s", "")}
            tick={{ fontSize: 11, fill: chartColors.tickText }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip content={<CustomTooltip ifnames={ifnames} activeIfname={activeIfname} />} />
          {/* Render areas for each interface - active one on top */}
          {sortedIfnames.reverse().map((ifname) => {
            const colors = getColors(ifname, ifnames);
            const isActive = ifname === activeIfname;
            return (
              <g key={ifname}>
                <Area
                  type="monotone"
                  dataKey={`${ifname}_rx`}
                  stroke={colors.rx}
                  strokeWidth={isActive ? 2 : 1}
                  fill={`url(#${colors.rxGradient})`}
                  strokeOpacity={isActive ? 1 : 0.5}
                  fillOpacity={isActive ? 1 : 0.3}
                />
                <Area
                  type="monotone"
                  dataKey={`${ifname}_tx`}
                  stroke={colors.tx}
                  strokeWidth={isActive ? 2 : 1}
                  fill={`url(#${colors.txGradient})`}
                  strokeOpacity={isActive ? 1 : 0.5}
                  fillOpacity={isActive ? 1 : 0.3}
                />
              </g>
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
