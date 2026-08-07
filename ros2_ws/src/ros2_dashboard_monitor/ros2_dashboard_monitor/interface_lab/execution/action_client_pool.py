"""Interface Lab ActionClient pool과 실제 사용 QoS 상태를 관리합니다."""

from __future__ import annotations

from typing import Any, Callable

from rclpy.qos import QoSProfile, qos_profile_action_status_default, qos_profile_services_default

from ros2_dashboard_monitor.interface_lab.execution.action_support import ActionGoalError
from ros2_dashboard_monitor.interface_lab.execution.runtime_storage import RuntimeClientPool
from ros2_dashboard_monitor.qos import choose_topic_qos, qos_state


class ActionClientPool:
    """Action 이름·타입별 client를 재사용하고 5개 채널의 QoS를 보존합니다."""

    def __init__(
        self,
        *,
        lock: Any,
        node_getter: Callable[[], Any],
        client_factory: Callable[..., Any],
    ) -> None:
        self._lock = lock
        self._node_getter = node_getter
        self._client_factory = client_factory
        self._clients: RuntimeClientPool[tuple[str, str], Any] = RuntimeClientPool(lock)
        self._qos_by_key: dict[tuple[str, str], dict[str, Any]] = {}

    def clear(self) -> None:
        with self._lock:
            self._qos_by_key = {}
        self._clients.clear()

    def get_or_create(self, name: str, action_type: str, action_class: type) -> Any:
        key = (name, action_type)

        def create_client() -> Any:
            node = self._node_getter()
            if node is None:
                raise ActionGoalError('ROS2 monitor node가 실행 중이 아닙니다.')
            profiles = self.qos_profiles(node, name)
            with self._lock:
                self._qos_by_key[key] = profiles['state']
            return self._client_factory(
                node,
                action_class,
                name,
                goal_service_qos_profile=profiles['goal'],
                result_service_qos_profile=profiles['result'],
                cancel_service_qos_profile=profiles['cancel'],
                feedback_sub_qos_profile=profiles['feedback'],
                status_sub_qos_profile=profiles['status'],
            )

        return self._clients.get_or_create(key, create_client)

    def dashboard_state(self) -> dict[tuple[str, str], dict[str, Any]]:
        return {
            key: {
                'interface_client_created': True,
                'qos': self._qos_by_key.get(key, self.qos_state(key[0])),
            }
            for key in self._clients.keys()
        }

    def qos_profiles(self, node: Any, name: str) -> dict[str, Any]:
        feedback, feedback_state = choose_topic_qos(
            node, f'{name}/_action/feedback', local_role='subscription',
            default_profile=QoSProfile(depth=10),
        )
        status, status_state = choose_topic_qos(
            node, f'{name}/_action/status', local_role='subscription',
            default_profile=qos_profile_action_status_default,
        )
        service_state = qos_state(
            status='unknown', source='default_profile', local=qos_profile_services_default,
            reason='Action service endpoint QoS는 Graph에서 확인할 수 없어 기본 Service QoS를 사용합니다.',
        )
        for part, state in (('feedback', feedback_state), ('status', status_state)):
            if state.get('qos_status') == 'incompatible':
                state['qos_error_type'] = f'action_{part}_qos_incompatible'
        return {
            'goal': qos_profile_services_default,
            'result': qos_profile_services_default,
            'cancel': qos_profile_services_default,
            'feedback': feedback,
            'status': status,
            'state': {
                'goal': service_state,
                'result': service_state,
                'cancel': service_state,
                'feedback': feedback_state,
                'status': status_state,
            },
        }

    def qos_state(self, name: str) -> dict[str, Any]:
        with self._lock:
            key = next((key for key in self._qos_by_key if key[0] == name), None)
            if key is not None:
                return self._qos_by_key[key]
        node = self._node_getter()
        if node is None or not name:
            service = qos_state(
                status='unknown', source='default_profile', local=qos_profile_services_default,
                reason='상대 QoS를 확인할 Action endpoint가 없습니다.',
            )
            return {part: service for part in ('goal', 'result', 'cancel', 'feedback', 'status')}
        return self.qos_profiles(node, name)['state']
