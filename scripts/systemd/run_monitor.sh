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
[[ -x /usr/bin/python3.12 ]] || {
  echo "[ros2_dashboard] Dashboard Python 3.12 was not found." >&2
  exit 1
}

unset AMENT_PREFIX_PATH COLCON_PREFIX_PATH CMAKE_PREFIX_PATH \
  LD_LIBRARY_PATH PKG_CONFIG_PATH PYTHONPATH ROS_DISTRO ROS_ETC_DIR \
  ROS_PYTHON_VERSION ROS_VERSION
set +u
source /opt/ros/jazzy/setup.bash
source "$ROS_WS/install/setup.bash"
set -u
[[ "${ROS_DISTRO:-}" == jazzy ]] || {
  echo "[ros2_dashboard] ROS2 Jazzy environment was not activated." >&2
  exit 1
}
/usr/bin/python3.12 -c 'import rclpy' || {
  echo "[ros2_dashboard] rclpy is not available to Dashboard Python 3.12." >&2
  exit 1
}

export ROS_LOG_DIR="${ROS_LOG_DIR:-$PROJECT_DIR/.runtime/ros_logs}"
export ROS2_DASHBOARD_WS_ROOT="${ROS2_DASHBOARD_WS_ROOT:-$ROS_WS}"
mkdir -p "$ROS_LOG_DIR"
exec /usr/bin/python3.12 -m ros2_dashboard_monitor.main
