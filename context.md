# UbiPanel Project Context

## Overview

**UbiPanel** is a modern, real-time network monitoring dashboard for UniFi networks. Built as a lightweight alternative to Grafana dashboards, providing a clean and intuitive interface for monitoring UniFi infrastructure.

- **Repository:** https://github.com/maelos-software/ubipanel
- **License:** MIT

## Tech Stack

### Frontend

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite 7** - Build tool and dev server
- **TanStack Query** - Data fetching and caching (30-second refresh interval)
- **Recharts 3.5.1** - Charts and visualizations (pinned version - 3.6.0 has breaking type changes)
- **Tailwind CSS 4** - Styling with CSS variables
- **Lucide React** - Icons
- **React Router 7** - Navigation
- **date-fns** - Date formatting

### Backend

- **Express** - Proxy server for secure InfluxDB access
- **InfluxDB 1.x** - Time series database (NOT compatible with 2.x/3.x)
- **UnPoller** - Collects metrics from UniFi controller

### Testing

- **Vitest** - Unit testing (601 tests)
- **Playwright** - E2E testing (100 tests)
- **Testing Library** - React component testing

### Development

- **Husky** - Git hooks
- **lint-staged** - Pre-commit linting
- **Prettier** - Code formatting
- **ESLint** - Linting

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  UniFi          │     │    UnPoller     │     │    InfluxDB     │
│  Controller     │────▶│  (Collector)    │────▶│   (Time-Series) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                        ┌─────────────────────────────────────────┐
                        │         Express Proxy Server            │
                        │  - Query validation (SELECT only)       │
                        │  - Credential management                │
                        │  - CORS handling                        │
                        └─────────────────────────────────────────┘
                                                        │
                                                        ▼
                        ┌─────────────────────────────────────────┐
                        │         React Dashboard (SPA)           │
                        │  - TanStack Query (data fetching)       │
                        │  - Recharts (visualizations)            │
                        │  - Tailwind CSS (styling)               │
                        └─────────────────────────────────────────┘
