#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
TEMPLATE="$PROJECT_DIR/config/nginx/nginx.conf.template"
OUTPUT="${1:-$PROJECT_DIR/.runtime/nginx/nginx.conf}"

required=(
  DASHBOARD_SERVER_NAME
  DASHBOARD_TLS_CERTIFICATE
  DASHBOARD_TLS_PRIVATE_KEY
)
for name in "${required[@]}"; do
  [[ -n "${!name:-}" ]] || {
    echo "[ros2_dashboard] missing required environment variable: $name" >&2
    exit 1
  }
done

export DASHBOARD_HTTPS_PORT="${DASHBOARD_HTTPS_PORT:-443}"
export DASHBOARD_FRONTEND_ROOT="${DASHBOARD_FRONTEND_ROOT:-/var/lib/ros2-dashboard/frontend}"
export DASHBOARD_BACKEND_UPSTREAM="${DASHBOARD_BACKEND_UPSTREAM:-http://127.0.0.1:8000}"

mkdir -p "$(dirname -- "$OUTPUT")"
envsubst '${DASHBOARD_HTTPS_PORT} ${DASHBOARD_SERVER_NAME} ${DASHBOARD_TLS_CERTIFICATE} ${DASHBOARD_TLS_PRIVATE_KEY} ${DASHBOARD_FRONTEND_ROOT} ${DASHBOARD_BACKEND_UPSTREAM}' \
  < "$TEMPLATE" > "$OUTPUT"

echo "[ros2_dashboard] rendered Nginx config: $OUTPUT"
