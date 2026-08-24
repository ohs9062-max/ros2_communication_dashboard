#!/usr/bin/env bash
set -Eeuo pipefail

[[ "$EUID" -eq 0 ]] || {
  echo "[ros2_dashboard] Run the installer with sudo: sudo ./scripts/install.sh" >&2
  exit 1
}

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/lib/ros_runtime_env.sh"
source "$SCRIPT_DIR/lib/install_environment.sh"
LOG_DIR=/var/log/ros2-dashboard
LOG_FILE="$LOG_DIR/install.log"
BACKUP_ROOT=/var/backups/ros2-dashboard
BACKUP_DIR="$BACKUP_ROOT/$(date +%Y%m%d-%H%M%S)"
install -d -m 0755 "$LOG_DIR"
touch "$LOG_FILE"
chmod 0640 "$LOG_FILE"
exec 3>&1
exec >>"$LOG_FILE" 2>&1

fail_report() {
  local exit_code=$?
  echo "[ros2_dashboard] Installation failed (exit $exit_code)." >&3
  echo "[ros2_dashboard] Log: $LOG_FILE" >&3
  tail -n 30 "$LOG_FILE" >&3 || true
  exit "$exit_code"
}
trap fail_report ERR

step() {
  echo "[$1/10] $2" >&3
  echo "[$1/10] $2"
}

if [[ -n "${ROS2_DASHBOARD_INSTALL_USER:-}" ]]; then
  INSTALL_USER="$ROS2_DASHBOARD_INSTALL_USER"
elif [[ -n "${SUDO_USER:-}" && "$SUDO_USER" != root ]]; then
  INSTALL_USER="$SUDO_USER"
else
  echo "[ros2_dashboard] Set ROS2_DASHBOARD_INSTALL_USER when running from a root shell." >&3
  exit 1
fi
id "$INSTALL_USER" >/dev/null
INSTALL_GROUP="$(id -gn "$INSTALL_USER")"
INSTALL_HOME="$(getent passwd "$INSTALL_USER" | cut -d: -f6)"

run_as_user() {
  sudo -u "$INSTALL_USER" -H env HOME="$INSTALL_HOME" bash -lc "$1"
}

run_with_jazzy() {
  run_as_user "unset AMENT_PREFIX_PATH COLCON_PREFIX_PATH CMAKE_PREFIX_PATH \
    LD_LIBRARY_PATH PKG_CONFIG_PATH PYTHONPATH ROS_DISTRO ROS_ETC_DIR \
    ROS_PYTHON_VERSION ROS_VERSION; source /opt/ros/jazzy/setup.bash && $1"
}

backup_system_file() {
  local source_path="$1" relative_path
  [[ -e "$source_path" ]] || return 0
  relative_path="${source_path#/}"
  install -d -m 0700 "$BACKUP_DIR/$(dirname -- "$relative_path")"
  cp -a -- "$source_path" "$BACKUP_DIR/$relative_path"
  printf '%s\n' "$source_path" >> "$BACKUP_DIR/MANIFEST"
}

step 1 "Checking Ubuntu, architecture, and install owner"
source /etc/os-release
[[ "${ID:-}" == ubuntu && "${VERSION_ID:-}" == 24.04 ]] || {
  echo "Ubuntu 24.04 is required; detected ${PRETTY_NAME:-unknown}." >&2
  exit 1
}
architecture="$(dpkg --print-architecture)"
[[ "$architecture" == amd64 || "$architecture" == arm64 ]] || {
  echo "Unsupported architecture: $architecture" >&2
  exit 1
}
[[ -f "$PROJECT_DIR/AGENTS.md" && -d "$PROJECT_DIR/ros2_ws/src" ]] || {
  echo "Project root is invalid: $PROJECT_DIR" >&2
  exit 1
}
[[ "$PROJECT_DIR" != *[[:space:]]* ]] || {
  echo "Project path must not contain whitespace because it is used by systemd: $PROJECT_DIR" >&2
  exit 1
}

