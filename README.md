# UbiPanel

A modern, real-time network monitoring dashboard for UniFi networks. Built as a lightweight alternative to Grafana dashboards, providing a clean and intuitive interface for monitoring your UniFi infrastructure.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

## Features

### Network Overview

- Real-time network health monitoring
- Client count and bandwidth statistics
- Top clients by bandwidth usage with visual indicators
- Client distribution charts by access point, network, and VLAN
- Multi-WAN throughput visualization with failover indicators

### Client Management

- Complete client listing with search and filtering (wired/wireless/guest)
- **Problem Client Isolation** - Dedicated filter for low-satisfaction or weak-signal devices
- VLAN-based filtering via URL parameters
- Detailed client view with:
  - Connection history and bandwidth charts
  - Signal strength and experience metrics (wireless)
  - Traffic statistics and roaming history
  - Associated device information

### Client Insights

- Network-wide wireless analytics
- Signal strength distribution
- Channel utilization analysis
- Client experience scoring
- **Signal vs. Satisfaction Correlation** - Visualize how RF health impacts user experience
- Roaming pattern analysis

### Access Points

- AP status and health monitoring
- Per-radio statistics (2.4GHz/5GHz/6GHz)
- Client distribution and channel utilization
- Detailed AP view with:
  - Connected clients list
  - Bandwidth history charts
  - Radio configuration details

### Switches

- Switch status and PoE power monitoring
- Visual port status indicators with traffic levels (TX/RX)
- Top ports by bandwidth
- Ports with errors highlighting
- Detailed port view with:
  - TX/RX bandwidth and packet rate history
  - PoE power consumption charts
  - SFP module diagnostics
  - Connected client information

### Gateway

- USG/UDM system metrics (CPU, memory, temperature)
- Multi-WAN status with failover detection
- Network/VLAN listing with client counts
- Recent WAN transition events
- Detailed WAN interface statistics

### Events

- Real-time event log with filtering
- Category filters: All, Wireless, LAN, WAN
- Color-coded event types
- Configurable time ranges

### Reports

Pre-built analytical reports:

- **Bandwidth Report** - Top bandwidth consumers over time
- **Experience Report** - Clients with poor wireless experience
- **Roaming Report** - Client roaming patterns and frequency
- **AP Load Report** - Access point utilization and client distribution
- **WAN Health Report** - WAN uptime and failover events
- **Port Health Report** - Switch ports with errors or issues
- **Infrastructure Report** - Device health overview
- **Guest Report** - Guest network analytics
- **Radio Report** - Radio utilization and channel analysis

### Application Traffic (Optional)

When the optional traffic collector is running:

- DPI (Deep Packet Inspection) traffic analysis
- Traffic breakdown by application (Netflix, YouTube, etc.)
- Traffic by country/region
- Per-client application usage

