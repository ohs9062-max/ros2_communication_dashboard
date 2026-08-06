"""Transient priority names supplied by the web backend."""

from __future__ import annotations

from threading import Lock


PRIORITY_KINDS = ('topics', 'services', 'actions', 'nodes')


class PriorityState:
    """In-memory mirror only; persistence remains a backend responsibility."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._priority = {kind: set() for kind in PRIORITY_KINDS}

    def contains(self, kind: str, name: str) -> bool:
        if kind not in PRIORITY_KINDS:
            return False
        with self._lock:
            return name in self._priority[kind]

    def replace(self, priority: dict[str, list[str]]) -> None:
        with self._lock:
            self._priority = {
                kind: {
                    name for name in priority.get(kind, [])
                    if isinstance(name, str) and name.strip()
                }
                for kind in PRIORITY_KINDS
            }
