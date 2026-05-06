#!/usr/bin/env bash
set -euo pipefail

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  else
    docker-compose "$@"
  fi
}

echo "==> Pull latest changes"
git pull --rebase

echo "==> Ensure folders exist"
mkdir -p data logs/caddy

if [[ ! -f .env ]]; then
  echo "==> Creating .env from template"
  cp .env.example .env
  echo "Edit .env before continuing (ADMIN_PASS, APP_DOMAIN, CLOUDFLARE_TUNNEL_TOKEN)."
  exit 1
fi

echo "==> Build and restart stack"
compose pull || true
compose up -d --build --remove-orphans

echo "==> Prune old images"
docker image prune -f

echo "Deploy complete."
