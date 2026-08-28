"""Runtime for user-started ROS2 Service servers in Interface Lab."""

from __future__ import annotations

from copy import deepcopy
from threading import Lock
from time import time
from typing import Any, Callable

from rosidl_runtime_py.utilities import get_service

from ros2_dashboard_monitor.interface_lab.apply.runtime import refresh_install_python_paths
from ros2_dashboard_monitor.interface_lab.common.value_converter import (
    InterfaceValidationError,
    fill_ros_message,
    ros_message_to_json,
)
from ros2_dashboard_monitor.interface_lab.execution.runtime_storage import BoundedExecutionHistory


MAX_HISTORY_ITEMS = 30


class ServiceServerError(ValueError):
    """Raised when an Interface Lab Service server request is invalid."""


class ServiceServerRuntime:
    """Own Service entities separately from the existing Client runtime."""

    def __init__(
        self,
        *,
        lock: Any,
        node_getter: Callable[[], Any],
        registered_types_getter: Callable[[], list[dict[str, Any]]],
        service_class_loader: Callable[[str], type] = get_service,
    ) -> None:
        self._lock = lock
        self._node_getter = node_getter
        self._registered_types_getter = registered_types_getter
        self._service_class_loader = service_class_loader
        self._entity_lock = Lock()
        self._servers: dict[tuple[str, str], dict[str, Any]] = {}
        self._history = BoundedExecutionHistory(lock, MAX_HISTORY_ITEMS)

    def registered_types(self) -> list[dict[str, Any]]:
        refresh_install_python_paths()
        result: dict[str, dict[str, Any]] = {}
        for item in self._registered_types_getter():
            type_name = str(item.get('service_type') or '')
            if not type_name or type_name in result:
                continue
            result[type_name] = {
                **item,
                'service_name': '',
                'server_available': False,
                'server_count': 0,
                'callable': False,
                'server_creatable': item.get('import_available') is True,
            }
        return sorted(result.values(), key=lambda item: item['service_type'])

    def start(
        self,
        *,
        service_name: str,
        service_type: str,
        response_data: dict[str, Any],
    ) -> dict[str, Any]:
        service_name = _required_name(service_name, 'service_name')
        service_type = _required_name(service_type, 'service_type')
        if not isinstance(response_data, dict):
            raise ServiceServerError('response must be an object.')
        if not self._is_registered_importable(service_type):
            raise ServiceServerError('Only an importable registered Service type can be opened.')
        node = self._node_getter()
        if node is None:
            raise ServiceServerError('The ROS2 monitor node is not running.')
        refresh_install_python_paths()
        try:
            service_class = self._service_class_loader(service_type)
            preview = service_class.Response()
            fill_ros_message(preview, response_data, label='response')
        except (AttributeError, ModuleNotFoundError, ValueError, InterfaceValidationError) as exc:
            raise ServiceServerError(str(exc)) from exc

        key = (service_name, service_type)
        with self._entity_lock:
            if key in self._servers:
                raise ServiceServerError('The Service server is already running.')
            config = {
                'service_name': service_name,
                'service_type': service_type,
                'response': deepcopy(response_data),
                'started_at': time(),
            }

            def callback(request: Any, response: Any) -> Any:
                called_at = time()
                item = {
                    'service_name': service_name,
                    'service_type': service_type,
                    'request': ros_message_to_json(request),
                    'response': None,
                    'received_at': called_at,
                    'status': 'responded',
                }
                try:
                    fill_ros_message(response, deepcopy(config['response']), label='response')
                    item['response'] = ros_message_to_json(response)
                    item['responded_at'] = time()
                except Exception as exc:  # callback errors must remain visible in history
                    item['status'] = 'response_error'
                    item['error'] = str(exc)
                    self._history.record(item)
                    raise
                self._history.record(item)
                return response

            try:
                entity = node.create_service(service_class, service_name, callback)
            except Exception as exc:
                raise ServiceServerError(f'Failed to create Service server: {exc}') from exc
            config['entity'] = entity
            self._servers[key] = config
        return {'success': True, 'server': self._public_server(config)}

    def stop(self, *, service_name: str, service_type: str) -> dict[str, Any]:
        key = (_required_name(service_name, 'service_name'), _required_name(service_type, 'service_type'))
        with self._entity_lock:
            config = self._servers.pop(key, None)
            if config is None:
                raise ServiceServerError('The Service server is not running.')
            node = self._node_getter()
            if node is not None:
                node.destroy_service(config['entity'])
        return {'success': True, 'stopped': {'service_name': key[0], 'service_type': key[1]}}

    def status(self) -> dict[str, Any]:
        with self._entity_lock:
            servers = [self._public_server(item) for item in self._servers.values()]
        return {'servers': servers, 'meta': {'count': len(servers)}}

    def history(self) -> dict[str, Any]:
        items = self._history.snapshot()
        return {'history': items, 'meta': {'count': len(items), 'limit': MAX_HISTORY_ITEMS}}

    def clear(self) -> None:
        with self._entity_lock:
            configs = list(self._servers.values())
            self._servers.clear()
            node = self._node_getter()
            if node is not None:
                for config in configs:
                    try:
                        node.destroy_service(config['entity'])
                    except Exception:
                        pass
        self._history.clear()

    def _is_registered_importable(self, service_type: str) -> bool:
        return any(
            item.get('service_type') == service_type and item.get('import_available') is True
            for item in self._registered_types_getter()
        )

    @staticmethod
    def _public_server(config: dict[str, Any]) -> dict[str, Any]:
        return {key: deepcopy(value) for key, value in config.items() if key != 'entity'}


def _required_name(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ServiceServerError(f'{field} is required.')
    return value.strip()
