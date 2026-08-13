#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
RUNTIME_DIR="$PROJECT_DIR/.runtime"

for name in frontend backend monitor; do
  pid_file="$RUNTIME_DIR/$name.pid"
  pgid_file="$RUNTIME_DIR/$name.pgid"
  pid=""
  pgid=""
  [[ -f "$pid_file" ]] && pid="$(tr -cd '0-9' < "$pid_file")"
  [[ -f "$pgid_file" ]] && pgid="$(tr -cd '0-9' < "$pgid_file")"

  if [[ "$pgid" =~ ^[0-9]+$ ]] && (( pgid > 1 )) \
      && kill -0 -- "-$pgid" 2>/dev/null; then
    echo "[ros2_dashboard] stopping $name process group (pgid $pgid)"
    kill -TERM -- "-$pgid"
  elif [[ "$pid" =~ ^[0-9]+$ ]] && (( pid > 1 )) \
      && kill -0 "$pid" 2>/dev/null; then
    echo "[ros2_dashboard] stopping $name (pid $pid)"
    kill -TERM "$pid"
  fi
  rm -f "$pid_file" "$pgid_file"
done
