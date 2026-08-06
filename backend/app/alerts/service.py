"""Backend-owned active/dismissed/resolved alert history."""

from __future__ import annotations

from copy import deepcopy
from threading import Lock
from time import time
from typing import Any

from .policy import HISTORY_LIMIT


class AlertHistoryService:
    def __init__(self) -> None:
        self._lock = Lock()
        self._active: dict[str, dict[str, Any]] = {}
        self._history: list[dict[str, Any]] = []
        self._dismissed: set[str] = set()
        self._meta: dict[str, Any] = {'count': 0}

    def consume(self, envelope: dict[str, Any]) -> None:
        alerts = envelope.get('data', []) if isinstance(envelope, dict) else []
        current = {
            item['id']: deepcopy(item)
            for item in alerts
            if isinstance(item, dict) and isinstance(item.get('id'), str)
        }
        with self._lock:
            for alert_id, previous in self._active.items():
                if alert_id not in current:
                    resolved = deepcopy(previous)
                    resolved['alert_state'] = 'resolved'
                    resolved['resolved_at'] = time()
                    self._history.insert(0, resolved)
            self._history = self._history[:HISTORY_LIMIT]
            self._dismissed.intersection_update(current)
            self._active = current
            self._meta = deepcopy(envelope.get('meta', {'count': len(current)}))

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            visible = [
                deepcopy(item) for alert_id, item in self._active.items()
                if alert_id not in self._dismissed
            ]
            meta = deepcopy(self._meta)
            meta['count'] = len(visible)
            return {
                'success': True,
                'data': visible,
                'history': deepcopy(self._history),
                'meta': meta,
                'message': 'ROS2 alerts fetched successfully',
            }

    def reset_history(self) -> dict[str, int]:
        with self._lock:
            cleared = len(self._history)
            self._history.clear()
            return {'cleared': cleared}

    def dismiss_current(self) -> dict[str, int]:
        with self._lock:
            ids = set(self._active)
            self._dismissed.update(ids)
            return {'cleared': len(ids)}
