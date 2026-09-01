#!/usr/bin/env bash
set -Eeuo pipefail

[[ "$EUID" -ne 0 ]] || {
  echo "[ros2_dashboard] Run the installer as your regular user: ./scripts/install.sh" >&2
  echo "[ros2_dashboard] The installer will request administrator permission once at startup." >&2
  exit 1
}

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/lib/ros_runtime_env.sh"
source "$SCRIPT_DIR/lib/install_environment.sh"
source "$SCRIPT_DIR/lib/local_ai.sh"
source "$SCRIPT_DIR/lib/network_env.sh"
source "$SCRIPT_DIR/lib/sudo_session.sh"

command -v sudo >/dev/null || {
  echo "[ros2_dashboard] sudo is required to install system packages and services." >&2
  exit 1
}

if [[ -n "${ROS2_DASHBOARD_INSTALL_USER:-}" ]]; then
  INSTALL_USER="$ROS2_DASHBOARD_INSTALL_USER"
else
  INSTALL_USER="$(id -un)"
fi
id "$INSTALL_USER" >/dev/null
INSTALL_GROUP="$(id -gn "$INSTALL_USER")"
INSTALL_HOME="$(getent passwd "$INSTALL_USER" | cut -d: -f6)"
[[ "$(id -u "$INSTALL_USER")" -eq "$EUID" ]] || {
  echo "[ros2_dashboard] Run the installer while logged in as $INSTALL_USER." >&2
  echo "[ros2_dashboard] ROS2_DASHBOARD_INSTALL_USER cannot select another account for a user-owned build." >&2
  exit 1
}

echo "[ros2_dashboard] Administrator permission is required."
sudo -v
ros_dashboard_start_sudo_keepalive sudo

sudo_run() {
  if ! sudo -n "$@"; then
    echo "[ros2_dashboard] A privileged command failed." >&2
    echo "[ros2_dashboard] If sudo authorization expired or was revoked, rerun ./scripts/install.sh." >&2
    return 1
  fi
}

