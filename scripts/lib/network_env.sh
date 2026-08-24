#!/usr/bin/env bash

ros_dashboard_ipv4_literal() {
  local value="${1:-}" octet
  local -a parts
  [[ "$value" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || return 1
  IFS=. read -r -a parts <<< "$value"
  (( ${#parts[@]} == 4 )) || return 1
  for octet in "${parts[@]}"; do
    [[ "$octet" =~ ^[0-9]+$ ]] || return 1
    (( 10#$octet <= 255 )) || return 1
  done
}

ros_dashboard_ipv4_valid() {
  local value="${1:-}" first
  ros_dashboard_ipv4_literal "$value" || return 1
  first="${value%%.*}"
  (( 10#$first > 0 && 10#$first < 224 )) || return 1
  [[ "$value" != 127.* && "$value" != 169.254.* && "$value" != 0.0.0.0 ]] || return 1
}

ros_dashboard_auto_interface_allowed() {
  local interface_name="${1%%@*}"
  case "$interface_name" in
    lo|docker*|br-*|virbr*|veth*|podman*|cni*|flannel*|kube*|lxc*|incus*)
      return 1
      ;;
  esac
}

ros_dashboard_array_add_unique() {
  local array_name="$1" value="$2" existing
  local -n target="$array_name"
  for existing in "${target[@]:-}"; do
    [[ "$existing" == "$value" ]] && return 0
  done
  target+=("$value")
}

ros_dashboard_select_network() {
  local explicit_ip="${1:-}" route_output="${2:-}" address_output="${3:-}"
  local fallback_output="${4:-}" index interface family cidr remainder ip route_line token
  local default_interface="" assigned=false
  local -a address_pairs=() allowed_ips=() fallback_ips=() route_tokens=()

  ROS_DASHBOARD_PRIMARY_IP=""
  ROS_DASHBOARD_NETWORK_SOURCE=""
  ROS_DASHBOARD_LAN_IPS=()

  while read -r index interface family cidr remainder; do
    [[ "$family" == inet ]] || continue
    interface="${interface%%@*}"
    ip="${cidr%%/*}"
    ros_dashboard_ipv4_valid "$ip" || continue
    ros_dashboard_array_add_unique address_pairs "$interface|$ip"
    if ros_dashboard_auto_interface_allowed "$interface"; then
      ros_dashboard_array_add_unique allowed_ips "$ip"
    fi
  done <<< "$address_output"

  if [[ -n "$explicit_ip" ]]; then
    ros_dashboard_ipv4_valid "$explicit_ip" || {
      echo "[ros2_dashboard] DASHBOARD_LOCAL_IP is not a usable IPv4 address: $explicit_ip" >&2
      return 1
    }
    if (( ${#address_pairs[@]} > 0 )); then
      for token in "${address_pairs[@]}"; do
        [[ "${token#*|}" == "$explicit_ip" ]] && assigned=true
      done
      [[ "$assigned" == true ]] || {
        echo "[ros2_dashboard] DASHBOARD_LOCAL_IP is not assigned to an active local interface: $explicit_ip" >&2
        return 1
      }
    fi
    ROS_DASHBOARD_PRIMARY_IP="$explicit_ip"
  else
    while IFS= read -r route_line; do
      [[ "$route_line" == default\ * ]] || continue
      read -r -a route_tokens <<< "$route_line"
      default_interface=""
      for ((index = 0; index < ${#route_tokens[@]} - 1; index++)); do
        if [[ "${route_tokens[index]}" == dev ]]; then
          default_interface="${route_tokens[index + 1]%%@*}"
          break
        fi
      done
      [[ -n "$default_interface" ]] || continue
      ros_dashboard_auto_interface_allowed "$default_interface" || continue
      for token in "${address_pairs[@]}"; do
        if [[ "${token%%|*}" == "$default_interface" ]]; then
          ROS_DASHBOARD_PRIMARY_IP="${token#*|}"
          break 2
        fi
      done
    done <<< "$route_output"

    if [[ -z "${ROS_DASHBOARD_PRIMARY_IP:-}" && ${#allowed_ips[@]} -gt 0 ]]; then
      ROS_DASHBOARD_PRIMARY_IP="${allowed_ips[0]}"
      ROS_DASHBOARD_NETWORK_SOURCE=active_interface
    fi
    if [[ -z "${ROS_DASHBOARD_PRIMARY_IP:-}" ]]; then
      for ip in $fallback_output; do
        ros_dashboard_ipv4_valid "$ip" || continue
        ros_dashboard_array_add_unique fallback_ips "$ip"
      done
      if (( ${#fallback_ips[@]} > 0 )); then
        ROS_DASHBOARD_PRIMARY_IP="${fallback_ips[0]}"
        allowed_ips=("${fallback_ips[@]}")
        ROS_DASHBOARD_NETWORK_SOURCE=hostname_fallback
      fi
    fi
  fi

  [[ -n "${ROS_DASHBOARD_PRIMARY_IP:-}" ]] || {
    echo "[ros2_dashboard] No usable LAN IPv4 address was detected; set DASHBOARD_LOCAL_IP." >&2
    return 1
  }
  ROS_DASHBOARD_NETWORK_SOURCE="${ROS_DASHBOARD_NETWORK_SOURCE:-$([[ -n "$explicit_ip" ]] && echo explicit || echo default_route)}"
  ROS_DASHBOARD_LAN_IPS=("$ROS_DASHBOARD_PRIMARY_IP")
  for ip in "${allowed_ips[@]}"; do
    ros_dashboard_array_add_unique ROS_DASHBOARD_LAN_IPS "$ip"
  done
}

ros_dashboard_detect_network() {
  local explicit_ip="${1:-}" route_output="" address_output="" fallback_output=""
  if command -v ip >/dev/null 2>&1; then
    route_output="$(ip -4 route show default 2>/dev/null || true)"
    address_output="$(ip -o -4 addr show up scope global 2>/dev/null || true)"
  fi
  fallback_output="$(hostname -I 2>/dev/null || true)"
  ROS_DASHBOARD_PRIMARY_IP=""
  ROS_DASHBOARD_NETWORK_SOURCE=""
  ROS_DASHBOARD_LAN_IPS=()
  ros_dashboard_select_network "$explicit_ip" "$route_output" "$address_output" "$fallback_output"
}

ros_dashboard_resolve_server_names() {
  local mode="${1:-auto}" configured="${2:-}" value ip
  shift 2 || true
  local -a ips=("$@") names=()
  case "$mode" in
    manual)
      [[ -n "$configured" ]] || {
        echo "[ros2_dashboard] DASHBOARD_SERVER_NAME_MODE=manual requires DASHBOARD_SERVER_NAME." >&2
        return 1
      }
      read -r -a names <<< "$configured"
      ;;
    auto|'')
      names=(localhost)
      for ip in "${ips[@]}"; do
        ros_dashboard_array_add_unique names "$ip"
      done
      for value in $configured; do
        [[ "$value" == localhost ]] && continue
        if ros_dashboard_ipv4_literal "$value"; then
          continue
        fi
        [[ "$value" =~ ^[A-Za-z0-9*_.-]+$ && "$value" != _ ]] || continue
        ros_dashboard_array_add_unique names "$value"
      done
      mode=auto
      ;;
    *)
      echo "[ros2_dashboard] DASHBOARD_SERVER_NAME_MODE must be auto or manual." >&2
      return 1
      ;;
  esac
  ROS_DASHBOARD_SERVER_NAME_MODE="$mode"
  ROS_DASHBOARD_SERVER_NAMES=("${names[@]}")
  ROS_DASHBOARD_SERVER_NAME="${names[*]}"
}

ros_dashboard_https_url() {
  local host="$1" port="${2:-443}"
  if [[ "$port" == 443 ]]; then
    printf 'https://%s' "$host"
  else
    printf 'https://%s:%s' "$host" "$port"
  fi
}

ros_dashboard_https_port_valid() {
  local port="${1:-}"
  [[ "$port" =~ ^[0-9]+$ ]] && (( 10#$port > 0 && 10#$port <= 65535 ))
}

ros_dashboard_certificate_fingerprint() {
  openssl x509 -in "$1" -noout -fingerprint -sha256 2>/dev/null \
    | sed -n 's/^sha256 Fingerprint=//Ip' | tr -d ':' | tr '[:upper:]' '[:lower:]'
}

ros_dashboard_certificate_is_managed() {
  local certificate="$1" marker="$2" expected actual
  [[ -f "$certificate" && -f "$marker" ]] || return 1
  expected="$(sed -n 's/^certificate_sha256=//p' "$marker" | tail -n 1)"
  actual="$(ros_dashboard_certificate_fingerprint "$certificate")"
  [[ -n "$expected" && "$expected" == "$actual" ]]
}

ros_dashboard_write_certificate_marker() {
  local certificate="$1" marker="$2" fingerprint
  fingerprint="$(ros_dashboard_certificate_fingerprint "$certificate")"
  [[ -n "$fingerprint" ]] || return 1
  printf 'owner=ros2-dashboard-installer-v1\ncertificate_sha256=%s\n' "$fingerprint" > "$marker"
  chmod 0644 "$marker"
}

ros_dashboard_certificate_has_sans() {
  local certificate="$1" value
  shift
  [[ -f "$certificate" ]] || return 1
  for value in "$@"; do
    if ros_dashboard_ipv4_literal "$value"; then
      openssl x509 -in "$certificate" -noout -checkip "$value" 2>/dev/null \
        | grep -Fq ' does match certificate' || return 1
    else
      openssl x509 -in "$certificate" -noout -checkhost "$value" 2>/dev/null \
        | grep -Fq ' does match certificate' || return 1
    fi
  done
}

ros_dashboard_certificate_key_matches() {
  local certificate="$1" private_key="$2" certificate_hash key_hash
  certificate_hash="$(openssl x509 -in "$certificate" -pubkey -noout 2>/dev/null \
    | openssl pkey -pubin -outform DER 2>/dev/null | sha256sum | cut -d' ' -f1)"
  key_hash="$(openssl pkey -in "$private_key" -pubout -outform DER 2>/dev/null \
    | sha256sum | cut -d' ' -f1)"
  [[ -n "$certificate_hash" && "$certificate_hash" == "$key_hash" ]]
}

ros_dashboard_certificate_plan() {
  local certificate="$1" private_key="$2" marker="$3"
  shift 3
  if [[ ! -e "$certificate" && ! -e "$private_key" ]]; then
    printf 'create\n'
    return 0
  fi
  if [[ ! -f "$certificate" || ! -f "$private_key" ]]; then
    printf 'incomplete\n'
    return 0
  fi
  if ! ros_dashboard_certificate_key_matches "$certificate" "$private_key"; then
    printf 'invalid_pair\n'
    return 0
  fi
  if ros_dashboard_certificate_has_sans "$certificate" "$@"; then
    printf 'reuse\n'
  elif ros_dashboard_certificate_is_managed "$certificate" "$marker"; then
    printf 'regenerate\n'
  else
    printf 'custom_san_mismatch\n'
  fi
}

ros_dashboard_websocket_check() {
  local url="$1" headers curl_status=0
  headers="$(mktemp)"
  curl --silent --insecure --http1.1 --max-time 2 --noproxy '*' \
    --dump-header "$headers" --output /dev/null \
    -H 'Connection: Upgrade' \
    -H 'Upgrade: websocket' \
    -H 'Sec-WebSocket-Version: 13' \
    -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' \
    "$url" || curl_status=$?
  if grep -Eq '^HTTP/[0-9.]+ 101([[:space:]]|$)' "$headers"; then
    rm -f -- "$headers"
    return 0
  fi
  rm -f -- "$headers"
  (( curl_status != 0 )) || curl_status=1
  return "$curl_status"
}
