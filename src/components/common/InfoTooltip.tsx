import { Info } from "lucide-react";
import { type MetricDefinition } from "@/lib/metrics";

interface InfoTooltipProps {
  metric: MetricDefinition;
  position?: "top" | "bottom" | "left" | "right";
}

/**
 * Educational info icon that shows metric definitions on hover.
 * Adds professional "scrutiny-ready" value to monitoring pages.
 */
export function InfoTooltip({ metric, position = "top" }: InfoTooltipProps) {
  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div className="group relative inline-block">
      <Info className="w-3.5 h-3.5 text-[var(--text-tertiary)] hover:text-purple-500 cursor-help transition-colors" />

      {/* Tooltip Content */}
      <div
        className={`
        absolute z-50 invisible group-hover:visible 
        w-64 p-3 rounded-xl shadow-xl
        bg-[var(--bg-secondary)] border border-[var(--border-primary)]
        transition-all opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100
        ${positionClasses[position]}
      `}
      >
        <h4 className="font-bold text-sm text-[var(--text-primary)] mb-1 border-b border-[var(--border-primary)] pb-1">
          {metric.name}
        </h4>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-2">
          {metric.shortDef}
        </p>
        <p className="text-[10px] text-[var(--text-tertiary)] leading-tight italic">
          {metric.longDef}
        </p>

        {metric.thresholds && (
          <div className="mt-2 pt-2 border-t border-[var(--border-primary)] grid grid-cols-3 gap-1 text-[9px] font-medium text-center">
            <div className="text-emerald-500">Good: {metric.thresholds.good}</div>
            <div className="text-amber-500">Fair: {metric.thresholds.fair}</div>
            <div className="text-red-500">Poor: {metric.thresholds.poor}</div>
          </div>
        )}

        {/* Arrow */}
        <div
          className={`
          absolute w-2 h-2 bg-[var(--bg-secondary)] border-b border-r border-[var(--border-primary)] rotate-45
          ${position === "top" ? "left-1/2 -translate-x-1/2 -bottom-1" : ""}
          ${position === "bottom" ? "left-1/2 -translate-x-1/2 -top-1 border-t border-l border-b-0 border-r-0" : ""}
        `}
        />
      </div>
    </div>
  );
}
