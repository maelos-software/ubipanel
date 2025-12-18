import { type ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  /** Label displayed below the value */
  title: string | ReactNode;
  /** Main value to display (e.g., "42", "1.5 GB") */
  value: string | number;
  /** Optional secondary text below the title */
  subtitle?: string;
  /** Lucide icon component to display */
  icon: LucideIcon;
  /** Icon container background color (Tailwind class, e.g., "bg-purple-50") */
  iconBg?: string;
  /** Icon color (Tailwind class). Auto-detected from iconBg if not provided */
  iconColor?: string;
  /** Use compact layout for smaller spaces */
  compact?: boolean;
  /** Optional trend indicator with percentage change */
  trend?: {
    /** Percentage change (positive = up, negative = down) */
    value: number;
    /** Time period label (e.g., "vs last hour") */
    label: string;
  };
  /** Click handler - makes the card interactive */
  onClick?: () => void;
}

/**
 * A card component for displaying a single statistic with an icon.
 * Supports compact and full layouts, optional trends, and click interaction.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <StatCard title="Total Clients" value={42} icon={Users} />
 *
 * // With trend and click handler
 * <StatCard
 *   title="Download"
 *   value="1.5 GB/s"
 *   icon={ArrowDown}
 *   iconBg="bg-emerald-50"
 *   trend={{ value: 12, label: "vs last hour" }}
 *   onClick={() => navigate("/bandwidth")}
 * />
 *
 * // Compact layout
 * <StatCard title="CPU" value="45%" icon={Cpu} compact />
 * ```
 */

// Map icon background colors to appropriate icon colors
const iconColorMap: Record<string, string> = {
  "bg-purple-50": "text-purple-600",
  "bg-purple-100": "text-purple-600",
  "bg-blue-50": "text-blue-600",
  "bg-blue-100": "text-blue-600",
  "bg-emerald-50": "text-emerald-600",
  "bg-emerald-100": "text-emerald-600",
  "bg-amber-50": "text-amber-600",
  "bg-amber-100": "text-amber-600",
  "bg-red-50": "text-red-600",
  "bg-red-100": "text-red-600",
  "bg-indigo-50": "text-indigo-600",
  "bg-indigo-100": "text-indigo-600",
  "bg-slate-50": "text-slate-600",
  "bg-slate-100": "text-slate-600",
  "bg-green-50": "text-green-600",
  "bg-green-100": "text-green-600",
  "bg-yellow-50": "text-yellow-600",
  "bg-yellow-100": "text-yellow-600",
  "bg-cyan-50": "text-cyan-600",
  "bg-cyan-100": "text-cyan-600",
};

// Dark mode icon background mappings
const darkIconBgMap: Record<string, string> = {
  "bg-purple-50": "dark:bg-purple-900/30",
  "bg-purple-100": "dark:bg-purple-900/40",
  "bg-blue-50": "dark:bg-blue-900/30",
  "bg-blue-100": "dark:bg-blue-900/40",
  "bg-emerald-50": "dark:bg-emerald-900/30",
  "bg-emerald-100": "dark:bg-emerald-900/40",
  "bg-amber-50": "dark:bg-amber-900/30",
  "bg-amber-100": "dark:bg-amber-900/40",
  "bg-red-50": "dark:bg-red-900/30",
  "bg-red-100": "dark:bg-red-900/40",
  "bg-indigo-50": "dark:bg-indigo-900/30",
  "bg-indigo-100": "dark:bg-indigo-900/40",
  "bg-slate-50": "dark:bg-slate-700/50",
  "bg-slate-100": "dark:bg-slate-700/60",
  "bg-green-50": "dark:bg-green-900/30",
  "bg-green-100": "dark:bg-green-900/40",
  "bg-yellow-50": "dark:bg-yellow-900/30",
  "bg-yellow-100": "dark:bg-yellow-900/40",
  "bg-cyan-50": "dark:bg-cyan-900/30",
  "bg-cyan-100": "dark:bg-cyan-900/40",
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconBg = "bg-purple-50",
  iconColor,
  compact = false,
  trend,
  onClick,
}: StatCardProps) {
  const Wrapper = onClick ? "button" : "div";
  const resolvedIconColor = iconColor || iconColorMap[iconBg] || "text-purple-600";
  const darkIconBg = darkIconBgMap[iconBg] || "dark:bg-slate-700/50";

  if (compact) {
    return (
      <Wrapper
        onClick={onClick}
        className={`bg-[var(--bg-secondary)] rounded-xl shadow-sm ring-1 ring-[var(--border-primary)] card-hover text-left w-full ${
          onClick ? "cursor-pointer" : ""
        }`}
        style={{ padding: "var(--density-spacing-md)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg ${iconBg} ${darkIconBg} flex items-center justify-center flex-shrink-0`}
          >
            <Icon className={`w-5 h-5 ${resolvedIconColor}`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xl font-bold font-[var(--font-display)] text-[var(--text-primary)] tracking-tight truncate">
              {value}
            </div>
            <div className="text-xs text-[var(--text-tertiary)] truncate">{title}</div>
          </div>
          {trend && (
            <div
              className={`text-xs font-medium flex-shrink-0 ${trend.value >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
            >
              {trend.value >= 0 ? "↑" : "↓"}
              {Math.abs(trend.value)}%
            </div>
          )}
        </div>
        {subtitle && (
          <div className="text-xs text-[var(--text-tertiary)] mt-1 ml-13 truncate">{subtitle}</div>
        )}
      </Wrapper>
    );
  }

  return (
    <Wrapper
      onClick={onClick}
      className={`bg-[var(--bg-secondary)] rounded-2xl shadow-sm ring-1 ring-[var(--border-primary)] card-hover text-left w-full ${
        onClick ? "cursor-pointer" : ""
      }`}
      style={{ padding: "var(--density-card-padding)" }}
    >
      <div className="flex items-start justify-between">
        <div
          className={`w-12 h-12 rounded-xl ${iconBg} ${darkIconBg} flex items-center justify-center`}
        >
          <Icon className={`w-6 h-6 ${resolvedIconColor}`} />
        </div>
        {trend && (
          <div
            className={`text-sm font-medium ${trend.value >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
          >
            {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value)}%
            <span className="text-[var(--text-tertiary)] ml-1">{trend.label}</span>
          </div>
        )}
      </div>
      <div className="mt-4">
        <div className="text-3xl font-bold font-[var(--font-display)] text-[var(--text-primary)] tracking-tight">
          {value}
        </div>
        <div className="text-sm text-[var(--text-tertiary)] mt-1">{title}</div>
        {subtitle && <div className="text-xs text-[var(--text-tertiary)] mt-1">{subtitle}</div>}
      </div>
    </Wrapper>
  );
}
