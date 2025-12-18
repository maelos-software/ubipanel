# Architecture Overview

This document provides a high-level overview of UbiPanel's architecture.

## System Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  UniFi          │     │    UnPoller     │     │    InfluxDB     │
│  Controller     │────▶│  (Collector)    │────▶│   (Time-Series) │
│  192.168.1.1    │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                        ┌─────────────────────────────────────────┐
                        │         Express Proxy Server            │
                        │  - Query validation (security)          │
                        │  - Credential management                │
                        │  - CORS handling                        │
                        └─────────────────────────────────────────┘
                                                        │
                                                        ▼
                        ┌─────────────────────────────────────────┐
                        │         React Dashboard (SPA)           │
                        │  - React Query (data fetching)          │
                        │  - Recharts (visualizations)            │
                        │  - Tailwind CSS (styling)               │
                        └─────────────────────────────────────────┘
```

## Data Flow

1. **UniFi Controller** → **UnPoller**: UnPoller polls the UniFi controller every 30 seconds
2. **UnPoller** → **InfluxDB**: Metrics are stored in time-series format
3. **InfluxDB** → **Express Proxy**: Dashboard queries data via the proxy server
4. **Express Proxy** → **React Dashboard**: JSON responses rendered in the UI

## Key Design Decisions

### 1. Query Proxy Pattern

All InfluxDB queries go through the Express server (`server/index.js`) for:

- **Credential Management**: InfluxDB credentials are never exposed to the browser
- **Query Validation**: Prevents SQL injection and dangerous operations (see `server/lib/validateQuery.js`)
- **CORS Handling**: Simplifies cross-origin requests during development

### 2. React Query for Data Fetching

We use TanStack Query (React Query) instead of manual fetch/useEffect patterns:

- **Automatic Refetching**: 30-second polling interval (`REFETCH_INTERVAL`)
- **Caching & Deduplication**: Prevents redundant network requests
- **Loading/Error States**: Consistent handling across all data hooks
- **Stale-While-Revalidate**: Shows cached data while fetching updates

### 3. Engine-Based Hook Architecture

Data fetching is powered by a generic `useTimeSeries` engine (`src/hooks/useTimeSeries.ts`) that handles InfluxDB query execution, error handling, and data parsing. Domain-specific hooks wrap this engine to provide type-safe access to network metrics.

- **Engine**: `useTimeSeries.ts` - Generic React Query wrapper for InfluxDB.
- **Queries**: Raw InfluxQL builders in `src/lib/queries/`.
- **Domain Hooks**: High-level hooks in `src/hooks/history/` and `src/hooks/use*.ts`.
- **Safe Parsing**: Optimized row-to-object mapping in `src/lib/influx.ts` using pre-computed column maps.

```
src/hooks/
├── useTimeSeries.ts        # The core data-fetching engine
├── history/                # Domain-specific historical hooks
│   ├── useWANHistory.ts
│   ├── useClientHistory.ts
│   ├── useAPHistory.ts
│   ├── useRadioReport.ts   # Specialized report logic
│   └── ...
├── utils/                  # InfluxDB parsing utilities
├── useClients.ts           # Current state hooks
└── ...
```

### 4. Normalized Data Model & Thresholds

UnPoller uses inconsistent field naming and non-standard metrics that we normalize across the application. We also maintain a centralized set of health thresholds in `src/lib/config.ts`.

| Metric            | Thresholds (Good / Fair / Poor) | Source Fields                      |
| :---------------- | :------------------------------ | :--------------------------------- |
| **Signal (RSSI)** | >= -60 / -70 / < -75 (dBm)      | `signal` (swapped from percentage) |
| **Satisfaction**  | >= 80 / 70 / < 60 (%)           | `satisfaction`                     |
| **Utilization**   | < 40 / 60 / > 80 (%)            | `cu_total`                         |
| **Resources**     | < 60 / 80 / > 90 (%)            | `cpu`, `mem`                       |

Field mapping details:

- `rssi` (Our model) = `signal` (UnPoller dBm value)
- `signal` (Our model) = `rssi` (UnPoller percentage value)
- `rxBytesR` = `rx_bytes_r` (Clients) or `"rx_bytes-r"` (Infrastructure)

### 5. Lazy Loading

Page components are lazy-loaded to reduce initial bundle size:

```typescript
const Overview = lazy(() => import("./pages/Overview"));
const Clients = lazy(() => import("./pages/Clients"));
```

## Directory Structure

```
ubipanel/
├── collector/            # Optional: standalone data collector
├── docs/                 # Documentation
├── public/               # Static assets
├── server/               # Express proxy server
│   ├── lib/
│   │   └── validateQuery.js  # Query security
│   └── index.js          # Main server entry
├── src/
│   ├── components/
│   │   ├── charts/       # Recharts-based visualizations
│   │   ├── common/       # Reusable UI (Badge, DataTable, InfoTooltip)
│   │   └── layout/       # Layout components
│   ├── hooks/
│   │   ├── history/      # Historical data hooks
│   │   ├── utils/        # Defensive parsing logic
│   │   └── *.ts          # Current data hooks
│   ├── lib/
│   │   ├── queries/      # Centralized InfluxQL builders
│   │   └── *.ts          # Utilities and helpers
│   ├── pages/            # Page components
│   │   └── reports/      # Report pages
│   └── types/            # TypeScript type definitions
└── tests/
    └── unit/             # Unit tests

