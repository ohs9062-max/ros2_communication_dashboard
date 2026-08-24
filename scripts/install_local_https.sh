#!/usr/bin/env bash
set -euo pipefail

[[ "$EUID" -eq 0 ]] || {
  echo "[ros2_dashboard] run with sudo: sudo $0" >&2
  exit 1
}

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
LOCAL_IP="${DASHBOARD_LOCAL_IP:-$(hostname -I | awk '{print $1}')}"
ENV_FILE="${DASHBOARD_ENV_FILE:-$PROJECT_DIR/config/nginx/dashboard.env}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

export DASHBOARD_HTTPS_PORT="${DASHBOARD_HTTPS_PORT:-443}"
export DASHBOARD_SERVER_NAME="${DASHBOARD_SERVER_NAME:-localhost $LOCAL_IP}"
export DASHBOARD_TLS_CERTIFICATE="${DASHBOARD_TLS_CERTIFICATE:-/etc/nginx/ssl/ros2-dashboard.crt}"
export DASHBOARD_TLS_PRIVATE_KEY="${DASHBOARD_TLS_PRIVATE_KEY:-/etc/nginx/ssl/ros2-dashboard.key}"
export DASHBOARD_FRONTEND_ROOT="${DASHBOARD_FRONTEND_ROOT:-/var/lib/ros2-dashboard/frontend}"
export DASHBOARD_BACKEND_UPSTREAM="${DASHBOARD_BACKEND_UPSTREAM:-http://127.0.0.1:8000}"

[[ -n "$LOCAL_IP" ]] || {
  echo "[ros2_dashboard] local IPv4 address was not detected; set DASHBOARD_LOCAL_IP" >&2
  exit 1
}
if [[ -f "$DASHBOARD_TLS_CERTIFICATE" && ! -f "$DASHBOARD_TLS_PRIVATE_KEY" \
    || ! -f "$DASHBOARD_TLS_CERTIFICATE" && -f "$DASHBOARD_TLS_PRIVATE_KEY" ]]; then
  echo "[ros2_dashboard] TLS certificate and private key must either both exist or both be absent." >&2
  echo "[ros2_dashboard] Restore the missing file or move the incomplete pair before reinstalling; the existing file was not overwritten." >&2
  exit 1
fi
install -d -m 0755 "$(dirname -- "$DASHBOARD_TLS_CERTIFICATE")"
if [[ ! -f "$DASHBOARD_TLS_CERTIFICATE" || ! -f "$DASHBOARD_TLS_PRIVATE_KEY" ]]; then
  openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 825 \
    -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:$LOCAL_IP" \
    -keyout "$DASHBOARD_TLS_PRIVATE_KEY" \
    -out "$DASHBOARD_TLS_CERTIFICATE"
fi
chmod 0600 "$DASHBOARD_TLS_PRIVATE_KEY"
chmod 0644 "$DASHBOARD_TLS_CERTIFICATE"

rendered="$(mktemp)"
previous_config="$(mktemp)"
had_previous_config=false
if [[ -f /etc/nginx/conf.d/ros2-dashboard.conf ]]; then
  cp -a /etc/nginx/conf.d/ros2-dashboard.conf "$previous_config"
  had_previous_config=true
fi
trap 'rm -f -- "$rendered" "$previous_config"' EXIT
"$SCRIPT_DIR/render_nginx_config.sh" "$rendered"
install -m 0644 "$rendered" /etc/nginx/conf.d/ros2-dashboard.conf

if ! nginx -t; then
  if [[ "$had_previous_config" == true ]]; then
    cp -a "$previous_config" /etc/nginx/conf.d/ros2-dashboard.conf
  else
    rm -f /etc/nginx/conf.d/ros2-dashboard.conf
  fi
  echo "[ros2_dashboard] The generated Nginx configuration was rejected; the previous Dashboard configuration was restored." >&2
  exit 1
fi
systemctl enable --now nginx >/dev/null
systemctl reload nginx

echo "[ros2_dashboard] local HTTPS: https://localhost:$DASHBOARD_HTTPS_PORT/"
echo "[ros2_dashboard] LAN HTTPS:   https://$LOCAL_IP:$DASHBOARD_HTTPS_PORT/"
echo "[ros2_dashboard] frontend:    $DASHBOARD_FRONTEND_ROOT (Nginx static files)"
