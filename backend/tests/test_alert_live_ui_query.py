from __future__ import annotations

from datetime import datetime, timedelta, timezone
import os

import httpx
import pytest

from app.database.connection import MariaDbConnectionFactory
from app.settings import settings


LIVE_TEST_ENABLED = os.getenv('ALERT_TEST_LIVE') == '1'
BACKEND_URL = os.getenv('ALERT_TEST_BACKEND_URL', 'http://127.0.0.1:8012')
TEST_NAME_PREFIX = '/__alert_ui_probe__/'


@pytest.mark.skipif(not LIVE_TEST_ENABLED, reason='live Alert DB/API test not enabled')
def test_live_alert_queries_support_current_history_search_and_pages() -> None:
    factory = MariaDbConnectionFactory(
        host=settings.mariadb_host,
        port=settings.mariadb_port,
        database=settings.mariadb_database,
        user=settings.mariadb_user,
        password=settings.mariadb_password,
        connect_timeout_sec=settings.mariadb_connect_timeout_sec,
        unix_socket=settings.mariadb_unix_socket,
    )
    base_time = datetime.now(tz=timezone.utc).replace(tzinfo=None)
    rows = []
    levels = ('warning', 'error', 'critical')
    sources = ('topic', 'service', 'action', 'node')
    for index in range(55):
        name = f'{TEST_NAME_PREFIX}RobotControl_{index:02d}'
        detected_at = base_time + timedelta(microseconds=index)
        resolved_at = base_time + timedelta(seconds=1, microseconds=index)
        rows.append((
            f'{sources[index % len(sources)]}:{name}:ui_probe_{index:02d}',
            sources[index % len(sources)],
            name,
            f'ui_probe_{index:02d}',
            levels[index % len(levels)],
            f'UI query probe {index:02d}',
            detected_at,
            resolved_at,
        ))

    _delete_probe_rows(factory)
    try:
        with factory.connect() as connection:
            with connection.cursor() as cursor:
                cursor.executemany(
                    'INSERT INTO alert '
                    '(alert_key, source, name, code, level, message, detected_at, resolved_at) '
                    'VALUES (%s, %s, %s, %s, %s, %s, %s, %s)',
                    rows,
                )
            connection.commit()

        with httpx.Client(base_url=BACKEND_URL, timeout=5.0) as client:
            current = client.get('/ros/alerts').raise_for_status().json()['data']
            assert all(item['resolved_at'] is None for item in current)
            assert [item['detected_at'] for item in current] == sorted(
                (item['detected_at'] for item in current),
                reverse=True,
            )

            first = client.get(
                '/ros/alerts/history',
                params={'name': '__alert_ui_probe__', 'page': 1},
            ).raise_for_status().json()
            second = client.get(
                '/ros/alerts/history',
                params={'name': '__alert_ui_probe__', 'page': 2},
            ).raise_for_status().json()

        assert first['pagination'] == {
            'page': 1,
            'page_size': 50,
            'total': 55,
            'total_pages': 2,
            'has_previous': False,
            'has_next': True,
        }
        assert len(first['data']) == 50
        assert len(second['data']) == 5
        assert second['pagination']['has_previous'] is True
        assert second['pagination']['has_next'] is False
        assert {item['level'] for item in first['data']} == {
            'warning', 'error', 'critical',
        }
        assert all(TEST_NAME_PREFIX in item['name'] for item in first['data'])
        assert all(isinstance(item['detected_at'], float) for item in first['data'])
        assert all(isinstance(item['resolved_at'], float) for item in first['data'])
        assert [item['resolved_at'] for item in first['data']] == sorted(
            (item['resolved_at'] for item in first['data']),
            reverse=True,
        )
    finally:
        _delete_probe_rows(factory)


def _delete_probe_rows(factory: MariaDbConnectionFactory) -> None:
    with factory.connect() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                'DELETE FROM alert WHERE name LIKE %s',
                (f'{TEST_NAME_PREFIX}%',),
            )
        connection.commit()
