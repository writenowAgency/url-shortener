# Architecture

```text
Public user
   |
   | HTTPS
   v
Cloudflare Edge (DNS, TLS, WAF, Access)
   |
   | outbound-only tunnel
   v
cloudflared container (EC2, no inbound 80/443)
   |
   v
Caddy reverse proxy (localhost:8080)
   |
   v
Node.js Express app (localhost docker network)
   |
   v
SQLite (better-sqlite3) on mounted ./data volume
```

## Why this shape

- One EC2 instance only, inside free-tier limits.
- No public web ports required on EC2 because tunnel is outbound.
- Caddy is a simple reverse proxy layer in front of the app.
- SQLite on mounted volume keeps persistence across restarts.
- Container memory limits keep the stack safe on 1 GB RAM instances.
