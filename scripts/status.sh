#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/lib/network_env.sh"
failed=0

network_env="${DASHBOARD_NETWORK_ENV_FILE:-/etc/ros2-dashboard/network.env}"
if [[ -r "$network_env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$network_env"
  set +a
else
  nginx_env="$PROJECT_DIR/config/nginx/dashboard.env"
  if [[ -r "$nginx_env" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$nginx_env"
    set +a
  fi
  if ros_dashboard_detect_network "${DASHBOARD_LOCAL_IP:-}" 2>/dev/null; then
    DASHBOARD_LOCAL_IP="$ROS_DASHBOARD_PRIMARY_IP"
  else
    DASHBOARD_LOCAL_IP=""
  fi
fi
DASHBOARD_HTTPS_PORT="${DASHBOARD_HTTPS_PORT:-443}"
if ! ros_dashboard_https_port_valid "$DASHBOARD_HTTPS_PORT"; then
  echo "Invalid DASHBOARD_HTTPS_PORT in ${network_env:-network configuration}: $DASHBOARD_HTTPS_PORT" >&2
  exit 1
fi
local_url="$(ros_dashboard_https_url localhost "$DASHBOARD_HTTPS_PORT")"
lan_url=""
if [[ -n "${DASHBOARD_LOCAL_IP:-}" ]]; then
  lan_url="$(ros_dashboard_https_url "$DASHBOARD_LOCAL_IP" "$DASHBOARD_HTTPS_PORT")"
fi

service_state() {
  local label="$1" unit="$2" state
  state="$(systemctl is-active "$unit" 2>/dev/null || true)"
  printf '%-16s %s\n' "$label" "${state:-not-installed}"
  [[ "$state" == active ]] || failed=1
}

echo "ROS2 Dashboard status"
service_state "Monitor" ros2-dashboard-monitor.service
service_state "Backend" ros2-dashboard-backend.service
service_state "MariaDB" mariadb.service
service_state "Nginx/Frontend" nginx.service

runtime_env=/etc/ros2-dashboard/dashboard.env
if [[ -r "$runtime_env" ]]; then
  runtime_domain="$(sed -n 's/^ROS_DOMAIN_ID=//p' "$runtime_env" | tail -n 1)"
  runtime_rmw="$(sed -n 's/^RMW_IMPLEMENTATION=//p' "$runtime_env" | tail -n 1)"
  printf '%-16s %s\n' "ROS domain" "${runtime_domain:-unset}"
  printf '%-16s %s\n' "ROS RMW" "${runtime_rmw:-unset}"
fi

if curl --silent --fail --noproxy '*' http://127.0.0.1:8766/snapshot >/dev/null 2>&1; then
  printf '%-16s %s\n' "DDS observer" "active"
else
  printf '%-16s %s\n' "DDS observer" "unavailable (optional)"
fi

if curl --silent --fail --noproxy '*' http://127.0.0.1:8000/health >/dev/null 2>&1; then
  printf '%-16s %s\n' "Backend API" "healthy"
else
  printf '%-16s %s\n' "Backend API" "unavailable"
  failed=1
fi

if [[ -x "$PROJECT_DIR/backend/.venv/bin/python" ]] \
    && database_status="$("$PROJECT_DIR/backend/.venv/bin/python" "$SCRIPT_DIR/check_database.py" 2>&1)"; then
  printf '%-16s %s\n' "Alert DB" "$database_status"
else
  printf '%-16s %s\n' "Alert DB" "${database_status:-unavailable}"
  failed=1
fi

if curl --silent --insecure --fail --noproxy '*' \
    --resolve "localhost:${DASHBOARD_HTTPS_PORT}:127.0.0.1" \
    "$local_url/" >/dev/null 2>&1; then
  printf '%-16s %s\n' "HTTPS UI" "$local_url/"
else
  printf '%-16s %s\n' "HTTPS UI" "unavailable"
  failed=1
fi
if [[ -n "$lan_url" ]]; then
  printf '%-16s %s\n' "LAN URL" "$lan_url/"
fi

if (( failed )); then
  echo
  echo "Logs: journalctl -u ros2-dashboard-monitor -u ros2-dashboard-backend -n 100"
  exit 1
fi
