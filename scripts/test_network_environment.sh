#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/network_env.sh"

assert_eq() {
  local expected="$1" actual="$2" label="$3"
  [[ "$actual" == "$expected" ]] || {
    printf '%s: expected <%s>, got <%s>\n' "$label" "$expected" "$actual" >&2
    exit 1
  }
}

single_routes='default via 192.168.1.1 dev enp4s0 proto dhcp metric 100'
single_addresses='2: enp4s0 inet 192.168.1.123/24 brd 192.168.1.255 scope global enp4s0'
ros_dashboard_select_network '' "$single_routes" "$single_addresses" ''
assert_eq 192.168.1.123 "$ROS_DASHBOARD_PRIMARY_IP" 'single NIC primary'
assert_eq 192.168.1.123 "${ROS_DASHBOARD_LAN_IPS[*]}" 'single NIC SAN list'

dual_routes=$'default via 192.168.1.1 dev enp4s0 metric 100\ndefault via 192.168.0.1 dev wlan0 metric 600'
dual_addresses=$'2: enp4s0 inet 192.168.1.123/24 scope global enp4s0\n3: wlan0 inet 192.168.0.52/24 scope global wlan0\n4: docker0 inet 172.17.0.1/16 scope global docker0\n5: br-a1 inet 172.18.0.1/16 scope global br-a1\n6: virbr0 inet 192.168.122.1/24 scope global virbr0\n7: tailscale0 inet 100.64.0.5/32 scope global tailscale0'
ros_dashboard_select_network '' "$dual_routes" "$dual_addresses" ''
assert_eq 192.168.1.123 "$ROS_DASHBOARD_PRIMARY_IP" 'default route primary'
assert_eq '192.168.1.123 192.168.0.52 100.64.0.5' "${ROS_DASHBOARD_LAN_IPS[*]}" 'additional LAN IPs'

container_first_routes=$'default via 172.17.0.1 dev docker0 metric 10\ndefault via 10.1.2.1 dev ens18 metric 100'
container_first_addresses=$'2: docker0 inet 172.17.0.2/16 scope global docker0\n3: ens18 inet 10.1.2.30/24 scope global ens18'
ros_dashboard_select_network '' "$container_first_routes" "$container_first_addresses" ''
assert_eq 10.1.2.30 "$ROS_DASHBOARD_PRIMARY_IP" 'container default route excluded'

ros_dashboard_select_network '' '' '' '127.0.0.1 169.254.1.2 10.9.8.7'
assert_eq 10.9.8.7 "$ROS_DASHBOARD_PRIMARY_IP" 'hostname fallback'

ros_dashboard_select_network 100.64.0.5 "$dual_routes" "$dual_addresses" ''
assert_eq 100.64.0.5 "$ROS_DASHBOARD_PRIMARY_IP" 'explicit VPN address'
assert_eq explicit "$ROS_DASHBOARD_NETWORK_SOURCE" 'explicit source'
if ros_dashboard_select_network 10.20.30.40 "$dual_routes" "$dual_addresses" '' >/dev/null 2>&1; then
  echo 'An explicit address not assigned to the host must be rejected.' >&2
  exit 1
fi

ros_dashboard_resolve_server_names auto \
  'localhost 192.168.99.99 dashboard.robot.local' 192.168.1.123 192.168.0.52
assert_eq 'localhost 192.168.1.123 192.168.0.52 dashboard.robot.local' \
  "$ROS_DASHBOARD_SERVER_NAME" 'stale auto server IP migration'
ros_dashboard_resolve_server_names manual 'dashboard.example.test 10.0.0.8' 192.168.1.123
assert_eq 'dashboard.example.test 10.0.0.8' "$ROS_DASHBOARD_SERVER_NAME" 'manual server names'

assert_eq 'https://192.168.1.123' \
  "$(ros_dashboard_https_url 192.168.1.123 443)" 'default HTTPS URL'
assert_eq 'https://192.168.1.123:8443' \
  "$(ros_dashboard_https_url 192.168.1.123 8443)" 'custom HTTPS URL'
ros_dashboard_https_port_valid 443
ros_dashboard_https_port_valid 8443
if ros_dashboard_https_port_valid 70000; then
  echo 'An out-of-range HTTPS port must be rejected.' >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf -- "$tmp_dir"' EXIT
old_certificate="$tmp_dir/old.crt"
old_key="$tmp_dir/old.key"
marker="$tmp_dir/old.crt.managed"
openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 1 \
  -subj '/CN=localhost' \
  -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1,IP:192.168.1.123' \
  -keyout "$old_key" -out "$old_certificate" >/dev/null 2>&1
assert_eq reuse "$(ros_dashboard_certificate_plan \
  "$old_certificate" "$old_key" "$marker" localhost 127.0.0.1 192.168.1.123)" \
  'valid unmarked certificate reuse'
assert_eq custom_san_mismatch "$(ros_dashboard_certificate_plan \
  "$old_certificate" "$old_key" "$marker" localhost 127.0.0.1 192.168.1.150)" \
  'custom certificate preservation'
ros_dashboard_write_certificate_marker "$old_certificate" "$marker"
assert_eq regenerate "$(ros_dashboard_certificate_plan \
  "$old_certificate" "$old_key" "$marker" localhost 127.0.0.1 192.168.1.150)" \
  'managed certificate DHCP renewal'
replacement_certificate="$tmp_dir/replacement.crt"
replacement_key="$tmp_dir/replacement.key"
openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 1 \
  -subj '/CN=localhost' \
  -addext 'subjectAltName=DNS:localhost,IP:127.0.0.1' \
  -keyout "$replacement_key" -out "$replacement_certificate" >/dev/null 2>&1
cp "$replacement_certificate" "$old_certificate"
cp "$replacement_key" "$old_key"
assert_eq custom_san_mismatch "$(ros_dashboard_certificate_plan \
  "$old_certificate" "$old_key" "$marker" localhost 127.0.0.1 192.168.1.150)" \
  'certificate replacement invalidates managed marker'
assert_eq create "$(ros_dashboard_certificate_plan \
  "$tmp_dir/new.crt" "$tmp_dir/new.key" "$tmp_dir/new.crt.managed" localhost)" \
  'fresh certificate creation'

echo 'Installer network environment tests passed.'
