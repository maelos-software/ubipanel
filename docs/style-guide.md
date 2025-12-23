# Visual Style Guide

UbiPanel follows a "Modern Purple" design system, optimized for high-density network monitoring data across light and dark modes.

## Color System

The system uses a variable-based approach to ensure consistency across themes. All colors must be sourced from the CSS variables defined in `src/index.css`.

### Brand Colors

| Variable           | Light                     | Dark                      | Purpose                                      |
| :----------------- | :------------------------ | :------------------------ | :------------------------------------------- |
| `--accent-primary` | `#7c3aed`                 | `#a855f7`                 | Primary buttons, active states, brand icons. |
| `--accent-hover`   | `#6d28d9`                 | `#c084fc`                 | Hover states for primary actions.            |
| `--accent-glow`    | `rgba(124, 58, 237, 0.3)` | `rgba(168, 85, 247, 0.3)` | Neon accent shadows and focus rings.         |

### Semantic Status Colors

Used for `Badge` components and health indicators.

| State       | Variable Prefix   | Light Palette (BG/Text) | Dark Palette (BG/Text) |
| :---------- | :---------------- | :---------------------- | :--------------------- |
| **Success** | `--color-success` | `#ecfdf5` / `#047857`   | `#064e3b` / `#6ee7b7`  |
| **Warning** | `--color-warning` | `#fffbeb` / `#b45309`   | `#78350f` / `#fcd34d`  |
| **Error**   | `--color-error`   | `#fef2f2` / `#b91c1c`   | `#7f1d1d` / `#fca5a5`  |
| **Info**    | `--color-info`    | `#eff6ff` / `#1d4ed8`   | `#1e3a8a` / `#93c5fd`  |

## Typography

- **Display**: "Plus Jakarta Sans" (Headings, Stats) - Tracking: tight.
- **Sans**: "Inter" (Body, Labels, Controls).
- **Mono**: "JetBrains Mono" (IPs, MACs, Raw Data).

## Density System

UbiPanel supports three density modes to accommodate different screen sizes and user preferences:

| Class           | Spacing (MD) | Text (Base) | Card Padding |
| :-------------- | :----------- | :---------- | :----------- |
| **Comfortable** | `1.0rem`     | `1.0rem`    | `1.5rem`     |
| **Compact**     | `0.5rem`     | `0.875rem`  | `1.0rem`     |
| **Spacious**    | `1.5rem`     | `1.125rem`  | `2.0rem`     |

## Layout & Components

### 1. The Global Layout

- **Sidebar**: Uses a `sidebar-gradient` (Indigo/Blue blend).
- **Background**: Light Mode: `#f9fafb` | Dark Mode: `#0f172a`.

### 2. Stat Cards (`StatCard`)

- **Container**: `bg-[var(--bg-secondary)]`, `rounded-2xl`, `shadow-sm`, `ring-1`.
- **Icons**: Backgrounds must be tinted versions of the icon color (e.g., `bg-purple-50` with `text-purple-600`).
- **Interaction**: Apply the `card-hover` class for a translateY lift effect on hover.

### 3. Data Tables (`DataTable`)

- **Headers**: Sticky, font-semibold, uppercase, tracking-wider.
- **Sorting**: Active columns show violet chevrons (`↑` or `↓`).
- **Focus**: Interactive rows/headers must use `focus-visible:ring-2 focus-visible:ring-purple-500`.

### 4. Badges (`Badge`)

- **Shape**: `rounded-full`, `px-2.5`, `py-0.5`.
- **Variants**: `success`, `warning`, `error`, `info`, `neutral`.

## Visual Effects & Utilities

- **Neon Glow**: `.neon-accent` applies a subtle glow using `--accent-glow`.
- **Text Gradient**: `.text-gradient` creates a sleek top-to-bottom fade on headings.
- **Transitions**:
  - `fast`: `0.1s` (Buttons, small UI changes).
  - `base`: `0.2s` (Color shifts, background fades).
  - `slow`: `0.3s` (Sidebar transitions, modal entries).

## Accessibility (A11y)

- All interactive `div` or `section` elements must include `role="button"` or appropriate landmarks.
- Focus rings are mandatory for keyboard navigation (`focus-visible`).
- Contrast ratios for status text must exceed WCAG AA standards.
