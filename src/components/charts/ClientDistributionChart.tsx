import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useChartColors } from "@/hooks/useChartColors";
import { ChartTooltipProps, PieLabelProps, CHART_COLORS } from "@/config/theme";

interface DistributionData {
  name: string;
  value: number;
  color: string;
}

interface ClientDistributionChartProps {
  data: DistributionData[];
  height?: number;
  title?: string;
}

const COLORS = CHART_COLORS.accent;

function CustomTooltip({ active, payload, total }: ChartTooltipProps & { total: number }) {
  if (active && payload && payload.length) {
    const itemData = payload[0].payload as unknown as DistributionData;
    const percentage = ((itemData.value / total) * 100).toFixed(1);
    return (
      <div className="bg-[var(--bg-secondary)] rounded-lg shadow-md border border-[var(--border-primary)] p-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: itemData.color }} />
          <span className="font-medium text-[var(--text-primary)]">{itemData.name}</span>
        </div>
        <div className="text-sm text-[var(--text-tertiary)]">
          {itemData.value} clients ({percentage}%)
        </div>
      </div>
    );
  }
  return null;
}

export function ClientDistributionChart({
  data,
  height = 250,
  title,
}: ClientDistributionChartProps) {
  const chartColors = useChartColors();

  // Assign colors if not provided
  const dataWithColors = data.map((item, idx) => ({
    ...item,
    color: item.color || COLORS[idx % COLORS.length],
  }));

  const total = data.reduce((sum, item) => sum + item.value, 0);

  const renderCustomLabel = ({ cx, cy }: PieLabelProps) => {
    return (
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
        <tspan
          x={cx}
          dy="-0.5em"
          className="text-2xl font-bold"
          fill={chartColors.centerTextPrimary}
        >
          {total}
        </tspan>
        <tspan x={cx} dy="1.5em" className="text-xs" fill={chartColors.centerTextSecondary}>
          clients
        </tspan>
      </text>
    );
  };

  // Calculate chart height - leave room for legend
  const chartHeight = Math.min(height - 60, 160);

  return (
    <div style={{ height }}>
      {title && <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">{title}</h3>}
      <ResponsiveContainer width="100%" height={chartHeight}>
        <PieChart>
          <Pie
            data={dataWithColors}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={65}
            paddingAngle={2}
            dataKey="value"
            labelLine={false}
            label={renderCustomLabel}
          >
            {dataWithColors.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                stroke={chartColors.tooltipBg}
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip total={total} />} />
        </PieChart>
      </ResponsiveContainer>
      {/* Custom legend that wraps and stays within bounds */}
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2 max-h-[50px] overflow-hidden">
        {dataWithColors.map((item) => (
          <div key={item.name} className="flex items-center gap-1">
            <div
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs text-[var(--text-tertiary)] whitespace-nowrap">
              {item.name} ({item.value})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
