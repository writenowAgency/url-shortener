#!/usr/bin/env bash
# Run ON EC2 as ec2-user (after SSH). One command — fetches this script from GitHub raw (public repo):
#   curl -fsSL https://raw.githubusercontent.com/writenowAgency/url-shortener/master/scripts/ec2-full-bootstrap.sh | bash
set -eu

REPO_URL="${REPO_URL:-https://github.com/writenowAgency/url-shortener.git}"
APP_DIR="${APP_DIR:-/opt/url-shortener}"
GIT_REF="${GIT_REF:-master}"

log() { echo "[bootstrap] $*"; }

DC() { sudo /usr/local/bin/docker-compose -f "$APP_DIR/docker-compose.yml" "$@"; }

log "Need sudo for Docker and /opt (EC2 passwordless sudo is normal)."
if ! sudo -n true 2>/dev/null; then
  log "Tip: if prompted, enter your sudo password (rare on EC2)."
fi

# --- Docker ---
if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker..."
  sudo dnf install -y docker git --allowerasing
fi
sudo systemctl enable --now docker
sudo usermod -aG docker "$(whoami)" || true

# --- docker-compose ---
if [[ ! -x /usr/local/bin/docker-compose ]]; then
  log "Installing docker-compose..."
  sudo curl -fsSL "https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-$(uname -m)" -o /usr/local/bin/docker-compose
  sudo chmod +x /usr/local/bin/docker-compose
fi
sudo /usr/local/bin/docker-compose version

# --- Swap ---
if ! grep -q '^/swapfile ' /proc/swaps 2>/dev/null; then
  if [[ ! -f /swapfile ]]; then
    log "Creating 1G swap..."
    sudo dd if=/dev/zero of=/swapfile bs=1M count=1024 status=none
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  fi
  sudo swapon /swapfile || true
fi

# --- Repo ---
if [[ ! -d "$APP_DIR/.git" ]]; then
  log "Cloning into $APP_DIR ..."
  sudo rm -rf "$APP_DIR"
  sudo mkdir -p "$(dirname "$APP_DIR")"
  sudo git clone --depth 1 --branch "$GIT_REF" "$REPO_URL" "$APP_DIR"
  sudo chown -R "$(whoami):$(whoami)" "$APP_DIR"
else
  log "Updating $APP_DIR ..."
  sudo chown -R "$(whoami):$(whoami)" "$APP_DIR" || true
  cd "$APP_DIR"
  git remote set-url origin "$REPO_URL" 2>/dev/null || git remote add origin "$REPO_URL"
  git fetch --depth 1 origin "$GIT_REF"
  git checkout "$GIT_REF"
  git reset --hard "origin/$GIT_REF"
fi

cd "$APP_DIR"
chmod +x scripts/stack-up.sh scripts/stack-down.sh scripts/install-systemd-only.sh scripts/ec2-task2-setup.sh 2>/dev/null || true

if [[ ! -f .env ]]; then
  log "Creating .env from template (set ADMIN_PASS!)"
  cp .env.example .env
fi

mkdir -p data logs/caddy

log "docker compose up (via sudo so it works before docker group re-login)..."
DC up -d --build
DC ps

log "Health..."
curl -fsS "http://127.0.0.1:8080/healthz" && echo " (stack ok)" || log "WARN caddy/app health"

log "systemd + logrotate..."
sudo cp "$APP_DIR/logrotate.conf" /etc/logrotate.d/url-shortener
sudo cp "$APP_DIR/url-shortener.service" /etc/systemd/system/url-shortener.service
sudo chmod 644 /etc/systemd/system/url-shortener.service
sudo systemctl daemon-reload
sudo systemd-analyze verify /etc/systemd/system/url-shortener.service
sudo systemctl enable url-shortener.service
sudo systemctl restart url-shortener.service || sudo systemctl start url-shortener.service
sudo journalctl -u url-shortener.service -n 30 --no-pager || true

log "Finished. systemctl is-enabled: $(systemctl is-enabled url-shortener.service 2>/dev/null || echo '?')"
log "If docker ps fails as your user, run: newgrp docker   OR   log out and SSH again."
log "Then: cd $APP_DIR && sudo docker-compose -f docker-compose.yml ps"
