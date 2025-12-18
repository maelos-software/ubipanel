# Contributing to UbiPanel

Thank you for your interest in contributing! This guide covers setting up a development environment and the tools available for development and testing.

## Development Setup

### Prerequisites

- Node.js 18+
- npm
- Access to an InfluxDB 1.x instance with UnPoller data

### Initial Setup

```bash
git clone https://github.com/maelos-software/ubipanel.git
cd ubipanel
npm install
```

This installs dependencies for both the frontend and server.

### Configure InfluxDB Connection

```bash
cp server/.env.example server/.env
```

Edit `server/.env` with your InfluxDB connection details:

```env
INFLUX_URL=http://your-influxdb-host:8086
INFLUX_DB=unpoller
INFLUX_USER=unpoller
INFLUX_PASS=your_password_here
SITE_NAME=My Network
```

### Start Development Environment

```bash
npm run dev:start
```

This starts both the proxy server and Vite dev server in the background. Open http://localhost:4820 in your browser.

### Stop Development Environment

```bash
npm run dev:stop
```

### Check Server Status

```bash
npm run dev:status
```

## Development Commands

| Command              | Description                                   |
| -------------------- | --------------------------------------------- |
| `npm run dev:start`  | Start proxy + Vite servers in background      |
| `npm run dev:stop`   | Stop all dev servers                          |
| `npm run dev:status` | Check if servers are running                  |
| `npm run dev`        | Start only Vite (if running proxy separately) |
| `npm test`           | Run unit tests                                |
| `npm run test:watch` | Run tests in watch mode                       |
| `npm run typecheck`  | TypeScript type checking                      |
| `npm run lint`       | ESLint                                        |
| `npm run format`     | Format code with Prettier                     |
| `npm run validate`   | Run all checks (typecheck + lint + test)      |
| `npm run build`      | Production build                              |

## Development Ports

Default ports (configurable in `.env.development`):

| Port | Service                    |
| ---- | -------------------------- |
| 4820 | Vite dev server (frontend) |
| 4821 | Proxy server (API)         |

To customize, create `.env.development`:

```env
DEV_VITE_PORT=4820
DEV_PROXY_PORT=4821
```

## Development Scripts

The `scripts/` directory contains utilities for development and testing.

### Dev Server Manager (`scripts/dev.js`)

Manages the development environment with background processes.

```bash
# Start servers (runs in background, you get your terminal back)
npm run dev:start

# Check status
npm run dev:status

# Stop servers
npm run dev:stop
```

The script:

- Validates `server/.env` exists before starting
- Starts proxy server first, waits for health check
- Starts Vite dev server, waits for ready
- Saves PIDs to `.dev-pids.json` for later cleanup
- Logs to `.dev-proxy.log` and `.dev-vite.log`

### Screenshot Utility (`scripts/screenshot.mjs`)

Takes screenshots of dashboard pages using Playwright. Useful for visual testing and documentation.

```bash
# Screenshot all pages
node scripts/screenshot.mjs

# Screenshot specific pages
node scripts/screenshot.mjs dashboard gateway clients

# Full-page screenshots in dark mode
node scripts/screenshot.mjs --full --dark

# Screenshot production server
node scripts/screenshot.mjs --url http://192.168.8.21/dashboard
```

**Options:**

| Option           | Description           | Default                 |
| ---------------- | --------------------- | ----------------------- |
| `--url <url>`    | Base URL              | `http://localhost:4820` |
| `--output <dir>` | Output directory      | `./tmp`                 |
| `--full`         | Full-page screenshots | viewport only           |
| `--wait <ms>`    | Wait time after load  | 3000                    |
| `--dark`         | Force dark mode       | system default          |
| `--light`        | Force light mode      | system default          |

**Available pages:** `dashboard`, `clients`, `insights`, `aps`, `switches`, `gateway`, `events`, `reports`, `applications`, `all`

Screenshots are saved to `./tmp/` by default (gitignored).

### Site Audit (`scripts/audit-site.mjs`)

Comprehensive audit that captures screenshots and extracts metrics from every page. Useful for regression testing and data validation.

```bash
# Audit local dev server
node scripts/audit-site.mjs

# Audit production
node scripts/audit-site.mjs --url http://192.168.8.21/dashboard --api http://192.168.8.21:4880
```

**Options:**

