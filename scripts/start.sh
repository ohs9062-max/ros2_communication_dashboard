#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
RUNTIME_ENV=/etc/ros2-dashboard/dashboard.env
runtime_env_changed=false

[[ -f /etc/systemd/system/ros2-dashboard.target ]] || {
  echo "[ros2_dashboard] Not installed. Run: sudo ./scripts/install.sh" >&2
  exit 1
}

if [[ -n "${ROS_DOMAIN_ID:-}" ]]; then
  if [[ ! "$ROS_DOMAIN_ID" =~ ^[0-9]+$ ]] || (( 10#$ROS_DOMAIN_ID > 232 )); then
    echo "[ros2_dashboard] ROS_DOMAIN_ID must be an integer from 0 to 232." >&2
    exit 1
  fi

  installed_domain="$(sed -n 's/^ROS_DOMAIN_ID=//p' "$RUNTIME_ENV" | tail -n 1)"
  if [[ "$installed_domain" != "$ROS_DOMAIN_ID" ]]; then
    if [[ "$EUID" -eq 0 ]]; then
      sed -i "s/^ROS_DOMAIN_ID=.*/ROS_DOMAIN_ID=${ROS_DOMAIN_ID}/" "$RUNTIME_ENV"
    else
      sudo sed -i "s/^ROS_DOMAIN_ID=.*/ROS_DOMAIN_ID=${ROS_DOMAIN_ID}/" "$RUNTIME_ENV"
    fi
    runtime_env_changed=true
    echo "[ros2_dashboard] ROS domain updated: ${installed_domain:-unset} -> ${ROS_DOMAIN_ID}"
  fi
fi

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
