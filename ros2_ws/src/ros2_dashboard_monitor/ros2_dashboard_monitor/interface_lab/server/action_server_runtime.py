"""Runtime for user-started ROS2 Action servers in Interface Lab."""

from __future__ import annotations

from copy import deepcopy
from threading import Lock
from time import sleep, time
from typing import Any, Callable

from rclpy.action import ActionServer, CancelResponse, GoalResponse
from rclpy.callback_groups import ReentrantCallbackGroup
from rosidl_runtime_py.utilities import get_action

from ros2_dashboard_monitor.interface_lab.apply.runtime import refresh_install_python_paths
from ros2_dashboard_monitor.interface_lab.common.value_converter import (
    InterfaceValidationError,
    build_ros_message,
    ros_message_to_json,
)
from ros2_dashboard_monitor.interface_lab.execution.runtime_storage import BoundedExecutionHistory


MAX_HISTORY_ITEMS = 30


class ActionServerError(ValueError):
    """Raised when an Interface Lab Action server request is invalid."""


class ActionServerRuntime:
    """Own ActionServer entities without changing the existing ActionClient runtime."""

    def __init__(
        self,
        *,
        lock: Any,
        node_getter: Callable[[], Any],
        registered_types_getter: Callable[[], list[dict[str, Any]]],
        action_class_loader: Callable[[str], type] = get_action,
        server_factory: Callable[..., Any] = ActionServer,
    ) -> None:
        self._lock = lock
        self._node_getter = node_getter
        self._registered_types_getter = registered_types_getter
        self._action_class_loader = action_class_loader
        self._server_factory = server_factory
        self._entity_lock = Lock()
        self._servers: dict[tuple[str, str], dict[str, Any]] = {}
        self._history = BoundedExecutionHistory(lock, MAX_HISTORY_ITEMS)

    def registered_types(self) -> list[dict[str, Any]]:
        refresh_install_python_paths()
        result: dict[str, dict[str, Any]] = {}
        for item in self._registered_types_getter():
            type_name = str(item.get('action_type') or '')
            if not type_name or type_name in result:
                continue
            result[type_name] = {
                **item,
                'action_name': '',
                'server_available': False,
                'server_count': 0,
                'callable': False,
                'executable': False,
                'server_creatable': item.get('import_available') is True,
            }
        return sorted(result.values(), key=lambda item: item['action_type'])

    def start(
        self,
        *,
        action_name: str,
        action_type: str,
        feedback_data: dict[str, Any],
        result_data: dict[str, Any],
        accept_goals: bool = True,
        accept_cancels: bool = True,
        result_delay_sec: float = 1.0,
    ) -> dict[str, Any]:
        action_name = _required_name(action_name, 'action_name')
        action_type = _required_name(action_type, 'action_type')
        if not isinstance(feedback_data, dict) or not isinstance(result_data, dict):
            raise ActionServerError('feedback and result must be objects.')
        try:
            delay = max(0.0, min(float(result_delay_sec), 60.0))
        except (TypeError, ValueError) as exc:
            raise ActionServerError('result_delay_sec must be a number.') from exc
        if not self._is_registered_importable(action_type):
            raise ActionServerError('Only an importable registered Action type can be opened.')
        node = self._node_getter()
        if node is None:
            raise ActionServerError('The ROS2 monitor node is not running.')
        refresh_install_python_paths()
        try:
            action_class = self._action_class_loader(action_type)
            build_ros_message(action_class.Feedback, feedback_data, label='feedback')
            build_ros_message(action_class.Result, result_data, label='result')
        except (AttributeError, ModuleNotFoundError, ValueError, InterfaceValidationError) as exc:
            raise ActionServerError(str(exc)) from exc

        key = (action_name, action_type)
        with self._entity_lock:
            if key in self._servers:
                raise ActionServerError('The Action server is already running.')
            config = {
                'action_name': action_name,
                'action_type': action_type,
                'feedback': deepcopy(feedback_data),
                'result': deepcopy(result_data),
                'accept_goals': bool(accept_goals),
                'accept_cancels': bool(accept_cancels),
                'result_delay_sec': delay,
                'started_at': time(),
            }

            def goal_callback(goal_request: Any) -> GoalResponse:
                accepted = config['accept_goals']
                self._history.record({
                    'action_name': action_name,
                    'action_type': action_type,
                    'goal': ros_message_to_json(goal_request),
                    'received_at': time(),
                    'accepted': accepted,
                    'status': 'accepted' if accepted else 'rejected',
                })
                return GoalResponse.ACCEPT if accepted else GoalResponse.REJECT

            def cancel_callback(goal_handle: Any) -> CancelResponse:
                accepted = config['accept_cancels']
                self._history.record({
                    'action_name': action_name,
                    'action_type': action_type,
                    'goal': ros_message_to_json(goal_handle.request),
                    'received_at': time(),
                    'cancel_requested': True,
                    'cancel_accepted': accepted,
                    'status': 'cancel_accepted' if accepted else 'cancel_rejected',
                })
                return CancelResponse.ACCEPT if accepted else CancelResponse.REJECT

            def execute_callback(goal_handle: Any) -> Any:
                started_at = time()
                feedback = build_ros_message(action_class.Feedback, deepcopy(config['feedback']), label='feedback')
                result = build_ros_message(action_class.Result, deepcopy(config['result']), label='result')
                goal_handle.publish_feedback(feedback)
                remaining = config['result_delay_sec']
                while remaining > 0 and not goal_handle.is_cancel_requested:
                    interval = min(0.1, remaining)
                    sleep(interval)
                    remaining -= interval
                if goal_handle.is_cancel_requested and config['accept_cancels']:
                    goal_handle.canceled()
                    status = 'canceled'
                else:
                    goal_handle.succeed()
                    status = 'succeeded'
                self._history.record({
                    'action_name': action_name,
                    'action_type': action_type,
                    'goal': ros_message_to_json(goal_handle.request),
                    'feedback': ros_message_to_json(feedback),
                    'result': ros_message_to_json(result),
                    'received_at': started_at,
                    'completed_at': time(),
                    'accepted': True,
                    'status': status,
                })
                return result

            try:
                entity = self._server_factory(
                    node,
                    action_class,
                    action_name,
                    execute_callback=execute_callback,
                    goal_callback=goal_callback,
                    cancel_callback=cancel_callback,
                    callback_group=ReentrantCallbackGroup(),
                )
            except Exception as exc:
                raise ActionServerError(f'Failed to create Action server: {exc}') from exc
            config['entity'] = entity
            self._servers[key] = config
        return {'success': True, 'server': self._public_server(config)}

    def stop(self, *, action_name: str, action_type: str) -> dict[str, Any]:
        key = (_required_name(action_name, 'action_name'), _required_name(action_type, 'action_type'))
        with self._entity_lock:
            config = self._servers.pop(key, None)
            if config is None:
                raise ActionServerError('The Action server is not running.')
            config['entity'].destroy()
        return {'success': True, 'stopped': {'action_name': key[0], 'action_type': key[1]}}

    def status(self) -> dict[str, Any]:
        with self._entity_lock:
            servers = [self._public_server(item) for item in self._servers.values()]
        return {'servers': servers, 'meta': {'count': len(servers)}}

    def history(self) -> dict[str, Any]:
        items = self._history.snapshot()
        return {'history': items, 'meta': {'count': len(items), 'limit': MAX_HISTORY_ITEMS}}

    def reset_history(
        self,
        *,
        action_name: str | None = None,
        action_type: str | None = None,
    ) -> dict[str, Any]:
        cleared = self._history.remove(lambda item: (
            (not action_name or item.get('action_name') == action_name)
            and (not action_type or item.get('action_type') == action_type)
        ))
        return {
            'cleared': cleared,
            'action_name': action_name,
            'action_type': action_type,
        }

    def clear(self) -> None:
        with self._entity_lock:
            configs = list(self._servers.values())
            self._servers.clear()
            for config in configs:
                try:
                    config['entity'].destroy()
                except Exception:
                    pass
        self._history.clear()

    def _is_registered_importable(self, action_type: str) -> bool:
        return any(
            item.get('action_type') == action_type and item.get('import_available') is True
            for item in self._registered_types_getter()
        )

    @staticmethod
    def _public_server(config: dict[str, Any]) -> dict[str, Any]:
        return {key: deepcopy(value) for key, value in config.items() if key != 'entity'}


def _required_name(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ActionServerError(f'{field} is required.')
    return value.strip()