| Option           | Description      | Default                 |
| ---------------- | ---------------- | ----------------------- |
| `--url <url>`    | Dashboard URL    | `http://localhost:4820` |
| `--api <url>`    | API URL          | `http://localhost:4821` |
| `--output <dir>` | Output directory | `./audit-results`       |

The audit:

- Queries InfluxDB directly for raw data
- Captures screenshots of all pages including detail pages
- Extracts visible metrics and table data
- Detects console errors
- Generates `audit-results.json` with findings

## Project Structure

```
├── src/
│   ├── components/
│   │   ├── charts/       # Reusable chart components
│   │   ├── common/       # Shared UI components (Badge, DataTable, SwitchCard, etc.)
│   │   └── layout/       # Layout components (Sidebar, PageHeader)
│   ├── hooks/            # Data fetching hooks
│   │   ├── history/      # Historical data hooks
│   │   └── utils/        # Defensive parsing logic
│   ├── lib/              # Utilities, API client, formatters
│   │   └── queries/      # Centralized InfluxQL builders
│   ├── pages/            # Page components
│   │   └── reports/      # Report page components
│   └── types/            # TypeScript types
├── server/
│   ├── index.js          # Proxy server
│   ├── lib/              # Server utilities (query validation)
│   └── .env.example      # Environment template
├── collector/            # Optional DPI traffic collector
│   ├── index.js          # Collector entry point
│   ├── lib/              # UniFi client, InfluxDB writer
│   └── docker-compose.yml
├── tests/
│   ├── components/       # Component tests
│   ├── hooks/            # Hook tests
│   └── unit/             # Unit tests
├── scripts/              # Development scripts
└── context/              # Project context docs
```

## Code Style

### TypeScript

- Strict mode enabled
- Explicit return types for exported functions
- Use `interface` for object shapes, `type` for unions/aliases

### Hooks & Data

- New history hooks should use the `useTimeSeries` engine (`src/hooks/useTimeSeries.ts`)
- Raw queries belong in `src/lib/queries/`
- Parsing logic should use `createValueGetter` from `src/lib/influx.ts` for type safety and O(1) performance

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Run specific test file
npm test -- tests/unit/format.test.ts

# Run with coverage
npm test -- --coverage
```

### Test Structure

- Unit tests in `tests/unit/` for pure functions
- Component tests in `tests/components/` for React components
- Hook tests in `tests/hooks/` for custom hooks

### Writing Tests

```typescript
import { describe, it, expect } from "vitest";
import { formatBytes } from "@/lib/format";

describe("formatBytes", () => {
  it("formats bytes correctly", () => {
    expect(formatBytes(1024)).toBe("1 KB");
  });
});
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run validation (`npm run validate`)
5. Commit your changes with a descriptive message
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Before Submitting

- [ ] All tests pass (`npm test`)
- [ ] TypeScript checks pass (`npm run typecheck`)
- [ ] Linting passes (`npm run lint`)
- [ ] Code is formatted (`npm run format`)

Pre-commit hooks automatically run linting and formatting on staged files.

## Architecture Notes

### Data Flow

```
Browser (React SPA)
    ↓ fetch
Proxy Server (Express)
    ↓ validated query
InfluxDB 1.x
```

The proxy server:

- Validates all queries (SELECT only, no mutations)
- Keeps InfluxDB credentials secure
- Serves the built frontend in production

### Key Conventions

**TX/RX vs Download/Upload:**

- WAN/Client context: Download/Upload (user perspective)
- Switch ports: TX/RX (device perspective)

**Signal Fields (UnPoller quirk):**

- UnPoller `signal` = RSSI in dBm (e.g., -65)
- UnPoller `rssi` = Signal quality percentage (0-100)

### Environment Variables

**Server (`server/.env`):**
| Variable | Description |
|----------|-------------|
| `INFLUX_URL` | InfluxDB server URL |
| `INFLUX_DB` | Database name |
| `INFLUX_USER` | InfluxDB username |
| `INFLUX_PASS` | InfluxDB password |
| `PORT` | Proxy server port |
| `SITE_NAME` | Name shown in sidebar |

**Frontend (build-time):**
| Variable | Description |
|----------|-------------|
| `VITE_BASE_PATH` | Base path for deployment |
| `VITE_API_URL` | API URL (dev only) |

## Getting Help

- Check existing issues for similar problems
- Open a new issue with reproduction steps
- For security issues, see [SECURITY.md](SECURITY.md)
