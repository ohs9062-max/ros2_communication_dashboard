#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
PROJECT_ENV="$PROJECT_DIR/backend/.env"
RUNTIME_ENV=/etc/ros2-dashboard/dashboard.env
runtime_env_changed=false
source "$SCRIPT_DIR/lib/ros_runtime_env.sh"

[[ -f /etc/systemd/system/ros2-dashboard.target ]] || {
  echo "[ros2_dashboard] Not installed. Run: sudo ./scripts/install.sh" >&2
  exit 1
}

ros_dashboard_migrate_runtime_env "$PROJECT_ENV" "$RUNTIME_ENV"
ros_dashboard_resolve_runtime_env "$PROJECT_ENV"

if [[ -f "$PROJECT_ENV" ]]; then
  project_domain="$(ros_dashboard_read_env_value "$PROJECT_ENV" ROS_DOMAIN_ID || true)"
  if [[ "$project_domain" != "$ROS_DASHBOARD_DOMAIN_ID" ]]; then
    ros_dashboard_set_env_value "$PROJECT_ENV" ROS_DOMAIN_ID "$ROS_DASHBOARD_DOMAIN_ID"
  fi
  project_rmw="$(ros_dashboard_read_env_value "$PROJECT_ENV" RMW_IMPLEMENTATION || true)"
  if [[ "$project_rmw" != "$ROS_DASHBOARD_RMW_IMPLEMENTATION" ]]; then
    ros_dashboard_set_env_value "$PROJECT_ENV" RMW_IMPLEMENTATION "$ROS_DASHBOARD_RMW_IMPLEMENTATION"
  fi
fi

sync_runtime_value() {
  local key="$1" value="$2" installed
  installed="$(ros_dashboard_read_env_value "$RUNTIME_ENV" "$key" || true)"
  if [[ "$installed" != "$value" ]]; then
    if [[ "$EUID" -eq 0 ]]; then
      ros_dashboard_set_env_value "$RUNTIME_ENV" "$key" "$value"
    elif grep -q "^[[:space:]]*${key}=" "$RUNTIME_ENV" 2>/dev/null; then
      sudo sed -i -E "s|^[[:space:]]*${key}=.*|${key}=${value}|" "$RUNTIME_ENV"
    else
      printf '%s=%s\n' "$key" "$value" | sudo tee -a "$RUNTIME_ENV" >/dev/null
    fi
    runtime_env_changed=true
    echo "[ros2_dashboard] ${key} updated: ${installed:-unset} -> ${value}"
  fi
}

sync_runtime_value ROS_DOMAIN_ID "$ROS_DASHBOARD_DOMAIN_ID"
sync_runtime_value RMW_IMPLEMENTATION "$ROS_DASHBOARD_RMW_IMPLEMENTATION"

if [[ "$EUID" -eq 0 ]]; then
  systemctl start mariadb.service nginx.service \
    ros2-dashboard-monitor.service ros2-dashboard-backend.service \
    ros2-dashboard.target
  if [[ "$runtime_env_changed" == true ]]; then
    systemctl restart ros2-dashboard-monitor.service
  fi
else
  sudo systemctl start mariadb.service nginx.service \
    ros2-dashboard-monitor.service ros2-dashboard-backend.service \
    ros2-dashboard.target
  if [[ "$runtime_env_changed" == true ]]; then
    sudo systemctl restart ros2-dashboard-monitor.service
  fi
fi

for _attempt in $(seq 1 30); do
  if systemctl is-active --quiet ros2-dashboard-monitor.service \
      && systemctl is-active --quiet ros2-dashboard-backend.service \
      && curl --silent --fail http://127.0.0.1:8000/health >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

systemctl is-active --quiet ros2-dashboard-monitor.service
systemctl is-active --quiet ros2-dashboard-backend.service
curl --silent --fail http://127.0.0.1:8000/health >/dev/null

echo "[ros2_dashboard] Start request completed."
"$SCRIPT_DIR/status.sh"