```

The proxy server keeps InfluxDB credentials secure - the browser never sees database credentials.

## Project Structure

```
ubipanel/
├── .github/workflows/    # CI configuration
│   └── ci.yml            # GitHub Actions (Node 20, 22 + Docker)
├── collector/            # Optional DPI traffic collector
│   ├── lib/
│   │   ├── influx.js     # InfluxDB writer
│   │   ├── mappings.js   # DPI app mappings
│   │   └── unifi.js      # UniFi API client
│   ├── index.js          # Collector entry point
│   └── docker-compose.yml
├── docs/
│   └── architecture.md   # Architecture documentation
├── public/
│   └── favicon.svg       # Custom WiFi icon favicon
├── scripts/
│   ├── dev.js            # Dev server manager (start/stop/status)
│   ├── screenshot.mjs    # Screenshot utility for visual testing
│   └── audit-site.mjs    # Comprehensive site audit tool
├── server/
│   ├── lib/
│   │   └── validateQuery.js  # Query security validation
│   ├── index.js          # Express proxy server
│   └── .env.example      # Environment template
├── src/
│   ├── components/
│   │   ├── charts/       # BandwidthChart, SignalChart, CorrelationChart, etc.
│   │   ├── common/       # Badge, DataTable, StatCard, ClientList, InfoTooltip
│   │   └── layout/       # Layout, Sidebar, PageHeader, PreferencesProvider
│   ├── config/
│   │   └── theme.ts      # Centralized chart colors and design tokens
│   ├── hooks/
│   │   ├── history/      # useWANHistory, useClientHistory, useRadioReport, etc.
│   │   ├── utils/        # parseInfluxResults (defensive parsing)
│   │   ├── useTimeSeries.ts # Generic InfluxDB data-fetching engine
│   │   └── *.ts          # useClients, useAccessPoints, useSwitches, etc.
│   ├── lib/
│   │   ├── queries/      # Centralized InfluxQL builders
│   │   ├── bandwidth.ts  # Bandwidth calculation helpers
│   │   ├── config.ts     # REFETCH_INTERVAL, etc.
│   │   ├── dpiMappings.ts # DPI application mappings
│   │   ├── format.ts     # formatBytes, formatDuration, etc.
│   │   ├── influx.ts     # Query utilities, escaping
│   │   ├── metrics.ts    # Educational metric definitions
│   │   ├── preferences.ts # User preferences (localStorage)
│   │   ├── timeRanges.ts # Time range presets
│   │   └── wifi.ts       # WiFi helpers (signal strength, distribution math)
│   ├── pages/
│   │   ├── reports/      # 9 report pages
│   │   └── *.tsx         # Overview, Clients, AccessPoints, Switches, etc.
│   └── types/            # TypeScript type definitions
├── tests/
│   ├── components/       # Component tests
│   ├── hooks/            # Hook tests
│   └── unit/             # Unit tests for lib utilities
├── index.html            # Entry HTML (title: "UbiPanel")
├── package.json          # name: "ubipanel"
└── vite.config.ts        # Vite configuration
```

## Features

### Pages

1. **Overview** - Network health, client counts, bandwidth stats, top clients, distribution charts
2. **Clients** - Client listing with search/filter, VLAN filtering via URL params
3. **Client Detail** - Connection history, bandwidth charts, signal/experience metrics
4. **Client Insights** - Network-wide wireless analytics, signal distribution, roaming patterns
5. **Access Points** - AP status, per-radio stats (2.4/5/6GHz), client distribution
6. **AP Detail** - Connected clients, bandwidth history, radio config
7. **Switches** - Switch status, PoE monitoring, port status with TX/RX levels
8. **Switch Detail** - Port details, PoE consumption, SFP diagnostics
9. **Port Detail** - TX/RX history, packet rates, connected client info
10. **Gateway** - USG/UDM metrics (CPU, memory, temp), multi-WAN status, VLANs
11. **WAN Detail** - Per-WAN interface statistics
12. **Events** - Real-time event log with category filters
13. **Applications** - DPI traffic analysis (optional, requires collector)
14. **Reports** - 9 pre-built analytical reports

### Reports

- Bandwidth Report - Top consumers over time
- Experience Report - Clients with poor wireless experience
- Roaming Report - Client roaming patterns
- AP Load Report - AP utilization and client distribution
- WAN Health Report - WAN uptime and failover events
- Port Health Report - Switch ports with errors
- Infrastructure Report - Device health overview
- Guest Report - Guest network analytics
- Radio Report - Radio utilization and channel analysis

## Key Technical Details

### CSS Variables (src/index.css)

- `--text-primary` - Main text
- `--text-secondary` - Secondary text
- `--text-tertiary` - Labels, icons, timestamps
- `--accent-primary` - Primary brand color (standardized transitions)
- `--z-modal` - Structured z-index hierarchy

Dark mode uses darker sidebar gradient:

```css
.dark .sidebar-gradient {
  background: linear-gradient(180deg, #0f1d2f 0%, #1e3a8a 50%, #1e3a5f 100%);
}
```

### UnPoller Field Mapping Quirks

- UnPoller `signal` = RSSI in dBm (e.g., -65)
- UnPoller `rssi` = Signal quality percentage (0-100)
- These are backwards from standard naming - dashboard normalizes internally

### TX/RX vs Download/Upload

- WAN/Client context: Download/Upload (user perspective)
- Switch ports: TX/RX (device perspective)

### Query Security (server/lib/validateQuery.js)

- Only SELECT and SHOW queries allowed
- Blocked: DROP, DELETE, ALTER, CREATE, INSERT, UPDATE, GRANT, INTO
- Input escaping for injection prevention

### LocalStorage Key

- `ubipanel-preferences` - User preferences (theme, refresh interval, etc.)

### Bandwidth Chart Spike Prevention

- Uses `non_negative_derivative()` instead of `derivative()` in InfluxDB queries
- 1 GB/s outlier filter in processing
- Skips first data point from each series

## Development

### Commands

```bash
npm run dev:start    # Start proxy + Vite in background
npm run dev:stop     # Stop servers
npm run dev:status   # Check server status
npm run dev          # Start only Vite
npm test             # Run tests (233 tests)
npm run typecheck    # TypeScript check
npm run lint         # ESLint
npm run validate     # All checks (typecheck + lint + test)
npm run build        # Production build
```

### Default Ports

- 4820 - Vite dev server (frontend)
- 4821 - Proxy server (API)

Configurable via `.env.development`:

```env
DEV_VITE_PORT=4820
DEV_PROXY_PORT=4821
```

### Scripts

**dev.js** - Development server manager

- Validates server/.env exists
- Starts proxy, waits for health check
- Starts Vite, waits for ready
- Saves PIDs to .dev-pids.json
- Logs to .dev-proxy.log, .dev-vite.log

**screenshot.mjs** - Screenshot utility

```bash
node scripts/screenshot.mjs [--url URL] [--full] [--dark] [pages...]
```

- Max height 5000px (Claude vision limit)
- Pages: dashboard, clients, insights, aps, switches, gateway, events, reports, applications, all

**audit-site.mjs** - Site audit

```bash
node scripts/audit-site.mjs [--url URL] [--api URL] [--output DIR]
```

- Queries InfluxDB directly
- Captures screenshots of all pages
- Extracts metrics and detects errors
- Generates audit-results.json

## Configuration

### Server Environment (server/.env)

```env
INFLUX_URL=http://localhost:8086
INFLUX_DB=unpoller
INFLUX_USER=unpoller
INFLUX_PASS=your_password
PORT=3001
SITE_NAME=UniFi Network
SERVE_STATIC=false
```

### Frontend Environment

```env
VITE_BASE_PATH=/           # Base path for deployment
VITE_API_URL=http://localhost:4821  # API URL (dev only)
```

### Docker Deployment (Production)

Pre-built images are pushed to GitHub Container Registry on every push to main.

```bash
# On your server, create a directory with docker-compose.yml and .env
# See deploy/ directory for templates

# Deploy or update
cd /opt/ubipanel
docker compose pull && docker compose up -d

# Available at http://localhost:4880
```

**Image tags:**

- `ghcr.io/maelos-software/ubipanel:main` - Latest from main branch
- `ghcr.io/maelos-software/ubipanel:v1.0.0` - Specific version (when tagged)
- `ghcr.io/maelos-software/ubipanel:<sha>` - Specific commit

**Server setup (srv1):**

- Location: `/opt/ubipanel`
- Nginx proxies `/dashboard/*` to port 4880
- Container runs on port 4880 → 3000 internal

### Docker Deployment (Local Development)

```bash
# Build and run locally
docker compose up -d --build
```

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`):

- Triggers on push/PR to main, and version tags (v\*)
- Tests on Node 20 and 22 (Node 18 dropped - Vitest hangs)
- 10-minute job timeout
- Steps: typecheck, lint, test, build
- On push to main: builds multi-arch image (amd64/arm64), pushes to ghcr.io
- Version displayed in Settings modal (from git tag or commit SHA)

## Traffic Collector (Optional)

The collector provides DPI data for the Applications page by polling UniFi's v2 API.

### Why Needed

UnPoller's DPI endpoints return empty on modern UniFi OS controllers.

### Measurements Written

- `traffic_by_app` - Per-client, per-application traffic
- `traffic_total_by_app` - Aggregate by application
- `traffic_by_country` - Traffic by country

### Configuration (collector/.env)

```env
UNIFI_URL=https://192.168.8.1
UNIFI_USER=unpoller
UNIFI_PASS=your_password
UNIFI_SITE=default
INFLUX_URL=http://localhost:8086
INFLUX_DB=unpoller
COLLECTION_INTERVAL=300000  # 5 minutes
```

## Git History (maelos-software/ubipanel)

All commits authored by: `Rafi Khardalian <rafi@maelos.com>`

1. `d23f62b` - Initial release of UbiPanel

## Important Notes

1. **Recharts version pinned to 3.5.1** - Version 3.6.0 has breaking type changes for Tooltip formatters

2. **InfluxDB 1.x only** - Not compatible with InfluxDB 2.x/3.x (different query language)

3. **No built-in auth** - Use reverse proxy authentication (nginx basic auth, OAuth, Cloudflare Access, etc.)

4. **Internal network only** - Not designed for public internet exposure

5. **Pre-commit hooks** - Husky runs typecheck, lint, and tests before commits

## Related Repositories

- Original development repo: `rmk40/unifi-dashboard` (private, has full git history)
- This repo is a clean-slate release with single initial commit
