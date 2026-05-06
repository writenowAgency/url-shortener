# URL Shortener (WriteNow Assessment)

Full-stack URL shortener with:

- Node.js + Express API
- SQLite (`better-sqlite3`) persistence
- Minimal HTML dashboard
- Basic auth protection for `/` and `POST /api/shorten`
- Rate limiting (10 requests/min/IP) on shorten endpoint
- Docker Compose deployment on EC2
- Caddy reverse proxy
- Cloudflare Tunnel public exposure without opening 80/443

## 1) Functional coverage

Implemented endpoints:

- `POST /api/shorten` (auth required)
- `GET /:slug` (302 redirect + click increment)
- `GET /api/stats/:slug` (click count + long URL + created timestamp)
- `GET /` dashboard (auth required)
- `GET /api/links` dashboard data list (auth required)
- `GET /healthz` returns `200 ok`

### Non-functional coverage

- Persistent storage on mounted `./data` volume.
- URL validation allows only `http://` and `https://`.
- Anti-loop rejects shortening links that point back to own domain (`APP_DOMAIN` or request host).
- Redirect logging to stdout with timestamp, slug, and source IP.
- `POST /api/shorten` rate-limited to 10/min/IP.

## 2) Idempotent slug strategy

Behavior: same admin submits same long URL twice -> existing slug is returned.

Implementation details:

1. `long_url` column has a unique index.
2. On shorten request:
   - first check `SELECT slug FROM links WHERE long_url = ?`
   - if found, return it
   - else generate a random 6-char base62 slug and insert
3. If insert fails with `UNIQUE long_url`, fetch and return existing slug.
4. If insert fails with `UNIQUE slug`, generate a new slug and retry.

Race-condition note:

- In a single Node process with synchronous `better-sqlite3`, request handling is serialized enough to avoid most races.
- The unique DB constraints still protect correctness under edge interleavings and keep endpoint idempotent.

## 3) Local run

```bash
cp .env.example .env
npm install
npm start
```

Open `http://localhost:3000/` and log in with `.env` credentials.

## 4) EC2 (Amazon Linux 2023) setup

Chosen OS: **Amazon Linux 2023** — it is the AWS-maintained default, ships with SELinux and modern `dnf`, and Docker is available directly from the Amazon Linux extras/dnf repo without adding a third-party apt source. The one-command bootstrap script (`scripts/ec2-full-bootstrap.sh`) targets Amazon Linux 2023. Ubuntu 22.04 LTS instructions are included in §4.2 for reference if you prefer it.

### 4.1 Launch instance

- Type: `t2.micro` or `t3.micro`
- Root disk: `gp3`, <= 30 GB
- Security group inbound:
  - SSH 22 from your own IP only
  - No inbound 80/443

### 4.2 Install Docker + Compose (official method, not snap)

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Re-login SSH session after adding docker group.

### 4.2b Amazon Linux 2023 (login user `ec2-user`)

`dnf` often has **no** `docker-compose-plugin`, so `docker compose` fails. Install the standalone binary, then use **`docker-compose`** (hyphen):

```bash
sudo dnf install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
sudo curl -SL "https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
docker-compose version
```

Log out and SSH back in, then deploy with:

```bash
cd /opt/url-shortener
docker-compose up -d --build
```

**Important:** `/opt/url-shortener` must contain `docker-compose.yml` (full repo). If `ls docker-compose.yml` fails, `git push` from your laptop first, then `git pull` on EC2.

### 4.2c One-command EC2 bootstrap (Amazon Linux, `ec2-user`)

After SSH, run **once** (requires a **public** GitHub repo — no `git` password prompt):

```bash
curl -fsSL https://raw.githubusercontent.com/MampotjeMabusela/url-shortener/main/scripts/ec2-full-bootstrap.sh | bash
```

Then set a strong `ADMIN_PASS` in `/opt/url-shortener/.env`, and optionally `sudo reboot` and re-test `curl http://127.0.0.1:8080/healthz`.

### 4.3 Clone and configure app

```bash
sudo mkdir -p /opt
sudo chown $USER:$USER /opt
git clone <your-repo-url> /opt/url-shortener
cd /opt/url-shortener
cp .env.example .env
```

Set:

- `ADMIN_USER`
- `ADMIN_PASS`
- `APP_DOMAIN` (your public hostname)
- `CLOUDFLARE_TUNNEL_TOKEN` (if using compose-based cloudflared)

### 4.4 Configure swap for 1 GB RAM safety

```bash
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 4.5 Deploy stack

```bash
cd /opt/url-shortener
chmod +x deploy.sh
./deploy.sh
```

### 4.6 Enable boot persistence with systemd

```bash
sudo cp url-shortener.service /etc/systemd/system/url-shortener.service
sudo systemctl daemon-reload
sudo systemctl enable --now url-shortener
```

### 4.7 Log rotation

```bash
sudo cp logrotate.conf /etc/logrotate.d/url-shortener
```

## 5) Cloudflare Tunnel setup (named tunnel)

You can run cloudflared as Docker service (already in compose) or as host systemd service.

### Option A: Docker-based cloudflared (this repo default)

`cloudflared` is behind a Compose **profile** so Task 2 works without a tunnel token. Default `docker compose up` starts **app + Caddy only**.

When you have a tunnel token (Task 3):

```bash
docker compose --profile cloudflare up -d --build
```

1. In Cloudflare Zero Trust dashboard, create named tunnel and copy token.
2. Set `CLOUDFLARE_TUNNEL_TOKEN` in `.env`.
3. Ensure tunnel public hostname points to `http://localhost:8080` on the EC2 host (Caddy listens on `127.0.0.1:8080:80` in compose).

### Option B: Host cloudflared service

Use files under `cloudflared-tunnel/`:

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin cloudflared
sudo mkdir -p /etc/cloudflared
# place config + credentials in /etc/cloudflared
sudo cp cloudflared-tunnel/systemd.service /etc/systemd/system/cloudflared.service
sudo systemctl daemon-reload
sudo systemctl enable --now cloudflared
```

## 6) Cloudflare hardening

Follow `cloudflared-tunnel/hardening.md`.

Must-have controls:

- Always Use HTTPS: ON
- SSL mode: Full (strict)
- WAF rate-limit on `POST /api/shorten`
- Cloudflare Access for `/` and `/api/shorten`
- Keep `/:slug` public

## 7) Verification checklist

```bash
curl -i https://<your-hostname>/healthz
curl -u ADMIN:PASS -X POST https://<your-hostname>/api/shorten -H "content-type: application/json" -d '{"url":"https://example.com"}'
curl -i https://<your-hostname>/<slug>
curl https://<your-hostname>/api/stats/<slug>
nmap -Pn <ec2-public-ip>
```

Expected:

- hostname `/healthz` works
- short link redirects and increments clicks
- `nmap` on EC2 public IP shows 80/443 closed or filtered

## 8) Suggested tiny load test

```bash
hey -z 60s -c 20 https://<your-hostname>/healthz
```

Record results in your submission write-up. This stack keeps RAM bounded with container limits and 1G swap.

## 9) Submission helpers

- `SUBMISSION_CHECKLIST.md` - final task-by-task checklist before sending.
- `WRITEUP.md` - one-page submission write-up.
- `scripts/smoke-test.ps1` - quick verification script.

Run smoke test locally:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\smoke-test.ps1
```
