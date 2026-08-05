"""RosMonitor coordinator의 ros_monitor 관련 기능을 담당하는 모듈입니다."""

from __future__ import annotations

from threading import Lock, Thread
from time import time
from typing import Any

import rclpy
from rclpy.node import Node

from ros2_dashboard_backend.action.alerts import build_action_alerts
from ros2_dashboard_backend.interface_lab.execution.action_goal_runtime import ActionGoalRuntime
from ros2_dashboard_backend.action.runtime import ActionRuntime
from ros2_dashboard_backend.config_loader import MonitorConfig
from ros2_dashboard_backend.interface_lab.execution.topic_runtime import InterfaceReceiveRuntime
from ros2_dashboard_backend.node.alerts import build_node_alerts
from ros2_dashboard_backend.node.runtime import NodeRuntime
from ros2_dashboard_backend.service.alerts import build_service_alerts
from ros2_dashboard_backend.interface_lab.execution.service_call_runtime import ServiceCallRuntime
from ros2_dashboard_backend.service.runtime import ServiceRuntime
from ros2_dashboard_backend.topic.alerts import (
    build_alert_meta,
    build_alerts,
    retain_alerts,
)
from ros2_dashboard_backend.topic.runtime import TopicRuntime
from ros2_dashboard_backend.topology import (
    build_role_node_index,
    related_nodes,
)
from ros2_dashboard_backend.user_preferences import UserPreferencesStore


