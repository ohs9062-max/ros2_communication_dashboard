"""Interface Lab의 service_call_runtime 관련 기능을 담당하는 모듈입니다."""

from __future__ import annotations

from time import time
from typing import Any, Callable

from ros2_dashboard_monitor.interface_lab.apply.runtime import refresh_install_python_paths
from ros2_dashboard_monitor.interface_lab.common.value_converter import (
    build_ros_message,
    ros_message_to_json,
    schema_from_message_class,
)
from ros2_dashboard_monitor.interface_lab.management.registry import registry_snapshot
from ros2_dashboard_monitor.interface_lab.management.packages import registered_package_services
from ros2_dashboard_monitor.interface_lab.execution.service_client_pool import (
    ServiceClientPool,
    service_qos_state,
)
from ros2_dashboard_monitor.interface_lab.execution.service_history import (
    ServiceCallHistory,
    call_summary_payload as _call_summary,
)
from ros2_dashboard_monitor.interface_lab.execution.service_discovery import (
    build_callable_services,
    build_service_state,
    count_service_clients,
    discover_service_graph,
    find_allowed_service,
    registered_services_from_registry,
)
from ros2_dashboard_monitor.interface_lab.execution.service_call_executor import execute_service_call
from ros2_dashboard_monitor.interface_lab.execution.qos_profiles import (
    ExecutionQosError,
    resolve_split_service_execution_qos,
)
from ros2_dashboard_monitor.ros2_service.active_check import (
    load_service_class,
)
MAX_HISTORY_ITEMS = 30
DEFAULT_TIMEOUT_SEC = 2.0
MAX_TIMEOUT_SEC = 10.0


class ServiceCallError(ValueError):
    """Interface Lab에서 발생하는 예외를 표현하는 클래스입니다."""


