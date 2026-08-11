"""Backend-owned Alert lifecycle, persistence, and query service."""

from __future__ import annotations

from copy import deepcopy
import logging
from threading import Lock
from time import monotonic, time
from typing import Any, Callable, TypeVar

from app.database.alert_repository import AlertRepository
from app.database.models import AlertPage

from .policy import HISTORY_LIMIT, HISTORY_PAGE_SIZE


LOGGER = logging.getLogger(__name__)
_UNAVAILABLE = object()
T = TypeVar('T')


class AlertHistoryService:
    def __init__(
        self,
        repository: AlertRepository | None = None,
        *,
        database_retry_interval_sec: float = 5.0,
    ) -> None:
        self._lock = Lock()
        self._database_lock = Lock()
        self._repository = repository
        self._database_retry_interval_sec = max(0.1, database_retry_interval_sec)
        self._database_retry_at = 0.0
        self._database_failure_reported = False
        self._active: dict[str, dict[str, Any]] = {}
        self._history: list[dict[str, Any]] = []
        self._dismissed: set[str] = set()
        self._meta: dict[str, Any] = {'count': 0}

    def start(self) -> None:
        if self._repository is None:
            return
        self._repository_call(self._repository.ping, force=True)

    def consume(self, envelope: dict[str, Any]) -> None:
        alerts = envelope.get('data', []) if isinstance(envelope, dict) else []
        current = {
            item['id']: deepcopy(item)
            for item in alerts
            if isinstance(item, dict) and isinstance(item.get('id'), str)
            and not _is_resolved(item)
        }
        resolved_items = {
            item['id']: deepcopy(item)
            for item in alerts
            if isinstance(item, dict) and isinstance(item.get('id'), str)
            and _is_resolved(item)
        }
        with self._lock:
            for alert_id, previous in self._active.items():
                if alert_id not in current:
                    resolved = deepcopy(resolved_items.get(alert_id, previous))
                    resolved['alert_state'] = 'resolved'
                    resolved['active'] = False
                    resolved['resolved_at'] = _resolved_at(resolved)
                    self._history.insert(0, resolved)
            self._history = self._history[:HISTORY_LIMIT]
            self._dismissed.intersection_update(current)
            self._active = current
            self._meta = deepcopy(envelope.get('meta', {'count': len(current)}))

        if self._repository is not None:
            self._repository_call(lambda: self._repository.synchronize(
                list(current.values()),
                list(resolved_items.values()),
                observed_at=time(),
            ))

    def snapshot(self, *, history_name: str = '', history_page: int = 1) -> dict[str, Any]:
        with self._lock:
            visible = [
                deepcopy(item) for alert_id, item in self._active.items()
                if alert_id not in self._dismissed
            ]
            active_payloads = deepcopy(self._active)
            dismissed = set(self._dismissed)
            memory_history = deepcopy(self._history)
            meta = deepcopy(self._meta)

        database_active = self._repository_call(
            self._repository.list_active if self._repository else None,
        )
        if database_active is not _UNAVAILABLE:
            visible = []
            for item in database_active:
                if item.alert_key in dismissed:
                    continue
                merged = active_payloads.get(item.alert_key, {})
                merged.update(item.as_api_dict())
                visible.append(merged)

        history = self._resolved_page(
            name=history_name,
            page=history_page,
            memory_history=memory_history,
        )
        meta['count'] = len(visible)
        meta['active_count'] = len(visible)
        return {
            'success': True,
            'data': visible,
            'history': history['data'],
            'history_pagination': history['pagination'],
            'meta': meta,
            'message': 'ROS2 alerts fetched successfully',
        }

    def resolved_snapshot(self, *, name: str = '', page: int = 1) -> dict[str, Any]:
        with self._lock:
            memory_history = deepcopy(self._history)
        result = self._resolved_page(name=name, page=page, memory_history=memory_history)
        return {
            'success': True,
            **result,
            'message': 'Resolved Alert history fetched successfully',
        }

    def reset_history(self) -> dict[str, int]:
        with self._lock:
            cleared = len(self._history)
            self._history.clear()
        database_cleared = self._repository_call(
            self._repository.delete_resolved if self._repository else None,
        )
        if database_cleared is not _UNAVAILABLE:
            cleared = int(database_cleared)
        return {'cleared': cleared}

    def dismiss_current(self) -> dict[str, int]:
        with self._lock:
            ids = set(self._active)
            self._dismissed.update(ids)
            return {'cleared': len(ids)}

    def _resolved_page(
        self,
        *,
        name: str,
        page: int,
        memory_history: list[dict[str, Any]],
    ) -> dict[str, Any]:
        safe_page = max(1, page)
        database_page = self._repository_call(
            (
                lambda: self._repository.list_resolved(
                    name=name,
                    page=safe_page,
                    page_size=HISTORY_PAGE_SIZE,
                )
            ) if self._repository else None,
        )
        if database_page is not _UNAVAILABLE:
            return _page_payload(database_page)

        normalized_name = name.casefold()
        filtered = [
            item for item in memory_history
            if not normalized_name
            or normalized_name in str(item.get('name', '')).casefold()
        ]
        total_pages = max(
            1,
            (len(filtered) + HISTORY_PAGE_SIZE - 1) // HISTORY_PAGE_SIZE,
        )
        safe_page = min(safe_page, total_pages)
        offset = (safe_page - 1) * HISTORY_PAGE_SIZE
        page_items = filtered[offset:offset + HISTORY_PAGE_SIZE]
        fallback_page = AlertPage(
            items=[],
            page=safe_page,
            page_size=HISTORY_PAGE_SIZE,
            total=len(filtered),
        )
        payload = _page_payload(fallback_page)
        payload['data'] = page_items
        return payload

    def _repository_call(
        self,
        operation: Callable[[], T] | None,
        *,
        force: bool = False,
    ) -> T | object:
        if operation is None:
            return _UNAVAILABLE
        now = monotonic()
        if not force and now < self._database_retry_at:
            return _UNAVAILABLE
        with self._database_lock:
            now = monotonic()
            if not force and now < self._database_retry_at:
                return _UNAVAILABLE
            try:
                result = operation()
            except Exception as exc:  # DB failure must not stop monitoring.
                self._database_retry_at = monotonic() + self._database_retry_interval_sec
                if not self._database_failure_reported:
                    LOGGER.warning(
                        'Alert MariaDB operation failed; memory fallback is active: %s',
                        exc,
                    )
                    self._database_failure_reported = True
                return _UNAVAILABLE
            if self._database_failure_reported:
                LOGGER.info('Alert MariaDB connection recovered')
                self._database_failure_reported = False
            self._database_retry_at = 0.0
            return result


def _is_resolved(alert: dict[str, Any]) -> bool:
    return alert.get('alert_state') == 'resolved' or (
        alert.get('active') is False and alert.get('resolved_at') is not None
    )


def _resolved_at(alert: dict[str, Any]) -> float:
    value = alert.get('resolved_at')
    return float(value) if isinstance(value, (int, float)) else time()


def _page_payload(page: AlertPage) -> dict[str, Any]:
    total_pages = page.total_pages
    return {
        'data': [item.as_api_dict() for item in page.items],
        'pagination': {
            'page': page.page,
            'page_size': page.page_size,
            'total': page.total,
            'total_pages': total_pages,
            'has_previous': page.page > 1,
            'has_next': page.page < total_pages,
        },
    }
