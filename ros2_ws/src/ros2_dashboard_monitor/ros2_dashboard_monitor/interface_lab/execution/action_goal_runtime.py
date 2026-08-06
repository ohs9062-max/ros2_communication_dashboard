"""Interface Lab의 action_goal_runtime 관련 기능을 담당하는 모듈입니다."""

from __future__ import annotations

import threading
from time import time
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
from ros2_dashboard_monitor.interface_lab.execution.runtime_storage import (
    BoundedExecutionHistory,
    RuntimeClientPool,
)


from ros2_dashboard_monitor.interface_lab.execution.action_support import (
    ActionGoalError,
    goal_summary as _goal_summary,
    interface_lab_node as _interface_lab_node,
    normalized_timeout as _normalized_timeout,
    schema_from_action_class as _schema_from_action_class,
)
from ros2_dashboard_monitor.interface_lab.execution.action_goal_executor import execute_action_goal
from ros2_dashboard_monitor.interface_lab.execution.action_discovery import (
    build_action_count_maps,
    discover_action_graph,
    merge_action_counts,
    query_action_endpoints,
)


MAX_HISTORY_ITEMS = 30


class ActionGoalRuntime:
    """Interface Lab runtime 상태와 cache를 관리하는 클래스입니다."""

    def __init__(
        self,
        *,
        lock: Any,
        node_getter: Callable[[], Any],
    ) -> None:
        self._lock = lock
        self._node_getter = node_getter
        self._client_pool: RuntimeClientPool[tuple[str, str], ActionClient] = RuntimeClientPool(lock)
        self._history = BoundedExecutionHistory(lock, MAX_HISTORY_ITEMS)
        self._goal_handles: dict[tuple[str, str], Any] = {}
        self._receive_reset_at: float | None = None
        self._receive_reset_by_key: dict[tuple[str | None, str | None], float] = {}

    def clear(self) -> None:
        """Interface Lab에서 cache와 runtime 상태를 초기화하는 함수입니다."""
        with self._lock:
            self._goal_handles = {}
            self._receive_reset_at = None
            self._receive_reset_by_key = {}
        self._client_pool.clear()
        self._history.clear()

    def callable_actions(self) -> dict[str, Any]:
        """등록·import 가능하고 현재 Graph와 일치하는 Action 후보를 반환합니다."""
        refresh_install_python_paths()
        registered = self._registered_actions()
        graph = self._action_graph()
        actions: list[dict[str, Any]] = []

        for entry in registered:
            action_type = entry['action_type']
            matching = [
                item for item in graph
                if item['type'] == action_type
            ]
            if not matching:
                actions.append(self._action_state(entry, None))
                continue
            for graph_item in matching:
                actions.append(self._action_state(entry, graph_item))

        actions.sort(key=lambda item: (item['action_type'], item['action_name']))
        return {
            'actions': actions,
            'meta': {
                'count': len(actions),
                'registered_count': len(registered),
                'callable_count': sum(1 for item in actions if item['callable']),
            },
        }

    def send_goal(
        self,
        *,
        action_name: str,
        action_type: str,
        goal_data: dict[str, Any],
        timeout_sec: float | None = None,
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

        return execute_action_goal(
            action_name=action_name,
            action_type=action_type,
            goal_data=goal_data,
            timeout=timeout,
            client_getter=self._client,
            result_builder=self._result,
            record_history=self._record_history,
            goal_handle_store=self._store_goal_handle,
            goal_handle_remove=self._remove_goal_handle,
        )

    def _store_goal_handle(self, action_name: str, action_type: str, goal_handle: Any) -> None:
        with self._lock:
            self._goal_handles[(action_name, action_type)] = goal_handle

    def _remove_goal_handle(self, action_name: str, action_type: str) -> None:
        with self._lock:
            self._goal_handles.pop((action_name, action_type), None)

    def cancel_goal(
        self,
        *,
        action_name: str,
        action_type: str,
        timeout_sec: float | None = None,
    ) -> dict[str, Any]:
        """Cancel the active user-submitted goal for an exact name/type pair."""
        timeout = _normalized_timeout(timeout_sec)
        with self._lock:
            goal_handle = self._goal_handles.get((action_name, action_type))
        if goal_handle is None:
            raise ActionGoalError('취소할 활성 Goal을 찾을 수 없습니다.')
        event = threading.Event()
        future = goal_handle.cancel_goal_async()
        future.add_done_callback(lambda _future: event.set())
        if not event.wait(timeout=timeout):
            raise ActionGoalError(f'action cancel timeout after {timeout:.2f}s')
        response = future.result()
        goals_canceling = getattr(response, 'goals_canceling', [])
        accepted = bool(goals_canceling)
        return {
            'success': accepted,
            'action_name': action_name,
            'action_type': action_type,
            'cancel_requested': True,
            'cancel_accepted': accepted,
        }

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
        goals = self.history()['goals']
        events = []
        for goal_index, goal in enumerate(goals):
            goal_summary = _goal_summary(goal)
            sent_at = goal.get('sent_at')
            if (
                self._receive_reset_at is not None
                and sent_at is not None
                and sent_at <= self._receive_reset_at
            ):
                continue
            reset_at = self._receive_reset_by_key.get(
                (goal.get('action_name'), goal.get('action_type')),
            )
            if reset_at is not None and sent_at is not None and sent_at <= reset_at:
                continue
            feedback_items = goal.get('feedback') if isinstance(goal.get('feedback'), list) else []
            for feedback_index, feedback in enumerate(feedback_items):
                events.append({
                    'id': f"action-feedback-{goal.get('sent_at', goal_index)}-{feedback_index}",
                    'direction': 'action_feedback',
                    'action_name': goal.get('action_name'),
                    'action_type': goal.get('action_type'),
                    'goal': goal.get('goal'),
                    'feedback': feedback,
                    'result': None,
                    'status': 'feedback',
                    'success': goal.get('success') is True,
                    'error_type': goal.get('error_type'),
                    'error': goal.get('error'),
                    'sent_to_server': goal.get('sent_to_server', False),
                    'goal_sent_at': goal.get('sent_at'),
                    'received_at': goal.get('sent_at'),
                    'execution_time_ms': goal.get('elapsed_ms'),
                    'execution_source': goal.get('execution_source'),
                    'requester_node': goal.get('requester_node'),
                    'raw': goal,
                })
            events.append({
                'id': f"action-result-{goal.get('sent_at', goal_index)}-{goal_index}",
                'direction': 'action_result',
                'action_name': goal.get('action_name'),
                'action_type': goal.get('action_type'),
                'goal': goal.get('goal'),
                'feedback': None,
                'result': goal.get('result'),
                'status': goal_summary['last_goal_status'],
                'success': goal.get('success') is True,
                'error_type': goal.get('error_type'),
                'error': goal.get('error'),
                'sent_to_server': goal.get('sent_to_server', False),
                'goal_sent_at': goal.get('sent_at'),
                'received_at': goal.get('sent_at'),
                'execution_time_ms': goal.get('elapsed_ms'),
                'execution_source': goal.get('execution_source'),
                'requester_node': goal.get('requester_node'),
                'raw': goal,
            })
        return {'history': events, 'meta': {'count': len(events)}}

    def reset_receive_history(
        self,
        *,
        action_name: str | None = None,
        action_type: str | None = None,
    ) -> dict[str, Any]:
        """선택한 Action의 feedback·result 이력 초기화 시각을 갱신합니다."""
        previous = len([
            item for item in self.receive_history()['history']
            if not action_name
            or (item.get('action_name') == action_name and item.get('action_type') == action_type)
        ])
        if action_name:
            self._receive_reset_by_key[(action_name, action_type)] = time()
        else:
            self._receive_reset_at = time()
        return {'cleared': previous}

    def summary_by_action(self) -> dict[tuple[str, str], dict[str, Any]]:
        """Action 이름·타입별 최근 Goal 결과와 누적 건수를 요약합니다."""
        goals = self._history.snapshot()
        summaries: dict[tuple[str, str], dict[str, Any]] = {}
        for goal in reversed(goals):
            key = (str(goal.get('action_name') or ''), str(goal.get('action_type') or ''))
            if not key[0] or not key[1]:
                continue
            summary = summaries.setdefault(key, {
                'goal_count': 0,
                'success_count': 0,
                'failure_count': 0,
                'canceled_count': 0,
                'history': [],
            })
            goal_summary = _goal_summary(goal)
            summary['goal_count'] += 1
            if goal.get('success') is True:
                summary['success_count'] += 1
            else:
                summary['failure_count'] += 1
            if goal_summary['last_goal_status'] == 'canceled':
                summary['canceled_count'] += 1
            summary['history'].insert(0, goal_summary)
            summary['history'] = summary['history'][:5]
            summary.update(goal_summary)
        return summaries

    def dashboard_state_by_action(
        self,
    ) -> dict[tuple[str, str], dict[str, bool]]:
        """Action별 Interface Lab Client 생성 상태를 반환합니다."""
        return {
            key: {'interface_client_created': True}
            for key in self._client_pool.keys()
        }

    def _allowed_action(
        self,
        action_name: str,
        action_type: str,
    ) -> dict[str, Any] | None:
        registered = self._registered_actions()
        if not any(
            item['action_type'] == action_type
            and item['import_available'] is True
            for item in registered
        ):
            return None

        for item in self._action_graph():
            if (
                item['name'] == action_name
                and item['type'] == action_type
                and item['server_count'] > 0
            ):
                return item
        return None

    def _registered_actions(self) -> list[dict[str, Any]]:
        registry = registry_snapshot()['interface_registry']
        actions = []
        for item in registry.get('actions', []):
            build = item.get('build') or {}
            package_name = build.get('interface_package')
            type_name = item.get('type_name')
            if not package_name or not type_name:
                continue
            action_type = f'{package_name}/action/{type_name}'
            goal_schema = item.get('parsed', {}).get('goal', [])
            result_schema = item.get('parsed', {}).get('result', [])
            feedback_schema = item.get('parsed', {}).get('feedback', [])
            if build.get('import_available') is True and not goal_schema:
                goal_schema, result_schema, feedback_schema = _schema_from_action_class(action_type)
            actions.append({
                'file_name': item.get('file_name'),
                'type_name': type_name,
                'action_type': action_type,
                'goal_schema': goal_schema,
                'result_schema': result_schema,
                'feedback_schema': feedback_schema,
                'saved_path': build.get('saved_path'),
                'import_available': build.get('import_available') is True,
                'import_error': build.get('import_error'),
                'source': item.get('source', 'single_upload'),
                'package_name': package_name,
            })
        actions.extend(registered_package_actions())
        return actions

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

    def _client(self, name: str, action_type: str, action_class: type):
        key = (name, action_type)
        def create_client():
            node = self._node_getter()
            if node is None:
                raise ActionGoalError('ROS2 monitor node가 실행 중이 아닙니다.')
            return ActionClient(node, action_class, name)

        return self._client_pool.get_or_create(key, create_client)

    def _action_state(
        self,
        entry: dict[str, Any],
        graph_item: dict[str, Any] | None,
    ) -> dict[str, Any]:
        server_count = int(graph_item.get('server_count') or 0) if graph_item else 0
        server_available = server_count > 0
        import_available = entry['import_available'] is True
        callable_now = import_available and server_available
        reason = None
        if not import_available:
            reason = entry.get('import_error') or 'import 불가'
        elif not server_available:
            reason = '서버 없음'
        return {
            'action_name': graph_item['name'] if graph_item else '',
            'action_type': entry['action_type'],
            'full_type': entry['action_type'],
            'graph_type': graph_item['type'] if graph_item else None,
            'selected_import_type': entry['action_type'],
            'file_name': entry['file_name'],
            'type_name': entry['type_name'],
            'goal_schema': entry['goal_schema'],
            'result_schema': entry['result_schema'],
            'feedback_schema': entry['feedback_schema'],
            'import_available': import_available,
            'import_error': entry.get('import_error'),
            'server_available': server_available,
            'server_count': server_count,
            'client_count': int(graph_item.get('client_count') or 0) if graph_item else 0,
            'callable': callable_now,
            'executable': callable_now,
            'reason': reason,
            'saved_path': entry.get('saved_path'),
            'source': entry.get('source', 'single_interface'),
            'package_name': entry.get('package_name'),
        }

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
        payload = {
            'success': success,
            'action_name': action_name,
            'action_type': action_type,
            'goal': goal_data,
            'accepted': accepted,
            'elapsed_ms': (time() - started_at) * 1000.0,
            'feedback': feedback,
            'result': result,
            'timeout_sec': timeout_sec,
            'sent_at': started_at,
            'sent_to_server': sent_to_server,
        }
        if status is not None:
            payload['status'] = status
        if error is not None:
            payload['error'] = error
        if error_type is not None:
            payload['error_type'] = error_type
        if details is not None:
            payload['details'] = details
        return payload
