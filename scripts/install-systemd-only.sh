#!/usr/bin/env bash
# Run on EC2 if only systemd was broken. After: git pull
set -eu
APP_DIR="${APP_DIR:-/opt/url-shortener}"
cd "$APP_DIR"
chmod +x scripts/stack-up.sh scripts/stack-down.sh scripts/ec2-task2-setup.sh 2>/dev/null || true
sudo cp "$APP_DIR/logrotate.conf" /etc/logrotate.d/url-shortener
sudo cp "$APP_DIR/url-shortener.service" /etc/systemd/system/url-shortener.service
sudo chmod 644 /etc/systemd/system/url-shortener.service
sudo systemctl daemon-reload
sudo systemd-analyze verify /etc/systemd/system/url-shortener.service
sudo systemctl enable url-shortener.service
sudo systemctl restart url-shortener.service || sudo systemctl start url-shortener.service
systemctl is-enabled url-shortener.service
sudo journalctl -u url-shortener.service -n 30 --no-pager