```

## Key Files

| File                          | Purpose                                     |
| ----------------------------- | ------------------------------------------- |
| `src/App.tsx`                 | Main app with routing and React Query setup |
| `src/lib/influx.ts`           | InfluxDB query utilities and escaping       |
| `src/lib/config.ts`           | Configuration constants                     |
| `src/lib/format.ts`           | Formatting utilities (bytes, time, etc.)    |
| `src/lib/bandwidth.ts`        | Bandwidth calculation helpers               |
| `src/lib/timeRanges.ts`       | Time range presets for selectors            |
| `server/lib/validateQuery.js` | Query validation/security                   |

## Code Quality

For information about code conventions, patterns, and maintainability:

- [Maintainability Guide](maintainability.md) - Conventions, patterns, and architectural principles
- [Style Guide](style-guide.md) - Visual design and component standards

## Security Considerations

1. **Query Validation**: The server validates all queries before forwarding to InfluxDB
   - Only SELECT and SHOW statements allowed
   - Blocked keywords: DROP, DELETE, ALTER, CREATE, INSERT, UPDATE, GRANT
   - Maximum query length enforced

2. **Credential Isolation**: Database credentials are only in server environment variables

3. **Input Escaping**: All user-provided values are escaped before query construction
   - `escapeInfluxString()` for string values
   - `escapeInfluxIdentifier()` for identifiers
   - `validateTimeRange()` for time parameters

## Configuration

### Environment Variables

**Server (`server/.env`):**

```env
INFLUX_URL=http://localhost:8086
INFLUX_DB=unpoller
INFLUX_USER=unpoller
INFLUX_PASS=your-password
SITE_NAME=My Network
```

**Client (`.env.development`):**

```env
VITE_API_URL=http://localhost:4821
```

### Key Constants (`src/lib/config.ts`)

| Constant              | Value | Description                       |
| --------------------- | ----- | --------------------------------- |
| `REFETCH_INTERVAL`    | 30000 | Data refresh interval (ms)        |
| `TRAFFIC_TOTAL_RANGE` | "24h" | Default range for traffic totals  |
| `CURRENT_DATA_WINDOW` | "5m"  | Window for "current" data queries |

## Testing

- **Unit Tests**: `npm test` - Tests for lib utilities
- **Type Checking**: `npx tsc --noEmit` - TypeScript validation
- **Linting**: `npm run lint` - ESLint checks

## Deployment

See `README.md` for deployment instructions using Docker Compose.