> **Note:** The Applications page shows an "Optional" badge in the sidebar when the traffic collector is not running. See [Traffic Collector](#traffic-collector-optional) for setup instructions.

## Prerequisites

### UnPoller (Required)

This dashboard requires [UnPoller](https://unpoller.com/) to collect metrics from your UniFi controller and store them in InfluxDB.

1. Install UnPoller following the [official documentation](https://unpoller.com/docs/install)
2. Configure UnPoller to connect to your UniFi controller
3. Configure UnPoller to write to InfluxDB 1.x

### InfluxDB 1.x (Required)

UnPoller writes metrics to InfluxDB. This dashboard is designed for **InfluxDB 1.x** (not 2.x).

- Database name: `unpoller` (default)
- Retention policy: Recommended 30+ days for historical charts

### Node.js

- Node.js 18+ required
- npm package manager

## Architecture

```
                                    ┌─────────────────────┐
                                    │   UniFi Controller  │
                                    └──────────┬──────────┘
                                               │
                         ┌─────────────────────┼─────────────────────┐
                         │                     │                     │
                         ▼                     ▼                     │
                  ┌─────────────┐       ┌─────────────┐              │
                  │  UnPoller   │       │  Collector  │ (optional)   │
                  │  (metrics)  │       │    (DPI)    │              │
                  └──────┬──────┘       └──────┬──────┘              │
                         │                     │                     │
                         └──────────┬──────────┘                     │
                                    ▼                                │
                            ┌─────────────┐                          │
                            │  InfluxDB   │                          │
                            │    1.x      │                          │
                            └──────┬──────┘                          │
                                   │                                 │
                                   ▼                                 │
    Browser ◄──────────►  Proxy Server (Node.js)                     │
   (React SPA)             - Serves frontend                         │
                           - Proxies InfluxDB queries                │
                           - Keeps credentials secure                │
```

The proxy server keeps InfluxDB credentials secure on the server side. The browser never sees the database credentials.

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/maelos-software/ubipanel.git
cd ubipanel
npm install
```

This automatically installs both frontend and server dependencies.

### 2. Configure InfluxDB Connection

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

### 3. Start the Dashboard

For development, see [CONTRIBUTING.md](CONTRIBUTING.md).

For production, see [Production Deployment](#production-deployment).

## Configuration

### Server Configuration (`server/.env`)

| Variable       | Description                 | Default                 |
| -------------- | --------------------------- | ----------------------- |
| `INFLUX_URL`   | InfluxDB server URL         | `http://localhost:8086` |
| `INFLUX_DB`    | Database name               | `unpoller`              |
| `INFLUX_USER`  | InfluxDB username           | `unpoller`              |
| `INFLUX_PASS`  | InfluxDB password           | **(required)**          |
| `PORT`         | Proxy server port           | `3001`                  |
| `SITE_NAME`    | Name shown in sidebar       | `UniFi Network`         |
| `SERVE_STATIC` | Serve frontend from `/dist` | `false`                 |

### Frontend Configuration

| Variable         | Description              | Default                 |
| ---------------- | ------------------------ | ----------------------- |
| `VITE_BASE_PATH` | Base path for deployment | `/`                     |
| `VITE_API_URL`   | API proxy URL (dev only) | `http://localhost:4821` |

## Production Deployment

### Option 1: Docker (Recommended)

The easiest way to deploy is using Docker:

```bash
# Create .env file with your configuration
cat > .env << EOF
INFLUX_URL=http://your-influxdb:8086
INFLUX_DB=unpoller
INFLUX_USER=unpoller
INFLUX_PASS=your_password
SITE_NAME=My Network
EOF

# Build and run
docker compose up -d
```

The dashboard will be available at http://localhost:4880

#### Docker Environment Variables

| Variable         | Description            | Default                            |
| ---------------- | ---------------------- | ---------------------------------- |
| `INFLUX_URL`     | InfluxDB URL           | `http://host.docker.internal:8086` |
| `INFLUX_DB`      | Database name          | `unpoller`                         |
| `INFLUX_USER`    | InfluxDB username      | `unpoller`                         |
| `INFLUX_PASS`    | InfluxDB password      | **(required)**                     |
| `SITE_NAME`      | Site name in sidebar   | `UniFi Network`                    |
| `VITE_BASE_PATH` | Base path (build-time) | `/`                                |

### Option 2: Manual Build + nginx

#### Build the frontend

```bash
npm run build
```

The built files will be in the `dist/` directory.

#### Start the proxy server

```bash
cd server
npm start
```

Or use PM2 for process management:

```bash
npm install -g pm2
cd server && pm2 start index.js --name unifi-proxy
```

#### Configure nginx

```nginx
server {
    listen 80;
    server_name dashboard.example.com;

    root /var/www/ubipanel;
    index index.html;

    # API proxy to Node.js server
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Option 3: Sub-path Deployment

To deploy at a sub-path (e.g., `/dashboard/`):

```bash
# Build with base path
VITE_BASE_PATH=/dashboard/ npm run build

# Or with Docker
docker compose build --build-arg VITE_BASE_PATH=/dashboard/
```

nginx configuration:

```nginx
location /dashboard/ {
    alias /var/www/ubipanel/;
    try_files $uri $uri/ /dashboard/index.html;
}

location /dashboard/api/ {
    proxy_pass http://127.0.0.1:3001/api/;
}
```

## Traffic Collector (Optional)

The traffic collector is an optional service that provides DPI (Deep Packet Inspection) data for the Applications page. It polls the UniFi controller's v2 API for traffic data that UnPoller doesn't collect.

### Why It's Needed

UnPoller's DPI endpoints (`stat/sitedpi`, `stat/stadpi`) return empty data on modern UniFi OS controllers. This collector uses Ubiquiti's newer v2 APIs which provide working traffic data:

- Traffic by application per client
- Traffic by country/region

### Installation

```bash
cd collector
cp .env.example .env
# Edit .env with your credentials

# Docker (recommended)
docker compose up -d

# Or manual
npm install
node index.js
```

### Configuration (`collector/.env`)

| Variable              | Description              | Default                 |
| --------------------- | ------------------------ | ----------------------- |
| `UNIFI_URL`           | UniFi controller URL     | `https://192.168.8.1`   |
| `UNIFI_USER`          | UniFi username           | `unpoller`              |
| `UNIFI_PASS`          | UniFi password           | **(required)**          |
| `UNIFI_SITE`          | UniFi site name          | `default`               |
| `INFLUX_URL`          | InfluxDB URL             | `http://localhost:8086` |
| `INFLUX_DB`           | Database name            | `unpoller`              |
| `INFLUX_USER`         | InfluxDB username        | -                       |
| `INFLUX_PASS`         | InfluxDB password        | -                       |
| `COLLECTION_INTERVAL` | Collection interval (ms) | `300000` (5 min)        |
| `LOG_LEVEL`           | Log level                | `info`                  |
| `REQUEST_TIMEOUT`     | Request timeout (ms)     | `30000`                 |
| `MAX_RETRIES`         | Retries per request      | `3`                     |
| `UNIFI_VERIFY_SSL`    | Verify SSL certificates  | `false`                 |

### Data Written

The collector writes to these InfluxDB measurements:

- **`traffic_by_app`** - Per-client, per-application traffic
- **`traffic_total_by_app`** - Aggregate traffic by application
- **`traffic_by_country`** - Traffic by country

See `collector/README.md` for detailed schema information.

## Data Refresh

- Dashboard data refreshes every **30 seconds** by default
- This is configured in `src/lib/config.ts` (`REFETCH_INTERVAL`)
- The traffic collector runs every **5 minutes** by default

## Important Notes

### TX/RX vs Download/Upload Terminology

The dashboard uses different terminology depending on context:

| Context        | Labels          | Meaning                                    |
| -------------- | --------------- | ------------------------------------------ |
| WAN interfaces | Download/Upload | User perspective (download = receiving)    |
| Client traffic | Download/Upload | User perspective                           |
| Switch ports   | TX/RX           | Device perspective (TX = transmitting out) |
| Port details   | TX/RX           | Device perspective                         |

This distinction matters because from a switch port's perspective, TX (transmit) means data going out of the port, which is the opposite of a user's "download."

### Signal Strength Fields

UnPoller uses non-standard field names for signal data:

- UnPoller `signal` = RSSI in dBm (e.g., -65)
- UnPoller `rssi` = Signal quality percentage (0-100)

The dashboard normalizes these internally.

### InfluxDB Version

This dashboard requires **InfluxDB 1.x**. It is not compatible with InfluxDB 2.x or InfluxDB 3.x due to query language differences (InfluxQL vs Flux).

### Query Security

The proxy server validates all InfluxDB queries before execution:

- Only SELECT queries are allowed
- DROP, DELETE, ALTER, CREATE, etc. are blocked
- Queries are limited to read-only operations

## Security Considerations

This dashboard is designed for **internal network use only**. Please review these security guidelines before deployment.

### Network Exposure

- **Do NOT expose this dashboard directly to the public internet**
- Deploy behind a reverse proxy with authentication (see below)
- Use a VPN for remote access to your internal network

### Authentication

The dashboard does not include built-in authentication. For production deployments, add authentication via your reverse proxy:

**nginx with Basic Auth:**

```nginx
location / {
    auth_basic "UbiPanel";
    auth_basic_user_file /etc/nginx/.htpasswd;
    # ... rest of config
}
```

**Traefik with OAuth/OIDC:**

```yaml
# Use traefik-forward-auth or authelia
labels:
  - "traefik.http.routers.dashboard.middlewares=authelia@docker"
```

**Cloudflare Access / Tailscale:**

- Use Cloudflare Access for zero-trust authentication
- Or access via Tailscale/WireGuard VPN only

### Query Security

The proxy server implements defense-in-depth for InfluxDB queries:

1. **Query Validation** - Only SELECT and SHOW queries are allowed
2. **Keyword Blocking** - DROP, DELETE, ALTER, CREATE, INSERT, etc. are blocked
3. **Input Escaping** - User inputs are escaped to prevent injection
4. **Cross-DB Prevention** - Queries cannot access other databases

### Credentials

- InfluxDB credentials are stored in environment variables (server-side only)
- Credentials are never exposed to the browser
- Use Docker secrets or Kubernetes secrets for production

### TLS/HTTPS

- Always use HTTPS in production (configure in reverse proxy)
- The optional traffic collector disables TLS verification by default for self-signed UniFi certificates
- Set `UNIFI_VERIFY_SSL=true` if using trusted certificates

### Reporting Security Issues

See [SECURITY.md](SECURITY.md) for our security policy and how to report vulnerabilities.

## Browser Support

Modern browsers with ES2020+ support:

- Chrome/Edge 88+
- Firefox 78+
- Safari 14+

## Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite 7** - Build tool and dev server
- **TanStack Query** - Data fetching and caching
- **Recharts** - Charts and visualizations
- **Tailwind CSS 4** - Styling
- **Lucide React** - Icons
- **React Router 7** - Navigation
- **date-fns** - Date formatting
- **Express** - Proxy server
- **Vitest** - Unit testing
- **Playwright** - E2E testing

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, available scripts, and guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [UnPoller](https://unpoller.com/) - UniFi metrics collection
- [UniFi](https://ui.com/) - Ubiquiti network equipment
- [InfluxDB](https://www.influxdata.com/) - Time series database

## Related Projects

- [UnPoller](https://github.com/unpoller/unpoller) - Collect UniFi metrics
- [Grafana UniFi Dashboards](https://grafana.com/grafana/dashboards/?search=unifi) - Alternative Grafana dashboards
