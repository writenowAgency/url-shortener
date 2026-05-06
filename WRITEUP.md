# WriteNow Assessment Write-up

## Stack choices (and why)

- **Node.js + Express**: fast to build, easy to read, low runtime overhead on a `t2.micro/t3.micro`, and strong ecosystem for middleware (auth, rate-limit, logging).
- **SQLite + better-sqlite3**: simplest persistent store for a single-instance service; no extra infrastructure cost and durable with a mounted Docker volume.
- **Vanilla HTML/CSS/JS dashboard**: minimal dependencies, fast load time, easy to audit, and enough for the required admin workflow.
- **Docker Compose**: reproducible deployment with pinned config in repo, one-command startup, and easy rollback/update behavior.
- **Caddy reverse proxy**: lightweight and simple config; clean separation between app and proxy, with logging and reverse proxying handled in one place.
- **Cloudflare Tunnel (`cloudflared`)**: exposes the service publicly without opening inbound 80/443 on EC2, reducing attack surface and avoiding paid load balancers.

## Idempotent slug approach

I implemented idempotency using a **lookup-then-insert pattern backed by DB uniqueness constraints**:

1. `long_url` has a unique index.
2. On `POST /api/shorten`, the app first checks if that URL already exists.
3. If found, it returns the existing slug (no duplicate rows).
4. If not found, it generates a random 6-char base62 slug and inserts.
5. If a race happens, DB constraints still preserve correctness:
   - `UNIQUE long_url` conflict -> re-read and return existing slug.
   - `UNIQUE slug` conflict -> generate and retry.

This ensures same long URL returns the same slug and prevents duplicates.

## Reliability and operational controls

- Health endpoint: `GET /healthz` returns `200 ok`.
- Restart safety: Docker containers use restart policies; optional systemd unit included for stack auto-recovery on reboot.
- Persistence: SQLite file stored on mounted `./data` volume survives container restarts/rebuilds.
- Logging:
  - HTTP requests via `morgan`.
  - Redirect events log `timestamp`, `slug`, and source IP (as required).
- Log rotation config included to avoid disk growth over time.

## Security posture

- Basic Auth on dashboard (`/`) and create endpoint (`POST /api/shorten`).
- Public visitors can still follow short links and view per-slug stats.
- URL validation allows only `http://` and `https://`.
- Anti-loop protection rejects URLs pointing to own short domain.
- App-side rate limit on shorten endpoint: **10 req/min/IP**.
  - This was chosen as a balance: enough for normal admin usage, low enough to dampen basic abuse.
- Cloudflare hardening documented:
  - Always Use HTTPS
  - SSL/TLS Full (strict)
  - Edge rate-limit on `POST /api/shorten`
  - Access policy for dashboard routes

## Free-tier and cost discipline

The design intentionally stays inside AWS free-tier/no-cost tooling:

- Single EC2 instance (`t2.micro`/`t3.micro`)
- No ELB, RDS, NAT Gateway, Elastic IP, or paid managed services
- Single local SQLite file instead of external database
- Cloudflare free-tier tunnel and DNS/proxy features

## What I would do with a budget of R500/month

- Add managed Postgres (for better concurrent write behavior and easier backup strategy).
- Add centralized logging/metrics and uptime alerting.
- Add CI/CD with automated smoke tests and security scanning.
- Add Cloudflare Access policies with finer-grained route/user controls and audit workflows.

## Hardest part

Balancing strict free-tier constraints with production-like security and reproducibility (especially no inbound web ports while still providing a public URL). I resolved this by structuring around Cloudflare Tunnel + closed security groups and documenting exact, repeatable deployment steps in `README.md`.

## Estimated time spent

Approximately **8-10 hours** total, including implementation, deployment artifacts, docs, and verification.
