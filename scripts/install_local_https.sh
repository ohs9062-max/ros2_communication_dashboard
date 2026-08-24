#!/usr/bin/env bash
set -euo pipefail

[[ "$EUID" -eq 0 ]] || {
  echo "[ros2_dashboard] run with sudo: sudo $0" >&2
  exit 1
}

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/lib/network_env.sh"

ENV_FILE="${DASHBOARD_ENV_FILE:-$PROJECT_DIR/config/nginx/dashboard.env}"
RESOLVED_ENV="${DASHBOARD_RESOLVED_ENV_FILE:-/etc/ros2-dashboard/network.env}"

caller_local_ip_set="${DASHBOARD_LOCAL_IP+x}"
caller_local_ip="${DASHBOARD_LOCAL_IP:-}"
caller_port_set="${DASHBOARD_HTTPS_PORT+x}"
caller_port="${DASHBOARD_HTTPS_PORT:-}"
caller_server_name_set="${DASHBOARD_SERVER_NAME+x}"
caller_server_name="${DASHBOARD_SERVER_NAME:-}"
caller_server_mode_set="${DASHBOARD_SERVER_NAME_MODE+x}"
caller_server_mode="${DASHBOARD_SERVER_NAME_MODE:-}"
caller_certificate_set="${DASHBOARD_TLS_CERTIFICATE+x}"
caller_certificate="${DASHBOARD_TLS_CERTIFICATE:-}"
caller_private_key_set="${DASHBOARD_TLS_PRIVATE_KEY+x}"
caller_private_key="${DASHBOARD_TLS_PRIVATE_KEY:-}"
caller_frontend_root_set="${DASHBOARD_FRONTEND_ROOT+x}"
caller_frontend_root="${DASHBOARD_FRONTEND_ROOT:-}"
caller_backend_upstream_set="${DASHBOARD_BACKEND_UPSTREAM+x}"
caller_backend_upstream="${DASHBOARD_BACKEND_UPSTREAM:-}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi
[[ -z "$caller_local_ip_set" ]] || DASHBOARD_LOCAL_IP="$caller_local_ip"
[[ -z "$caller_port_set" ]] || DASHBOARD_HTTPS_PORT="$caller_port"
[[ -z "$caller_server_name_set" ]] || DASHBOARD_SERVER_NAME="$caller_server_name"
[[ -z "$caller_server_mode_set" ]] || DASHBOARD_SERVER_NAME_MODE="$caller_server_mode"
[[ -z "$caller_certificate_set" ]] || DASHBOARD_TLS_CERTIFICATE="$caller_certificate"
[[ -z "$caller_private_key_set" ]] || DASHBOARD_TLS_PRIVATE_KEY="$caller_private_key"
[[ -z "$caller_frontend_root_set" ]] || DASHBOARD_FRONTEND_ROOT="$caller_frontend_root"
[[ -z "$caller_backend_upstream_set" ]] || DASHBOARD_BACKEND_UPSTREAM="$caller_backend_upstream"

export DASHBOARD_HTTPS_PORT="${DASHBOARD_HTTPS_PORT:-443}"
ros_dashboard_https_port_valid "$DASHBOARD_HTTPS_PORT" || {
  echo "[ros2_dashboard] DASHBOARD_HTTPS_PORT must be an integer from 1 to 65535." >&2
  exit 1
}

ros_dashboard_detect_network "${DASHBOARD_LOCAL_IP:-}"
export DASHBOARD_LOCAL_IP="$ROS_DASHBOARD_PRIMARY_IP"
export DASHBOARD_LAN_IPS="${ROS_DASHBOARD_LAN_IPS[*]}"

server_mode="${DASHBOARD_SERVER_NAME_MODE:-}"
if [[ -z "$server_mode" && -n "$caller_server_name_set" ]]; then
  server_mode=manual
fi
server_mode="${server_mode:-auto}"
configured_server_name="${DASHBOARD_SERVER_NAME:-}"
if [[ "$server_mode" == auto && -n "$configured_server_name" ]]; then
  for configured_value in $configured_server_name; do
    if ros_dashboard_ipv4_literal "$configured_value" \
        && [[ " ${ROS_DASHBOARD_LAN_IPS[*]} " != *" $configured_value "* ]] \
        && [[ "$configured_value" != 127.0.0.1 ]]; then
      echo "[ros2_dashboard] Ignoring stale auto Nginx IP from $ENV_FILE: $configured_value" >&2
    fi
  done
fi
ros_dashboard_resolve_server_names \
  "$server_mode" "$configured_server_name" "${ROS_DASHBOARD_LAN_IPS[@]}"
export DASHBOARD_SERVER_NAME="$ROS_DASHBOARD_SERVER_NAME"
export DASHBOARD_SERVER_NAME_MODE="$ROS_DASHBOARD_SERVER_NAME_MODE"

