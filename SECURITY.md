# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

1. **Do NOT open a public GitHub issue** for security vulnerabilities
2. Email the maintainer directly or use GitHub's private vulnerability reporting feature
3. Include as much detail as possible:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: We will acknowledge receipt within 48 hours
- **Assessment**: We will assess the vulnerability and determine severity within 1 week
- **Fix Timeline**: Critical issues will be addressed within 1-2 weeks; others within 30 days
- **Disclosure**: We will coordinate disclosure timing with you

### Scope

The following are in scope for security reports:

- SQL/InfluxQL injection vulnerabilities
- Authentication/authorization bypass
- Cross-site scripting (XSS)
- Cross-site request forgery (CSRF)
- Sensitive data exposure
- Server-side request forgery (SSRF)
- Remote code execution

The following are out of scope:

- Denial of service (DoS) attacks (this is a private network tool)
- Issues requiring physical access
- Social engineering attacks
- Issues in dependencies (report to upstream)

## Security Best Practices for Deployment

### Network Security

1. **Never expose directly to the internet** - This dashboard is designed for internal networks
2. **Use a reverse proxy** with authentication (nginx, Traefik, Caddy)
3. **Enable HTTPS** via your reverse proxy
4. **Use a VPN** for remote access (Tailscale, WireGuard, OpenVPN)

### Authentication Options

Since the dashboard doesn't include built-in authentication, use one of these approaches:

- **Basic Auth** via nginx/Apache
- **OAuth/OIDC** via Authelia, Authentik, or Keycloak
- **Zero Trust** via Cloudflare Access or Tailscale
- **Network-level** via VPN-only access

### Credentials Management

- Store credentials in environment variables, not config files
- Use Docker secrets or Kubernetes secrets in production
- Rotate credentials periodically
- Use dedicated read-only InfluxDB users

### Example Secure Deployment

```yaml
# docker-compose.yml with Traefik and Authelia
services:
  dashboard:
    image: ubipanel
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.dashboard.rule=Host(`dashboard.internal`)"
      - "traefik.http.routers.dashboard.middlewares=authelia@docker"
      - "traefik.http.routers.dashboard.tls=true"
    environment:
      - INFLUX_URL=http://influxdb:8086
      - INFLUX_PASS_FILE=/run/secrets/influx_pass
    secrets:
      - influx_pass

secrets:
  influx_pass:
    external: true
```

## Security Features

### Query Validation

All InfluxDB queries are validated before execution:

```javascript
// Blocked keywords
["DROP", "DELETE", "CREATE", "ALTER", "GRANT", "REVOKE", "INSERT", "INTO", "KILL"][
  // Only allowed
  ("SELECT", "SHOW")
];
```

### Input Escaping

User inputs in queries are escaped to prevent injection:

```typescript
// Safe: escapes single quotes
escapeInfluxString("O'Brien"); // => "O''Brien"
```

### Defense in Depth

1. Client-side input escaping
2. Server-side query validation
3. InfluxDB user with minimal permissions

## Changelog

### Security Fixes

- **2024-12-15**: Added escapeInfluxString() to route parameter inputs in PortDetail, WANDetail, SwitchDetail pages
