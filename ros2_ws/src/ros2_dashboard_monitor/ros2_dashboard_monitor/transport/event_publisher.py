"""Optional push-event publisher; polling snapshots remain the fallback."""

from __future__ import annotations

from .backend_client import post_event


class EventPublisher:
    def __init__(self, backend_event_url: str | None = None) -> None:
        self._backend_event_url = backend_event_url

    def publish(self, payload: dict) -> None:
        if self._backend_event_url:
            post_event(self._backend_event_url, payload)