step 2 "Installing Ubuntu runtime and build prerequisites"
export DEBIAN_FRONTEND=noninteractive
export LANG=C.UTF-8
export LC_ALL=C.UTF-8
apt-get update
apt-get install -y \
  ca-certificates curl gnupg software-properties-common locales
add-apt-repository universe -y
apt-get update
apt-get install -y \
  python3 python3-venv python3-pip build-essential cmake pkg-config git jq rsync \
  openssl gettext-base nginx mariadb-server mariadb-client
PYTHON_BIN="$(ros_dashboard_python_runtime /usr/bin/python3)"

step 3 "Installing ROS2 Jazzy and ROS development tools"
mapfile -t other_ros_distros < <(ros_dashboard_other_ros_distros /opt/ros jazzy)
if (( ${#other_ros_distros[@]} > 0 )); then
  echo "[ros2_dashboard] Other ROS2 installations detected: ${other_ros_distros[*]}" >&3
  echo "[ros2_dashboard] They will not be removed. Installer build commands use an isolated ROS2 Jazzy environment." >&3
fi
if ! ros_dashboard_apt_repository_has_package ros-jazzy-ros-base; then
  ros_apt_version="$(curl -fsSL https://api.github.com/repos/ros-infrastructure/ros-apt-source/releases/latest \
    | sed -n 's/.*"tag_name": "\([^"]*\)".*/\1/p' | head -n 1)"
  [[ "$ros_apt_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || {
    echo "Could not determine the ros2-apt-source release." >&2
    exit 1
  }
  ros_apt_deb="/tmp/ros2-apt-source_${ros_apt_version}.${VERSION_CODENAME}_all.deb"
  curl -fL "https://github.com/ros-infrastructure/ros-apt-source/releases/download/${ros_apt_version}/ros2-apt-source_${ros_apt_version}.${VERSION_CODENAME}_all.deb" \
    -o "$ros_apt_deb"
  dpkg -i "$ros_apt_deb"
fi
apt-get update
apt-get install -y ros-jazzy-ros-base ros-dev-tools ros-jazzy-rmw-fastrtps-cpp
[[ -f /opt/ros/jazzy/setup.bash ]] || {
  echo "[ros2_dashboard] ROS2 Jazzy installation is incomplete: /opt/ros/jazzy/setup.bash is missing." >&2
  echo "[ros2_dashboard] Check the ROS apt source and rerun the installer; other ROS2 distributions were not removed." >&2
  exit 1
}

if [[ ! -f /etc/ros/rosdep/sources.list.d/20-default.list ]]; then
  rosdep init
fi
run_with_jazzy "rosdep update"

step 4 "Installing Node.js 22 for the production Frontend build"
if ! ros_dashboard_node_toolchain_ready node npm; then
  install -d -m 0755 /usr/share/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor --yes -o /usr/share/keyrings/nodesource.gpg
  chmod 0644 /usr/share/keyrings/nodesource.gpg
  rm -f /etc/apt/sources.list.d/nodesource.list
  cat > /etc/apt/sources.list.d/nodesource.sources <<EOF
Types: deb
URIs: https://deb.nodesource.com/node_22.x
Suites: nodistro
Components: main
Architectures: ${architecture}
Signed-By: /usr/share/keyrings/nodesource.gpg
EOF
  apt-get update
  apt-get install -y nodejs
fi
ros_dashboard_node_toolchain_ready node npm || {
  echo "[ros2_dashboard] Frontend requires Node.js ^20.19.0 or >=22.12.0 and a working npm command." >&2
  echo "[ros2_dashboard] Remove any unsupported node/npm that shadows /usr/bin, then rerun the installer." >&2
  exit 1
}
NODE_BIN="$(command -v node)"
NPM_BIN="$(command -v npm)"
NODE_TOOL_PATH="$(dirname -- "$NODE_BIN"):$(dirname -- "$NPM_BIN"):/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

step 5 "Resolving ROS dependencies and building the product workspace"
mapfile -d '' ros_package_dirs < <(
  find "$PROJECT_DIR/ros2_ws/src" -name package.xml \
    ! -path "$PROJECT_DIR/ros2_ws/src/ros2_dashboard_demo_nodes/*" \
    -printf '%h\0'
)
if (( ${#ros_package_dirs[@]} == 0 )); then
  echo "No ROS packages were found." >&2
  exit 1
fi
run_with_jazzy "rosdep install --from-paths $(printf '%q ' "${ros_package_dirs[@]}") --ignore-src --rosdistro jazzy -y"
run_with_jazzy "cd $(printf '%q' "$PROJECT_DIR/ros2_ws") && colcon build --symlink-install --packages-skip ros2_dashboard_demo_nodes"

step 6 "Installing Backend and Frontend application dependencies"
VENV_DIR="$PROJECT_DIR/backend/.venv"
venv_stamp="$VENV_DIR/.ros2-dashboard-venv"
python_runtime="$(readlink -f "$PYTHON_BIN"):$(
  "$PYTHON_BIN" -c 'import sys; print(f"{sys.implementation.name}:{sys.version_info.major}.{sys.version_info.minor}")'
)"
venv_identity="$VENV_DIR|$(cat /etc/machine-id)|$python_runtime"
venv_reusable=false

if [[ -d "$VENV_DIR" && ! -L "$VENV_DIR" ]] \
    && ros_dashboard_venv_is_isolated "$VENV_DIR" \
    && [[ -x "$VENV_DIR/bin/python" && -f "$VENV_DIR/bin/pip" ]]; then
  venv_prefix="$("$VENV_DIR/bin/python" -c 'import sys; print(sys.prefix)' 2>/dev/null || true)"
  pip_shebang="$(head -n 1 "$VENV_DIR/bin/pip" 2>/dev/null || true)"
  if [[ "$(readlink -f "$venv_prefix" 2>/dev/null || true)" == "$(readlink -f "$VENV_DIR")" \
      && ( "$pip_shebang" == "#!$VENV_DIR/bin/python" \
        || "$pip_shebang" == "#!$VENV_DIR/bin/python3" ) \
      && ( ! -f "$venv_stamp" \
        || "$(cat "$venv_stamp")" == "$venv_identity" ) ]]; then
    venv_reusable=true
  fi
fi

if [[ ( -e "$VENV_DIR" || -L "$VENV_DIR" ) && "$venv_reusable" != true ]]; then
  echo "Recreating Backend virtual environment for this checkout."
  run_as_user "rm -rf -- $(printf '%q' "$VENV_DIR")"
fi
if [[ ! -x "$VENV_DIR/bin/python" ]]; then
  run_as_user "unset PYTHONHOME PYTHONPATH VIRTUAL_ENV PIP_USER PIP_PREFIX PIP_TARGET; \
    $(printf '%q' "$PYTHON_BIN") -m venv $(printf '%q' "$VENV_DIR")"
fi
if [[ ! -f "$venv_stamp" || "$(cat "$venv_stamp")" != "$venv_identity" ]]; then
  install -o "$INSTALL_USER" -g "$INSTALL_GROUP" -m 0644 /dev/null "$venv_stamp"
  printf '%s\n' "$venv_identity" > "$venv_stamp"
fi
run_as_user "unset PYTHONHOME PYTHONPATH VIRTUAL_ENV PIP_USER PIP_PREFIX PIP_TARGET; \
  $(printf '%q' "$VENV_DIR/bin/python") -m pip install -r $(printf '%q' "$PROJECT_DIR/backend/requirements.txt")"
run_as_user "export PATH=$(printf '%q' "$NODE_TOOL_PATH"); cd $(printf '%q' "$PROJECT_DIR/frontend") \
  && $(printf '%q' "$NPM_BIN") ci && VITE_API_BASE_URL= $(printf '%q' "$NPM_BIN") run build"
install -d -m 0755 /var/lib/ros2-dashboard/frontend
rsync -a --delete "$PROJECT_DIR/frontend/dist/" /var/lib/ros2-dashboard/frontend/
find /var/lib/ros2-dashboard/frontend -type d -exec chmod 0755 {} +
find /var/lib/ros2-dashboard/frontend -type f -exec chmod 0644 {} +

step 7 "Preparing persistent configuration and MariaDB schema"
backend_env="$PROJECT_DIR/backend/.env"
runtime_env=/etc/ros2-dashboard/dashboard.env
if [[ -z "${ROS_DOMAIN_ID:-}" && -n "${INSTALL_USER:-}" ]]; then
  user_domain="$(run_as_user 'printf "%s" "${ROS_DOMAIN_ID:-}"' 2>/dev/null || true)"
  if [[ -n "$user_domain" ]]; then
    export ROS_DOMAIN_ID="$user_domain"
  fi
fi
if [[ -z "${RMW_IMPLEMENTATION:-}" && -n "${INSTALL_USER:-}" ]]; then
  user_rmw="$(run_as_user 'printf "%s" "${RMW_IMPLEMENTATION:-}"' 2>/dev/null || true)"
  if [[ -n "$user_rmw" ]]; then
    export RMW_IMPLEMENTATION="$user_rmw"
  fi
fi
if [[ ! -f "$backend_env" ]]; then
  install -o "$INSTALL_USER" -g "$INSTALL_GROUP" -m 0600 \
    "$PROJECT_DIR/backend/.env.example" "$backend_env"
fi
if [[ -z "$(ros_dashboard_read_env_value "$backend_env" MARIADB_PASSWORD || true)" ]]; then
  ros_dashboard_set_env_value "$backend_env" MARIADB_PASSWORD "$(openssl rand -hex 24)"
fi
ros_dashboard_migrate_runtime_env "$backend_env" "$runtime_env"
ros_dashboard_resolve_runtime_env "$backend_env" true
ros_dashboard_set_env_value "$backend_env" ROS_DOMAIN_ID "$ROS_DASHBOARD_DOMAIN_ID"
ros_dashboard_set_env_value "$backend_env" RMW_IMPLEMENTATION "$ROS_DASHBOARD_RMW_IMPLEMENTATION"
chown "$INSTALL_USER:$INSTALL_GROUP" "$backend_env"
chmod 0600 "$backend_env"
systemctl enable --now mariadb.service
"$SCRIPT_DIR/init_database.sh"

install -d -m 0755 /etc/ros2-dashboard
if [[ ! -f "$runtime_env" ]]; then
  install -m 0644 /dev/null "$runtime_env"
fi
ros_dashboard_set_env_value "$runtime_env" ROS_DOMAIN_ID "$ROS_DASHBOARD_DOMAIN_ID"
ros_dashboard_set_env_value "$runtime_env" RMW_IMPLEMENTATION "$ROS_DASHBOARD_RMW_IMPLEMENTATION"
ros_dashboard_set_env_value "$runtime_env" ROS2_DASHBOARD_WS_ROOT "$PROJECT_DIR/ros2_ws"
ros_dashboard_set_env_value "$runtime_env" ROS2_DASHBOARD_MONITOR_CONFIG_DIR \
  "$PROJECT_DIR/ros2_ws/src/ros2_dashboard_monitor/config"
ros_dashboard_set_env_value "$runtime_env" ROS_LOG_DIR "$PROJECT_DIR/.runtime/ros_logs"
install -d -o "$INSTALL_USER" -g "$INSTALL_GROUP" -m 0755 "$PROJECT_DIR/.runtime/ros_logs"

step 8 "Installing systemd units and production HTTPS/WSS"
escaped_project="${PROJECT_DIR//&/\\&}"
for unit in ros2-dashboard-monitor.service ros2-dashboard-backend.service; do
  backup_system_file "/etc/systemd/system/${unit}"
  sed \
    -e "s|@PROJECT_DIR@|${escaped_project}|g" \
    -e "s|@DASHBOARD_USER@|${INSTALL_USER}|g" \
    -e "s|@DASHBOARD_GROUP@|${INSTALL_GROUP}|g" \
    "$PROJECT_DIR/config/systemd/${unit}.in" > "/etc/systemd/system/${unit}"
done
backup_system_file /etc/systemd/system/ros2-dashboard.target
install -m 0644 "$PROJECT_DIR/config/systemd/ros2-dashboard.target" \
  /etc/systemd/system/ros2-dashboard.target
systemctl daemon-reload
systemctl enable ros2-dashboard.target ros2-dashboard-monitor.service ros2-dashboard-backend.service

export DASHBOARD_FRONTEND_ROOT=/var/lib/ros2-dashboard/frontend
dashboard_nginx_env="${DASHBOARD_ENV_FILE:-$PROJECT_DIR/config/nginx/dashboard.env}"
if [[ -f "$dashboard_nginx_env" ]]; then
  set -a
  source "$dashboard_nginx_env"
  set +a
fi
export DASHBOARD_HTTPS_PORT="${DASHBOARD_HTTPS_PORT:-443}"
backup_system_file /etc/nginx/conf.d/ros2-dashboard.conf
"$SCRIPT_DIR/install_local_https.sh"

step 9 "Starting Dashboard services"
systemctl start nginx.service mariadb.service
systemctl stop ros2-dashboard.target \
  ros2-dashboard-monitor.service ros2-dashboard-backend.service

for dashboard_port in 8765 8000; do
  if ss -H -ltn "sport = :${dashboard_port}" | grep -q .; then
    echo "Port ${dashboard_port} is already used by a process outside the installed Dashboard services." >&2
    echo "Stop the development stack or conflicting process, then run the installer again." >&2
    exit 1
  fi
done

systemctl reset-failed ros2-dashboard-monitor.service ros2-dashboard-backend.service
systemctl start ros2-dashboard-monitor.service ros2-dashboard-backend.service \
  ros2-dashboard.target

step 10 "Verifying installed services"
dashboard_https_ready() {
  curl --silent --insecure --fail \
    --resolve "localhost:${DASHBOARD_HTTPS_PORT}:127.0.0.1" \
    "https://localhost:${DASHBOARD_HTTPS_PORT}/" \
    | grep -Fq '<title>ROS2 Communication Monitor</title>'
}
for _attempt in $(seq 1 40); do
  if systemctl is-active --quiet ros2-dashboard-monitor.service \
      && systemctl is-active --quiet ros2-dashboard-backend.service \
      && curl --silent --fail http://127.0.0.1:8765/health >/dev/null 2>&1 \
      && curl --silent --fail http://127.0.0.1:8000/health >/dev/null 2>&1 \
      && dashboard_https_ready; then
    break
  fi
  sleep 0.5
done
systemctl is-active --quiet ros2-dashboard-monitor.service
systemctl is-active --quiet ros2-dashboard-backend.service
curl --silent --fail http://127.0.0.1:8765/health >/dev/null
curl --silent --fail http://127.0.0.1:8000/health >/dev/null
dashboard_https_ready || {
  echo "Nginx HTTPS did not serve the ROS2 Dashboard at https://localhost:${DASHBOARD_HTTPS_PORT}/." >&2
  echo "Check for an existing ${DASHBOARD_HTTPS_PORT}/localhost server conflict with: sudo nginx -T" >&2
  exit 1
}
run_as_user "$(printf '%q' "$PROJECT_DIR/backend/.venv/bin/python") $(printf '%q' "$PROJECT_DIR/scripts/check_database.py")"

trap - ERR
local_ip="$(hostname -I | awk '{print $1}')"
echo "[ros2_dashboard] Installation completed." >&3
echo "[ros2_dashboard] Local URL: https://localhost/" >&3
[[ -n "$local_ip" ]] && echo "[ros2_dashboard] LAN URL:   https://$local_ip/" >&3
echo "[ros2_dashboard] Status:    ./scripts/status.sh" >&3
if [[ -f "$BACKUP_DIR/MANIFEST" ]]; then
  echo "[ros2_dashboard] Backup:    $BACKUP_DIR" >&3
fi
echo "[ros2_dashboard] Full log:  $LOG_FILE" >&3