class ServiceCallRuntime:
    """Interface Lab runtime 상태와 cache를 관리하는 클래스입니다."""

    def __init__(
        self,
        *,
        lock: Any,
        node_getter: Callable[[], Any],
        dds_qos_getter: Callable[[str], dict[str, Any]] | None = None,
    ) -> None:
        self._lock = lock
        self._node_getter = node_getter
        self._dds_qos_getter = dds_qos_getter
        self._client_pool = ServiceClientPool(
            lock=lock,
            node_getter=node_getter,
            unavailable_error=lambda: ServiceCallError(
                'ROS2 monitor node가 실행 중이 아닙니다.',
            ),
        )
        self._history = ServiceCallHistory(lock, MAX_HISTORY_ITEMS)

    def clear(self) -> None:
        """Interface Lab에서 cache와 runtime 상태를 초기화하는 함수입니다."""
        self._client_pool.clear()
        self._history.clear()

    def callable_services(self) -> dict[str, Any]:
        """등록·import 가능하고 현재 Graph와 일치하는 Service 후보를 반환합니다."""
        refresh_install_python_paths()
        registered = self._registered_services()
        graph = self._service_graph()
        return build_callable_services(registered, graph, self._service_qos())

    def call_service(
        self,
        *,
        service_name: str,
        service_type: str,
        request_data: dict[str, Any],
        timeout_sec: float | None = None,
        qos_selection: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """요청값을 ROS request로 변환해 Service를 호출하고 결과를 기록합니다."""
        timeout = _normalized_timeout(timeout_sec)
        refresh_install_python_paths()
        allowed = self._allowed_service(service_name, service_type)
        if allowed is None:
            raise ServiceCallError(
                'registry에 등록되고 import 가능한 Service이며, 현재 server가 있는 경우만 호출할 수 있습니다.',
            )

        node = self._node_getter()
        if node is None:
            raise ServiceCallError('ROS2 monitor node가 실행 중이 아닙니다.')
        try:
            qos_profile, execution_qos = resolve_split_service_execution_qos(
                service_name,
                selection=qos_selection,
                remote_qos_getter=self._dds_qos_getter,
            )
        except ExecutionQosError as exc:
            raise ServiceCallError(str(exc)) from exc

        result = execute_service_call(
            service_name=service_name,
            service_type=service_type,
            request_data=request_data,
            timeout=timeout,
            service_class_loader=load_service_class,
            client_getter=lambda name, type_name, service_class: self._client(
                name, type_name, service_class, qos_profile, execution_qos,
            ),
            validation_result_builder=self._validation_result,
            record_history=lambda item: self._record_history_with_qos(item, execution_qos),
            error_class=ServiceCallError,
            message_builder=build_ros_message,
            response_serializer=ros_message_to_json,
        )
        result['qos'] = execution_qos
        return result

    def history(self) -> dict[str, Any]:
        """최근 Service Call 실행 이력을 복사해 반환합니다."""
        return self._history.response()

    def receive_history(self) -> dict[str, Any]:
        """초기화 경계 이후의 Service 응답 이력을 반환합니다."""
        return self._history.receive_response()

    def reset_receive_history(
        self,
        *,
        service_name: str | None = None,
        service_type: str | None = None,
    ) -> dict[str, Any]:
        """선택한 Service의 응답 이력 초기화 시각을 갱신합니다."""
        return self._history.reset_receive(
            service_name=service_name,
            service_type=service_type,
        )

    def summary_by_service(self) -> dict[tuple[str, str], dict[str, Any]]:
        """Service 이름·타입별 최근 Call 결과와 누적 건수를 요약합니다."""
        return self._history.summary_by_service()

    def dashboard_state_by_service(
        self,
    ) -> dict[tuple[str, str], dict[str, bool]]:
        """Service별 Interface Lab Client 생성 상태를 반환합니다."""
        return self._client_pool.dashboard_state()

    def _allowed_service(
        self,
        service_name: str,
        service_type: str,
    ) -> dict[str, Any] | None:
        return find_allowed_service(
            service_name,
            service_type,
            self._registered_services(),
            self._service_graph(),
        )

    def _registered_services(self) -> list[dict[str, Any]]:
        registry = registry_snapshot()['interface_registry']
        return registered_services_from_registry(
            registry,
            registered_package_services(),
            _schema_from_service_class,
        )

    def _service_graph(self) -> list[dict[str, Any]]:
        return discover_service_graph(self._node_getter, self._client_count)

    def _client(
        self, name: str, service_type: str, service_class: type,
        qos_profile: Any = None, execution_qos: dict[str, Any] | None = None,
    ):
        if qos_profile is None or execution_qos is None:
            qos_profile, execution_qos = resolve_split_service_execution_qos(
                name, selection=None, remote_qos_getter=self._dds_qos_getter,
            )
        return self._client_pool.get_or_create(
            name, service_type, service_class, qos_profile, execution_qos,
        )

    def _client_count(self, name: str) -> int:
        return count_service_clients(self._node_getter, name)

    def _service_state(
        self,
        entry: dict[str, Any],
        graph_item: dict[str, Any] | None,
    ) -> dict[str, Any]:
        return build_service_state(entry, graph_item, self._service_qos())

    @staticmethod
    def _service_qos() -> dict[str, Any]:
        return service_qos_state()

    def _record_history_with_qos(
        self, item: dict[str, Any], execution_qos: dict[str, Any] | None = None,
    ) -> None:
        item['qos'] = execution_qos or self._service_qos()
        self._record_history(item)

    def _record_history(self, item: dict[str, Any]) -> None:
        item.setdefault('execution_source', 'interface_lab')
        item.setdefault('requester_node', _interface_lab_node(self._node_getter))
        self._history.record(item)

    def _validation_result(
        self,
        *,
        service_name: str,
        service_type: str,
        request_data: dict[str, Any],
        started_at: float,
        timeout_sec: float,
        error: str,
        details: list[str],
    ) -> dict[str, Any]:
        return {
            'success': False,
            'called': False,
            'sent_to_server': False,
            'service_name': service_name,
            'service_type': service_type,
            'request': request_data,
            'response': None,
            'elapsed_ms': (time() - started_at) * 1000.0,
            'timeout_sec': timeout_sec,
            'called_at': started_at,
            'error_type': 'validation_error',
            'error': error,
            'details': details,
        }


def _normalized_timeout(timeout_sec: float | None) -> float:
    if timeout_sec is None:
        return DEFAULT_TIMEOUT_SEC
    try:
        timeout = float(timeout_sec)
    except (TypeError, ValueError) as exc:
        raise ServiceCallError('timeout_sec 값이 올바르지 않습니다.') from exc
    if timeout <= 0:
        raise ServiceCallError('timeout_sec는 0보다 커야 합니다.')
    return min(timeout, MAX_TIMEOUT_SEC)


def _schema_from_service_class(service_type: str) -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    try:
        service_class = load_service_class(service_type)
        return (
            _schema_from_message_class(service_class.Request),
            _schema_from_message_class(service_class.Response),
        )
    except Exception:
        return [], []


def _interface_lab_node(node_getter: Callable[[], Any]) -> dict[str, Any]:
    node = node_getter()
    try:
        name = str(node.get_fully_qualified_name()) if node is not None else ''
    except Exception:
        name = ''
    return {
        'name': name or '/ros2_dashboard_topic_monitor',
        'display_name': 'Dashboard Interface Lab',
        'is_internal': True,
    }
