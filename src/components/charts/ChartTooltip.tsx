import { formatBytesRate } from "@/lib/format";

interface ChartTooltipEntry {
  value?: number;
  color?: string;
  name?: string;
  dataKey?: string;
}

interface ChartColors {
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipEntry[];
  label?: string;
  chartColors: ChartColors;
  formatValue?: (value: number) => string;
  nameFormatter?: (name: string) => string;
  unit?: string;
  /** If true, show all values including zeros (useful for counts). Default false. */
  showZeros?: boolean;
}

/**
 * Generic chart tooltip component with consistent styling across the dashboard.
 *
 * Features:
 * - Sorts entries by value descending (highest first)
 * - Filters out zero values by default (configurable)
 * - Shows colored dots next to each entry
 * - Supports custom value formatters and units
 */
export function ChartTooltip({
  active,
  payload,
  label,
  chartColors,
  formatValue = (v: number) => String(v),
  nameFormatter = (n: string) => n,
  unit = "",
  showZeros = false,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  // Sort by absolute value descending (highest first), optionally filter zeros
  const sorted = [...payload]
    .filter((p) => p.value !== undefined && (showZeros || p.value !== 0))
    .sort((a, b) => Math.abs(b.value || 0) - Math.abs(a.value || 0));

  if (sorted.length === 0) return null;

  return (
    <div
      className="rounded-lg shadow-md p-3 text-sm"
      style={{
        backgroundColor: chartColors.tooltipBg,
        border: `1px solid ${chartColors.tooltipBorder}`,
      }}
    >
      <p className="text-xs text-[var(--text-tertiary)] mb-2">{label}</p>
      <div className="space-y-1">
        {sorted.map((entry) => (
          <div key={entry.dataKey || entry.name} className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            <span style={{ color: chartColors.tooltipText }}>
              {nameFormatter(entry.name || "")}: {formatValue(entry.value || 0)}
              {unit}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Pre-configured tooltip variants for common use cases
export const BandwidthTooltip = (props: Omit<ChartTooltipProps, "formatValue" | "unit">) => (
  <ChartTooltip {...props} formatValue={formatBytesRate} />
);

export const PercentTooltip = (props: Omit<ChartTooltipProps, "formatValue" | "unit">) => (
  <ChartTooltip {...props} formatValue={(v) => v.toFixed(0)} unit="%" />
);

export const SignalTooltip = (props: Omit<ChartTooltipProps, "formatValue" | "unit">) => (
  <ChartTooltip {...props} formatValue={(v) => v.toFixed(0)} unit=" dBm" />
);

export const CountTooltip = (
  props: Omit<ChartTooltipProps, "formatValue" | "unit" | "showZeros">
) => <ChartTooltip {...props} formatValue={(v) => v.toFixed(0)} showZeros />;
