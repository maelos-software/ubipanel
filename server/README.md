# UbiPanel API Server

Express.js proxy server that provides secure access to InfluxDB for the UbiPanel frontend.

## Purpose

This server acts as a secure intermediary between the React frontend and InfluxDB:

1. **Credential Protection** - InfluxDB credentials are stored on the server, not exposed to the browser
2. **Query Validation** - All queries are validated before being forwarded to prevent injection attacks
3. **CORS Handling** - Enables the frontend to make cross-origin requests during development
4. **Static Serving** - In production, serves the built React application

## Environment Variables

Create a `.env` file based on `.env.example`:

| Variable       | Default                 | Description                                             |
| -------------- | ----------------------- | ------------------------------------------------------- |
| `INFLUX_URL`   | `http://localhost:8086` | InfluxDB server URL                                     |
| `INFLUX_DB`    | `unpoller`              | InfluxDB database name                                  |
| `INFLUX_USER`  | `unpoller`              | InfluxDB username                                       |
| `INFLUX_PASS`  | (empty)                 | InfluxDB password                                       |
| `PORT`         | `3001`                  | Server port                                             |
| `SITE_NAME`    | `UniFi Network`         | Display name shown in the UI                            |
| `SERVE_STATIC` | `false`                 | Set to `true` in production to serve the built frontend |

## API Endpoints

### GET /api/health

Health check endpoint for monitoring.

**Response:**

```json
{
  "status": "ok"
}
```

### GET /api/config

Returns non-sensitive site configuration for the frontend.

**Response:**

```json
{
  "siteName": "My Network"
}
```

### POST /api/query

Proxies InfluxQL queries to InfluxDB after validation.

**Request:**

- Content-Type: `application/x-www-form-urlencoded`
- Body: `q=<InfluxQL query>`

**Example:**

```bash
curl -X POST http://localhost:3001/api/query \
  -d "q=SELECT * FROM clients WHERE time > now() - 5m LIMIT 10"
```

**Success Response:**

```json
{
  "results": [
    {
      "statement_id": 0,
      "series": [
        {
          "name": "clients",
          "columns": ["time", "rx_bytes", "tx_bytes"],
          "values": [
            ["2024-01-15T10:00:00Z", 1024, 512],
            ["2024-01-15T10:01:00Z", 2048, 1024]
          ]
        }
      ]
    }
  ]
}
```

**Error Responses:**

- `400 Bad Request` - Missing query parameter

  ```json
  { "error": "Missing query parameter 'q'" }
  ```

- `403 Forbidden` - Query validation failed

  ```json
  { "error": "Query contains blocked keyword: DELETE" }
  ```

- `500 Internal Server Error` - InfluxDB connection error
  ```json
  { "error": "Failed to query InfluxDB" }
  ```

## Query Validation

The server validates all incoming queries to prevent malicious operations:

### Allowed Operations

- `SELECT` - Read data from measurements
- `SHOW` - Display metadata (measurements, tag keys, etc.)

### Blocked Keywords

- `DELETE`, `DROP`, `CREATE`, `ALTER`, `GRANT`, `REVOKE`
- `INSERT`, `UPDATE` (use UnPoller for data ingestion)
- `INTO` (prevents SELECT INTO attacks)

### Example Valid Queries

```sql
SELECT * FROM clients WHERE time > now() - 5m
SELECT LAST(rx_bytes) FROM clients GROUP BY mac
SHOW MEASUREMENTS
SHOW TAG KEYS FROM clients
```

### Example Blocked Queries

```sql
DELETE FROM clients              -- Blocked: DELETE
DROP MEASUREMENT clients         -- Blocked: DROP
SELECT * INTO backup FROM clients -- Blocked: INTO
```

## Running the Server

### Development

```bash
cd server
npm install
npm run dev
```

The server will start on `http://localhost:3001` with hot-reloading.

### Production

```bash
cd server
npm install --production
npm start
```

Or with Docker (from project root):

```bash
docker compose up -d
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              React Dashboard (Vite)                  │    │
│  │                                                       │    │
│  │  useQuery() ──────────────────────────────────────►  │    │
│  │                                                       │    │
│  │              POST /api/query                          │    │
│  │              { q: "SELECT..." }                       │    │
│  └───────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express Server                            │
│                                                              │
│  1. Parse query from request body                           │
│  2. Validate query (block dangerous keywords)               │
│  3. Add Basic Auth header with credentials                  │
│  4. Forward to InfluxDB                                     │
│  5. Return response to client                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       InfluxDB                               │
│                                                              │
│  Database: unpoller                                         │
│  Measurements: clients, uap, uap_vaps, usw, usg, etc.      │
└─────────────────────────────────────────────────────────────┘
```

## Security Considerations

1. **Never expose InfluxDB directly** - Always use this proxy server
2. **Use strong passwords** - Set a strong `INFLUX_PASS` in production
3. **Network isolation** - In production, InfluxDB should only be accessible from the server
4. **HTTPS** - Use a reverse proxy (nginx, Caddy) for SSL termination in production
5. **Rate limiting** - Consider adding rate limiting for public deployments
