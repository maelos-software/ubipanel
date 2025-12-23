import { ReactNode } from "react";

/** Available badge color variants */
type BadgeVariant = "success" | "warning" | "error" | "info" | "neutral";

interface BadgeProps {
  /** Badge content */
  children: ReactNode;
  /** Color variant (default: 'neutral') */
  variant?: BadgeVariant;
}

/**
 * A small status indicator badge with colored background.
 *
 * @example
 * ```tsx
 * <Badge variant="success">Online</Badge>
 * <Badge variant="error">Offline</Badge>
 * <Badge>Unknown</Badge>
 * ```
 */

const variantStyles: Record<BadgeVariant, string> = {
  success:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50",
  warning:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50",
  error:
    "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50",
  info: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50",
  neutral:
    "bg-gray-50 text-gray-700 border-gray-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700",
};

export function Badge({ children, variant = "neutral" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variantStyles[variant]}`}
    >
      {children}
    </span>
  );
}
