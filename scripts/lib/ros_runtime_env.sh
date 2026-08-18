#!/usr/bin/env bash

ros_dashboard_read_env_value() {
  local file="$1" key="$2" value
  [[ -f "$file" ]] || return 1
  value="$(sed -n -E "s/^[[:space:]]*${key}[[:space:]]*=[[:space:]]*(.*)$/\\1/p" "$file" | tail -n 1)"
  value="${value%$'\r'}"
  if [[ "$value" == \"*\" && "$value" == *\" ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
    value="${value:1:${#value}-2}"
  fi
  [[ -n "$value" ]] || return 1
  printf '%s' "$value"
}

ros_dashboard_set_env_value() {
  local file="$1" key="$2" value="$3" escaped
  escaped="${value//&/\\&}"
  if grep -q "^${key}=" "$file"; then
    sed -i "s|^${key}=.*|${key}=${escaped}|" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

ros_dashboard_migrate_runtime_env() {
  local project_env="$1" runtime_env="$2" key value
  [[ -f "$project_env" && -f "$runtime_env" ]] || return 0
  for key in ROS_DOMAIN_ID RMW_IMPLEMENTATION; do
    if ! ros_dashboard_read_env_value "$project_env" "$key" >/dev/null; then
      value="$(ros_dashboard_read_env_value "$runtime_env" "$key" || true)"
      if [[ -n "$value" ]]; then
        ros_dashboard_set_env_value "$project_env" "$key" "$value"
      fi
    fi
  done
}

ros_dashboard_resolve_runtime_env() {
  local project_env="$1" allow_install_override="${2:-false}" project_domain="" project_rmw=""
  project_domain="$(ros_dashboard_read_env_value "$project_env" ROS_DOMAIN_ID || true)"
  project_rmw="$(ros_dashboard_read_env_value "$project_env" RMW_IMPLEMENTATION || true)"

  if [[ "$allow_install_override" == true ]]; then
    ROS_DASHBOARD_DOMAIN_ID="${ROS2_DASHBOARD_ROS_DOMAIN_ID:-${project_domain:-${ROS_DOMAIN_ID:-0}}}"
    ROS_DASHBOARD_RMW_IMPLEMENTATION="${ROS2_DASHBOARD_RMW_IMPLEMENTATION:-${project_rmw:-${RMW_IMPLEMENTATION:-rmw_fastrtps_cpp}}}"
  else
    ROS_DASHBOARD_DOMAIN_ID="${project_domain:-${ROS_DOMAIN_ID:-0}}"
    ROS_DASHBOARD_RMW_IMPLEMENTATION="${project_rmw:-${RMW_IMPLEMENTATION:-rmw_fastrtps_cpp}}"
  fi

  if [[ ! "$ROS_DASHBOARD_DOMAIN_ID" =~ ^[0-9]+$ \
      || ${#ROS_DASHBOARD_DOMAIN_ID} -gt 3 ]] \
      || (( 10#$ROS_DASHBOARD_DOMAIN_ID > 232 )); then
    echo "[ros2_dashboard] ROS_DOMAIN_ID must be an integer from 0 to 232." >&2
    return 1
  fi
  if [[ ! "$ROS_DASHBOARD_RMW_IMPLEMENTATION" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    echo "[ros2_dashboard] RMW_IMPLEMENTATION must be a valid implementation identifier." >&2
    return 1
  fi
}
