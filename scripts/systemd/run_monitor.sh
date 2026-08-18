#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/../.." && pwd)"
ROS_WS="$PROJECT_DIR/ros2_ws"

[[ -f /opt/ros/jazzy/setup.bash ]] || {
  echo "[ros2_dashboard] ROS2 Jazzy setup was not found." >&2
  exit 1
}
[[ -f "$ROS_WS/install/setup.bash" ]] || {
  echo "[ros2_dashboard] Workspace install is missing. Run sudo ./scripts/install.sh." >&2
  exit 1
}

set +u
source /opt/ros/jazzy/setup.bash
source "$ROS_WS/install/setup.bash"
set -u

export ROS_LOG_DIR="${ROS_LOG_DIR:-$PROJECT_DIR/.runtime/ros_logs}"
export ROS2_DASHBOARD_WS_ROOT="${ROS2_DASHBOARD_WS_ROOT:-$ROS_WS}"
mkdir -p "$ROS_LOG_DIR"
exec ros2 run ros2_dashboard_monitor monitor
