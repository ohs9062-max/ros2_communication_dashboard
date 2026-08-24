#!/usr/bin/env bash

ros_dashboard_start_sudo_keepalive() {
  local sudo_bin="${1:-sudo}"
  local interval_sec="${ROS2_DASHBOARD_SUDO_KEEPALIVE_SEC:-45}"
  local control_fifo

  ROS_DASHBOARD_SUDO_KEEPALIVE_DIR="$(mktemp -d)"
  control_fifo="$ROS_DASHBOARD_SUDO_KEEPALIVE_DIR/control"
  mkfifo -m 0600 "$control_fifo"
  (
    exec 9<> "$control_fifo"
    trap 'exit 0' TERM INT HUP

    while ! read -r -t "$interval_sec" _ <&9; do
      "$sudo_bin" -n -v || exit 1
    done
  ) &
  ROS_DASHBOARD_SUDO_KEEPALIVE_PID=$!
}

ros_dashboard_stop_sudo_keepalive() {
  local keepalive_pid="${ROS_DASHBOARD_SUDO_KEEPALIVE_PID:-}"
  [[ -n "$keepalive_pid" ]] || return 0

  kill "$keepalive_pid" 2>/dev/null || true
  wait "$keepalive_pid" 2>/dev/null || true
  if [[ -n "${ROS_DASHBOARD_SUDO_KEEPALIVE_DIR:-}" ]]; then
    rm -rf -- "$ROS_DASHBOARD_SUDO_KEEPALIVE_DIR"
  fi
  ROS_DASHBOARD_SUDO_KEEPALIVE_PID=""
  ROS_DASHBOARD_SUDO_KEEPALIVE_DIR=""
}

ros_dashboard_create_noninteractive_sudo_wrapper() {
  local target_dir="$1" sudo_bin="${2:-/usr/bin/sudo}"

  install -d -m 0700 "$target_dir"
  printf '#!/usr/bin/env bash\nexec %q -n "$@"\n' "$sudo_bin" > "$target_dir/sudo"
  chmod 0700 "$target_dir/sudo"
}
