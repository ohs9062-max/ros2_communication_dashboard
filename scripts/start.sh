#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

[[ -f /etc/systemd/system/ros2-dashboard.target ]] || {
  echo "[ros2_dashboard] Not installed. Run: sudo ./scripts/install.sh" >&2
  exit 1
}

if [[ "$EUID" -eq 0 ]]; then
  systemctl start mariadb.service nginx.service \
    ros2-dashboard-monitor.service ros2-dashboard-backend.service \
    ros2-dashboard.target
else
  sudo systemctl start mariadb.service nginx.service \
    ros2-dashboard-monitor.service ros2-dashboard-backend.service \
    ros2-dashboard.target
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
