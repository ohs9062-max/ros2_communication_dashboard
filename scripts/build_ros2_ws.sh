#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROS_WS="$(cd -- "$SCRIPT_DIR/../ros2_ws" && pwd)"

set +u
source /opt/ros/jazzy/setup.bash
set -u
cd "$ROS_WS"
echo "[ros2_dashboard] building ROS2 workspace: $ROS_WS"
colcon build --symlink-install
