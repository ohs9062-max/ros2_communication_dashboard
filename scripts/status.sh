#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
failed=0

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

if curl --silent --fail http://127.0.0.1:8766/snapshot >/dev/null 2>&1; then
  printf '%-16s %s\n' "DDS observer" "active"
else
  printf '%-16s %s\n' "DDS observer" "unavailable (optional)"
fi

if curl --silent --fail http://127.0.0.1:8000/health >/dev/null 2>&1; then
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

if curl --silent --insecure --fail https://127.0.0.1/ >/dev/null 2>&1; then
  printf '%-16s %s\n' "HTTPS UI" "https://localhost/"
else
  printf '%-16s %s\n' "HTTPS UI" "unavailable"
  failed=1
fi

if (( failed )); then
  echo
  echo "Logs: journalctl -u ros2-dashboard-monitor -u ros2-dashboard-backend -n 100"
  exit 1
fi
