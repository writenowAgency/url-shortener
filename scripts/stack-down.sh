#!/usr/bin/env bash
set -e
export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
APP_DIR="${APP_DIR:-/opt/url-shortener}"
cd "$APP_DIR"

if [[ -x /usr/local/bin/docker-compose ]]; then
  exec /usr/local/bin/docker-compose -f "$APP_DIR/docker-compose.yml" down
fi
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  exec docker compose -f "$APP_DIR/docker-compose.yml" down
fi
exit 0
