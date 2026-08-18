#!/usr/bin/env bash
set -euo pipefail

if [[ "$EUID" -eq 0 ]]; then
  systemctl stop ros2-dashboard.target \
    ros2-dashboard-backend.service ros2-dashboard-monitor.service
else
  sudo systemctl stop ros2-dashboard.target \
    ros2-dashboard-backend.service ros2-dashboard-monitor.service
fi

for dashboard_unit in \
  ros2-dashboard-monitor.service \
  ros2-dashboard-backend.service \
  ros2-dashboard.target; do
  dashboard_state="$(systemctl is-active "$dashboard_unit" 2>/dev/null || true)"
  if [[ "$dashboard_state" != inactive && "$dashboard_state" != failed ]]; then
    echo "[ros2_dashboard] Failed to stop ${dashboard_unit}: ${dashboard_state:-unknown}" >&2
    exit 1
  fi
done

echo "[ros2_dashboard] Dashboard Monitor and Backend stopped."
echo "[ros2_dashboard] Shared MariaDB and Nginx services were left running."
