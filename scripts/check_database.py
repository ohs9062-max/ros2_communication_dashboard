#!/usr/bin/env python3
"""Verify the configured Alert database without printing credentials."""

from __future__ import annotations

import os
from pathlib import Path
import sys


PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = PROJECT_ROOT / 'backend'
sys.path.insert(0, str(BACKEND_ROOT))
os.chdir(BACKEND_ROOT)

from app.database.connection import MariaDbConnectionFactory  # noqa: E402
from app.settings import settings  # noqa: E402


EXPECTED_COLUMNS = [
    ('id', 'bigint(20)', 'NO'),
    ('alert_key', 'varchar(768)', 'NO'),
    ('source', 'varchar(64)', 'NO'),
    ('name', 'varchar(512)', 'NO'),
    ('code', 'varchar(64)', 'NO'),
    ('level', 'varchar(16)', 'NO'),
    ('message', 'text', 'NO'),
    ('detected_at', 'datetime(6)', 'NO'),
    ('resolved_at', 'datetime(6)', 'YES'),
]


def main() -> int:
    if not settings.alert_db_enabled:
        print('disabled')
        return 0
    if not settings.mariadb_password:
        print(
            'unavailable: MARIADB_PASSWORD is empty in backend/.env',
            file=sys.stderr,
        )
        return 1
    factory = MariaDbConnectionFactory(
        host=settings.mariadb_host,
        port=settings.mariadb_port,
        database=settings.mariadb_database,
        user=settings.mariadb_user,
        password=settings.mariadb_password,
        connect_timeout_sec=settings.mariadb_connect_timeout_sec,
        unix_socket=settings.mariadb_unix_socket,
    )
    try:
        connection = factory.connect()
        with connection.cursor() as cursor:
            cursor.execute('SELECT COUNT(*) AS row_count FROM alert')
            row_count = int(cursor.fetchone()['row_count'])
            cursor.execute(
                'SELECT column_name, column_type, is_nullable '
                'FROM information_schema.columns '
                'WHERE table_schema=%s AND table_name=%s '
                'ORDER BY ordinal_position',
                (settings.mariadb_database, 'alert'),
            )
            columns = [
                (row['column_name'], row['column_type'], row['is_nullable'])
                for row in cursor.fetchall()
            ]
            cursor.execute(
                'SELECT column_name FROM information_schema.statistics '
                'WHERE table_schema=%s AND table_name=%s AND index_name=%s '
                'ORDER BY seq_in_index',
                (settings.mariadb_database, 'alert', 'PRIMARY'),
            )
            primary_columns = [row['column_name'] for row in cursor.fetchall()]
        connection.close()
    except Exception as exc:
        print(f'unavailable: MariaDB connection failed: {exc}', file=sys.stderr)
        return 1
    if columns != EXPECTED_COLUMNS or primary_columns != ['id']:
        print('connected, but the alert schema is incompatible', file=sys.stderr)
        return 1
    print(f'connected, schema valid (alert rows: {row_count})')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
