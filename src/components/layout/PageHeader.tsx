import { ReactNode } from "react";
import { Link } from "react-router-dom";

interface PageHeaderProps {
  /** Page title (displayed as h1) */
  title: string;
  /** Optional description text below the title */
  description?: string;
  /** Breadcrumb text (e.g., "← Back to Clients") */
  breadcrumb?: string;
  /** Link destination for the breadcrumb */
  breadcrumbHref?: string;
  /** Action buttons or controls to display on the right */
  actions?: ReactNode;
}

/**
 * A consistent page header with title, optional description, breadcrumb, and action area.
 *
 * @example
 * ```tsx
 * // Simple page header
 * <PageHeader title="Overview" description="Network status at a glance" />
 *
 * // With breadcrumb navigation
 * <PageHeader
 *   title="Client Detail"
 *   breadcrumb="← Back to Clients"
 *   breadcrumbHref="/clients"
 * />
 *
 * // With action buttons
 * <PageHeader
 *   title="Access Points"
 *   actions={<TimeRangeSelector {...props} />}
 * />
 * ```
 */

export function PageHeader({
  title,
  description,
  breadcrumb,
  breadcrumbHref,
  actions,
}: PageHeaderProps) {
  return (
    <div className="mb-8">
      {breadcrumb && (
        <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
          {breadcrumbHref ? (
            <Link
              to={breadcrumbHref}
              className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
            >
              {breadcrumb}
            </Link>
          ) : (
            breadcrumb
          )}
        </div>
      )}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold font-[var(--font-display)] text-gradient tracking-tight">
            {title}
          </h1>
          {description && <p className="mt-1 text-[var(--text-tertiary)]">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}
