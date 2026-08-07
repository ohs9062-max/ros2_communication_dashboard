"""ROS Service client lifecycle and QoS state for Interface Lab calls."""

from __future__ import annotations

from typing import Any, Callable

from rclpy.qos import qos_profile_services_default

from ros2_dashboard_monitor.interface_lab.execution.runtime_storage import RuntimeClientPool
from ros2_dashboard_monitor.qos import qos_state


SERVICE_QOS_REASON = (
    'Service Graph API에서 상대 endpoint QoS를 제공하지 않아 기본 Service QoS를 사용합니다.'
)


class ServiceClientPool:
    def __init__(
        self,
        *,
        lock: Any,
        node_getter: Callable[[], Any],
        unavailable_error: Callable[[], Exception],
    ) -> None:
        self._node_getter = node_getter
        self._unavailable_error = unavailable_error
        self._clients: RuntimeClientPool[tuple[str, str], Any] = RuntimeClientPool(lock)

    def clear(self) -> None:
        self._clients.clear()

    def get_or_create(self, name: str, service_type: str, service_class: type):
        key = (name, service_type)

        def create_client():
            node = self._node_getter()
            if node is None:
                raise self._unavailable_error()
            return node.create_client(
                service_class,
                name,
                qos_profile=qos_profile_services_default,
            )

        return self._clients.get_or_create(key, create_client)

    def dashboard_state(self) -> dict[tuple[str, str], dict[str, Any]]:
        return {
            key: {'interface_client_created': True, **service_qos_state()}
            for key in self._clients.keys()
        }


def service_qos_state() -> dict[str, Any]:
    return qos_state(
        status='unknown',
        source='default_profile',
        local=qos_profile_services_default,
        reason=SERVICE_QOS_REASON,
        auto_applied=False,
    )
