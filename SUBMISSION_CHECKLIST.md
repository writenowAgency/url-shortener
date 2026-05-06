# WriteNow Final Submission Checklist

Use this checklist right before submitting. It maps directly to the assessment rubric.

## A) Application (Task 1)

- [x] `POST /api/shorten` accepts long URL and returns 6-char base62 slug.
- [x] `GET /:slug` 302-redirects and increments clicks.
- [x] `GET /api/stats/:slug` returns long URL, clicks, created timestamp.
- [x] Dashboard at `/` allows URL input and shows all links + click counts.
- [x] Basic Auth on `/` and `POST /api/shorten`.
- [x] `GET /healthz` returns `200` with body `ok`.
- [x] Persistence survives restart (`./data` mounted volume).
- [x] Rate limit set to 10 requests/min/IP on shorten endpoint.
- [x] URL validation only allows `http://` and `https://`.
- [x] Anti-loop blocks own domain shortening (`APP_DOMAIN` / request host).
- [x] Redirect logging includes timestamp, slug, and source IP.
- [x] Idempotency: same long URL returns existing slug.

## B) Deployment (Task 2)

- [x] Single EC2 `t2.micro`/`t3.micro`, root volume <= 30 GB gp3.
- [x] OS documented (Ubuntu 22.04 in `README.md`).
- [x] Docker + Compose via official Docker apt repo (not snap).
- [x] App runs in container with restart policy.
- [x] Reverse proxy in front of app (Caddy).
- [x] Boot persistence included (`url-shortener.service` and restart policies).
- [x] Log rotation included (`logrotate.conf`).
- [x] One-command deploy script included (`deploy.sh`).
- [x] Swap setup documented for 1 GB RAM safety.
- [x] Container memory limits configured in `docker-compose.yml`.

## C) Cloudflare Tunnel (Task 3)

- [x] Named tunnel support included (`cloudflared` + docs/config templates).
- [x] Tunnel routes hostname to local service.
- [x] Tunnel survives reboot (container restart policy and host systemd option).
- [x] Hardening guide included (`cloudflared-tunnel/hardening.md`).

Manual in Cloudflare dashboard (must complete yourself):

- [ ] Enable **Always Use HTTPS**.
- [ ] Set SSL/TLS mode to **Full (strict)**.
- [ ] Add WAF/Rate-limit rule for `POST /api/shorten`.
- [ ] Add Cloudflare Access policy for `/` and `/api/shorten`.
- [ ] Keep `/:slug` public (no Access challenge on redirect paths).
- [ ] Add cache rules: bypass `/api/*` and redirect routes; cache static assets.

## D) Required submission artifacts

- [ ] Live URL works: `https://<hostname>/healthz` returns `ok`.
- [ ] Dashboard route is protected (Auth + Cloudflare Access).
- [ ] Repo is pushed and accessible to reviewers.
- [ ] `README.md` provides full rebuild instructions from scratch.
- [x] `ARCHITECTURE.md` included.
- [x] `WRITEUP.md` included (1-page style).
- [ ] Add final evidence section to write-up:
  - [ ] `nmap -Pn <ec2-public-ip>` output (80/443 closed/filtered)
  - [ ] `curl https://<hostname>/healthz` output
  - [ ] Optional screenshot of Cloudflare Access login page
  - [ ] AWS billing screenshot showing $0.00 / R0.00

## E) Final 10-minute pre-submit run

1. Restart stack: `docker compose up -d --build`
2. Test end-to-end:
   - Create short URL from dashboard
   - Open short URL
   - Confirm clicks increase in dashboard or `/api/stats/:slug`
3. Reboot EC2 once: `sudo reboot`
4. Re-test URL after reboot
5. Capture proof artifacts and submit
