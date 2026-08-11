"""Interface Lab의 action_goal_runtime 관련 기능을 담당하는 모듈입니다."""

from __future__ import annotations

from typing import Any, Callable

from rclpy.action import ActionClient
from rclpy.action.graph import (
    get_action_client_names_and_types_by_node,
    get_action_names_and_types,
    get_action_server_names_and_types_by_node,
)
from ros2_dashboard_monitor.interface_lab.apply.runtime import refresh_install_python_paths
from ros2_dashboard_monitor.interface_lab.management.registry import registry_snapshot
from ros2_dashboard_monitor.interface_lab.management.packages import registered_package_actions
from ros2_dashboard_monitor.interface_lab.execution.runtime_storage import BoundedExecutionHistory


from ros2_dashboard_monitor.interface_lab.execution.action_support import (
    ActionGoalError,
    goal_summary as _goal_summary,
    interface_lab_node as _interface_lab_node,
    normalized_timeout as _normalized_timeout,
    schema_from_action_class as _schema_from_action_class,
)
from ros2_dashboard_monitor.interface_lab.execution.action_goal_executor import execute_action_goal
from ros2_dashboard_monitor.interface_lab.execution.action_goal_tracker import ActionGoalTracker
from ros2_dashboard_monitor.interface_lab.execution.action_result import build_action_goal_result
from ros2_dashboard_monitor.interface_lab.execution.action_client_pool import ActionClientPool
from ros2_dashboard_monitor.interface_lab.execution.qos_profiles import ExecutionQosError
from ros2_dashboard_monitor.interface_lab.execution.action_history import (
    summarize_action_history,
)
from ros2_dashboard_monitor.interface_lab.execution.action_receive_history import ActionReceiveHistory
from ros2_dashboard_monitor.interface_lab.execution.action_discovery import (
    build_action_count_maps,
    build_action_state,
    build_callable_actions,
    discover_action_graph,
    find_allowed_action,
    merge_action_counts,
    query_action_endpoints,
    registered_actions_from_registry,
)
MAX_HISTORY_ITEMS = 30


