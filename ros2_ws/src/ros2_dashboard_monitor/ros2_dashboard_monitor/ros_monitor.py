"""RosMonitor coordinator의 ros_monitor 관련 기능을 담당하는 모듈입니다."""

from __future__ import annotations

from threading import Lock, Thread
from time import time
from typing import Any

import rclpy
from rclpy.node import Node

from ros2_dashboard_monitor.ros2_action.alerts import build_action_alerts
from ros2_dashboard_monitor.interface_lab.execution.action_goal_runtime import ActionGoalRuntime
from ros2_dashboard_monitor.ros2_action.runtime import ActionRuntime
from ros2_dashboard_monitor.config_loader import MonitorConfig
from ros2_dashboard_monitor.interface_lab.execution.topic_runtime import InterfaceReceiveRuntime
from ros2_dashboard_monitor.ros2_node.alerts import build_node_alerts
from ros2_dashboard_monitor.ros2_node.runtime import NodeRuntime
from ros2_dashboard_monitor.ros2_service.alerts import build_service_alerts
from ros2_dashboard_monitor.interface_lab.execution.service_call_runtime import ServiceCallRuntime
from ros2_dashboard_monitor.ros2_service.runtime import ServiceRuntime
from ros2_dashboard_monitor.ros2_topic.alerts import (
    build_alert_meta,
    build_alerts,
    retain_alerts,
)
from ros2_dashboard_monitor.ros2_topic.runtime import TopicRuntime
from ros2_dashboard_monitor.topology import build_role_node_index
from ros2_dashboard_monitor.priority_state import PriorityState
from ros2_dashboard_monitor.monitor_helpers import (
    runtime_state_map as _runtime_state_map,
    service_effective_status as _service_effective_status,
)
from ros2_dashboard_monitor.snapshot_summary import (
    websocket_action_meta,
    websocket_node_meta,
    websocket_service_meta,
    websocket_topic_meta,
)
from ros2_dashboard_monitor.snapshot_assembler import (
    assemble_action_snapshot,
    assemble_node_snapshot,
    assemble_service_snapshot,
    enrich_topic_snapshot,
)


class RosMonitor:
    """RosMonitor coordinator의 RosMonitor 역할을 담당하는 클래스입니다."""

    # 이전 테스트와 내부 호출 호환을 유지하면서 계산 책임은 순수 모듈에 둡니다.
    _websocket_topic_meta = staticmethod(websocket_topic_meta)
    _websocket_service_meta = staticmethod(websocket_service_meta)
    _websocket_action_meta = staticmethod(websocket_action_meta)
    _websocket_node_meta = staticmethod(websocket_node_meta)

    def __init__(
        self,
        config: MonitorConfig | None = None,
        *,
        priority_state: PriorityState | None = None,
    ) -> None:
        """공통 Lock과 Topic·Service·Action·Node Runtime을 조립합니다."""
        self._config = config or MonitorConfig()
        self._priority_state = priority_state
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
        interface_states = _runtime_state_map(
            getattr(self, '_receive_runtime', None),
            'dashboard_state_by_topic',
        )
        return enrich_topic_snapshot(
            snapshot,
            role_nodes=self._role_node_index(),
            internal_node=self._monitor_node_full_name(),
            interface_states=interface_states,
            apply_primary_state=self._apply_primary_state,
        )

    def service_snapshot(
        self,
        *,
        include_hidden: bool = False,
    ) -> dict[str, Any]:
        return assemble_service_snapshot(self, include_hidden=include_hidden)

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
        return assemble_action_snapshot(self)

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

    def cancel_action_goal(
        self,
        *,
        action_name: str,
        action_type: str,
        timeout_sec: float | None = None,
    ) -> dict[str, Any]:
        return self._action_goal_runtime.cancel_goal(
            action_name=action_name,
            action_type=action_type,
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
        return assemble_node_snapshot(self)

    def _apply_primary_state(
        self,
        item: dict[str, Any],
        *,
        kind: str,
        name: str,
    ) -> None:
        system_primary = bool(item.get('primary'))
        preferences = getattr(self, '_priority_state', None)
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
