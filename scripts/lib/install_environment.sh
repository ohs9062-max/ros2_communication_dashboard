#!/usr/bin/env bash

ros_dashboard_python_runtime() {
  local python_bin="${1:-/usr/bin/python3}" version
  [[ -x "$python_bin" ]] || {
    echo "[ros2_dashboard] Required system Python is missing: $python_bin" >&2
    return 1
  }
  version="$($python_bin -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || true)"
  [[ "$version" == 3.12 ]] || {
    echo "[ros2_dashboard] Ubuntu 24.04 / ROS2 Jazzy requires system Python 3.12; detected ${version:-unknown} at $python_bin." >&2
    echo "[ros2_dashboard] Restore Ubuntu's /usr/bin/python3 and python3-venv packages; do not point the system Python to another version." >&2
    return 1
  }
  printf '%s\n' "$python_bin"
}

ros_dashboard_node_supported() {
  local node_bin="${1:-node}" version major minor
  command -v "$node_bin" >/dev/null 2>&1 || return 1
  version="$($node_bin -p 'process.versions.node' 2>/dev/null || true)"
  [[ "$version" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+) ]] || return 1
  major="${BASH_REMATCH[1]}"
  minor="${BASH_REMATCH[2]}"
  (( major > 22 \
      || (major == 22 && minor >= 12) \
      || (major == 20 && minor >= 19) ))
}

ros_dashboard_node_toolchain_ready() {
  ros_dashboard_node_supported "${1:-node}" \
    && command -v "${2:-npm}" >/dev/null 2>&1
}

ros_dashboard_other_ros_distros() {
  local ros_root="${1:-/opt/ros}" required="${2:-jazzy}" path
  [[ -d "$ros_root" ]] || return 0
  for path in "$ros_root"/*; do
    [[ -d "$path" && "${path##*/}" != "$required" ]] || continue
    printf '%s\n' "${path##*/}"
  done
}

ros_dashboard_apt_repository_has_package() {
  local package_name="$1" apt_cache_bin="${2:-apt-cache}"
  command -v "$apt_cache_bin" >/dev/null 2>&1 || return 1
  [[ -n "$($apt_cache_bin madison "$package_name" 2>/dev/null)" ]]
}

ros_dashboard_venv_is_isolated() {
  local venv_dir="$1"
  [[ -f "$venv_dir/pyvenv.cfg" ]] \
    && grep -Eq '^include-system-site-packages[[:space:]]*=[[:space:]]*false$' "$venv_dir/pyvenv.cfg"
}