class ActionGoalRuntime:
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
        self._client_pool = ActionClientPool(
            lock=lock,
            node_getter=node_getter,
            client_factory=lambda *args, **kwargs: ActionClient(*args, **kwargs),
            dds_qos_getter=dds_qos_getter,
        )
        self._history = BoundedExecutionHistory(lock, MAX_HISTORY_ITEMS)
        self._goal_tracker = ActionGoalTracker(lock=lock, qos_state=self._action_qos)
        self._receive_history = ActionReceiveHistory(self._history.snapshot)

    def clear(self) -> None:
        """Interface Lab에서 cache와 runtime 상태를 초기화하는 함수입니다."""
        self._receive_history.clear()
        self._goal_tracker.clear()
        self._client_pool.clear()
        self._history.clear()

    def callable_actions(self) -> dict[str, Any]:
        """등록·import 가능하고 현재 Graph와 일치하는 Action 후보를 반환합니다."""
        refresh_install_python_paths()
        registered = self._registered_actions()
        graph = self._action_graph()
        return build_callable_actions(registered, graph, self._action_qos)

    def send_goal(
        self,
        *,
        action_name: str,
        action_type: str,
        goal_data: dict[str, Any],
        timeout_sec: float | None = None,
        qos_selection: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Goal을 보내고 feedback·result를 기다린 뒤 실행 이력을 기록합니다."""
        timeout = _normalized_timeout(timeout_sec)
        refresh_install_python_paths()
        allowed = self._allowed_action(action_name, action_type)
        if allowed is None:
            raise ActionGoalError(
                'registry에 등록되고 import 가능한 Action이며, 현재 server가 있는 경우만 실행할 수 있습니다.',
            )

        node = self._node_getter()
        if node is None:
            raise ActionGoalError('ROS2 monitor node가 실행 중이 아닙니다.')

        try:
            result = execute_action_goal(
                action_name=action_name,
                action_type=action_type,
                goal_data=goal_data,
                timeout=timeout,
                client_getter=lambda name, type_name, action_class: self._client(
                    name, type_name, action_class, qos_selection,
                ),
                result_builder=self._result,
                record_history=self._record_history_with_qos,
                goal_handle_store=self._store_goal_handle,
                goal_handle_remove=self._remove_goal_handle,
            )
        except ExecutionQosError as exc:
            raise ActionGoalError(str(exc)) from exc
        result['qos'] = self._action_qos(action_name)
        return result

    def _store_goal_handle(self, action_name: str, action_type: str, goal_handle: Any) -> None:
        self._goal_tracker.store(action_name, action_type, goal_handle)

    def _remove_goal_handle(self, action_name: str, action_type: str) -> None:
        self._goal_tracker.remove(action_name, action_type)

    def cancel_goal(
        self,
        *,
        action_name: str,
        action_type: str,
        timeout_sec: float | None = None,
    ) -> dict[str, Any]:
        """Cancel the active user-submitted goal for an exact name/type pair."""
        timeout = _normalized_timeout(timeout_sec)
        return self._goal_tracker.cancel(
            action_name=action_name,
            action_type=action_type,
            timeout=timeout,
        )

    def history(self) -> dict[str, Any]:
        """최근 Action Goal 실행 이력을 복사해 반환합니다."""
        goals = self._history.snapshot()
        return {
            'goals': goals,
            'meta': {
                'count': len(goals),
            },
        }

    def receive_history(self) -> dict[str, Any]:
        """초기화 경계 이후에 받은 feedback·result 이력을 반환합니다."""
        return self._receive_history.snapshot()

    def reset_receive_history(
        self,
        *,
        action_name: str | None = None,
        action_type: str | None = None,
    ) -> dict[str, Any]:
        """선택한 Action의 feedback·result 이력 초기화 시각을 갱신합니다."""
        return self._receive_history.reset(
            action_name=action_name,
            action_type=action_type,
        )

    def summary_by_action(self) -> dict[tuple[str, str], dict[str, Any]]:
        """Action 이름·타입별 최근 Goal 결과와 누적 건수를 요약합니다."""
        return summarize_action_history(self._history.snapshot())

    def dashboard_state_by_action(
        self,
    ) -> dict[tuple[str, str], dict[str, bool]]:
        """Action별 Interface Lab Client 생성 상태를 반환합니다."""
        return self._client_pool.dashboard_state()

    def _allowed_action(
        self,
        action_name: str,
        action_type: str,
    ) -> dict[str, Any] | None:
        return find_allowed_action(
            action_name,
            action_type,
            self._registered_actions(),
            self._action_graph(),
        )

    def _registered_actions(self) -> list[dict[str, Any]]:
        return registered_actions_from_registry(
            registry_snapshot()['interface_registry'],
            registered_package_actions(),
            _schema_from_action_class,
        )

    def _action_graph(self) -> list[dict[str, Any]]:
        return discover_action_graph(
            self._node_getter,
            get_action_names_and_types,
            self._action_count_maps,
        )

    def _action_count_maps(
        self,
    ) -> tuple[dict[tuple[str, str], int], dict[tuple[str, str], int]]:
        return build_action_count_maps(
            self._node_getter,
            self._action_servers_by_node,
            self._action_clients_by_node,
        )

    def _action_servers_by_node(
        self,
        node_name: str,
        namespace: str,
    ) -> list[tuple[str, list[str]]]:
        return query_action_endpoints(
            self._node_getter,
            get_action_server_names_and_types_by_node,
            node_name,
            namespace,
        )

    def _action_clients_by_node(
        self,
        node_name: str,
        namespace: str,
    ) -> list[tuple[str, list[str]]]:
        return query_action_endpoints(
            self._node_getter,
            get_action_client_names_and_types_by_node,
            node_name,
            namespace,
        )

    def _client(
        self, name: str, action_type: str, action_class: type,
        qos_selection: dict[str, Any] | None = None,
    ):
        return self._client_pool.get_or_create(
            name, action_type, action_class, qos_selection,
        )

    def _action_state(
        self,
        entry: dict[str, Any],
        graph_item: dict[str, Any] | None,
    ) -> dict[str, Any]:
        return build_action_state(entry, graph_item, self._action_qos)

    def _action_qos_profiles(self, node: Any, name: str) -> dict[str, Any]:
        return self._client_pool.qos_profiles(node, name)

    def _action_qos(self, name: str) -> dict[str, Any]:
        return self._client_pool.qos_state(name)

    def _record_history_with_qos(self, item: dict[str, Any]) -> None:
        item['qos'] = self._action_qos(str(item.get('action_name') or ''))
        self._record_history(item)

    @staticmethod
    def _merge_action_counts(
        counts: dict[tuple[str, str], int],
        names_and_types: list[tuple[str, list[str]]],
    ) -> None:
        merge_action_counts(counts, names_and_types)

    def _record_history(self, item: dict[str, Any]) -> None:
        item.setdefault('execution_source', 'interface_lab')
        item.setdefault('requester_node', _interface_lab_node(self._node_getter))
        self._history.record(item)

    @staticmethod
    def _result(
        *,
        success: bool,
        action_name: str,
        action_type: str,
        goal_data: dict[str, Any],
        accepted: bool,
        feedback: list[dict[str, Any]],
        result: dict[str, Any] | None,
        started_at: float,
        timeout_sec: float,
        status: int | None = None,
        error: str | None = None,
        error_type: str | None = None,
        details: list[str] | None = None,
        sent_to_server: bool = False,
    ) -> dict[str, Any]:
        return build_action_goal_result(
            success=success,
            action_name=action_name,
            action_type=action_type,
            goal_data=goal_data,
            accepted=accepted,
            feedback=feedback,
            result=result,
            started_at=started_at,
            timeout_sec=timeout_sec,
            status=status,
            error=error,
            error_type=error_type,
            details=details,
            sent_to_server=sent_to_server,
        )
