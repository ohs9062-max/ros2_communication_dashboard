#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/sudo_session.sh"

tmp_dir="$(mktemp -d)"
trap 'rm -rf -- "$tmp_dir"' EXIT

fake_sudo="$tmp_dir/fake-sudo"
cat > "$fake_sudo" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$FAKE_SUDO_LOG"
EOF
chmod +x "$fake_sudo"
export FAKE_SUDO_LOG="$tmp_dir/sudo.log"
export ROS2_DASHBOARD_SUDO_KEEPALIVE_SEC=0.05

ros_dashboard_start_sudo_keepalive "$fake_sudo"
keepalive_pid="$ROS_DASHBOARD_SUDO_KEEPALIVE_PID"
sleep 0.12
ros_dashboard_stop_sudo_keepalive
if kill -0 "$keepalive_pid" 2>/dev/null; then
  echo "sudo keepalive remained after normal cleanup." >&2
  exit 1
fi
grep -Fq -- '-n -v' "$FAKE_SUDO_LOG"

wrapper_dir="$tmp_dir/wrapper"
ros_dashboard_create_noninteractive_sudo_wrapper "$wrapper_dir" "$fake_sudo"
"$wrapper_dir/sudo" -H apt-get install -y example
grep -Fq -- '-n -H apt-get install -y example' "$FAKE_SUDO_LOG"

run_cleanup_case() {
  local signal="$1"
  local pid_file="$tmp_dir/$signal.pid"
  set +e
  FAKE_SUDO_LOG="$FAKE_SUDO_LOG" \
  ROS2_DASHBOARD_SUDO_KEEPALIVE_SEC=30 \
  bash -c '
    set -euo pipefail
    source "$1"
    ros_dashboard_start_sudo_keepalive "$2"
    printf "%s\n" "$ROS_DASHBOARD_SUDO_KEEPALIVE_PID" > "$3"
    trap ros_dashboard_stop_sudo_keepalive EXIT
    trap "exit 130" INT
    trap "exit 143" TERM
    if [[ "$4" == ERR ]]; then
      false
    else
      kill -"$4" "$$"
    fi
  ' bash "$SCRIPT_DIR/lib/sudo_session.sh" "$fake_sudo" "$pid_file" "$signal"
  case_exit=$?
  set -e
  [[ "$case_exit" -ne 0 ]]
  child_pid="$(cat "$pid_file")"
  if kill -0 "$child_pid" 2>/dev/null; then
    echo "sudo keepalive remained after $signal cleanup." >&2
    exit 1
  fi
}

run_cleanup_case ERR
run_cleanup_case INT

echo "Sudo session tests passed."
