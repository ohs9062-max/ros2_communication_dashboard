"""Interface Lab Action Goal handle 저장과 cancel lifecycle을 관리합니다."""

from __future__ import annotations

import threading
from typing import Any, Callable

from ros2_dashboard_monitor.interface_lab.execution.action_support import ActionGoalError


class ActionGoalTracker:
    def __init__(self, *, lock: Any, qos_state: Callable[[str], dict[str, Any]]) -> None:
        self._lock = lock
        self._qos_state = qos_state
        self._handles: dict[tuple[str, str], Any] = {}

    def clear(self) -> None:
        with self._lock:
            self._handles = {}

    def store(self, action_name: str, action_type: str, goal_handle: Any) -> None:
        with self._lock:
            self._handles[(action_name, action_type)] = goal_handle

    def remove(self, action_name: str, action_type: str) -> None:
        with self._lock:
            self._handles.pop((action_name, action_type), None)

    def cancel(self, *, action_name: str, action_type: str, timeout: float) -> dict[str, Any]:
        with self._lock:
            goal_handle = self._handles.get((action_name, action_type))
        if goal_handle is None:
            raise ActionGoalError('No active goal is available to cancel.')
        event = threading.Event()
        future = goal_handle.cancel_goal_async()
        future.add_done_callback(lambda _future: event.set())
        if not event.wait(timeout=timeout):
            raise ActionGoalError(f'action cancel timeout after {timeout:.2f}s')
        response = future.result()
        accepted = bool(getattr(response, 'goals_canceling', []))
        return {
            'success': accepted,
            'action_name': action_name,
            'action_type': action_type,
            'cancel_requested': True,
            'cancel_accepted': accepted,
            'qos': self._qos_state(action_name),
        }
