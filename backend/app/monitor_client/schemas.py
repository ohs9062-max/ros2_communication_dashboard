"""Backend-side monitor transport schema aliases."""

from typing import Any, TypedDict


class CachedMonitorSnapshot(TypedDict, total=False):
    topics: dict[str, Any]
    services: dict[str, Any]
    actions: dict[str, Any]
    nodes: dict[str, Any]
    alerts: dict[str, Any]
    websocket: dict[str, Any]
    interface_apply: dict[str, Any]
