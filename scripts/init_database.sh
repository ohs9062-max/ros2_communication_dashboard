#!/usr/bin/env bash
set -euo pipefail

[[ "$EUID" -eq 0 ]] || {
  echo "[ros2_dashboard] run with sudo: sudo $0" >&2
  exit 1
}

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${DASHBOARD_BACKEND_ENV:-$PROJECT_DIR/backend/.env}"
SCHEMA_FILE="$PROJECT_DIR/backend/schema/001_alert.sql"

env_value() {
  local key="$1" default_value="$2" value
  value="$(sed -n "s/^${key}=//p" "$ENV_FILE" | tail -n 1)"
  printf '%s' "${value:-$default_value}"
}

[[ -f "$ENV_FILE" ]] || {
  echo "[ros2_dashboard] Backend environment is missing: $ENV_FILE" >&2
  exit 1
}

database="$(env_value MARIADB_DATABASE ros2_dashboard)"
db_user="$(env_value MARIADB_USER ros2_dashboard)"
db_password="$(env_value MARIADB_PASSWORD '')"

[[ "$database" =~ ^[A-Za-z0-9_]+$ ]] || {
  echo "[ros2_dashboard] Invalid MARIADB_DATABASE identifier." >&2
  exit 1
}
[[ "$db_user" =~ ^[A-Za-z0-9_]+$ ]] || {
  echo "[ros2_dashboard] Invalid MARIADB_USER identifier." >&2
  exit 1
}
[[ -n "$db_password" ]] || {
  echo "[ros2_dashboard] MARIADB_PASSWORD is empty." >&2
  exit 1
}

escaped_password="${db_password//\'/\'\'}"
mariadb --protocol=socket -uroot <<SQL
CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${db_user}'@'localhost' IDENTIFIED BY '${escaped_password}';
ALTER USER '${db_user}'@'localhost' IDENTIFIED BY '${escaped_password}';
CREATE USER IF NOT EXISTS '${db_user}'@'127.0.0.1' IDENTIFIED BY '${escaped_password}';
ALTER USER '${db_user}'@'127.0.0.1' IDENTIFIED BY '${escaped_password}';
GRANT SELECT, INSERT, UPDATE, DELETE ON \`${database}\`.* TO '${db_user}'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON \`${database}\`.* TO '${db_user}'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

mariadb --protocol=socket -uroot "$database" < "$SCHEMA_FILE"

actual_columns="$(mariadb --batch --skip-column-names --protocol=socket -uroot -e "
SELECT CONCAT(column_name, ':', column_type, ':', is_nullable)
FROM information_schema.columns
WHERE table_schema='${database}' AND table_name='alert'
ORDER BY ordinal_position;
")"
expected_columns="$(printf '%s\n' \
  'id:bigint(20):NO' \
  'alert_key:varchar(768):NO' \
  'source:varchar(64):NO' \
  'name:varchar(512):NO' \
  'code:varchar(64):NO' \
  'level:varchar(16):NO' \
  'message:text:NO' \
  'detected_at:datetime(6):NO' \
  'resolved_at:datetime(6):YES')"

if [[ "$actual_columns" != "$expected_columns" ]]; then
  echo "[ros2_dashboard] Existing alert table schema is incompatible." >&2
  echo "[ros2_dashboard] No destructive migration was attempted." >&2
  diff -u <(printf '%s\n' "$expected_columns") <(printf '%s\n' "$actual_columns") >&2 || true
  exit 1
fi

primary_columns="$(mariadb --batch --skip-column-names --protocol=socket -uroot -e "
SELECT column_name
FROM information_schema.statistics
WHERE table_schema='${database}' AND table_name='alert' AND index_name='PRIMARY'
ORDER BY seq_in_index;
")"
if [[ "$primary_columns" != id ]]; then
  echo "[ros2_dashboard] The alert table must use id as its only primary-key column." >&2
  echo "[ros2_dashboard] No destructive migration was attempted." >&2
  exit 1
fi

echo "[ros2_dashboard] MariaDB database and alert schema are ready."