export DASHBOARD_TLS_CERTIFICATE="${DASHBOARD_TLS_CERTIFICATE:-/etc/nginx/ssl/ros2-dashboard.crt}"
export DASHBOARD_TLS_PRIVATE_KEY="${DASHBOARD_TLS_PRIVATE_KEY:-/etc/nginx/ssl/ros2-dashboard.key}"
export DASHBOARD_FRONTEND_ROOT="${DASHBOARD_FRONTEND_ROOT:-/var/lib/ros2-dashboard/frontend}"
export DASHBOARD_BACKEND_UPSTREAM="${DASHBOARD_BACKEND_UPSTREAM:-http://127.0.0.1:8000}"
certificate_marker="${DASHBOARD_TLS_MANAGED_MARKER:-${DASHBOARD_TLS_CERTIFICATE}.managed}"
certificate_changed=false
certificate_created=false
install_completed=false
tls_backup_dir=""
tls_work_dir=""
rendered=""
previous_config=""
resolved_work=""

restore_tls_after_failure() {
  [[ "$certificate_changed" == true ]] || return 0
  if [[ "$certificate_created" == true ]]; then
    rm -f -- "$DASHBOARD_TLS_CERTIFICATE" "$DASHBOARD_TLS_PRIVATE_KEY" "$certificate_marker"
    return 0
  fi
  cp -a -- \
    "$tls_backup_dir/$(basename -- "$DASHBOARD_TLS_CERTIFICATE")" "$DASHBOARD_TLS_CERTIFICATE"
  cp -a -- \
    "$tls_backup_dir/$(basename -- "$DASHBOARD_TLS_PRIVATE_KEY")" "$DASHBOARD_TLS_PRIVATE_KEY"
  cp -a -- \
    "$tls_backup_dir/$(basename -- "$certificate_marker")" "$certificate_marker"
}

cleanup_install() {
  if [[ "$install_completed" != true ]]; then
    restore_tls_after_failure || true
  fi
  rm -rf -- "$tls_work_dir" "$rendered" "$previous_config" "$resolved_work"
}
trap cleanup_install EXIT

required_sans=(localhost 127.0.0.1 "${ROS_DASHBOARD_LAN_IPS[@]}")
for configured_value in "${ROS_DASHBOARD_SERVER_NAMES[@]}"; do
  [[ "$configured_value" == _ ]] && continue
  [[ "$configured_value" =~ ^[A-Za-z0-9*_.-]+$ ]] || continue
  ros_dashboard_array_add_unique required_sans "$configured_value"
done

certificate_plan="$(ros_dashboard_certificate_plan \
  "$DASHBOARD_TLS_CERTIFICATE" "$DASHBOARD_TLS_PRIVATE_KEY" "$certificate_marker" \
  "${required_sans[@]}")"
case "$certificate_plan" in
  incomplete)
    echo "[ros2_dashboard] TLS certificate and private key must either both exist or both be absent." >&2
    echo "[ros2_dashboard] Restore the missing file or move the incomplete pair before reinstalling." >&2
    exit 1
    ;;
  invalid_pair)
    echo "[ros2_dashboard] The existing TLS certificate and private key are invalid or do not match." >&2
    echo "[ros2_dashboard] Existing TLS files were not overwritten." >&2
    exit 1
    ;;
  custom_san_mismatch)
    echo "[ros2_dashboard] The existing user-managed TLS certificate does not cover every selected Dashboard address." >&2
    echo "[ros2_dashboard] Required SAN entries: ${required_sans[*]}" >&2
    echo "[ros2_dashboard] Replace the custom certificate or set DASHBOARD_LOCAL_IP/DASHBOARD_SERVER_NAME explicitly." >&2
    exit 1
    ;;
  create|regenerate)
    install -d -m 0755 "$(dirname -- "$DASHBOARD_TLS_CERTIFICATE")"
    install -d -m 0700 /var/backups/ros2-dashboard
    if [[ "$certificate_plan" == regenerate ]]; then
      tls_backup_dir="$(mktemp -d "/var/backups/ros2-dashboard/tls-$(date +%Y%m%d-%H%M%S).XXXXXX")"
      chmod 0700 "$tls_backup_dir"
      cp -a -- "$DASHBOARD_TLS_CERTIFICATE" "$DASHBOARD_TLS_PRIVATE_KEY" "$certificate_marker" \
        "$tls_backup_dir/"
      certificate_changed=true
      echo "[ros2_dashboard] Backed up the previous installer-managed TLS files: $tls_backup_dir" >&2
    else
      certificate_changed=true
      certificate_created=true
    fi
    tls_work_dir="$(mktemp -d)"
    san_list=""
    for configured_value in "${required_sans[@]}"; do
      if ros_dashboard_ipv4_literal "$configured_value"; then
        san_entry="IP:$configured_value"
      else
        san_entry="DNS:$configured_value"
      fi
      san_list="${san_list:+$san_list,}$san_entry"
    done
    openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 825 \
      -subj "/CN=localhost" \
      -addext "subjectAltName=$san_list" \
      -keyout "$tls_work_dir/dashboard.key" \
      -out "$tls_work_dir/dashboard.crt"
    install -m 0600 "$tls_work_dir/dashboard.key" "$DASHBOARD_TLS_PRIVATE_KEY"
    install -m 0644 "$tls_work_dir/dashboard.crt" "$DASHBOARD_TLS_CERTIFICATE"
    ros_dashboard_write_certificate_marker "$DASHBOARD_TLS_CERTIFICATE" "$certificate_marker"
    ;;
  reuse)
    ;;
  *)
    echo "[ros2_dashboard] Unknown TLS certificate plan: $certificate_plan" >&2
    exit 1
    ;;
