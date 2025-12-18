import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
  Cell,
} from "recharts";
import { useMemo } from "react";
import { useChartColors } from "@/hooks/useChartColors";
import { CHART_COLORS } from "@/config/theme";
import { THRESHOLDS } from "@/lib/config";

interface CorrelationChartProps {
  clients: {
    mac: string;
    name: string;
    hostname: string;
    isWired: boolean;
    apName: string;
    signal: number;
    rssi: number;
    satisfaction: number;
  }[];
}

export function CorrelationChart({ clients }: CorrelationChartProps) {
  const chartColors = useChartColors();

  const data = useMemo(() => {
    return clients
      .filter((c) => !c.isWired && c.rssi && c.satisfaction)
      .map((c) => ({
        name: c.name || c.hostname || c.mac,
        mac: c.mac,
        x: c.rssi, // RSSI in dBm (e.g., -60)
        y: c.satisfaction, // 0-100
        apName: c.apName,
      }));
  }, [clients]);

  // Determine color based on satisfaction
  const getColor = (satisfaction: number) => {
    if (satisfaction >= 90) return CHART_COLORS.semantic.success;
    if (satisfaction >= 70) return CHART_COLORS.semantic.info;
    if (satisfaction >= THRESHOLDS.satisfaction.warning) return CHART_COLORS.semantic.warning;
    return CHART_COLORS.semantic.error;
  };

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-tertiary)] text-sm">
        No wireless client data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart
        margin={{
          top: 20,
          right: 20,
          bottom: 20,
          left: 10,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
        <XAxis
          type="number"
          dataKey="x"
          name="Signal Strength"
          unit=" dBm"
          domain={[-95, -30]}
          tick={{ fontSize: 10, fill: chartColors.tickText }}
          stroke={chartColors.axisLine}
          label={{
            value: "Signal Strength (dBm)",
            position: "bottom",
            offset: 0,
            fill: chartColors.tickText,
            fontSize: 12,
          }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name="Satisfaction"
          unit="%"
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: chartColors.tickText }}
          stroke={chartColors.axisLine}
          label={{
            value: "Satisfaction (%)",
            angle: -90,
            position: "insideLeft",
            fill: chartColors.tickText,
            fontSize: 12,
          }}
        />

        {/* Poor Signal Area (< -75 dBm) */}
        <ReferenceArea
          x1={-95}
          x2={THRESHOLDS.signal.poor}
          y1={0}
          y2={100}
          stroke="none"
          fill={CHART_COLORS.semantic.error}
          fillOpacity={0.05}
        />

        {/* Low Satisfaction Area (< 60%) */}
        <ReferenceArea
          x1={-95}
          x2={-30}
          y1={0}
          y2={THRESHOLDS.satisfaction.warning}
          stroke="none"
          fill={CHART_COLORS.semantic.warning}
          fillOpacity={0.05}
        />

        {/* Guidelines */}
        <ReferenceLine
          x={THRESHOLDS.signal.poor}
          stroke={CHART_COLORS.semantic.error}
          strokeDasharray="3 3"
          strokeOpacity={0.5}
        />
        <ReferenceLine
          y={THRESHOLDS.satisfaction.warning}
          stroke={CHART_COLORS.semantic.warning}
          strokeDasharray="3 3"
          strokeOpacity={0.5}
        />

        <Tooltip
          cursor={{ strokeDasharray: "3 3" }}
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const data = payload[0].payload;
              return (
                <div
                  className="rounded-lg shadow-md p-3 text-sm"
                  style={{
                    backgroundColor: chartColors.tooltipBg,
                    border: `1px solid ${chartColors.tooltipBorder}`,
                  }}
                >
                  <p className="font-semibold text-[var(--text-primary)] mb-1">{data.name}</p>
                  <div className="space-y-1 text-xs text-[var(--text-secondary)]">
                    <p>AP: {data.apName}</p>
                    <p>
                      Signal: <span className="font-mono">{data.x} dBm</span>
                    </p>
                    <p>
                      Satisfaction: <span className="font-mono">{data.y}%</span>
                    </p>
                  </div>
                </div>
              );
            }
            return null;
          }}
        />
        <Scatter name="Clients" data={data}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getColor(entry.y)} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
