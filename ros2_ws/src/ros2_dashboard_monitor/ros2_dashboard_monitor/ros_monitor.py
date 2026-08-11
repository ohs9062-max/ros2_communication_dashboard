"""RosMonitor coordinator의 ros_monitor 관련 기능을 담당하는 모듈입니다."""

from __future__ import annotations

from threading import Lock, Thread
from time import time
from typing import Any

from rclpy.node import Node
from rclpy.utilities import get_rmw_implementation_identifier

from ros2_dashboard_monitor.alert_assembler import (
    alert_response,
    collect_runtime_alerts,
    reconcile_alert_state,
)
from ros2_dashboard_monitor.interface_lab.execution.action_goal_runtime import ActionGoalRuntime
from ros2_dashboard_monitor.interface_lab.facade import InterfaceLabFacade
from ros2_dashboard_monitor.ros2_action.runtime import ActionRuntime
from ros2_dashboard_monitor.config_loader import MonitorConfig
from ros2_dashboard_monitor.interface_lab.execution.topic_runtime import InterfaceReceiveRuntime
from ros2_dashboard_monitor.ros2_node.runtime import NodeRuntime
from ros2_dashboard_monitor.interface_lab.execution.service_call_runtime import ServiceCallRuntime
from ros2_dashboard_monitor.ros2_service.runtime import ServiceRuntime
from ros2_dashboard_monitor.ros2_topic.runtime import TopicRuntime
from ros2_dashboard_monitor.topology import build_role_node_index
from ros2_dashboard_monitor.priority_state import PriorityState
from ros2_dashboard_monitor.monitor_helpers import (
    runtime_state_map as _runtime_state_map,
    service_effective_status as _service_effective_status,
)
from ros2_dashboard_monitor.monitor_lifecycle import (
    create_monitor_node,
    shutdown_monitor_node,
    spin_monitor_node,
    start_spin_thread,
)
from ros2_dashboard_monitor.snapshot_summary import (
    assemble_websocket_snapshot,
    websocket_action_meta,
    websocket_node_meta,
    websocket_service_meta,
    websocket_topic_meta,
)
from ros2_dashboard_monitor.action_snapshot import assemble_action_snapshot
from ros2_dashboard_monitor.dds_observer import FastDdsQosObserver
from ros2_dashboard_monitor.node_snapshot import assemble_node_snapshot
from ros2_dashboard_monitor.service_snapshot import assemble_service_snapshot
from ros2_dashboard_monitor.snapshot_assembler import enrich_topic_snapshot


class RosMonitor(InterfaceLabFacade):
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
        self._dds_qos_observer = FastDdsQosObserver(
            self._config.fastdds_observer,
        )
        self._action_runtime = ActionRuntime(
            config=self._config,
            lock=self._lock,
            node_getter=lambda: self._node,
            dds_qos_getter=self._dds_qos_observer.service_qos,
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
            dds_qos_getter=self._dds_qos_observer.service_qos,
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

        self._node = create_monitor_node(
            poll_interval_sec=self._config.poll_interval_sec,
            update_callback=self._update_graph,
        )
        self._dds_qos_observer.start(
            get_rmw_implementation_identifier(),
            self._node.context.get_domain_id(),
        )
        self._update_graph()
        self._thread = start_spin_thread(self._spin)

    def stop(self) -> None:
        """timer와 실행 Runtime을 정리하고 rclpy Node를 종료합니다."""
        node = self._node
        self._receive_runtime.stop_all_continuous_publishes()
        self._dds_qos_observer.stop()

        shutdown_monitor_node(node, self._thread)

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

    def action_snapshot(self) -> dict[str, Any]:
        return assemble_action_snapshot(self)

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

    def websocket_snapshot(
        self,
        *,
        topic_snapshot: dict[str, Any] | None = None,
        service_snapshot: dict[str, Any] | None = None,
        action_snapshot: dict[str, Any] | None = None,
        node_snapshot: dict[str, Any] | None = None,
        alerts: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """현재 Cache에서 WebSocket 전송용 경량 요약을 만듭니다."""
        timestamp = time()
        topic_snapshot = topic_snapshot or self.snapshot()
        service_snapshot = service_snapshot or self.service_snapshot()
        action_snapshot = action_snapshot or self.action_snapshot()
        node_snapshot = node_snapshot or self.node_snapshot()
        alerts = alerts or self.alerts(
            action_snapshot=action_snapshot,
            node_snapshot=node_snapshot,
        )

        return assemble_websocket_snapshot(
            timestamp=timestamp,
            topic_snapshot=topic_snapshot,
            service_snapshot=service_snapshot,
            action_snapshot=action_snapshot,
            node_snapshot=node_snapshot,
            alerts=alerts,
        )

    def latest_message(self, name: str) -> dict[str, Any]:
        """지정한 Topic의 최신 수신 메시지를 TopicRuntime에서 가져옵니다."""
        return self._topic_runtime.latest_message(name)

    def topic_hz(self, name: str) -> dict[str, Any]:
        """지정한 Topic의 현재 수신 Hz를 TopicRuntime에서 가져옵니다."""
        return self._topic_runtime.topic_hz(name)

    def alerts(
        self,
        *,
        action_snapshot: dict[str, Any] | None = None,
        node_snapshot: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """모든 Runtime의 Alert를 합치고 active·resolved 이력을 갱신합니다."""
        detected_at = time()
        services = self.service_snapshot(include_hidden=True)['services']
        actions = (action_snapshot or self.action_snapshot())['actions']
        topics, subscriptions = self._topic_runtime.alert_snapshot()
        node_snapshot = node_snapshot or self._node_runtime.snapshot()
        nodes = node_snapshot['nodes']

        alerts = collect_runtime_alerts(
            topics=topics,
            subscriptions=subscriptions,
            services=services,
            actions=actions,
            nodes=nodes,
            detected_at=detected_at,
            stale_timeout_sec=self._config.stale_timeout_sec,
            required_stream_names=self._config.topics_required_stream_names,
            command_names=self._config.topics_command_names,
        )
        with self._lock:
            alerts, alert_history, visible_ids = reconcile_alert_state(
                current_alerts=alerts,
                dismissed_alert_ids=self._dismissed_alert_ids,
                alert_history=self._alert_history,
                retained_alerts=self._retained_alerts,
                detected_at=detected_at,
            )
            self._visible_alert_ids = visible_ids

        return alert_response(alerts, alert_history)

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
        spin_monitor_node(self._node)

    def _update_graph(self) -> None:
        self._node_runtime.update()
        self._topic_runtime.update()
        self._service_runtime.update()
        self._action_runtime.update()
        # Service 자동 호출은 의도적으로 비활성화합니다.
        # 생존 상태는 Graph로 관찰하고 실제 요청/응답은 Interface Lab의
        # 사용자 명시 Call 기록으로만 확인합니다.
