#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROS_WS="$(cd -- "$SCRIPT_DIR/../ros2_ws" && pwd)"

unset AMENT_PREFIX_PATH COLCON_PREFIX_PATH CMAKE_PREFIX_PATH \
  LD_LIBRARY_PATH PKG_CONFIG_PATH PYTHONPATH ROS_DISTRO ROS_ETC_DIR \
  ROS_PYTHON_VERSION ROS_VERSION
set +u
source /opt/ros/jazzy/setup.bash
set -u
cd "$ROS_WS"
echo "[ros2_dashboard] building ROS2 workspace: $ROS_WS"
/usr/bin/python3.12 /usr/bin/colcon build --symlink-install
