#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/install_environment.sh"

tmp_dir="$(mktemp -d)"
trap 'rm -rf -- "$tmp_dir"' EXIT

fake_python() {
  local name="$1" version="$2"
  printf '#!/usr/bin/env bash\nprintf "%%s\\n" %q\n' "$version" > "$tmp_dir/$name"
  chmod +x "$tmp_dir/$name"
}

fake_node() {
  local name="$1" version="$2"
  printf '#!/usr/bin/env bash\nprintf "%%s\\n" %q\n' "$version" > "$tmp_dir/$name"
  chmod +x "$tmp_dir/$name"
}

fake_python python312 3.12
fake_python python311 3.11
ros_dashboard_python_runtime "$tmp_dir/python312" >/dev/null
if ros_dashboard_python_runtime "$tmp_dir/python311" >/dev/null 2>&1; then
  echo 'Python 3.11 must be rejected.' >&2
  exit 1
fi

[[ "$(ros_dashboard_node_distribution amd64)" == \
  'node-v22.23.2-linux-x64.tar.xz|d60acfe00a2932254bb0ad20e01b0d74397a0875595de719654b214f4b03f307' ]]
[[ "$(ros_dashboard_node_distribution arm64)" == \
  'node-v22.23.2-linux-arm64.tar.xz|fff4078c5def658577f92c88db7db3bc0072924bfb93fe52c1e744a54e94abb8' ]]
if ros_dashboard_node_distribution i386 >/dev/null 2>&1; then
  echo 'Unsupported Node.js architectures must be rejected.' >&2
  exit 1
fi

fake_node node2019 20.19.0
fake_node node2212 22.12.0
fake_node node2018 20.18.9
fake_node node2211 22.11.0
fake_node node24 24.1.0
ros_dashboard_node_supported "$tmp_dir/node2019"
ros_dashboard_node_supported "$tmp_dir/node2212"
ros_dashboard_node_supported "$tmp_dir/node24"
ros_dashboard_node_toolchain_ready "$tmp_dir/node2212" bash
if ros_dashboard_node_toolchain_ready "$tmp_dir/node2212" "$tmp_dir/missing-npm"; then
  echo 'A missing npm command must be rejected.' >&2
  exit 1
fi
if ros_dashboard_node_supported "$tmp_dir/node2018"; then
  echo 'Node.js 20.18 must be rejected.' >&2
  exit 1
fi
if ros_dashboard_node_supported "$tmp_dir/node2211"; then
  echo 'Node.js 22.11 must be rejected.' >&2
  exit 1
fi

mkdir -p "$tmp_dir/ros/humble" "$tmp_dir/ros/jazzy" "$tmp_dir/ros/rolling"
mapfile -t other_distros < <(ros_dashboard_other_ros_distros "$tmp_dir/ros" jazzy)
[[ "${other_distros[*]}" == 'humble rolling' ]]

cat > "$tmp_dir/apt-cache-with-jazzy" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' 'ros-jazzy-ros-base | 0.11.0-1noble | http://packages.ros.org/ros2/ubuntu noble/main amd64 Packages'
EOF
cat > "$tmp_dir/apt-cache-without-jazzy" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "$tmp_dir/apt-cache-with-jazzy" "$tmp_dir/apt-cache-without-jazzy"
ros_dashboard_apt_repository_has_package ros-jazzy-ros-base "$tmp_dir/apt-cache-with-jazzy"
if ros_dashboard_apt_repository_has_package ros-jazzy-ros-base "$tmp_dir/apt-cache-without-jazzy"; then
  echo 'A repository without Jazzy packages must be rejected.' >&2
  exit 1
fi

mkdir -p "$tmp_dir/isolated-venv" "$tmp_dir/system-venv"
printf '%s\n' 'include-system-site-packages = false' > "$tmp_dir/isolated-venv/pyvenv.cfg"
printf '%s\n' 'include-system-site-packages = true' > "$tmp_dir/system-venv/pyvenv.cfg"
ros_dashboard_venv_is_isolated "$tmp_dir/isolated-venv"
if ros_dashboard_venv_is_isolated "$tmp_dir/system-venv"; then
  echo 'A venv with system site packages must be rejected.' >&2
  exit 1
fi

echo 'Installer environment tests passed.'
