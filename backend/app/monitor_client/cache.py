"""Thread-safe backend-owned cache of monitor snapshots."""

from __future__ import annotations

from copy import deepcopy
from threading import Lock
from time import time
from typing import Any


class MonitorCache:
    def __init__(self) -> None:
        self._lock = Lock()
        self._data: dict[str, Any] = {}
        self._updated_at: float | None = None
        self._error: str | None = 'monitor snapshot not received yet'

    def update(self, data: dict[str, Any]) -> None:
        with self._lock:
            self._data = deepcopy(data)
            self._updated_at = time()
            self._error = None

    def mark_error(self, error: str) -> None:
        with self._lock:
            self._error = error

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return {
                'data': deepcopy(self._data),
                'updated_at': self._updated_at,
                'error': self._error,
                'connected': self._error is None,
            }
