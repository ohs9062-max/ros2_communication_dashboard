from __future__ import annotations

import os

import pytest

from app.database.alert_repository import MariaDbAlertRepository
from app.database.connection import MariaDbConnectionFactory


SOCKET = os.getenv('ALERT_TEST_MARIADB_SOCKET')


@pytest.mark.skipif(not SOCKET, reason='isolated MariaDB socket not configured')
def test_exact_alert_table_lifecycle_search_and_pagination() -> None:
    factory = MariaDbConnectionFactory(
        host='127.0.0.1',
        port=3306,
        database='ros2_dashboard',
        user='root',
        password='',
        unix_socket=SOCKET,
    )
    repository = MariaDbAlertRepository(factory)
    repository.ping()
    with factory.connect() as connection:
        with connection.cursor() as cursor:
            cursor.execute('DELETE FROM alert')
        connection.commit()

    codes = [
        ('topic', 'waiting_publisher', 'warning'),
        ('topic', 'topic_message_missing', 'warning'),
        ('topic', 'topic_stale', 'warning'),
        ('topic', 'topic_disconnected', 'error'),
        ('monitor_status', 'monitor_status_warning', 'warning'),
        ('monitor_status', 'monitor_status_error', 'error'),
        ('monitor_status', 'monitor_status_critical', 'critical'),
        ('service', 'service_call_timeout', 'warning'),
        ('service', 'service_call_failed', 'error'),
        ('service', 'service_disconnected', 'error'),
        ('action', 'action_disconnected', 'error'),
        ('action', 'action_goal_aborted', 'error'),
        ('action', 'action_goal_canceled', 'warning'),
        ('action', 'action_goal_rejected', 'warning'),
        ('action', 'action_goal_send_failed', 'error'),
        ('action', 'action_result_timeout', 'warning'),
        ('action', 'action_result_unavailable', 'error'),
        ('node', 'node_stale', 'error'),
    ]
    first_occurrence = [
        _alert(source, code, level, index, detected_at=1000.0)
        for index, (source, code, level) in enumerate(codes)
    ]

    repository.synchronize(first_occurrence, [], observed_at=1000.0)
    repository.synchronize(first_occurrence, [], observed_at=1001.0)
    assert len(repository.list_active()) == 18
    assert _row_count(factory) == 18
    assert {item.level for item in repository.list_active()} == {
        'warning', 'error', 'critical',
    }
    assert {item.source for item in repository.list_active()} == {
        'topic', 'monitor_status', 'service', 'action', 'node',
    }

    resolved = [
        {**item, 'alert_state': 'resolved', 'active': False, 'resolved_at': 1100.5}
        for item in first_occurrence
    ]
    repository.synchronize([], resolved, observed_at=1101.0)
    assert repository.list_active() == []
    assert repository.list_resolved(name='', page=1, page_size=50).total == 18
    assert all(
        item.resolved_at == 1100.5
        for item in repository.list_resolved(name='', page=1, page_size=50).items
    )

    recurrence = [{**item, 'detected_at': 1200.0} for item in first_occurrence]
    repository.synchronize(recurrence, [], observed_at=1200.0)
    assert _row_count(factory) == 36
    assert len(repository.list_active()) == 18

    page_items = [
        _alert('topic', f'page_code_{index:02d}', 'warning', index + 100, detected_at=1300.0 + index)
        for index in range(55)
    ]
    repository.synchronize(page_items, [], observed_at=1300.0)
    repository.synchronize([], [], observed_at=1400.0)
    first_page = repository.list_resolved(
        name='/__alert_e2e__/page_', page=1, page_size=50,
    )
    second_page = repository.list_resolved(
        name='/__alert_e2e__/page_', page=2, page_size=50,
    )
    assert first_page.total == 55
    assert len(first_page.items) == 50
    assert len(second_page.items) == 5
    assert first_page.items[0].resolved_at == 1400.0


def _alert(
    source: str,
    code: str,
    level: str,
    index: int,
    *,
    detected_at: float,
) -> dict[str, object]:
    name = f'/__alert_e2e__/{code}_{index}'
    return {
        'id': f'{source}:{name}:{code}',
        'source': source,
        'name': name,
        'code': code,
        'level': level,
        'message': f'{code} integration message',
        'detected_at': detected_at,
    }


def _row_count(factory: MariaDbConnectionFactory) -> int:
    with factory.connect() as connection:
        with connection.cursor() as cursor:
            cursor.execute('SELECT COUNT(*) AS total FROM alert')
            return int(cursor.fetchone()['total'])
