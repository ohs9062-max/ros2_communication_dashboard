from __future__ import annotations

from dataclasses import replace
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from app.alerts.service import AlertHistoryService
from app.database.alert_repository import (
    ALERT_DB_TIMEZONE,
    MariaDbAlertRepository,
    _to_db_datetime,
    _to_timestamp,
)
from app.database.models import AlertPage, StoredAlert


EXPECTED_ALERT_CODES = {
    'waiting_publisher',
    'topic_message_missing',
    'topic_stale',
    'topic_disconnected',
    'monitor_status_warning',
    'monitor_status_error',
    'monitor_status_critical',
    'service_call_timeout',
    'service_call_failed',
    'service_disconnected',
    'action_disconnected',
    'action_goal_aborted',
    'action_goal_canceled',
    'action_goal_rejected',
    'action_goal_send_failed',
    'action_result_timeout',
    'action_result_unavailable',
    'node_stale',
}


class MemoryAlertRepository:
    def __init__(self) -> None:
        self.records: list[StoredAlert] = []

    def ping(self) -> None:
        return None

    def synchronize(
        self,
        active_alerts: list[dict[str, Any]],
        resolved_alerts: list[dict[str, Any]],
        *,
        observed_at: float,
    ) -> None:
        active_by_key = {item['id']: item for item in active_alerts}
        resolved_by_key = {item['id']: item for item in resolved_alerts}
        for index, record in enumerate(self.records):
            if record.resolved_at is not None or record.alert_key in active_by_key:
                continue
            resolved = resolved_by_key.get(record.alert_key, {})
            resolved_at = resolved.get('resolved_at', observed_at)
            self.records[index] = replace(record, resolved_at=float(resolved_at))

        open_keys = {
            record.alert_key for record in self.records
            if record.resolved_at is None
        }
        for alert_key, item in active_by_key.items():
            if alert_key in open_keys:
                continue
            detected_at = item.get('first_detected_at', item.get('detected_at', observed_at))
            self.records.append(StoredAlert(
                alert_key=alert_key,
                source=item['source'],
                name=item['name'],
                code=item['code'],
                level=item['level'],
                message=item['message'],
                detected_at=float(detected_at),
                resolved_at=None,
            ))

    def list_active(self) -> list[StoredAlert]:
        return sorted(
            (record for record in self.records if record.resolved_at is None),
            key=lambda record: record.detected_at,
            reverse=True,
        )

    def list_resolved(self, *, name: str, page: int, page_size: int) -> AlertPage:
        records = [
            record for record in self.records
            if record.resolved_at is not None
            and name.casefold() in record.name.casefold()
        ]
        records.sort(key=lambda record: record.resolved_at or 0, reverse=True)
        offset = (page - 1) * page_size
        return AlertPage(records[offset:offset + page_size], page, page_size, len(records))

    def delete_resolved(self) -> int:
        before = len(self.records)
        self.records = [record for record in self.records if record.resolved_at is None]
        return before - len(self.records)


def alert(
    code: str = 'topic_stale',
    *,
    source: str = 'topic',
    name: str = '/scan',
    level: str = 'warning',
    detected_at: float = 100.0,
) -> dict[str, Any]:
    return {
        'id': f'{source}:{name}:{code}',
        'source': source,
        'name': name,
        'code': code,
        'level': level,
        'message': f'{code} message',
        'detected_at': detected_at,
    }


def test_first_detection_deduplicates_resolves_and_reoccurs() -> None:
    repository = MemoryAlertRepository()
    service = AlertHistoryService(repository)
    item = {**alert(), 'status': 'stale', 'age_sec': 4.5}

    service.consume({'data': [item], 'meta': {'count': 1}})
    current = service.snapshot()['data'][0]
    assert current['status'] == 'stale'
    assert current['age_sec'] == 4.5
    service.consume({'data': [{**item, 'detected_at': 101.0}], 'meta': {'count': 1}})
    assert len(repository.records) == 1
    assert repository.records[0].resolved_at is None
    assert repository.records[0].detected_at == 100.0

    service.consume({'data': [], 'meta': {'count': 0}})
    assert repository.records[0].resolved_at is not None

    service.consume({'data': [{**item, 'detected_at': 200.0}], 'meta': {'count': 1}})
    assert len(repository.records) == 2
    assert repository.records[1].resolved_at is None
    assert repository.records[1].detected_at == 200.0


def test_explicit_resolved_timestamp_is_preserved() -> None:
    repository = MemoryAlertRepository()
    service = AlertHistoryService(repository)
    item = alert()
    service.consume({'data': [item], 'meta': {'count': 1}})
    service.consume({
        'data': [{
            **item,
            'active': False,
            'alert_state': 'resolved',
            'resolved_at': 123.5,
        }],
        'meta': {'count': 0},
    })
    assert repository.records[0].resolved_at == 123.5


def test_all_18_codes_and_levels_use_common_persistence_path() -> None:
    source_by_code = {}
    for code in EXPECTED_ALERT_CODES:
        source = code.split('_', 1)[0]
        if code == 'waiting_publisher':
            source = 'topic'
        elif code.startswith('monitor_status_'):
            source = 'monitor_status'
        source_by_code[code] = source
    levels = {'warning', 'error', 'critical'}
    items = [
        alert(
            code,
            source=source_by_code[code],
            name=f'/{code}',
            level=(
                'critical' if code == 'monitor_status_critical'
                else 'warning' if code in {
                    'waiting_publisher', 'topic_message_missing', 'topic_stale',
                    'monitor_status_warning', 'service_call_timeout',
                    'action_goal_canceled', 'action_goal_rejected', 'action_result_timeout',
                }
                else 'error'
            ),
        )
        for code in EXPECTED_ALERT_CODES
    ]
    repository = MemoryAlertRepository()
    service = AlertHistoryService(repository)
    service.consume({'data': items, 'meta': {'count': len(items)}})

    assert {record.code for record in repository.records} == EXPECTED_ALERT_CODES
    assert {record.level for record in repository.records} == levels
    assert {record.source for record in repository.records} == {
        'topic', 'monitor_status', 'service', 'action', 'node',
    }


