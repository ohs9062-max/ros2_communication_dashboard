#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
ROS_WS="$PROJECT_DIR/ros2_ws"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"
RUNTIME_DIR="$PROJECT_DIR/.runtime"
ROS_LOG_DIR_VALUE="${ROS_LOG_DIR:-$RUNTIME_DIR/ros_logs}"

mkdir -p "$RUNTIME_DIR"
mkdir -p "$ROS_LOG_DIR_VALUE"

fail() {
  echo "[ros2_dashboard] ERROR: $*" >&2
  "$SCRIPT_DIR/stop_dashboard_stack.sh" || true
  exit 1
}

wait_http() {
  local name="$1" url="$2" pid="$3"
  for _attempt in $(seq 1 40); do
    kill -0 "$pid" 2>/dev/null || fail "$name process exited; see $RUNTIME_DIR/$name.log"
    if curl --silent --fail "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done
  fail "$name health check timed out: $url"
}

"$SCRIPT_DIR/build_ros2_ws.sh"

set +u
source /opt/ros/jazzy/setup.bash
source "$ROS_WS/install/setup.bash"
set -u

(
  cd "$ROS_WS"
  export ROS_LOG_DIR="$ROS_LOG_DIR_VALUE"
  export ROS2_DASHBOARD_WS_ROOT="$ROS_WS"
  exec ros2 run ros2_dashboard_monitor monitor
) >"$RUNTIME_DIR/monitor.log" 2>&1 &
MONITOR_PID=$!
echo "$MONITOR_PID" >"$RUNTIME_DIR/monitor.pid"
wait_http monitor http://127.0.0.1:8765/health "$MONITOR_PID"

(
  cd "$BACKEND_DIR"
  if [[ -f .venv/bin/activate ]]; then
    set +u
    source .venv/bin/activate
    set -u
  fi
  exec python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000
) >"$RUNTIME_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo "$BACKEND_PID" >"$RUNTIME_DIR/backend.pid"
wait_http backend http://127.0.0.1:8000/health "$BACKEND_PID"

(
  cd "$FRONTEND_DIR"
  exec npm run dev -- --host 127.0.0.1
) >"$RUNTIME_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "$FRONTEND_PID" >"$RUNTIME_DIR/frontend.pid"
wait_http frontend http://127.0.0.1:5173/ "$FRONTEND_PID"

echo "[ros2_dashboard] monitor=$MONITOR_PID backend=$BACKEND_PID frontend=$FRONTEND_PID"
echo "[ros2_dashboard] logs: $RUNTIME_DIR"
trap '"$SCRIPT_DIR/stop_dashboard_stack.sh"' INT TERM EXIT
wait "$MONITOR_PID" "$BACKEND_PID" "$FRONTEND_PID"
