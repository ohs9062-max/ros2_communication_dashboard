"""ROS Service client lifecycle and QoS state for Interface Lab calls."""

from __future__ import annotations

from typing import Any, Callable

from rclpy.qos import QoSProfile, qos_profile_services_default

from ros2_dashboard_monitor.interface_lab.execution.runtime_storage import RuntimeClientPool
from ros2_dashboard_monitor.qos import qos_state
from ros2_dashboard_monitor.interface_lab.execution.qos_profiles import profile_fingerprint


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
        self._clients: RuntimeClientPool[tuple[str, str, tuple[Any, ...]], Any] = RuntimeClientPool(lock)
        self._last_state: dict[tuple[str, str], dict[str, Any]] = {}

    def clear(self) -> None:
        self._last_state = {}
        self._clients.clear()

    def get_or_create(
        self, name: str, service_type: str, service_class: type,
        qos_profile: QoSProfile, execution_qos: dict[str, Any],
    ):
        resource_key = (name, service_type)
        key = (*resource_key, profile_fingerprint(qos_profile))

        def create_client():
            node = self._node_getter()
            if node is None:
                raise self._unavailable_error()
            return node.create_client(
                service_class,
                name,
                qos_profile=qos_profile,
            )

        client = self._clients.get_or_create(key, create_client)
        self._last_state[resource_key] = execution_qos
        return client

    def dashboard_state(self) -> dict[tuple[str, str], dict[str, Any]]:
        return {
            (key[0], key[1]): {
                'interface_client_created': True,
                **self._last_state.get((key[0], key[1]), service_qos_state()),
            }
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