class RosMonitor:
    """RosMonitor coordinator의 RosMonitor 역할을 담당하는 클래스입니다."""

    def __init__(
        self,
        config: MonitorConfig | None = None,
        *,
        user_preferences: UserPreferencesStore | None = None,
    ) -> None:
        """공통 Lock과 Topic·Service·Action·Node Runtime을 조립합니다."""
        self._config = config or MonitorConfig()
        self._user_preferences = user_preferences
        self._node: Node | None = None
        self._thread: Thread | None = None
        self._lock = Lock()
        self._retained_alerts: dict[str, dict[str, Any]] = {}
        self._alert_history: list[dict[str, Any]] = []
        self._dismissed_alert_ids: set[str] = set()
        self._visible_alert_ids: set[str] = set()
        self._action_runtime = ActionRuntime(
            config=self._config,
            lock=self._lock,
            node_getter=lambda: self._node,
        )
        self._action_goal_runtime = ActionGoalRuntime(
            lock=self._lock,
            node_getter=lambda: self._node,
        )
        self._topic_runtime = TopicRuntime(
            action_monitor_subscriber_count=(
                self._action_runtime.monitor_subscriber_count
            ),
            config=self._config,
            lock=self._lock,
            node_getter=lambda: self._node,
        )
        self._node_runtime = NodeRuntime(
            exclude_names=self._config.nodes_exclude,
            exclude_prefixes=self._config.nodes_exclude_prefixes,
            include_names=self._config.nodes_include,
            primary_names=self._config.nodes_primary_names,
            lock=self._lock,
            node_getter=lambda: self._node,
            stale_timeout_sec=self._config.nodes_stale_timeout_sec,
        )
        self._service_runtime = ServiceRuntime(
            config=self._config,
            lock=self._lock,
            node_getter=lambda: self._node,
        )
        self._service_call_runtime = ServiceCallRuntime(
            lock=self._lock,
            node_getter=lambda: self._node,
        )
        self._receive_runtime = InterfaceReceiveRuntime(
            lock=self._lock,
            node_getter=lambda: self._node,
        )

    def start(self) -> None:
        """rclpy Node, Graph 갱신 timer, spin thread를 시작합니다."""
        if self._thread and self._thread.is_alive():
            return

        rclpy.init(args=None)
        self._node = Node('ros2_dashboard_topic_monitor')
        self._node.create_timer(
            self._config.poll_interval_sec,
            self._update_graph,
        )
        self._update_graph()

        self._thread = Thread(target=self._spin, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        """timer와 실행 Runtime을 정리하고 rclpy Node를 종료합니다."""
        node = self._node
        self._receive_runtime.stop_all_continuous_publishes()

        if rclpy.ok():
            rclpy.shutdown()

        if self._thread is not None:
            self._thread.join(timeout=2.0)

        if node is not None:
            node.destroy_node()

        self._thread = None
        self._node = None
        self._topic_runtime.clear()
        self._action_runtime.clear()
        self._action_goal_runtime.clear()
        self._service_runtime.clear()
        self._service_call_runtime.clear()
        self._receive_runtime.clear()
        self._node_runtime.clear()
        with self._lock:
            self._retained_alerts = {}
            self._alert_history = []
            self._dismissed_alert_ids = set()
            self._visible_alert_ids = set()

    def snapshot(self) -> dict[str, Any]:
        """Topic Cache에 Publisher·Subscriber Node 관계 수를 합쳐 반환합니다."""
        snapshot = self._topic_runtime.snapshot()
        role_nodes = self._role_node_index()
        internal_node = self._monitor_node_full_name()
        interface_states = _runtime_state_map(
            getattr(self, '_receive_runtime', None),
            'dashboard_state_by_topic',
        )
        for topic in snapshot['topics']:
            topic_types = topic.get('types') or []
            topic_name = str(topic.get('name') or '')
            interface_topic_states = [
                interface_states.get((topic_name, str(topic_type)), {})
                for topic_type in topic_types
            ]
            all_publisher_nodes = related_nodes(
                role_nodes,
                role='topic_publisher',
                resource_name=str(topic.get('name') or ''),
                resource_types=topic_types,
            )
            all_subscriber_nodes = related_nodes(
                role_nodes,
                role='topic_subscriber',
                resource_name=str(topic.get('name') or ''),
                resource_types=topic_types,
            )
            publisher_nodes = _without_internal_node(
                all_publisher_nodes,
                internal_node,
            )
            subscriber_nodes = _without_internal_node(
                all_subscriber_nodes,
                internal_node,
            )
            internal_publisher_nodes = [
                name for name in all_publisher_nodes
                if name == internal_node
            ]
            internal_subscriber_nodes = [
                name for name in all_subscriber_nodes
                if name == internal_node
            ]
            topic.update({
                'publisher_node_count': len(publisher_nodes),
                'subscriber_node_count': len(subscriber_nodes),
                'total_publisher_node_count': len(all_publisher_nodes),
                'total_subscriber_node_count': len(all_subscriber_nodes),
                'internal_publisher_node_count': (
                    len(all_publisher_nodes) - len(publisher_nodes)
                ),
                'internal_subscriber_node_count': (
                    len(all_subscriber_nodes) - len(subscriber_nodes)
                ),
                'external_subscriber_node_count': len(subscriber_nodes),
                'publisher_nodes': publisher_nodes,
                'subscriber_nodes': subscriber_nodes,
                'all_publisher_nodes': all_publisher_nodes,
                'all_subscriber_nodes': all_subscriber_nodes,
                'internal_publisher_nodes': internal_publisher_nodes,
                'internal_subscriber_nodes': internal_subscriber_nodes,
                'external_subscriber_nodes': subscriber_nodes,
                'publisher_endpoint_count': int(topic.get('publisher_count') or 0),
                'subscriber_endpoint_count': int(topic.get('subscriber_count') or 0),
                'internal_subscriber_endpoint_count': int(
                    topic.get('monitor_subscriber_count') or 0
                ),
                'external_subscriber_endpoint_count': int(
                    topic.get('external_subscriber_count') or 0
                ),
                'dashboard_communication': {
                    'auto_monitoring_active': topic.get('deep_monitoring') is True,
                    'interface_receive_active': any(
                        state.get('interface_receive_active') is True
                        for state in interface_topic_states
                    ),
                    'interface_publisher_created': any(
                        state.get('interface_publisher_created') is True
                        for state in interface_topic_states
                    ),
                    'execution_node': _dashboard_execution_node(internal_node)
                    if any(
                        state.get('interface_publisher_created') is True
                        for state in interface_topic_states
                    ) else None,
                },
            })
            self._apply_primary_state(
                topic,
                kind='topics',
                name=str(topic.get('name') or ''),
            )
        return snapshot

    def service_snapshot(
        self,
        *,
        include_hidden: bool = False,
    ) -> dict[str, Any]:
        """Service Cache에 Node 관계와 최근 사용자 Call 결과를 합쳐 반환합니다."""
        snapshot = self._service_runtime.snapshot(include_hidden=True)
        role_nodes = self._role_node_index()
        internal_node = self._monitor_node_full_name()
        summaries = self._service_call_runtime.summary_by_service()
        dashboard_states = _runtime_state_map(
            self._service_call_runtime,
            'dashboard_state_by_service',
        )
        callable_items = self._service_call_runtime.callable_services()['services']
        allowlisted_types = {item.get('service_type') for item in callable_items}
        callable_names = {
            (item.get('service_name'), item.get('service_type'))
            for item in callable_items
            if item.get('callable') is True
        }
        for service in snapshot['services']:
            key = (service.get('name'), service.get('type'))
            all_server_nodes = related_nodes(
                role_nodes,
                role='service_server',
                resource_name=str(service.get('name') or ''),
                resource_types=[service.get('type')],
            )
            all_client_nodes = related_nodes(
                role_nodes,
                role='service_client',
                resource_name=str(service.get('name') or ''),
                resource_types=[service.get('type')],
            )
            server_nodes = _without_internal_node(
                all_server_nodes,
                internal_node,
            )
            client_nodes = _without_internal_node(
                all_client_nodes,
                internal_node,
            )
            service.update({
                'server_node_count': len(server_nodes),
                'client_node_count': len(client_nodes),
                'server_nodes': server_nodes,
                'client_nodes': client_nodes,
                'total_server_node_count': len(all_server_nodes),
                'total_client_node_count': len(all_client_nodes),
                'internal_server_node_count': (
                    len(all_server_nodes) - len(server_nodes)
                ),
                'internal_client_node_count': (
                    len(all_client_nodes) - len(client_nodes)
                ),
                'server_endpoint_count': int(service.get('server_count') or 0),
                'client_endpoint_count': int(service.get('client_count') or 0),
            })
            summary = summaries.get(key)
            allowlisted = service.get('type') in allowlisted_types
            service['allowlisted'] = allowlisted
            service['callable'] = key in callable_names
            if summary:
                service['last_call_summary'] = summary
            service['call_status'] = (
                summary.get('last_call_status')
                if summary
                else 'not_called'
            )
            service['effective_status'] = _service_effective_status(
                graph_status=service.get('status'),
                server_count=service.get('server_count'),
                summary=summary,
            )
            configured_primary = (
                service.get('name') in self._config.services_primary_names
            )
            if allowlisted:
                service['primary_priority'] = 1
                service['primary_source'] = 'registered_interface'
            elif configured_primary:
                service['primary_priority'] = 2
                service['primary_source'] = 'monitor_config'
            else:
                service['primary_priority'] = None
                service['primary_source'] = None
            service['primary'] = service['primary_priority'] is not None
            self._apply_primary_state(
                service,
                kind='services',
                name=str(service.get('name') or ''),
            )
            service['call_count'] = summary.get('call_count', 0) if summary else 0
            service['success_count'] = summary.get('success_count', 0) if summary else 0
            service['failure_count'] = summary.get('failure_count', 0) if summary else 0
            service['dashboard_communication'] = {
                'interface_client_created': (
                    dashboard_states.get(key, {}).get(
                        'interface_client_created',
                    ) is True
                ),
                'has_call_history': summary is not None,
                'execution_node': (
                    summary.get('requester_node')
                    if summary and summary.get('requester_node')
                    else _dashboard_execution_node(internal_node)
                    if dashboard_states.get(key, {}).get(
                        'interface_client_created',
                    ) is True
                    else None
                ),
            }
        if not include_hidden:
            all_services = snapshot['services']
            preferences = getattr(self, '_user_preferences', None)
            snapshot['services'] = [
                service for service in all_services
                if (
                    service.get('hidden_by_default') is not True
                    or service.get('user_primary') is True
                )
            ]
            snapshot['meta']['count'] = len(snapshot['services'])
            snapshot['meta']['visible_count'] = len(snapshot['services'])
            snapshot['meta']['hidden_count'] = sum(
                1 for service in all_services
                if (
                    service.get('hidden_by_default') is True
                    and not (
                        preferences
                        and preferences.contains(
                            'services',
                            str(service.get('name') or ''),
                        )
                    )
                )
            )
        return snapshot

    def callable_services(self) -> dict[str, Any]:
        """Registry 타입과 현재 Graph가 일치하는 호출 가능 Service를 반환합니다."""
        return self._service_call_runtime.callable_services()

    def call_service(
        self,
        *,
        service_name: str,
        service_type: str,
        request_data: dict[str, Any],
        timeout_sec: float | None = None,
    ) -> dict[str, Any]:
        """사용자 Service 요청을 ServiceCallRuntime에 전달합니다."""
        return self._service_call_runtime.call_service(
            service_name=service_name,
            service_type=service_type,
            request_data=request_data,
            timeout_sec=timeout_sec,
        )

    def service_call_history(self) -> dict[str, Any]:
        """Interface Lab에서 실행한 Service Call 이력을 반환합니다."""
        return self._service_call_runtime.history()

    def receive_service_history(self) -> dict[str, Any]:
        """화면에 표시할 Service 응답 수신 이력을 반환합니다."""
        return self._service_call_runtime.receive_history()

    def reset_receive_service_history(
        self,
        *,
        service_name: str | None = None,
        service_type: str | None = None,
    ) -> dict[str, Any]:
        """지정한 시점 이전의 Service 수신 이력을 숨기도록 초기화합니다."""
        return self._service_call_runtime.reset_receive_history(
            service_name=service_name,
            service_type=service_type,
        )

    def action_snapshot(self) -> dict[str, Any]:
        """Action Cache에 Node 관계와 최근 사용자 Goal 결과를 합쳐 반환합니다."""
        snapshot = self._action_runtime.snapshot()
        role_nodes = self._role_node_index()
        internal_node = self._monitor_node_full_name()
        summaries = self._action_goal_runtime.summary_by_action()
        dashboard_states = _runtime_state_map(
            self._action_goal_runtime,
            'dashboard_state_by_action',
        )
        callable_items = self._action_goal_runtime.callable_actions()['actions']
        allowlisted_types = {item.get('action_type') for item in callable_items}
        callable_names = {
            (item.get('action_name'), item.get('action_type'))
            for item in callable_items
            if item.get('callable') is True
        }
        for action in snapshot['actions']:
            key = (action.get('name'), action.get('type'))
            all_server_nodes = related_nodes(
                role_nodes,
                role='action_server',
                resource_name=str(action.get('name') or ''),
                resource_types=[action.get('type')],
            )
            all_client_nodes = related_nodes(
                role_nodes,
                role='action_client',
                resource_name=str(action.get('name') or ''),
                resource_types=[action.get('type')],
            )
            server_nodes = _without_internal_node(
                all_server_nodes,
                internal_node,
            )
            client_nodes = _without_internal_node(
                all_client_nodes,
                internal_node,
            )
            action.update({
                'server_node_count': len(server_nodes),
                'client_node_count': len(client_nodes),
                'server_nodes': server_nodes,
                'client_nodes': client_nodes,
                'total_server_node_count': len(all_server_nodes),
                'total_client_node_count': len(all_client_nodes),
                'internal_server_node_count': (
                    len(all_server_nodes) - len(server_nodes)
                ),
                'internal_client_node_count': (
                    len(all_client_nodes) - len(client_nodes)
                ),
                'server_endpoint_count': int(action.get('server_count') or 0),
                'client_endpoint_count': int(action.get('client_count') or 0),
            })
            summary = summaries.get(key)
            allowlisted = action.get('type') in allowlisted_types
            action['allowlisted'] = allowlisted
            action['callable'] = key in callable_names
            if summary:
                action['last_goal_summary'] = summary
            action['goal_count'] = summary.get('goal_count', 0) if summary else 0
            action['success_count'] = summary.get('success_count', 0) if summary else 0
            action['failure_count'] = summary.get('failure_count', 0) if summary else 0
            action['canceled_count'] = summary.get('canceled_count', 0) if summary else 0
            configured_primary = (
                action.get('name') in self._config.actions_primary_names
            )
            runtime = action.get('runtime') or {}
            observed_primary = (
                int(runtime.get('observed_goal_count') or 0) > 0
                or str(runtime.get('last_goal_status') or '').lower()
                not in {'', 'unknown'}
                or bool(runtime.get('feedback_preview'))
                or bool(runtime.get('result_preview'))
                or bool(runtime.get('result_status'))
                or bool(runtime.get('result_error'))
            )
            if allowlisted:
                action['primary_priority'] = 1
                action['primary_source'] = 'registered_interface'
            elif configured_primary:
                action['primary_priority'] = 2
                action['primary_source'] = 'monitor_config'
            elif observed_primary:
                action['primary_priority'] = 3
                action['primary_source'] = 'observed_activity'
            else:
                action['primary_priority'] = None
                action['primary_source'] = None
            action['primary'] = action['primary_priority'] is not None
            self._apply_primary_state(
                action,
                kind='actions',
                name=str(action.get('name') or ''),
            )
            action['dashboard_communication'] = {
                'monitoring_active': (
                    action.get('status_supported') is True
                    or action.get('feedback_supported') is True
                ),
                'status_monitoring_active': (
                    action.get('status_supported') is True
                ),
                'feedback_monitoring_active': (
                    action.get('feedback_supported') is True
                ),
                'interface_client_created': (
                    dashboard_states.get(key, {}).get(
                        'interface_client_created',
                    ) is True
                ),
                'has_goal_history': summary is not None,
                'execution_node': (
                    summary.get('requester_node')
                    if summary and summary.get('requester_node')
                    else _dashboard_execution_node(internal_node)
                    if dashboard_states.get(key, {}).get(
                        'interface_client_created',
                    ) is True
                    else None
                ),
            }
        return snapshot

    def callable_actions(self) -> dict[str, Any]:
        """Registry 타입과 현재 Graph가 일치하는 실행 가능 Action을 반환합니다."""
        return self._action_goal_runtime.callable_actions()

    def send_action_goal(
        self,
        *,
        action_name: str,
        action_type: str,
        goal_data: dict[str, Any],
        timeout_sec: float | None = None,
    ) -> dict[str, Any]:
        """사용자 Goal을 ActionGoalRuntime에 전달합니다."""
        return self._action_goal_runtime.send_goal(
            action_name=action_name,
            action_type=action_type,
            goal_data=goal_data,
            timeout_sec=timeout_sec,
        )

    def action_goal_history(self) -> dict[str, Any]:
        """Interface Lab에서 실행한 Action Goal 이력을 반환합니다."""
        return self._action_goal_runtime.history()

    def receive_action_history(self) -> dict[str, Any]:
        """Goal 실행 중 받은 feedback과 result 이력을 반환합니다."""
        return self._action_goal_runtime.receive_history()

    def reset_receive_action_history(
        self,
        *,
        action_name: str | None = None,
        action_type: str | None = None,
    ) -> dict[str, Any]:
        """지정한 Action의 feedback·result 수신 이력을 초기화합니다."""
        return self._action_goal_runtime.reset_receive_history(
            action_name=action_name,
            action_type=action_type,
        )

    def start_receive_topic(self, *, topic_name: str, topic_type: str, history_limit: int = 100) -> dict[str, Any]:
        """사용자가 선택한 Topic의 Interface Lab 구독을 시작합니다."""
        return self._receive_runtime.start_topic(
            topic_name=topic_name,
            topic_type=topic_type,
            history_limit=history_limit,
        )

    def stop_receive_topic(self, *, topic_name: str, topic_type: str | None = None) -> dict[str, Any]:
        """사용자가 시작한 Interface Lab Topic 구독을 중지합니다."""
        return self._receive_runtime.stop_topic(topic_name=topic_name, topic_type=topic_type)

    def receive_topics(self) -> dict[str, Any]:
        """현재 Interface Lab에서 수신 중인 Topic 목록을 반환합니다."""
        return self._receive_runtime.topics()

    def receive_topic_history(
        self,
        *,
        topic_name: str | None = None,
        topic_type: str | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        """조건에 맞는 Interface Lab Topic 수신 이력을 반환합니다."""
        return self._receive_runtime.topic_history(
            topic_name=topic_name,
            topic_type=topic_type,
            limit=limit,
        )

    def reset_receive_topic_history(
        self,
        *,
        topic_name: str | None = None,
        topic_type: str | None = None,
    ) -> dict[str, Any]:
        """지정한 Topic의 Interface Lab 수신 이력을 초기화합니다."""
        return self._receive_runtime.reset_topic_history(
            topic_name=topic_name,
            topic_type=topic_type,
        )

    def callable_messages(self) -> dict[str, Any]:
        """Interface Lab에서 사용할 수 있는 import 가능 Message 타입을 반환합니다."""
        return self._receive_runtime.callable_messages()

    def message_schema(self, *, message_type: str) -> dict[str, Any]:
        """RosMonitor coordinator에서 interface schema를 반환하는 함수입니다."""
        return self._receive_runtime.message_schema(message_type=message_type)

    def publish_topic(
        self,
        *,
        topic_name: str,
        topic_type: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """RosMonitor coordinator에서 Topic 메시지를 발행하는 함수입니다."""
        return self._receive_runtime.publish_topic(
            topic_name=topic_name,
            topic_type=topic_type,
            payload=payload,
        )

    def start_continuous_topic_publish(
        self,
        *,
        topic_name: str,
        topic_type: str,
        payload: dict[str, Any],
        hz: float,
    ) -> dict[str, Any]:
        """Interface Lab의 사용자 명시 주기 발행을 시작합니다."""
        return self._receive_runtime.start_continuous_publish(
            topic_name=topic_name,
            topic_type=topic_type,
            payload=payload,
            hz=hz,
        )

    def stop_continuous_topic_publish(
        self,
        *,
        topic_name: str,
        topic_type: str,
    ) -> dict[str, Any]:
        """Interface Lab의 사용자 명시 주기 발행을 중지합니다."""
        return self._receive_runtime.stop_continuous_publish(
            topic_name=topic_name,
            topic_type=topic_type,
        )

    def continuous_topic_publishes(self) -> dict[str, Any]:
        """Interface Lab의 주기 발행 상태를 반환합니다."""
        return self._receive_runtime.continuous_publishes()

    def topic_publish_history(self, *, limit: int | None = None) -> dict[str, Any]:
        """Interface Lab에서 실행한 Topic Publish 이력을 반환합니다."""
        return self._receive_runtime.publish_history(limit=limit)

    def reset_topic_publish_history(
        self,
        *,
        topic_name: str | None = None,
        topic_type: str | None = None,
    ) -> dict[str, Any]:
        """지정한 Topic의 Publish 이력을 초기화합니다."""
        return self._receive_runtime.reset_publish_history(
            topic_name=topic_name,
            topic_type=topic_type,
        )

    def node_snapshot(self) -> dict[str, Any]:
        """Node Cache에 Dashboard 내부 Node 여부를 표시해 반환합니다."""
        snapshot = self._node_runtime.snapshot()
        internal_node = self._monitor_node_full_name()
        has_resource_runtimes = all(hasattr(self, name) for name in (
            '_topic_runtime',
            '_service_runtime',
            '_service_call_runtime',
            '_action_runtime',
            '_action_goal_runtime',
        ))
        system_resources = (
            _system_primary_resources(
                topics=self.snapshot()['topics'],
                services=self.service_snapshot(include_hidden=True)['services'],
                actions=self.action_snapshot()['actions'],
            )
            if has_resource_runtimes
            else set()
        )
        for node in snapshot['nodes']:
            node['is_internal'] = node.get('full_name') == internal_node
            node['primary'] = bool(
                node.get('primary')
                or node.get('status') == 'disconnected'
                or _node_uses_system_primary(node, system_resources)
            )
            self._apply_primary_state(
                node,
                kind='nodes',
                name=str(node.get('full_name') or node.get('name') or ''),
            )
        return snapshot

    def _apply_primary_state(
        self,
        item: dict[str, Any],
        *,
        kind: str,
        name: str,
    ) -> None:
        system_primary = bool(item.get('primary'))
        preferences = getattr(self, '_user_preferences', None)
        user_primary = bool(
            preferences
            and name
            and preferences.contains(kind, name)
        )
        item['system_primary'] = system_primary
        item['user_primary'] = user_primary
        item['is_primary'] = system_primary or user_primary
        item['primary'] = item['is_primary']

    def _role_node_index(self) -> dict[tuple[str, str, str], set[str]]:
        return build_role_node_index(self._node_runtime.snapshot()['nodes'])

    def _monitor_node_full_name(self) -> str:
        node = self._node
        if node is None:
            return '/ros2_dashboard_topic_monitor'
        try:
            return str(node.get_fully_qualified_name())
        except Exception:
            return '/ros2_dashboard_topic_monitor'

    def websocket_snapshot(self) -> dict[str, Any]:
        """현재 Cache에서 WebSocket 전송용 경량 요약을 만듭니다."""
        timestamp = time()
        topic_snapshot = self.snapshot()
        service_snapshot = self.service_snapshot()
        action_snapshot = self.action_snapshot()
        node_snapshot = self.node_snapshot()
        alerts = self.alerts()

        return {
            'type': 'monitor_snapshot',
            'timestamp': timestamp,
            'data': {
                'topics': self._websocket_topic_meta(
                    topic_snapshot['topics'],
                ),
                'services': self._websocket_service_meta(
                    service_snapshot['services'],
                    service_snapshot['meta'],
                ),
                'actions': self._websocket_action_meta(
                    action_snapshot['actions'],
                    action_snapshot['meta'],
                ),
                'nodes': self._websocket_node_meta(
                    node_snapshot['nodes'],
                    node_snapshot['meta'],
                ),
                'alerts': alerts['data'],
            },
        }

    def latest_message(self, name: str) -> dict[str, Any]:
        """지정한 Topic의 최신 수신 메시지를 TopicRuntime에서 가져옵니다."""
        return self._topic_runtime.latest_message(name)

    def topic_hz(self, name: str) -> dict[str, Any]:
        """지정한 Topic의 현재 수신 Hz를 TopicRuntime에서 가져옵니다."""
        return self._topic_runtime.topic_hz(name)

    def alerts(self) -> dict[str, Any]:
        """모든 Runtime의 Alert를 합치고 active·resolved 이력을 갱신합니다."""
        detected_at = time()
        services = self.service_snapshot(include_hidden=True)['services']
        actions = self.action_snapshot()['actions']
        topics, subscriptions = self._topic_runtime.alert_snapshot()
        node_snapshot = self._node_runtime.snapshot()
        nodes = node_snapshot['nodes']

        alerts = build_alerts(
            topics=topics,
            subscriptions=subscriptions,
            detected_at=detected_at,
            stale_timeout_sec=self._config.stale_timeout_sec,
            required_stream_names=self._config.topics_required_stream_names,
            command_names=self._config.topics_command_names,
        )
        alerts.extend(
            build_service_alerts(
                services=services,
                detected_at=detected_at,
            ),
        )
        alerts.extend(
            build_action_alerts(
                actions=actions,
                detected_at=detected_at,
            ),
        )
        alerts.extend(
            build_node_alerts(
                nodes=nodes,
                detected_at=detected_at,
            ),
        )
        with self._lock:
            current_ids = {
                alert['id'] for alert in alerts if alert.get('id')
            }
            self._dismissed_alert_ids.intersection_update(current_ids)
            alerts = [
                alert for alert in alerts
                if alert.get('id') not in self._dismissed_alert_ids
            ]
            alerts = retain_alerts(
                alert_history=self._alert_history,
                current_alerts=alerts,
                history_limit=50,
                retained_alerts=self._retained_alerts,
                retained_codes={
                    'topic_message_missing',
                    'topic_stale',
                    'topic_disconnected',
                    'service_disconnected',
                    'service_call_failed',
                    'service_call_timeout',
                    'action_disconnected',
                    'action_goal_aborted',
                    'action_goal_canceled',
                    'action_goal_rejected',
                    'action_goal_send_failed',
                    'action_result_timeout',
                    'action_result_unavailable',
                    'node_stale',
                },
                detected_at=detected_at,
            )
            alert_history = [
                alert.copy() for alert in self._alert_history
            ]
            self._visible_alert_ids = {
                alert['id'] for alert in alerts
                if alert.get('id')
                and alert.get('alert_state') != 'resolved'
            }

        return {
            'success': True,
            'data': alerts,
            'history': alert_history,
            'meta': build_alert_meta(alerts),
            'message': 'ROS2 alerts fetched successfully',
        }

    def reset_alert_history(self) -> dict[str, int]:
        """해결된 Alert의 메모리 history만 삭제합니다."""
        with self._lock:
            cleared = len(self._alert_history)
            self._alert_history = []
        return {'cleared': cleared}

    def reset_current_alerts(self) -> dict[str, int]:
        """현재 Alert를 확인 처리하고 동일 발생 건을 숨깁니다."""
        with self._lock:
            dismissed_ids = set(self._visible_alert_ids)
            self._dismissed_alert_ids.update(dismissed_ids)
            for alert_id in dismissed_ids:
                self._retained_alerts.pop(alert_id, None)
            self._visible_alert_ids = set()
        return {'cleared': len(dismissed_ids)}

    @staticmethod
    def _websocket_topic_meta(
        topics: list[dict[str, Any]],
    ) -> dict[str, Any]:
        return {
            'count': len(topics),
            'active_count': sum(
                1 for topic in topics
                if topic.get('status') == 'active'
            ),
            'warning_count': sum(
                1 for topic in topics
                if topic.get('status') in (
                    'warning',
                    'stale',
                    'no_subscriber',
                    'waiting_publisher',
                )
            ),
            'error_count': sum(
                1 for topic in topics
                if topic.get('status') in ('error', 'critical')
                or topic.get('status') == 'disconnected'
            ),
            'deep_monitoring_count': sum(
                1 for topic in topics
                if topic.get('deep_monitoring') is True
            ),
            'stale_count': sum(
                1 for topic in topics
                if topic.get('status') in ('stale', 'disconnected')
            ),
            'latest': {
                topic['name']: {
                    'message_preview': topic.get('last_message_preview'),
                    'last_received_at': topic.get('last_received_at'),
                }
                for topic in topics
                if topic.get('last_message_preview') is not None
            },
        }

    @staticmethod
    def _websocket_service_meta(
        services: list[dict[str, Any]],
        meta: dict[str, Any],
    ) -> dict[str, int]:
        return {
            'count': int(meta.get('count') or meta.get('visible_count') or 0),
            'active_count': int(meta.get('active_count') or 0),
            'warning_count': int(meta.get('warning_count') or 0),
            'error_count': int(meta.get('error_count') or 0),
            'callable_count': sum(1 for service in services if service.get('callable') is True),
            'last_call_count': sum(1 for service in services if service.get('last_call_summary')),
        }

    @staticmethod
    def _websocket_action_meta(
        actions: list[dict[str, Any]],
        meta: dict[str, Any],
    ) -> dict[str, int]:
        return {
            'count': int(meta.get('count') or 0),
            'active_count': int(meta.get('active_count') or 0),
            'warning_count': int(meta.get('warning_count') or 0),
            'error_count': int(meta.get('error_count') or 0),
            'observed_goal_count': int(
                meta.get('observed_goal_count') or 0,
            ),
            'executing_count': sum(
                1 for action in actions
                if action.get('runtime', {}).get('last_goal_status')
                == 'executing'
            ),
            'failed_count': sum(
                1 for action in actions
                if action.get('runtime', {}).get('last_goal_status')
                == 'aborted'
            ),
            'callable_count': sum(1 for action in actions if action.get('callable') is True),
            'last_goal_count': sum(1 for action in actions if action.get('last_goal_summary')),
        }

    @staticmethod
    def _websocket_node_meta(
        nodes: list[dict[str, Any]],
        meta: dict[str, Any],
    ) -> dict[str, int]:
        return {
            'count': int(meta.get('count') or len(nodes)),
            'active_count': int(meta.get('active_count') or 0),
            'warning_count': int(meta.get('warning_count') or 0),
            'error_count': int(meta.get('error_count') or 0),
            'stale_count': sum(
                1 for node in nodes
                if node.get('status') in ('stale', 'disconnected')
            ),
        }

    def _spin(self) -> None:
        if self._node is None:
            return

        try:
            rclpy.spin(self._node)
        except rclpy.executors.ExternalShutdownException:
            pass
        except Exception:
            if rclpy.ok():
                raise

    def _update_graph(self) -> None:
        self._node_runtime.update()
        self._topic_runtime.update()
        self._service_runtime.update()
        self._action_runtime.update()
        # Service 자동 호출은 의도적으로 비활성화합니다.
        # 생존 상태는 Graph로 관찰하고 실제 요청/응답은 Interface Lab의
        # 사용자 명시 Call 기록으로만 확인합니다.


def _without_internal_node(
    node_names: list[str],
    internal_node: str,
) -> list[str]:
    """Dashboard 내부 Node를 제외한 ROS2 통신 참여 Node를 반환합니다."""
    return [name for name in node_names if name != internal_node]


def _dashboard_execution_node(internal_node: str) -> dict[str, Any]:
    return {
        'name': internal_node,
        'display_name': 'Dashboard Interface Lab',
        'is_internal': True,
    }


def _runtime_state_map(runtime: Any, method_name: str) -> dict[Any, Any]:
    """선택 Runtime이 제공하는 Dashboard 통신 상태를 안전하게 읽습니다."""
    method = getattr(runtime, method_name, None)
    if not callable(method):
        return {}
    return method()


def _system_primary_resources(
    *,
    topics: list[dict[str, Any]],
    services: list[dict[str, Any]],
    actions: list[dict[str, Any]],
) -> set[tuple[str, str, str]]:
    resources: set[tuple[str, str, str]] = set()
    for kind, items in (
        ('topic', topics),
        ('service', services),
        ('action', actions),
    ):
        for item in items:
            if item.get('system_primary') is not True:
                continue
            name = str(item.get('name') or '')
            types = item.get('types') or [item.get('type')]
            for full_type in types:
                if name and full_type:
                    resources.add((kind, name, str(full_type)))
    return resources


def _node_uses_system_primary(
    node: dict[str, Any],
    resources: set[tuple[str, str, str]],
) -> bool:
    for kind, fields in (
        ('topic', ('topic_publishers', 'topic_subscribers')),
        ('service', ('service_servers', 'service_clients')),
        ('action', ('action_servers', 'action_clients')),
    ):
        for field in fields:
            for entity in node.get(field) or []:
                name = str(entity.get('name') or '')
                types = entity.get('types') or [entity.get('type')]
                if any(
                    (kind, name, str(full_type)) in resources
                    for full_type in types
                    if full_type
                ):
                    return True
    return False


def _service_effective_status(
    *,
    graph_status: str | None,
    server_count: Any,
    summary: dict[str, Any] | None,
) -> str:
    status = str(graph_status or 'unknown')
    if status == 'disconnected' or int(server_count or 0) <= 0:
        return status

    if not summary or summary.get('sent_to_server') is not True:
        return status

    call_status = str(summary.get('last_call_status') or '')
    if call_status == 'timeout':
        return 'timeout'
    if call_status == 'success':
        return 'active'
    return 'failed'