cleanup() {
  ros_dashboard_stop_sudo_keepalive
  [[ -z "${runtime_env_work:-}" ]] || rm -f -- "$runtime_env_work"
  [[ -z "${rendered_unit:-}" ]] || rm -f -- "$rendered_unit"
  [[ -z "${rosdep_sudo_dir:-}" ]] || rm -rf -- "$rosdep_sudo_dir"
  [[ -z "${lan_html:-}" ]] || rm -f -- "$lan_html"
  [[ -z "${ollama_installer:-}" ]] || rm -f -- "$ollama_installer"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

LOG_DIR=/var/log/ros2-dashboard
LOG_FILE="$LOG_DIR/install.log"
BACKUP_ROOT=/var/backups/ros2-dashboard
BACKUP_DIR="$BACKUP_ROOT/$(date +%Y%m%d-%H%M%S)"
sudo_run install -d -m 0755 "$LOG_DIR"
sudo_run touch "$LOG_FILE"
sudo_run chown "root:$INSTALL_GROUP" "$LOG_FILE"
sudo_run chmod 0640 "$LOG_FILE"
exec 3>&1
exec > >(sudo -n tee -a "$LOG_FILE" >/dev/null) 2>&1

fail_report() {
  local exit_code=$?
  echo "[ros2_dashboard] Installation failed (exit $exit_code)." >&3
  echo "[ros2_dashboard] Log: $LOG_FILE" >&3
  tail -n 30 "$LOG_FILE" >&3 || true
  exit "$exit_code"
}
trap fail_report ERR

step() {
  echo "[$1/11] $2" >&3
  echo "[$1/11] $2"
}

run_as_user() {
  env HOME="$INSTALL_HOME" bash -lc "$1"
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
  sudo_run install -d -m 0700 "$BACKUP_DIR/$(dirname -- "$relative_path")"
  sudo_run cp -a -- "$source_path" "$BACKUP_DIR/$relative_path"
  printf '%s\n' "$source_path" | sudo_run tee -a "$BACKUP_DIR/MANIFEST" >/dev/null
}

prepare_local_ai() {
  local local_llm_url local_llm_model local_llm_timeout tags_payload

  local_llm_url="$(ros_dashboard_read_env_value "$backend_env" LOCAL_LLM_URL || true)"
  local_llm_model="$(ros_dashboard_read_env_value "$backend_env" LOCAL_LLM_MODEL || true)"
  local_llm_timeout="$(ros_dashboard_read_env_value "$backend_env" LOCAL_LLM_TIMEOUT || true)"

  if [[ -z "$local_llm_url" || -z "$local_llm_model" ]] \
      || ! ros_dashboard_local_llm_timeout_valid "$local_llm_timeout"; then
    echo "[ros2_dashboard] Local AI settings are missing or invalid in $backend_env." >&3
    return 1
  fi
  local_llm_url="${local_llm_url%/}"

  if ! ros_dashboard_local_llm_url_is_loopback "$local_llm_url"; then
    echo "[ros2_dashboard] LOCAL_LLM_URL is not loopback; installer will not install, start, or modify Ollama for: $local_llm_url" >&3
    return 1
  fi

  echo "[Local AI 1/3] Checking Ollama command..." >&3
  if ros_dashboard_ollama_install_needed ollama; then
    echo "[Local AI 1/3] Ollama is missing; installing with the official Linux installer..." >&3
    ollama_installer="$(mktemp)"
    if ! curl -fsSL https://ollama.com/install.sh -o "$ollama_installer"; then
      echo "[ros2_dashboard] Could not download the official Ollama installer." >&3
      return 1
    fi
    if ! sudo_run sh "$ollama_installer"; then
      echo "[ros2_dashboard] The official Ollama installer failed." >&3
      return 1
    fi
    rm -f -- "$ollama_installer"
    ollama_installer=""
  else
    echo "[Local AI 1/3] Ollama is executable; skipping reinstall." >&3
  fi

  if ! ros_dashboard_ollama_command_ready ollama; then
    echo "[ros2_dashboard] Ollama is not executable after installation." >&3
    return 1
  fi
  if ! systemctl cat ollama.service >/dev/null 2>&1; then
    echo "[ros2_dashboard] Ollama systemd service is unavailable." >&3
    return 1
  fi
  echo "[Local AI 2/3] Checking Ollama service..." >&3
  if ! ros_dashboard_ollama_service_is_enabled systemctl; then
    if ! sudo_run systemctl enable ollama.service; then
      echo "[ros2_dashboard] Could not enable ollama.service." >&3
      return 1
    fi
  fi
  if ! ros_dashboard_ollama_service_is_active systemctl; then
    if ! sudo_run systemctl start ollama.service; then
      echo "[ros2_dashboard] Could not start ollama.service." >&3
      return 1
    fi
  else
    echo "[Local AI 2/3] ollama.service is active; skipping restart." >&3
  fi
  echo "[Local AI 2/3] Ollama service ready." >&3

  tags_payload=""
  for _attempt in $(seq 1 30); do
    if tags_payload="$(curl --silent --show-error --fail --noproxy '*' --max-time 2 \
        "$local_llm_url/api/tags" 2>/dev/null)"; then
      break
    fi
    sleep 0.5
  done
  if [[ -z "$tags_payload" ]]; then
    echo "[ros2_dashboard] Ollama API did not respond at $local_llm_url/api/tags." >&3
    return 1
  fi
  if ! printf '%s' "$tags_payload" | jq -e '.models | type == "array"' >/dev/null 2>&1; then
    echo "[ros2_dashboard] Ollama /api/tags returned an invalid response." >&3
    return 1
  fi

  echo "[Local AI 3/3] Ollama API and /api/tags are ready." >&3
  echo "[ros2_dashboard] Ollama runtime is ready at $local_llm_url." >&3
  echo "[ros2_dashboard] Model $local_llm_model will be downloaded on first Local AI use if needed." >&3
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
sudo_run apt-get update
sudo_run apt-get install -y \
  ca-certificates curl gnupg software-properties-common locales
sudo_run add-apt-repository universe -y
sudo_run apt-get update
sudo_run apt-get install -y \
  python3.12 python3.12-venv build-essential cmake pkg-config git jq rsync xz-utils \
  openssl gettext-base nginx mariadb-server mariadb-client
PYTHON_BIN="$(ros_dashboard_python_runtime /usr/bin/python3.12)" || {
  echo "[ros2_dashboard] Python 3.12 could not be installed side-by-side on this Ubuntu installation." >&2
  echo "[ros2_dashboard] The existing default Python was not changed." >&2
  exit 1
}

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
  sudo_run dpkg -i "$ros_apt_deb"
fi
sudo_run apt-get update
sudo_run apt-get install -y ros-jazzy-ros-base ros-dev-tools ros-jazzy-rmw-fastrtps-cpp
[[ -f /opt/ros/jazzy/setup.bash ]] || {
  echo "[ros2_dashboard] ROS2 Jazzy installation is incomplete: /opt/ros/jazzy/setup.bash is missing." >&2
  echo "[ros2_dashboard] Check the ROS apt source and rerun the installer; other ROS2 distributions were not removed." >&2
  exit 1
}

ROSDEP_BIN=/usr/bin/rosdep
COLCON_BIN=/usr/bin/colcon
[[ -f "$ROSDEP_BIN" && -f "$COLCON_BIN" ]] || {
  echo "[ros2_dashboard] ROS2 Jazzy development tools are incomplete (rosdep/colcon missing)." >&2
  exit 1
}
if [[ ! -f /etc/ros/rosdep/sources.list.d/20-default.list ]]; then
  sudo_run "$PYTHON_BIN" "$ROSDEP_BIN" init
fi
run_with_jazzy "$(printf '%q' "$PYTHON_BIN") $(printf '%q' "$ROSDEP_BIN") update"

step 4 "Installing the Dashboard Node.js 22 build toolchain"
NODE_VERSION=22.23.2
NODE_TOOLCHAIN_ROOT=/opt/ros2-dashboard/toolchains
node_distribution="$(ros_dashboard_node_distribution "$architecture" "$NODE_VERSION")" || {
  echo "[ros2_dashboard] No Dashboard Node.js build is available for architecture: $architecture" >&2
  exit 1
}
NODE_ARCHIVE="${node_distribution%%|*}"
NODE_SHA256="${node_distribution#*|}"
NODE_HOME="$NODE_TOOLCHAIN_ROOT/${NODE_ARCHIVE%.tar.xz}"
NODE_CURRENT="$NODE_TOOLCHAIN_ROOT/node"
if ! ros_dashboard_node_toolchain_ready "$NODE_HOME/bin/node" "$NODE_HOME/bin/npm"; then
  node_archive_path="/tmp/$NODE_ARCHIVE"
  curl -fL "https://nodejs.org/dist/v${NODE_VERSION}/${NODE_ARCHIVE}" -o "$node_archive_path"
  printf '%s  %s\n' "$NODE_SHA256" "$node_archive_path" | sha256sum -c -
  sudo_run install -d -m 0755 "$NODE_TOOLCHAIN_ROOT"
  if [[ -e "$NODE_HOME" || -L "$NODE_HOME" ]]; then
    sudo_run rm -rf -- "$NODE_HOME"
  fi
  sudo_run tar -xJf "$node_archive_path" -C "$NODE_TOOLCHAIN_ROOT"
fi
if [[ -e "$NODE_CURRENT" && ! -L "$NODE_CURRENT" ]]; then
  echo "[ros2_dashboard] Dashboard Node toolchain path exists but is not a symlink: $NODE_CURRENT" >&2
  echo "[ros2_dashboard] Move that Dashboard-specific path aside and rerun; the system Node was not changed." >&2
  exit 1
fi
sudo_run ln -sfn "$NODE_HOME" "$NODE_CURRENT"
NODE_BIN="$NODE_CURRENT/bin/node"
NPM_BIN="$NODE_CURRENT/bin/npm"
ros_dashboard_node_toolchain_ready "$NODE_BIN" "$NPM_BIN" || {
  echo "[ros2_dashboard] Dashboard Node.js toolchain validation failed: $NODE_HOME" >&2
  exit 1
}
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
rosdep_sudo_dir="$(mktemp -d)"
ros_dashboard_create_noninteractive_sudo_wrapper "$rosdep_sudo_dir" /usr/bin/sudo
run_with_jazzy "export PATH=$(printf '%q' "$rosdep_sudo_dir"):\$PATH; \
  $(printf '%q' "$PYTHON_BIN") $(printf '%q' "$ROSDEP_BIN") install --from-paths $(printf '%q ' "${ros_package_dirs[@]}") --ignore-src --rosdistro jazzy -y"
rm -rf -- "$rosdep_sudo_dir"
rosdep_sudo_dir=""
run_with_jazzy "cd $(printf '%q' "$PROJECT_DIR/ros2_ws") && $(printf '%q' "$PYTHON_BIN") $(printf '%q' "$COLCON_BIN") build --symlink-install --packages-skip ros2_dashboard_demo_nodes"

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
venv_base_executable="$("$VENV_DIR/bin/python" -c 'import os, sys; print(os.path.realpath(sys._base_executable))')"
[[ "$venv_base_executable" == "$(readlink -f "$PYTHON_BIN")" ]] || {
  echo "[ros2_dashboard] Backend venv does not use the Dashboard Python: $venv_base_executable" >&2
  exit 1
}
if [[ ! -f "$venv_stamp" || "$(cat "$venv_stamp")" != "$venv_identity" ]]; then
  install -m 0644 /dev/null "$venv_stamp"
  printf '%s\n' "$venv_identity" > "$venv_stamp"
fi
run_as_user "unset PYTHONHOME PYTHONPATH VIRTUAL_ENV PIP_USER PIP_PREFIX PIP_TARGET; \
  $(printf '%q' "$VENV_DIR/bin/python") -m pip install -r $(printf '%q' "$PROJECT_DIR/backend/requirements.txt")"
run_as_user "export PATH=$(printf '%q' "$NODE_TOOL_PATH"); cd $(printf '%q' "$PROJECT_DIR/frontend") \
  && $(printf '%q' "$NPM_BIN") ci && VITE_API_BASE_URL= $(printf '%q' "$NPM_BIN") run build"
sudo_run install -d -m 0755 /var/lib/ros2-dashboard/frontend
sudo_run rsync -a --delete "$PROJECT_DIR/frontend/dist/" /var/lib/ros2-dashboard/frontend/
sudo_run find /var/lib/ros2-dashboard/frontend -type d -exec chmod 0755 {} +
sudo_run find /var/lib/ros2-dashboard/frontend -type f -exec chmod 0644 {} +

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
  install -m 0600 \
    "$PROJECT_DIR/backend/.env.example" "$backend_env"
fi
if ! ros_dashboard_ensure_local_llm_env_defaults \
    "$backend_env" "$PROJECT_DIR/backend/.env.example"; then
  echo "[ros2_dashboard] WARNING: Local AI defaults could not be prepared; Local AI setup will be skipped." >&3
fi
if [[ -z "$(ros_dashboard_read_env_value "$backend_env" MARIADB_PASSWORD || true)" ]]; then
  ros_dashboard_set_env_value "$backend_env" MARIADB_PASSWORD "$(openssl rand -hex 24)"
fi
runtime_env_work="$(mktemp)"
if sudo -n test -f "$runtime_env"; then
  sudo_run cat "$runtime_env" > "$runtime_env_work"
fi
ros_dashboard_migrate_runtime_env "$backend_env" "$runtime_env_work"
ros_dashboard_resolve_runtime_env "$backend_env" true
ros_dashboard_set_env_value "$backend_env" ROS_DOMAIN_ID "$ROS_DASHBOARD_DOMAIN_ID"
ros_dashboard_set_env_value "$backend_env" RMW_IMPLEMENTATION "$ROS_DASHBOARD_RMW_IMPLEMENTATION"
chmod 0600 "$backend_env"
sudo_run systemctl enable --now mariadb.service
sudo_run "$SCRIPT_DIR/init_database.sh"

ros_dashboard_set_env_value "$runtime_env_work" ROS_DOMAIN_ID "$ROS_DASHBOARD_DOMAIN_ID"
ros_dashboard_set_env_value "$runtime_env_work" RMW_IMPLEMENTATION "$ROS_DASHBOARD_RMW_IMPLEMENTATION"
ros_dashboard_set_env_value "$runtime_env_work" ROS2_DASHBOARD_WS_ROOT "$PROJECT_DIR/ros2_ws"
ros_dashboard_set_env_value "$runtime_env_work" ROS2_DASHBOARD_MONITOR_CONFIG_DIR \
  "$PROJECT_DIR/ros2_ws/src/ros2_dashboard_monitor/config"
ros_dashboard_set_env_value "$runtime_env_work" ROS_LOG_DIR "$PROJECT_DIR/.runtime/ros_logs"
sudo_run install -d -m 0755 /etc/ros2-dashboard
sudo_run install -m 0644 "$runtime_env_work" "$runtime_env"
rm -f -- "$runtime_env_work"
sudo_run install -d -o "$INSTALL_USER" -g "$INSTALL_GROUP" -m 0755 "$PROJECT_DIR/.runtime/ros_logs"

step 8 "Preparing optional Local AI runtime with Ollama"
if ! prepare_local_ai; then
  echo "[ros2_dashboard] WARNING: Local AI setup did not complete; Dashboard installation will continue." >&3
  echo "[ros2_dashboard] WARNING: Review the Ollama messages above and rerun ./scripts/install.sh after fixing the cause." >&3
fi

step 9 "Installing systemd units and production HTTPS/WSS"
escaped_project="${PROJECT_DIR//&/\\&}"
for unit in ros2-dashboard-monitor.service ros2-dashboard-backend.service; do
  backup_system_file "/etc/systemd/system/${unit}"
  rendered_unit="$(mktemp)"
  sed \
    -e "s|@PROJECT_DIR@|${escaped_project}|g" \
    -e "s|@DASHBOARD_USER@|${INSTALL_USER}|g" \
    -e "s|@DASHBOARD_GROUP@|${INSTALL_GROUP}|g" \
    "$PROJECT_DIR/config/systemd/${unit}.in" > "$rendered_unit"
  sudo_run install -m 0644 "$rendered_unit" "/etc/systemd/system/${unit}"
  rm -f -- "$rendered_unit"
done
backup_system_file /etc/systemd/system/ros2-dashboard.target
sudo_run install -m 0644 "$PROJECT_DIR/config/systemd/ros2-dashboard.target" \
  /etc/systemd/system/ros2-dashboard.target
sudo_run systemctl daemon-reload
sudo_run systemctl enable ros2-dashboard.target ros2-dashboard-monitor.service ros2-dashboard-backend.service

export DASHBOARD_FRONTEND_ROOT=/var/lib/ros2-dashboard/frontend
dashboard_nginx_env="${DASHBOARD_ENV_FILE:-$PROJECT_DIR/config/nginx/dashboard.env}"
resolved_network_env=/etc/ros2-dashboard/network.env
backup_system_file /etc/nginx/conf.d/ros2-dashboard.conf
backup_system_file "$resolved_network_env"
network_env_args=(
  "DASHBOARD_FRONTEND_ROOT=$DASHBOARD_FRONTEND_ROOT"
  "DASHBOARD_ENV_FILE=$dashboard_nginx_env"
  "DASHBOARD_RESOLVED_ENV_FILE=$resolved_network_env"
)
for network_override in \
    DASHBOARD_LOCAL_IP DASHBOARD_HTTPS_PORT DASHBOARD_SERVER_NAME \
    DASHBOARD_SERVER_NAME_MODE DASHBOARD_TLS_CERTIFICATE \
    DASHBOARD_TLS_PRIVATE_KEY DASHBOARD_BACKEND_UPSTREAM; do
  if [[ -v "$network_override" ]]; then
    network_env_args+=("$network_override=${!network_override}")
  fi
done
sudo_run env "${network_env_args[@]}" "$SCRIPT_DIR/install_local_https.sh"
set -a
# shellcheck disable=SC1090
source "$resolved_network_env"
set +a
local_url="$(ros_dashboard_https_url localhost "$DASHBOARD_HTTPS_PORT")"
lan_url="$(ros_dashboard_https_url "$DASHBOARD_LOCAL_IP" "$DASHBOARD_HTTPS_PORT")"
echo "[ros2_dashboard] Selected LAN URL: $lan_url/" >&3

if command -v ufw >/dev/null 2>&1; then
  firewall_status="$(sudo -n env LANG=C ufw status 2>/dev/null || true)"
  if grep -Fq 'Status: active' <<< "$firewall_status" \
      && ! grep -Eq "(^|[[:space:]])${DASHBOARD_HTTPS_PORT}(/tcp)?[[:space:]]+ALLOW" \
        <<< "$firewall_status"; then
    echo "[ros2_dashboard] WARNING: UFW is active and no explicit allow rule for TCP $DASHBOARD_HTTPS_PORT was found." >&3
    echo "[ros2_dashboard] Verify from another LAN device; if policy permits, run: sudo ufw allow ${DASHBOARD_HTTPS_PORT}/tcp" >&3
  fi
fi

step 10 "Starting Dashboard services"
sudo_run systemctl start nginx.service mariadb.service
sudo_run systemctl stop ros2-dashboard.target \
  ros2-dashboard-monitor.service ros2-dashboard-backend.service

for dashboard_port in 8765 8000; do
  if ss -H -ltn "sport = :${dashboard_port}" | grep -q .; then
    echo "Port ${dashboard_port} is already used by a process outside the installed Dashboard services." >&2
    echo "Stop the development stack or conflicting process, then run the installer again." >&2
    exit 1
  fi
done

sudo_run systemctl reset-failed ros2-dashboard-monitor.service ros2-dashboard-backend.service
sudo_run systemctl start ros2-dashboard-monitor.service ros2-dashboard-backend.service \
  ros2-dashboard.target

step 11 "Verifying installed services"
dashboard_https_ready() {
  curl --silent --insecure --fail --noproxy '*' \
    --resolve "localhost:${DASHBOARD_HTTPS_PORT}:127.0.0.1" \
    "$local_url/" \
    | grep -Fq '<title>ROS2 Communication Monitor</title>'
}
for _attempt in $(seq 1 40); do
  if systemctl is-active --quiet ros2-dashboard-monitor.service \
      && systemctl is-active --quiet ros2-dashboard-backend.service \
      && curl --silent --fail --noproxy '*' http://127.0.0.1:8765/health >/dev/null 2>&1 \
      && curl --silent --fail --noproxy '*' http://127.0.0.1:8000/health >/dev/null 2>&1 \
      && dashboard_https_ready; then
    break
  fi
  sleep 0.5
done
systemctl is-active --quiet ros2-dashboard-monitor.service
systemctl is-active --quiet ros2-dashboard-backend.service
curl --silent --fail --noproxy '*' http://127.0.0.1:8765/health >/dev/null
curl --silent --fail --noproxy '*' http://127.0.0.1:8000/health >/dev/null
dashboard_https_ready || {
  echo "Nginx HTTPS did not serve the ROS2 Dashboard at $local_url/." >&2
  echo "Check for an existing ${DASHBOARD_HTTPS_PORT}/localhost server conflict with: sudo nginx -T" >&2
  exit 1
}
curl --silent --insecure --fail --noproxy '*' "$local_url/health" \
  | jq -e '.success == true and .data.monitor_connected == true' >/dev/null
ros_dashboard_certificate_has_sans \
  "$DASHBOARD_TLS_CERTIFICATE" localhost 127.0.0.1 "$DASHBOARD_LOCAL_IP"
ros_dashboard_websocket_check "$local_url/ws/monitor" || {
  echo "Nginx WSS did not upgrade at $local_url/ws/monitor." >&2
  exit 1
}

lan_html="$(mktemp)"
if curl --silent --show-error --insecure --fail --connect-timeout 3 --noproxy '*' \
    --output "$lan_html" "$lan_url/"; then
  grep -Fq '<title>ROS2 Communication Monitor</title>' "$lan_html" || {
    echo "The selected LAN address did not serve the Dashboard production HTML: $lan_url/" >&2
    exit 1
  }
  curl --silent --insecure --fail --noproxy '*' "$lan_url/health" \
    | jq -e '.success == true and .data.monitor_connected == true' >/dev/null
  ros_dashboard_websocket_check "$lan_url/ws/monitor" || {
    echo "The selected LAN address did not complete a WSS upgrade: $lan_url/ws/monitor" >&2
    exit 1
  }
  echo "[ros2_dashboard] LAN HTTPS, health, TLS SAN, and WSS checks passed: $lan_url/" >&3
else
  echo "[ros2_dashboard] WARNING: localhost checks passed, but this host could not connect to its selected LAN URL: $lan_url/" >&3
  echo "[ros2_dashboard] This can be caused by host firewall or hairpin routing. Verify the URL from another LAN device." >&3
fi
rm -f -- "$lan_html"
run_as_user "$(printf '%q' "$PROJECT_DIR/backend/.venv/bin/python") $(printf '%q' "$PROJECT_DIR/scripts/check_database.py")"

trap - ERR
echo "[ros2_dashboard] Installation completed." >&3
echo "[ros2_dashboard] Local URL: $local_url/" >&3
echo "[ros2_dashboard] LAN URL:   $lan_url/" >&3
echo "[ros2_dashboard] Status:    ./scripts/status.sh" >&3
if sudo -n test -f "$BACKUP_DIR/MANIFEST"; then
  echo "[ros2_dashboard] Backup:    $BACKUP_DIR" >&3
fi
echo "[ros2_dashboard] Full log:  $LOG_FILE" >&3
