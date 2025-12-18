import { useChartColors } from "@/hooks/useChartColors";

interface GaugeChartProps {
  /** Current value to display */
  value: number;
  /** Maximum value for the gauge (default: 100) */
  max?: number;
  /** Label text displayed below the gauge */
  label: string;
  /** Unit suffix displayed below the value (default: '%') */
  unit?: string;
  /** Primary color for the gauge arc (default: purple) */
  color?: string;
  /** Size variant (default: 'md') */
  size?: "sm" | "md" | "lg";
}

/**
 * A 270-degree arc gauge chart for displaying percentage values.
 * Automatically changes color to warn (amber) at 70% and critical (red) at 90%.
 *
 * @example
 * ```tsx
 * // CPU usage gauge
 * <GaugeChart value={45} label="CPU" />
 *
 * // Memory with custom max and color
 * <GaugeChart value={6} max={8} label="Memory" unit="GB" color="#3B82F6" />
 *
 * // Compact size
 * <GaugeChart value={72} label="Load" size="sm" />
 * ```
 */

export function GaugeChart({
  value,
  max = 100,
  label,
  unit = "%",
  color = "#7C3AED",
  size = "md",
}: GaugeChartProps) {
  const chartColors = useChartColors();
  const percentage = Math.min((value / max) * 100, 100);
  const radius = size === "sm" ? 40 : size === "md" ? 50 : 60;
  const strokeWidth = size === "sm" ? 6 : size === "md" ? 8 : 10;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference * 0.75; // 270 degrees

  const getColor = () => {
    if (percentage >= 90) return "#EF4444";
    if (percentage >= 70) return "#F59E0B";
    return color;
  };

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative"
        style={{ width: radius * 2 + strokeWidth * 2, height: radius * 2 + strokeWidth * 2 }}
      >
        <svg
          width={radius * 2 + strokeWidth * 2}
          height={radius * 2 + strokeWidth * 2}
          className="transform -rotate-[135deg]"
        >
          {/* Background arc */}
          <circle
            cx={radius + strokeWidth}
            cy={radius + strokeWidth}
            r={radius}
            fill="none"
            stroke={chartColors.gaugeBg}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.75} ${circumference}`}
          />
          {/* Value arc */}
          <circle
            cx={radius + strokeWidth}
            cy={radius + strokeWidth}
            r={radius}
            fill="none"
            stroke={getColor()}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${circumference * 0.75} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-bold font-[var(--font-display)] text-[var(--text-primary)] ${size === "sm" ? "text-lg" : size === "md" ? "text-2xl" : "text-3xl"}`}
          >
            {value.toFixed(0)}
          </span>
          <span className="text-xs text-[var(--text-tertiary)]">{unit}</span>
        </div>
      </div>
      <span className="text-sm text-[var(--text-tertiary)] mt-2">{label}</span>
    </div>
  );
}
