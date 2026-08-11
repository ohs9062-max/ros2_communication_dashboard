"""Interface Lab ActionClient pool과 실제 사용 QoS 상태를 관리합니다."""

from __future__ import annotations

from typing import Any, Callable

from rclpy.qos import QoSProfile, qos_profile_action_status_default, qos_profile_services_default

from ros2_dashboard_monitor.interface_lab.execution.action_support import ActionGoalError
from ros2_dashboard_monitor.interface_lab.execution.runtime_storage import RuntimeClientPool
from ros2_dashboard_monitor.qos import qos_state
from ros2_dashboard_monitor.interface_lab.execution.qos_profiles import (
    action_profile_fingerprint,
    action_channel_selection,
    resolve_service_execution_qos,
    resolve_topic_execution_qos,
)


class ActionClientPool:
    """Action 이름·타입별 client를 재사용하고 5개 채널의 QoS를 보존합니다."""

    def __init__(
        self,
        *,
        lock: Any,
        node_getter: Callable[[], Any],
        client_factory: Callable[..., Any],
        dds_qos_getter: Callable[[str], dict[str, Any]] | None = None,
    ) -> None:
        self._lock = lock
        self._node_getter = node_getter
        self._client_factory = client_factory
        self._dds_qos_getter = dds_qos_getter
        self._clients: RuntimeClientPool[tuple[str, str, tuple[Any, ...]], Any] = RuntimeClientPool(lock)
        self._qos_by_key: dict[tuple[str, str, tuple[Any, ...]], dict[str, Any]] = {}
        self._last_key_by_resource: dict[tuple[str, str], tuple[str, str, tuple[Any, ...]]] = {}

    def clear(self) -> None:
        with self._lock:
            self._qos_by_key = {}
            self._last_key_by_resource = {}
        self._clients.clear()

    def get_or_create(
        self, name: str, action_type: str, action_class: type,
        qos_selection: dict[str, Any] | None = None,
    ) -> Any:
        node = self._node_getter()
        if node is None:
            raise ActionGoalError('ROS2 monitor node가 실행 중이 아닙니다.')
        profiles = self.qos_profiles(node, name, qos_selection)
        key = (name, action_type, action_profile_fingerprint(profiles))

        def create_client() -> Any:
            with self._lock:
                self._qos_by_key[key] = profiles['state']
                self._last_key_by_resource[(name, action_type)] = key
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

        client = self._clients.get_or_create(key, create_client)
        with self._lock:
            self._qos_by_key[key] = profiles['state']
            self._last_key_by_resource[(name, action_type)] = key
        return client

    def dashboard_state(self) -> dict[tuple[str, str], dict[str, Any]]:
        return {
            (key[0], key[1]): {
                'interface_client_created': True,
                'qos': self._qos_by_key.get(key, self.qos_state(key[0])),
            }
            for key in self._clients.keys()
        }

    def qos_profiles(
        self, node: Any, name: str,
        qos_selection: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        feedback_selection = action_channel_selection(qos_selection, 'feedback', 'topic')
        status_selection = action_channel_selection(qos_selection, 'status', 'topic')
        feedback, feedback_state = resolve_topic_execution_qos(
            node, f'{name}/_action/feedback', local_role='subscription',
            default_profile=QoSProfile(depth=10), selection=feedback_selection,
        )
        status, status_state = resolve_topic_execution_qos(
            node, f'{name}/_action/status', local_role='subscription',
            default_profile=qos_profile_action_status_default, selection=status_selection,
        )
        services = {}
        service_states = {}
        for part, suffix in (
            ('goal', 'send_goal'), ('result', 'get_result'), ('cancel', 'cancel_goal'),
        ):
            profile, state = resolve_service_execution_qos(
                f'{name}/_action/{suffix}',
                selection=action_channel_selection(qos_selection, part, 'service'),
                remote_qos_getter=self._dds_qos_getter,
            )
            services[part] = profile
            service_states[part] = state
        for part, state in (('feedback', feedback_state), ('status', status_state)):
            if state.get('qos_status') == 'incompatible':
                state['qos_error_type'] = f'action_{part}_qos_incompatible'
        return {
            **services,
            'feedback': feedback,
            'status': status,
            'state': {
                **service_states,
                'feedback': feedback_state,
                'status': status_state,
            },
        }

    def qos_state(self, name: str) -> dict[str, Any]:
        with self._lock:
            resource_key = next(
                (key for key in self._last_key_by_resource if key[0] == name), None,
            )
            key = self._last_key_by_resource.get(resource_key) if resource_key else None
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
