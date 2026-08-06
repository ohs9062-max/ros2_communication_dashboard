"""Polling consumer that isolates monitor failures from the web process."""

from __future__ import annotations

import json
from threading import Event, Thread
from typing import Callable, Any

from .cache import MonitorCache
from .client import MonitorClient, MonitorUnavailable


class MonitorEventConsumer:
    def __init__(
        self,
        client: MonitorClient,
        cache: MonitorCache,
        interval_sec: float,
        on_snapshot: Callable[[dict[str, Any]], None] | None = None,
        on_connected: Callable[[], None] | None = None,
    ) -> None:
        self._client = client
        self._cache = cache
        self._interval_sec = interval_sec
        self._on_snapshot = on_snapshot
        self._on_connected = on_connected
        self._connection_initialized = False
        self._stop = Event()
        self._thread: Thread | None = None

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = Thread(target=self._run, name='monitor-event-consumer', daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=max(2.0, self._interval_sec * 2))

    def _run(self) -> None:
        while not self._stop.is_set():
            try:
                response = self._client.request('GET', '/transport/snapshot')
                if response.status_code != 200:
                    raise MonitorUnavailable(f'monitor snapshot HTTP {response.status_code}')
                payload = json.loads(response.content)
                data = payload['data']
                self._cache.update(data)
                if self._on_snapshot:
                    self._on_snapshot(data)
                if not self._connection_initialized and self._on_connected:
                    self._on_connected()
                    self._connection_initialized = True
            except (MonitorUnavailable, ValueError, KeyError) as exc:
                self._connection_initialized = False
                self._cache.mark_error(str(exc))
            self._stop.wait(self._interval_sec)
