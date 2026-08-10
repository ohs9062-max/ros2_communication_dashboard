"""관찰 Action Result Service class와 ROS client cache를 관리합니다."""

from __future__ import annotations

from typing import Any, Callable

from rclpy.qos import qos_profile_services_default


class ActionResultClientPool:
    def __init__(
        self,
        *,
        node_getter: Callable[[], Any],
        service_class_loader: Callable[[str | None], tuple[type | None, str | None, str | None]],
    ) -> None:
        self._node_getter = node_getter
        self._service_class_loader = service_class_loader
        self._clients: dict[str, Any] = {}
        self._service_classes: dict[str, dict[str, Any]] = {}

    def clear(self) -> None:
        self._clients = {}
        self._service_classes = {}

    def cleanup(self, stale_names: list[str]) -> None:
        for name in stale_names:
            self._clients.pop(name, None)

    def client(self, name: str, service_class: type):
        node = self._node_getter()
        if node is None:
            raise RuntimeError('ROS2 monitor is not running')
        client = self._clients.get(name)
        if client is None:
            client = node.create_client(
                service_class,
                f'{name}/_action/get_result',
                qos_profile=qos_profile_services_default,
            )
            self._clients[name] = client
        return client

    def service_class(self, action_type: str | None) -> tuple[type | None, str | None, str | None]:
        cache_key = action_type or ''
        if cache_key not in self._service_classes:
            service_class, result_policy, result_reason = self._service_class_loader(action_type)
            self._service_classes[cache_key] = {
                'service_class': service_class,
                'result_policy': result_policy,
                'result_reason': result_reason,
            }
        cached = self._service_classes[cache_key]
        return cached.get('service_class'), cached.get('result_policy'), cached.get('result_reason')
