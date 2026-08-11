"""MariaDB repository for the fixed eight-column Alert table."""

from __future__ import annotations

from contextlib import closing
from datetime import datetime
from time import time
from typing import Any, Protocol
from zoneinfo import ZoneInfo

from .connection import ConnectionFactory
from .models import AlertPage, StoredAlert


ALERT_SYNC_LOCK_NAME = 'ros2_dashboard.alert.sync'
ALERT_DB_TIMEZONE = ZoneInfo('Asia/Seoul')


class AlertRepository(Protocol):
    def ping(self) -> None: ...

    def synchronize(
        self,
        active_alerts: list[dict[str, Any]],
        resolved_alerts: list[dict[str, Any]],
        *,
        observed_at: float,
    ) -> None: ...

    def list_active(self) -> list[StoredAlert]: ...

    def list_resolved(self, *, name: str, page: int, page_size: int) -> AlertPage: ...

    def delete_resolved(self) -> int: ...


class MariaDbAlertRepository:
    def __init__(self, connection_factory: ConnectionFactory) -> None:
        self._connection_factory = connection_factory

    def ping(self) -> None:
        with closing(self._connection_factory.connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute('SELECT 1 FROM alert LIMIT 1')

    def synchronize(
        self,
        active_alerts: list[dict[str, Any]],
        resolved_alerts: list[dict[str, Any]],
        *,
        observed_at: float,
    ) -> None:
        active_by_key = {
            item['id']: item
            for item in active_alerts
            if _valid_alert(item)
        }
        resolved_by_key = {
            item['id']: item
            for item in resolved_alerts
            if _valid_alert(item)
        }

        with closing(self._connection_factory.connect()) as connection:
            lock_acquired = False
            try:
                with connection.cursor() as cursor:
                    cursor.execute('SELECT GET_LOCK(%s, %s) AS acquired', (ALERT_SYNC_LOCK_NAME, 5))
                    lock_row = cursor.fetchone() or {}
                    if lock_row.get('acquired') != 1:
                        raise RuntimeError('MariaDB Alert synchronization lock timed out')
                    lock_acquired = True

                    connection.begin()
                    cursor.execute(
                        'SELECT alert_key FROM alert '
                        'WHERE resolved_at IS NULL FOR UPDATE',
                    )
                    open_keys = {row['alert_key'] for row in cursor.fetchall()}
                    current_keys = set(active_by_key)

                    for alert_key in open_keys - current_keys:
                        resolved = resolved_by_key.get(alert_key)
                        resolved_at = _timestamp_value(
                            resolved.get('resolved_at') if resolved else None,
                            fallback=observed_at,
                        )
                        cursor.execute(
                            'UPDATE alert SET resolved_at = %s '
                            'WHERE alert_key = %s AND resolved_at IS NULL',
                            (_to_db_datetime(resolved_at), alert_key),
                        )

                    for alert_key in current_keys - open_keys:
                        alert = active_by_key[alert_key]
                        detected_at = _timestamp_value(
                            alert.get('first_detected_at', alert.get('detected_at')),
                            fallback=observed_at,
                        )
                        cursor.execute(
                            'INSERT INTO alert '
                            '(alert_key, source, name, code, level, message, detected_at, resolved_at) '
                            'VALUES (%s, %s, %s, %s, %s, %s, %s, NULL)',
                            (
                                alert_key,
                                str(alert['source']),
                                str(alert['name']),
                                str(alert['code']),
                                str(alert['level']),
                                str(alert['message']),
                                _to_db_datetime(detected_at),
                            ),
                        )
                    connection.commit()
            except Exception:
                connection.rollback()
                raise
            finally:
                if lock_acquired:
                    with connection.cursor() as cursor:
                        cursor.execute('SELECT RELEASE_LOCK(%s)', (ALERT_SYNC_LOCK_NAME,))

    def list_active(self) -> list[StoredAlert]:
        with closing(self._connection_factory.connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    'SELECT id, alert_key, source, name, code, level, message, '
                    'detected_at, resolved_at FROM alert '
                    'WHERE resolved_at IS NULL ORDER BY detected_at DESC, id DESC',
                )
                return [_stored_alert(row) for row in cursor.fetchall()]

    def list_resolved(self, *, name: str, page: int, page_size: int) -> AlertPage:
        requested_page = max(1, page)
        where = 'WHERE resolved_at IS NOT NULL'
        parameters: list[Any] = []
        if name:
            where += ' AND name LIKE %s'
            parameters.append(f'%{name}%')

        with closing(self._connection_factory.connect()) as connection:
            with connection.cursor() as cursor:
                cursor.execute(f'SELECT COUNT(*) AS total FROM alert {where}', parameters)
                total = int((cursor.fetchone() or {}).get('total', 0))
                total_pages = max(1, (total + page_size - 1) // page_size)
                safe_page = min(requested_page, total_pages)
                offset = (safe_page - 1) * page_size
                cursor.execute(
                    'SELECT id, alert_key, source, name, code, level, message, '
                    f'detected_at, resolved_at FROM alert {where} '
                    'ORDER BY resolved_at DESC, id DESC LIMIT %s OFFSET %s',
                    [*parameters, page_size, offset],
                )
                items = [_stored_alert(row) for row in cursor.fetchall()]
        return AlertPage(items=items, page=safe_page, page_size=page_size, total=total)

    def delete_resolved(self) -> int:
        with closing(self._connection_factory.connect()) as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute('DELETE FROM alert WHERE resolved_at IS NOT NULL')
                    cleared = cursor.rowcount
                connection.commit()
                return cleared
            except Exception:
                connection.rollback()
                raise


def _valid_alert(item: Any) -> bool:
    if not isinstance(item, dict) or not isinstance(item.get('id'), str):
        return False
    return all(item.get(field) is not None for field in (
        'source', 'name', 'code', 'level', 'message',
    ))


def _timestamp_value(value: Any, *, fallback: float) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    return fallback


def _to_db_datetime(timestamp: float) -> datetime:
    return datetime.fromtimestamp(timestamp, tz=ALERT_DB_TIMEZONE).replace(tzinfo=None)


def _to_timestamp(value: Any) -> float:
    if isinstance(value, datetime):
        aware = value if value.tzinfo else value.replace(tzinfo=ALERT_DB_TIMEZONE)
        return aware.timestamp()
    if isinstance(value, (int, float)):
        return float(value)
    return time()


def _stored_alert(row: dict[str, Any]) -> StoredAlert:
    resolved_at = row.get('resolved_at')
    return StoredAlert(
        alert_key=str(row['alert_key']),
        source=str(row['source']),
        name=str(row['name']),
        code=str(row['code']),
        level=str(row['level']),
        message=str(row['message']),
        detected_at=_to_timestamp(row['detected_at']),
        resolved_at=_to_timestamp(resolved_at) if resolved_at is not None else None,
    )