esac
chmod 0600 "$DASHBOARD_TLS_PRIVATE_KEY"
chmod 0644 "$DASHBOARD_TLS_CERTIFICATE"

rendered="$(mktemp)"
previous_config="$(mktemp)"
resolved_work="$(mktemp)"
had_previous_config=false
if [[ -f /etc/nginx/conf.d/ros2-dashboard.conf ]]; then
  cp -a /etc/nginx/conf.d/ros2-dashboard.conf "$previous_config"
  had_previous_config=true
fi
"$SCRIPT_DIR/render_nginx_config.sh" "$rendered"
install -m 0644 "$rendered" /etc/nginx/conf.d/ros2-dashboard.conf

if ! nginx -t || ! systemctl enable --now nginx >/dev/null || ! systemctl reload nginx; then
  if [[ "$had_previous_config" == true ]]; then
    cp -a "$previous_config" /etc/nginx/conf.d/ros2-dashboard.conf
  else
    rm -f /etc/nginx/conf.d/ros2-dashboard.conf
  fi
  restore_tls_after_failure
  certificate_changed=false
  nginx -t >/dev/null 2>&1 && systemctl reload nginx >/dev/null 2>&1 || true
  echo "[ros2_dashboard] The generated Nginx configuration could not be validated or reloaded; the previous Dashboard configuration and TLS files were restored." >&2
  exit 1
fi

install -d -m 0755 "$(dirname -- "$RESOLVED_ENV")"
{
  printf 'DASHBOARD_LOCAL_IP=%q\n' "$DASHBOARD_LOCAL_IP"
  printf 'DASHBOARD_LAN_IPS=%q\n' "$DASHBOARD_LAN_IPS"
  printf 'DASHBOARD_NETWORK_SOURCE=%q\n' "$ROS_DASHBOARD_NETWORK_SOURCE"
  printf 'DASHBOARD_HTTPS_PORT=%q\n' "$DASHBOARD_HTTPS_PORT"
  printf 'DASHBOARD_SERVER_NAME_MODE=%q\n' "$DASHBOARD_SERVER_NAME_MODE"
  printf 'DASHBOARD_SERVER_NAME=%q\n' "$DASHBOARD_SERVER_NAME"
  printf 'DASHBOARD_TLS_CERTIFICATE=%q\n' "$DASHBOARD_TLS_CERTIFICATE"
  printf 'DASHBOARD_TLS_PRIVATE_KEY=%q\n' "$DASHBOARD_TLS_PRIVATE_KEY"
  printf 'DASHBOARD_TLS_MANAGED_MARKER=%q\n' "$certificate_marker"
  printf 'DASHBOARD_FRONTEND_ROOT=%q\n' "$DASHBOARD_FRONTEND_ROOT"
  printf 'DASHBOARD_BACKEND_UPSTREAM=%q\n' "$DASHBOARD_BACKEND_UPSTREAM"
} > "$resolved_work"
install -m 0644 "$resolved_work" "$RESOLVED_ENV"
install_completed=true

local_url="$(ros_dashboard_https_url localhost "$DASHBOARD_HTTPS_PORT")"
lan_url="$(ros_dashboard_https_url "$DASHBOARD_LOCAL_IP" "$DASHBOARD_HTTPS_PORT")"
echo "[ros2_dashboard] network source: $ROS_DASHBOARD_NETWORK_SOURCE"
echo "[ros2_dashboard] selected LAN IPv4: $DASHBOARD_LOCAL_IP"
echo "[ros2_dashboard] certificate LAN IPv4 entries: $DASHBOARD_LAN_IPS"
echo "[ros2_dashboard] local HTTPS: $local_url/"
echo "[ros2_dashboard] LAN HTTPS:   $lan_url/"
echo "[ros2_dashboard] frontend:    $DASHBOARD_FRONTEND_ROOT (Nginx static files)"
