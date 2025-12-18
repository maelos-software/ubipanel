# Visual Style Guide

UbiPanel follows a "Modern Purple" design system. This guide ensures visual consistency across the dashboard.

## Color System

All colors must be sourced from the CSS variables in `src/index.css` or the theme configuration in `src/config/theme.ts`.

### Semantic Colors

| State       | CSS Variable       | Hex (Reference)         |
| :---------- | :----------------- | :---------------------- |
| **Primary** | `--accent-primary` | `#8b5cf6` (Violet 500)  |
| **Success** | `--status-success` | `#10b981` (Emerald 500) |
| **Warning** | `--status-warning` | `#f59e0b` (Amber 500)   |
| **Error**   | `--status-error`   | `#ef4444` (Red 500)     |
| **Info**    | `--status-info`    | `#3b82f6` (Blue 500)    |

### Chart Palettes

When creating multi-series charts, use the following arrays from `CHART_COLORS`:

1.  **Accent**: Default for most line/area charts.
2.  **Vivid**: Best for Pie charts and categorical distribution.
3.  **Radio**: Specifically for 2.4GHz, 5GHz, and 6GHz bands.

## Component Patterns

### 1. Stat Cards

Used for high-level metrics in grids.

- Always include an icon with a tinted background (e.g., `bg-blue-50/10`).
- Use `StatCard` from `@/components/common/StatCard`.

### 2. Data Tables

Used for detailed entity listings.

- Standardize on `DataTable` with `SortableHeader`.
- Ensure `focus-visible:ring` is active for keyboard navigation.

### 3. Charts

Built with Recharts 3.5.1.

- All charts must be wrapped in `ResponsiveContainer`.
- Use the shared `ChartTooltip` component for consistent hover behavior.
- Apply `role="img"` and `aria-label` to chart containers for accessibility.

## Typography

- **Headings**: Inter / System Sans-Serif, Semi-bold.
- **Body**: Inter / System Sans-Serif, Regular.
- **Monospace**: JetBrains Mono / System Mono (used for MACs, IPs, and raw metrics).

## Accessibility (A11y)

- **Landmarks**: Use `<section aria-label="...">` for major page blocks.
- **Interactive Elements**: All buttons must have an `aria-label` if they only contain an icon.
- **Focus States**: Use Tailwind `focus-visible` to provide clear indicators for keyboard users.
