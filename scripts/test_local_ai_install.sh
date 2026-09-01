#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/ros_runtime_env.sh"
source "$SCRIPT_DIR/lib/local_ai.sh"

tmp_dir="$(mktemp -d)"
trap 'rm -rf -- "$tmp_dir"' EXIT

cp "$SCRIPT_DIR/../backend/.env.example" "$tmp_dir/example.env"
expected_url="$(ros_dashboard_read_env_value "$tmp_dir/example.env" LOCAL_LLM_URL)"
expected_model="$(ros_dashboard_read_env_value "$tmp_dir/example.env" LOCAL_LLM_MODEL)"
expected_timeout="$(ros_dashboard_read_env_value "$tmp_dir/example.env" LOCAL_LLM_TIMEOUT)"
printf '%s\n' 'LOCAL_LLM_MODEL=existing-model' > "$tmp_dir/project.env"
ros_dashboard_ensure_local_llm_env_defaults "$tmp_dir/project.env" "$tmp_dir/example.env"
[[ "$(ros_dashboard_read_env_value "$tmp_dir/project.env" LOCAL_LLM_MODEL)" == existing-model ]]
[[ "$(ros_dashboard_read_env_value "$tmp_dir/project.env" LOCAL_LLM_URL)" == "$expected_url" ]]
[[ "$(ros_dashboard_read_env_value "$tmp_dir/project.env" LOCAL_LLM_TIMEOUT)" == "$expected_timeout" ]]

ros_dashboard_local_llm_url_is_loopback http://127.0.0.1:11434
ros_dashboard_local_llm_url_is_loopback http://localhost:11434
if ros_dashboard_local_llm_url_is_loopback http://192.0.2.10:11434; then
  echo 'A non-loopback Local LLM URL must not be managed as the local Ollama service.' >&2
  exit 1
fi

fake_ollama="$tmp_dir/ollama"
printf '#!/usr/bin/env bash\n[[ "$1" == --version ]]\n' > "$fake_ollama"
chmod +x "$fake_ollama"
ros_dashboard_ollama_command_ready "$fake_ollama"
if ros_dashboard_ollama_command_ready "$tmp_dir/missing-ollama"; then
  echo 'A missing Ollama command must not be considered installed.' >&2
  exit 1
fi

fake_systemctl="$tmp_dir/systemctl"
printf '#!/usr/bin/env bash\n[[ "$1" == cat && "$2" == ollama.service ]]\n' > "$fake_systemctl"
chmod +x "$fake_systemctl"
if ros_dashboard_ollama_install_needed "$fake_ollama"; then
  echo 'A working Ollama command and service must skip installation.' >&2
  exit 1
fi
ros_dashboard_ollama_install_needed "$tmp_dir/missing-ollama"

printf '#!/usr/bin/env bash\nexit 1\n' > "$fake_systemctl"
chmod +x "$fake_systemctl"
if ros_dashboard_ollama_install_needed "$fake_ollama"; then
  echo 'An executable Ollama command must not be reinstalled when its service is unavailable.' >&2
  exit 1
fi

printf '#!/usr/bin/env bash\n[[ "$1" == is-active && "$2" == --quiet && "$3" == ollama.service ]]\n' > "$fake_systemctl"
chmod +x "$fake_systemctl"
ros_dashboard_ollama_service_is_active "$fake_systemctl"
if ros_dashboard_ollama_service_is_enabled "$fake_systemctl"; then
  echo 'An inactive or disabled Ollama service must not be treated as enabled.' >&2
  exit 1
fi

printf '#!/usr/bin/env bash\n[[ "$1" == is-enabled && "$2" == --quiet && "$3" == ollama.service ]]\n' > "$fake_systemctl"
chmod +x "$fake_systemctl"
ros_dashboard_ollama_service_is_enabled "$fake_systemctl"
if ros_dashboard_ollama_service_is_active "$fake_systemctl"; then
  echo 'An inactive Ollama service must not be treated as active.' >&2
  exit 1
fi

tags="$(jq -nc --arg model "$expected_model" '{models: [{name: "other:latest"}, {model: $model}]}')"
ros_dashboard_ollama_model_in_tags "$expected_model" "$tags"
if ros_dashboard_ollama_model_in_tags missing-model "$tags"; then
  echo 'An absent Ollama model must not be considered downloaded.' >&2
  exit 1
fi

fake_pull="$tmp_dir/pull-ollama"
pull_record="$tmp_dir/pull-record"
printf '#!/usr/bin/env bash\nprintf "%%s|%%s|%%s\\n" "$OLLAMA_HOST" "$1" "$2" > "$PULL_RECORD"\necho "pulling 50%%"\n' > "$fake_pull"
chmod +x "$fake_pull"
export PULL_RECORD="$pull_record"
ros_dashboard_ollama_pull_model http://127.0.0.1:11434 "$expected_model" "$fake_pull" \
  > "$tmp_dir/pull-output"
unset PULL_RECORD
[[ "$(<"$pull_record")" == "http://127.0.0.1:11434|pull|$expected_model" ]]
grep -qx 'pulling 50%' "$tmp_dir/pull-output"
grep -Fq 'ros_dashboard_ollama_pull_model "$local_llm_url" "$local_llm_model" ollama >&3' \
  "$SCRIPT_DIR/install.sh"

ros_dashboard_local_llm_timeout_valid 120
ros_dashboard_local_llm_timeout_valid 0.5
if ros_dashboard_local_llm_timeout_valid 0; then
  echo 'A zero Local LLM timeout must be rejected.' >&2
  exit 1
fi

echo 'Local AI installer helper tests passed.'
