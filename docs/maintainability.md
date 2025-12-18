# Maintainability & Code Quality

This document outlines the architectural patterns and code quality standards maintained in UbiPanel to ensure it remains accessible to contributors and robust against regressions.

## Architectural Patterns

### 1. The Data Engine Pattern (`useTimeSeries`)

To prevent "copy-paste architecture" across the dashboard's many charts, all historical data fetching is consolidated into a single generic engine: `src/hooks/useTimeSeries.ts`.

- **Abstraction**: React Query boilerplate (caching, loading states, polling) is handled once.
- **Type Safety**: TypeScript overloads ensure that generic data fetching remains strictly typed for both simple maps and complex aggregations.
- **Performance**: Standardizes the polling interval and stale times globally.

### 2. Defensive Parsing (`createValueGetter`)

InfluxDB 1.x returns data in a column-based array format (`columns[]`, `values[][]`). To prevent brittle code that breaks when the database schema changes:

- **O(1) Lookups**: The `createValueGetter` utility pre-computes a column map to avoid repeated `indexOf` calls.
- **Typed Accessors**: Helpers like `.number()`, `.string()`, and `.boolean()` handle null-safety and type conversion automatically.
- **Dev Warnings**: Missing columns trigger console warnings in development to catch schema mismatches early.

### 3. Visual Configuration Hub (`theme.ts`)

UI components never define their own colors. All visual constants are centralized:

- **CSS Variables**: Core layout colors are defined in `src/index.css`.
- **JS Theme Config**: Chart-specific colors (Recharts) are centralized in `src/config/theme.ts`.
- **Health Thresholds**: Boundaries for "Good/Fair/Poor" status are centralized in `src/lib/config.ts`.

## Code Quality Standards

### TypeScript

- **No `any`**: The use of `any` is strictly prohibited. Use generics or `unknown` with type guards.
- **Interface vs Type**: Use `interface` for public-facing object shapes and `type` for internal unions or aliases.
- **Explicit Returns**: All exported functions and hooks must have explicit return types.

### React & Performance

- **Memoization**: Expensive data transformations (especially those inside `useTimeSeries` processors) must be memoized using `useMemo`.
- **Pure Components**: Chart and data-rendering components should remain pure, relying on props rather than internal state where possible.
- **Barrel Exports**: Use `index.ts` files in hook directories to provide clean, domain-based import paths.

## Testing Strategy

UbiPanel maintains a strict "Build-or-Break" testing policy:

1.  **Unit Tests (Vitest)**: Every utility in `src/lib` must have 100% logic coverage.
2.  **Hook Tests (Testing Library)**: Domain hooks are tested with mocked InfluxDB responses to ensure correct data transformation.
3.  **E2E Tests (Playwright)**: Full-page smoke tests verify that the frontend correctly renders all data types and handles navigation/filters.

---

_Contributors are expected to adhere to these patterns when submitting Pull Requests._
