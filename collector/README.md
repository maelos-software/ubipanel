# UniFi Traffic Collector

A standalone Node.js service that polls UniFi controller v2 APIs for traffic/DPI data and writes to InfluxDB. Designed to run alongside UnPoller to supplement its data collection with application-level traffic analytics.

## Why This Exists

UnPoller's DPI endpoints (`stat/sitedpi`, `stat/stadpi`) return empty data on modern UniFi OS controllers. This collector uses Ubiquiti's newer v2 APIs which provide working traffic data:

- `/v2/api/site/{site}/traffic` - Traffic by application per client
- `/v2/api/site/{site}/country-traffic` - Traffic by country

## Features

- Polls UniFi controller for traffic data at configurable intervals
- Writes to InfluxDB using line protocol (compatible with UnPoller's database)
- **Fully resilient** - never stops running:
  - Waits indefinitely for services to become available at startup
  - Retries failed requests with exponential backoff
  - Continues collecting even when individual requests fail
  - Recovers automatically when services come back online

## Installation

### Docker (Recommended)

```bash
cd collector
cp .env.example .env
# Edit .env with your credentials

docker compose up -d
```

### Manual

```bash
cd collector
npm install
cp .env.example .env
# Edit .env with your credentials

node index.js
```

## Configuration

All configuration is via environment variables (see `.env.example`):

### Required

| Variable     | Description                                        |
| ------------ | -------------------------------------------------- |
| `UNIFI_URL`  | UniFi controller URL (e.g., `https://192.168.1.1`) |
| `UNIFI_USER` | UniFi username                                     |
| `UNIFI_PASS` | UniFi password                                     |
| `INFLUX_URL` | InfluxDB URL (e.g., `http://localhost:8086`)       |
| `INFLUX_DB`  | InfluxDB database name                             |

### Optional

| Variable              | Default   | Description                               |
| --------------------- | --------- | ----------------------------------------- |
| `UNIFI_SITE`          | `default` | UniFi site name                           |
| `INFLUX_USER`         | -         | InfluxDB username                         |
| `INFLUX_PASS`         | -         | InfluxDB password                         |
| `COLLECTION_INTERVAL` | `300000`  | Collection interval in ms (5 min)         |
| `LOG_LEVEL`           | `info`    | Log level: debug, info, warn, error       |
| `REQUEST_TIMEOUT`     | `30000`   | Request timeout in ms                     |
| `MAX_RETRIES`         | `3`       | Retries per request                       |
| `RETRY_DELAY`         | `5000`    | Base delay between retries in ms          |
| `STARTUP_RETRY_DELAY` | `30000`   | Delay between startup connection attempts |
| `UNIFI_VERIFY_SSL`    | `false`   | Set to `true` to verify SSL certificates  |

## InfluxDB Measurements

### traffic_by_app

Traffic data per client per application.

**Tags:**

- `client_mac` - Client MAC address
- `client_name` - Client hostname or name
- `is_wired` - Whether client is wired (true/false)
- `application` - Application ID (see DPI mappings)
- `category` - Category ID

**Fields:**

- `bytes_rx` - Bytes received
- `bytes_tx` - Bytes transmitted
- `bytes_total` - Total bytes
- `activity_seconds` - Activity duration in seconds

### traffic_by_country

Traffic data aggregated by country.

**Tags:**

- `country` - ISO country code (e.g., US, GB, DE)

**Fields:**

- `bytes_rx` - Bytes received
- `bytes_tx` - Bytes transmitted
- `bytes_total` - Total bytes

## Resilience

The collector is designed to run indefinitely without manual intervention:

| Scenario                        | Behavior                          |
| ------------------------------- | --------------------------------- |
| InfluxDB unreachable at startup | Retries forever every 30s         |
| UniFi unreachable at startup    | Retries forever every 30s         |
| Request fails during collection | Retries 3x, logs error, continues |
| Service recovers                | Automatically reconnects          |
| Uncaught exception              | Logs error, keeps running         |

## Update Frequency

The UniFi controller updates traffic statistics approximately every 20-25 seconds. The default 5-minute collection interval is conservative; you can reduce it to 1-2 minutes for finer granularity at the cost of more storage.

## Logs

```bash
# Docker
docker logs -f unifi-collector

# Manual
# Logs go to stdout
```

Example output:

```
[2025-12-12T20:14:50.045Z] [INFO] [collector] Starting collection cycle
[2025-12-12T20:14:50.081Z] [INFO] [influx] Successfully wrote 127 points to InfluxDB
[2025-12-12T20:14:50.096Z] [INFO] [collector] Collection completed: 150 points written
```

## License

MIT