def test_resolved_history_name_search_and_50_row_pages() -> None:
    repository = MemoryAlertRepository()
    for index in range(105):
        name = f'/scan_{index:03d}' if index < 60 else f'/navigate_{index:03d}'
        repository.records.append(StoredAlert(
            alert_key=f'topic:{name}:topic_stale',
            source='topic',
            name=name,
            code='topic_stale',
            level='warning',
            message='stale',
            detected_at=float(index),
            resolved_at=float(index + 1000),
        ))
    service = AlertHistoryService(repository)

    first = service.resolved_snapshot(name='', page=1)
    second = service.resolved_snapshot(name='', page=2)
    search = service.resolved_snapshot(name='scan', page=2)

    assert len(first['data']) == 50
    assert len(second['data']) == 50
    assert first['pagination']['total'] == 105
    assert first['data'][0]['resolved_at'] == 1104.0
    assert search['pagination']['total'] == 60
    assert len(search['data']) == 10
    assert all('scan' in item['name'] for item in search['data'])


def test_database_failure_keeps_memory_alert_monitoring_available() -> None:
    class FailingRepository(MemoryAlertRepository):
        def ping(self) -> None:
            raise ConnectionError('database unavailable')

        def synchronize(self, *_args, **_kwargs) -> None:
            raise ConnectionError('database unavailable')

        def list_active(self) -> list[StoredAlert]:
            raise ConnectionError('database unavailable')

        def list_resolved(self, **_kwargs) -> AlertPage:
            raise ConnectionError('database unavailable')

    service = AlertHistoryService(FailingRepository(), database_retry_interval_sec=60)
    service.start()
    service.consume({'data': [alert()], 'meta': {'count': 1}})
    snapshot = service.snapshot()
    assert snapshot['data'][0]['code'] == 'topic_stale'
    assert snapshot['meta']['active_count'] == 1


class SqlCursor:
    def __init__(self, open_keys: set[str]) -> None:
        self.open_keys = open_keys
        self.executed: list[tuple[str, Any]] = []
        self._last_sql = ''
        self.rowcount = 0

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def execute(self, sql: str, parameters: Any = None) -> None:
        self._last_sql = sql
        self.executed.append((sql, parameters))

    def fetchone(self) -> dict[str, Any]:
        if 'GET_LOCK' in self._last_sql:
            return {'acquired': 1}
        return {}

    def fetchall(self) -> list[dict[str, str]]:
        if 'SELECT alert_key' in self._last_sql:
            return [{'alert_key': key} for key in self.open_keys]
        return []


class SqlConnection:
    def __init__(self, open_keys: set[str]) -> None:
        self.sql_cursor = SqlCursor(open_keys)
        self.committed = False
        self.rolled_back = False

    def cursor(self) -> SqlCursor:
        return self.sql_cursor

    def begin(self) -> None:
        return None

    def commit(self) -> None:
        self.committed = True

    def rollback(self) -> None:
        self.rolled_back = True

    def close(self) -> None:
        return None


class SqlConnectionFactory:
    def __init__(self, connection: SqlConnection) -> None:
        self.connection = connection

    def connect(self) -> SqlConnection:
        return self.connection


def test_mariadb_repository_selects_insert_and_update_without_schema_changes() -> None:
    existing_key = 'topic:/old:topic_stale'
    connection = SqlConnection({existing_key})
    repository = MariaDbAlertRepository(SqlConnectionFactory(connection))
    resolved = alert(name='/old')
    resolved['id'] = existing_key
    resolved['resolved_at'] = 150.0
    repository.synchronize(
        [alert(name='/new', detected_at=200.0)],
        [resolved],
        observed_at=300.0,
    )

    statements = connection.sql_cursor.executed
    update = next((params for sql, params in statements if sql.startswith('UPDATE alert')), None)
    insert = next((params for sql, params in statements if sql.startswith('INSERT INTO alert')), None)
    assert connection.committed is True
    assert update is not None
    assert update[0] == datetime.fromtimestamp(150.0, tz=ALERT_DB_TIMEZONE).replace(tzinfo=None)
    assert update[1] == existing_key
    assert insert is not None
    assert insert[0] == 'topic:/new:topic_stale'
    assert len(insert) == 7


def test_mariadb_repository_stores_and_reads_kst_wall_clock() -> None:
    stored = datetime(2026, 8, 11, 16, 30, 45, 123456)
    timestamp = stored.replace(tzinfo=ALERT_DB_TIMEZONE).timestamp()

    assert isinstance(ALERT_DB_TIMEZONE, ZoneInfo)
    assert ALERT_DB_TIMEZONE.key == 'Asia/Seoul'
    assert _to_db_datetime(timestamp) == stored
    assert _to_timestamp(stored) == timestamp


def test_mariadb_repository_does_not_insert_existing_active_key() -> None:
    item = alert()
    connection = SqlConnection({item['id']})
    repository = MariaDbAlertRepository(SqlConnectionFactory(connection))
    repository.synchronize([item], [], observed_at=200.0)
    assert not any(
        sql.startswith('INSERT INTO alert')
        for sql, _params in connection.sql_cursor.executed
    )
