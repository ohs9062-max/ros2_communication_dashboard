"""ROS Service client lifecycle and QoS state for Interface Lab calls."""

from __future__ import annotations

from typing import Any, Callable

from rclpy.qos import QoSProfile, qos_profile_services_default

from ros2_dashboard_monitor.interface_lab.execution.runtime_storage import RuntimeClientPool
from ros2_dashboard_monitor.qos import qos_state
from ros2_dashboard_monitor.interface_lab.execution.qos_profiles import (
    profile_fingerprint,
    resolve_split_service_execution_qos,
)


SERVICE_QOS_REASON = (
    'Remote endpoint QoS is not available from the Service graph API. The default Service QoS is used.'
)


class ServiceClientPool:
    def __init__(
        self,
        *,
        lock: Any,
        node_getter: Callable[[], Any],
        unavailable_error: Callable[[], Exception],
        dds_qos_getter: Callable[[str], dict[str, Any]] | None = None,
    ) -> None:
        self._node_getter = node_getter
        self._unavailable_error = unavailable_error
        self._dds_qos_getter = dds_qos_getter
        self._clients: RuntimeClientPool[tuple[str, str, tuple[Any, ...]], Any] = RuntimeClientPool(lock)
        self._last_state: dict[tuple[str, str], dict[str, Any]] = {}
        self._last_selection: dict[tuple[str, str], dict[str, Any] | None] = {}
        self._remote_signature: dict[tuple[str, str], str] = {}

    def clear(self) -> None:
        self._last_state = {}
        self._last_selection = {}
        self._remote_signature = {}
        self._clients.clear()

    def get_or_create(
        self, name: str, service_type: str, service_class: type,
        qos_profile: QoSProfile, execution_qos: dict[str, Any],
        selection: dict[str, Any] | None = None,
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
        self._last_selection[resource_key] = selection
        return client

    def refresh_qos(self) -> None:
        if self._dds_qos_getter is not None:
            for key in self._clients.keys():
                resource_key = (key[0], key[1])
                selection = self._last_selection.get(resource_key)
                try:
                    remote = self._dds_qos_getter(key[0])
                    signature = repr((
                        remote.get('qos_detection_source'),
                        remote.get('publisher_qos'),
                        remote.get('subscriber_qos'),
                    ))
                    if self._remote_signature.get(resource_key) == signature:
                        continue
                    _profile, state = resolve_split_service_execution_qos(
                        key[0],
                        selection=selection,
                        remote_qos_getter=lambda _name, value=remote: value,
                    )
                    self._last_state[resource_key] = state
                    self._remote_signature[resource_key] = signature
                except Exception:
                    pass

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
