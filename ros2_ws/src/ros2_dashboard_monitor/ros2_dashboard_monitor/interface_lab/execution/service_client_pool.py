"""ROS Service client lifecycle and QoS state for Interface Lab calls."""

from __future__ import annotations

from typing import Any, Callable

from rclpy.qos import QoSProfile, qos_profile_services_default

from ros2_dashboard_monitor.interface_lab.execution.runtime_storage import RuntimeClientPool, _locked
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
        self._lock = lock
        self._node_getter = node_getter
        self._unavailable_error = unavailable_error
        self._dds_qos_getter = dds_qos_getter
        self._clients: RuntimeClientPool[tuple[str, str, tuple[Any, ...]], Any] = RuntimeClientPool(lock)
        self._last_state: dict[tuple[str, str], dict[str, Any]] = {}
        self._last_selection: dict[tuple[str, str], dict[str, Any] | None] = {}
        self._remote_signature: dict[tuple[str, str], str] = {}

    def clear(self) -> None:
        with _locked(self._lock):
            self._last_state = {}
            self._last_selection = {}
            self._remote_signature = {}
        self._clients.clear()

    def record_qos_attempt(
        self,
        name: str,
        service_type: str,
        execution_qos: dict[str, Any],
        selection: dict[str, Any] | None = None,
    ) -> None:
        """Client 생성 여부와 무관하게 가장 최근 실행 전 QoS 판정을 보존합니다."""
        resource_key = (name, service_type)
        remote = execution_qos.get('remote_qos') or {}
        signature = repr((
            remote.get('qos_detection_source'),
            remote.get('publisher_qos'),
            remote.get('subscriber_qos'),
        ))
        with _locked(self._lock):
            self._last_state[resource_key] = execution_qos
            self._last_selection[resource_key] = selection
            self._remote_signature[resource_key] = signature

    def get_or_create(
        self, name: str, service_type: str, service_class: type,
        qos_profile: QoSProfile, execution_qos: dict[str, Any],
        selection: dict[str, Any] | None = None,
    ):
        resource_key = (name, service_type)
        key = (*resource_key, profile_fingerprint(qos_profile))
        self.record_qos_attempt(
            name, service_type, execution_qos, selection,
        )

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
        return client

    def refresh_qos(self) -> None:
        if self._dds_qos_getter is not None:
            with _locked(self._lock):
                resource_keys = list(self._last_state)
            for resource_key in resource_keys:
                selection = self._last_selection.get(resource_key)
                try:
                    remote = self._dds_qos_getter(resource_key[0])
                    signature = repr((
                        remote.get('qos_detection_source'),
                        remote.get('publisher_qos'),
                        remote.get('subscriber_qos'),
                    ))
                    if self._remote_signature.get(resource_key) == signature:
                        continue
                    _profile, state = resolve_split_service_execution_qos(
                        resource_key[0],
                        selection=selection,
                        remote_qos_getter=lambda _name, value=remote: value,
                    )
                    with _locked(self._lock):
                        self._last_state[resource_key] = state
                        self._remote_signature[resource_key] = signature
                except Exception:
                    pass

    def dashboard_state(self) -> dict[tuple[str, str], dict[str, Any]]:
        client_resources = {
            (key[0], key[1]) for key in self._clients.keys()
        }
        with _locked(self._lock):
            resource_keys = client_resources | set(self._last_state)
            return {
                resource_key: {
                    'interface_client_created': resource_key in client_resources,
                    **self._last_state.get(resource_key, service_qos_state()),
                }
                for resource_key in resource_keys
            }


def service_qos_state() -> dict[str, Any]:
    return qos_state(
        status='unknown',
        source='default_profile',
        local=qos_profile_services_default,
        reason=SERVICE_QOS_REASON,
        auto_applied=False,
    )
