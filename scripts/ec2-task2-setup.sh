#!/usr/bin/env bash
# Run ON EC2 after SSH (or pipe: Get-Content scripts/ec2-task2-setup.sh | ssh ... bash -s)
set -eu

APP_DIR="${APP_DIR:-/opt/url-shortener}"
cd "$APP_DIR"

echo "==> Repo"
git remote -v || true
# Public repo (no auth). Override with: export GIT_ORIGIN_URL='https://github.com/you/repo.git'
GIT_ORIGIN_URL="${GIT_ORIGIN_URL:-https://github.com/MampotjeMabusela/url-shortener.git}"
git remote set-url origin "$GIT_ORIGIN_URL" 2>/dev/null || git remote add origin "$GIT_ORIGIN_URL"
git pull

echo "==> Compose binary"
COMPOSE=(docker-compose)
if ! command -v docker-compose >/dev/null 2>&1; then
  echo "Installing docker-compose to /usr/local/bin ..."
  sudo curl -SL "https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-$(uname -m)" -o /usr/local/bin/docker-compose
  sudo chmod +x /usr/local/bin/docker-compose
  COMPOSE=(/usr/local/bin/docker-compose)
fi
"${COMPOSE[@]}" version

if [[ ! -f .env ]]; then
  echo "==> Creating .env from template (edit ADMIN_PASS after this script)"
  cp .env.example .env
fi

mkdir -p data logs/caddy

echo "==> Build and start"
"${COMPOSE[@]}" up -d --build
"${COMPOSE[@]}" ps

echo "==> Health checks"
curl -i --max-time 5 http://127.0.0.1:3000/healthz || true
curl -i --max-time 5 http://127.0.0.1:8080/healthz || true

echo "==> Logrotate + systemd"
chmod +x "$APP_DIR/scripts/stack-up.sh" "$APP_DIR/scripts/stack-down.sh" 2>/dev/null || true
sudo cp "$APP_DIR/logrotate.conf" /etc/logrotate.d/url-shortener
sudo cp "$APP_DIR/url-shortener.service" /etc/systemd/system/url-shortener.service
sudo chmod 644 /etc/systemd/system/url-shortener.service
sudo systemctl daemon-reload
sudo systemd-analyze verify /etc/systemd/system/url-shortener.service 2>&1 || true
sudo systemctl enable url-shortener.service
sudo systemctl start url-shortener.service || true
sudo systemctl status url-shortener.service --no-pager | head -n 30 || true
echo "==> If start failed, logs:"
sudo journalctl -u url-shortener.service -n 40 --no-pager || true

echo "==> Optional: load test (install hey if missing)"
if command -v hey >/dev/null 2>&1; then
  hey -z 15s -c 10 http://127.0.0.1:8080/healthz || true
else
  echo "hey not installed; skip quick load test or: sudo dnf install -y hey"
fi

echo ""
echo "==> DONE. Optional reboot test (run manually):"
echo "    sudo reboot"
echo "    # wait ~90s, SSH back, then:"
echo "    cd $APP_DIR && ${COMPOSE[*]} ps && curl -i http://127.0.0.1:8080/healthz"
