#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
RUNTIME_DIR="$PROJECT_DIR/.runtime"

for name in frontend backend monitor; do
  pid_file="$RUNTIME_DIR/$name.pid"
  [[ -f "$pid_file" ]] || continue
  pid="$(tr -cd '0-9' < "$pid_file")"
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    echo "[ros2_dashboard] stopping $name (pid $pid)"
    kill -TERM "$pid"
  fi
  rm -f "$pid_file"
done
