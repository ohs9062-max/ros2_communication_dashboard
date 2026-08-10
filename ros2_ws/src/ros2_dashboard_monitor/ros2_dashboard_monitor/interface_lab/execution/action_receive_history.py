"""Action Goal history의 feedback/result 관찰 reset 경계를 관리합니다."""

from __future__ import annotations

from time import time
from typing import Any, Callable

from ros2_dashboard_monitor.interface_lab.execution.action_history import build_receive_history


class ActionReceiveHistory:
    def __init__(self, history_loader: Callable[[], list[dict[str, Any]]]) -> None:
        self._history_loader = history_loader
        self._reset_at: float | None = None
        self._reset_by_key: dict[tuple[str | None, str | None], float] = {}

    def clear(self) -> None:
        self._reset_at = None
        self._reset_by_key = {}

    def snapshot(self) -> dict[str, Any]:
        return build_receive_history(
            self._history_loader(),
            reset_at=self._reset_at,
            reset_by_key=self._reset_by_key,
        )

    def reset(self, *, action_name: str | None = None, action_type: str | None = None) -> dict[str, Any]:
        previous = len([
            item for item in self.snapshot()['history']
            if not action_name
            or (item.get('action_name') == action_name and item.get('action_type') == action_type)
        ])
        if action_name:
            self._reset_by_key[(action_name, action_type)] = time()
        else:
            self._reset_at = time()
        return {'cleared': previous}
