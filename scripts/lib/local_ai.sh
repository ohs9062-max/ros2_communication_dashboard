#!/usr/bin/env bash

ros_dashboard_ensure_local_llm_env_defaults() {
  local project_env="$1" example_env="$2" key value
  for key in LOCAL_LLM_URL LOCAL_LLM_MODEL LOCAL_LLM_TIMEOUT; do
    if grep -Eq "^[[:space:]]*${key}[[:space:]]*=" "$project_env"; then
      continue
    fi
    value="$(ros_dashboard_read_env_value "$example_env" "$key" || true)"
    [[ -n "$value" ]] || {
      echo "[ros2_dashboard] Local AI default is missing from $example_env: $key" >&2
      return 1
    }
    ros_dashboard_set_env_value "$project_env" "$key" "$value"
  done
}

ros_dashboard_local_llm_url_is_loopback() {
  [[ "${1:-}" =~ ^https?://(127\.0\.0\.1|localhost|\[::1\])(:[0-9]+)?$ ]]
}

ros_dashboard_ollama_command_ready() {
  local ollama_bin="${1:-ollama}"
  command -v "$ollama_bin" >/dev/null 2>&1 \
    && "$ollama_bin" --version >/dev/null 2>&1
}

ros_dashboard_ollama_install_needed() {
  local ollama_bin="${1:-ollama}"
  ! ros_dashboard_ollama_command_ready "$ollama_bin"
}

ros_dashboard_ollama_service_is_active() {
  local systemctl_bin="${1:-systemctl}"
  "$systemctl_bin" is-active --quiet ollama.service
}

ros_dashboard_ollama_service_is_enabled() {
  local systemctl_bin="${1:-systemctl}"
  "$systemctl_bin" is-enabled --quiet ollama.service
}

ros_dashboard_local_llm_timeout_valid() {
  [[ "${1:-}" =~ ^[0-9]+([.][0-9]+)?$ ]] \
    && awk -v value="$1" 'BEGIN { exit !(value > 0) }'
}
