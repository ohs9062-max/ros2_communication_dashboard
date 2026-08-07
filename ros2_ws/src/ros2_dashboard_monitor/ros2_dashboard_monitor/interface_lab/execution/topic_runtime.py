"""Interface Lab의 topic_runtime 관련 기능을 담당하는 모듈입니다."""

from __future__ import annotations

from time import sleep, time
from typing import Any, Callable

from rosidl_runtime_py.utilities import get_message

from ros2_dashboard_monitor.interface_lab.apply.runtime import refresh_install_python_paths
from ros2_dashboard_monitor.interface_lab.management.packages import registered_package_messages
from ros2_dashboard_monitor.interface_lab.management.registry import registry_snapshot
from ros2_dashboard_monitor.interface_lab.common.value_converter import (
    InterfaceValidationError,
    build_ros_message,
    ros_message_to_json,
    schema_from_message_type,
)
from ros2_dashboard_monitor.interface_lab.execution.topic_support import (
    DEFAULT_CONTINUOUS_PUBLISH_HZ,
    DEFAULT_TOPIC_HISTORY_LIMIT,
    MAX_PUBLISH_HISTORY_ITEMS,
    InterfaceReceiveError,
    interface_lab_node as _interface_lab_node,
    is_action_internal_topic as _is_action_internal_topic,
    normalize_limit as _normalize_limit,
)
from ros2_dashboard_monitor.interface_lab.execution.topic_continuous_runtime import (
    ContinuousTopicPublishRuntime,
)
from ros2_dashboard_monitor.interface_lab.execution.runtime_storage import (
    BoundedExecutionHistory,
)
from ros2_dashboard_monitor.interface_lab.execution.topic_publisher_pool import (
    TopicPublisherPool,
)
from ros2_dashboard_monitor.interface_lab.execution.topic_receive_runtime import (
    TopicReceiveRuntime,
)
from ros2_dashboard_monitor.interface_lab.execution.topic_graph import TopicGraphInspector
from ros2_dashboard_monitor.interface_lab.execution.topic_message_registry import (
    TopicMessageRegistry,
)


class InterfaceReceiveRuntime:
    """Interface Lab runtime 상태와 cache를 관리하는 클래스입니다."""

    def __init__(self, *, lock: Any, node_getter: Callable[[], Any]) -> None:
        self._lock = lock
        self._node_getter = node_getter
        self._topic_graph_inspector = TopicGraphInspector(node_getter=node_getter)
        self._message_registry = TopicMessageRegistry(
            graph_topics=self._topic_graph_inspector.topics,
            package_messages_loader=lambda: registered_package_messages(),
            registry_loader=lambda: registry_snapshot(),
            schema_loader=schema_from_message_type,
        )
        self._publisher_pool = TopicPublisherPool(lock=lock, node_getter=node_getter)
        self._publish_history = BoundedExecutionHistory(lock, MAX_PUBLISH_HISTORY_ITEMS)
        self._continuous_publish_runtime = ContinuousTopicPublishRuntime(
            lock=lock,
            publish=self.publish_topic,
        )
        self._receive_runtime = TopicReceiveRuntime(
            ensure_registered=self._ensure_registered_message,
            graph_state=self._topic_graph_state,
            lock=lock,
            message_loader=lambda message_type: get_message(message_type),
            message_to_json=ros_message_to_json,
            node_getter=node_getter,
        )

    def clear(self) -> None:
        self._continuous_publish_runtime.clear()
        self._receive_runtime.clear()
        self._publish_history.clear()
        self._publisher_pool.clear()

    def message_schema(self, *, message_type: str) -> dict[str, Any]:
        """Interface Lab에서 interface schema를 반환하는 함수입니다."""
        refresh_install_python_paths()
        return self._message_registry.schema(message_type.strip())

    def callable_messages(self) -> dict[str, Any]:
        """Registry에서 import 가능한 Message 타입을 중복 없이 반환합니다."""
        refresh_install_python_paths()
        return self._message_registry.callable_messages()

    def start_topic(
        self,
        *,
        topic_name: str,
        topic_type: str,
        history_limit: int = DEFAULT_TOPIC_HISTORY_LIMIT,
    ) -> dict[str, Any]:
        return self._receive_runtime.start(
            topic_name=topic_name,
            topic_type=topic_type,
            history_limit=history_limit,
        )

    def stop_topic(self, *, topic_name: str, topic_type: str | None = None) -> dict[str, Any]:
        return self._receive_runtime.stop(topic_name=topic_name, topic_type=topic_type)

    def topics(self) -> dict[str, Any]:
        return self._receive_runtime.snapshot()

    def dashboard_state_by_topic(
        self,
    ) -> dict[tuple[str, str], dict[str, bool]]:
        """Topic별 Interface Lab Publisher·Receive 생성 상태를 반환합니다."""
        publisher_keys = set(self._publisher_pool.keys())
        return self._receive_runtime.state_by_topic(publisher_keys=publisher_keys)

    def topic_history(
        self,
        *,
        topic_name: str | None = None,
        topic_type: str | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        return self._receive_runtime.history(
            topic_name=topic_name,
            topic_type=topic_type,
            limit=limit,
        )

    def reset_topic_history(
        self,
        *,
        topic_name: str | None = None,
        topic_type: str | None = None,
    ) -> dict[str, Any]:
        """선택한 Topic의 수신 이력과 subscription 상태를 제거합니다."""
        return self._receive_runtime.reset_history(
            topic_name=topic_name,
            topic_type=topic_type,
        )

    def publish_topic(
        self,
        *,
        topic_name: str,
        topic_type: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        """Interface Lab에서 Topic 메시지를 발행하는 함수입니다."""
        node = self._node_getter()
        if node is None:
            raise InterfaceReceiveError('ROS2 monitor node가 실행 중이 아닙니다.')
        topic_name = topic_name.strip()
        topic_type = topic_type.strip()
        if not topic_name.startswith('/'):
            raise InterfaceReceiveError('topic_name은 /로 시작해야 합니다.')
        self._ensure_registered_message(topic_type)
        started_at = time()
        graph_state = self._topic_graph_state(topic_name=topic_name, topic_type=topic_type)
        if _is_action_internal_topic(topic_name):
            result = {
                'success': False,
                'published': False,
                'sent_to_topic': False,
                'topic_name': topic_name,
                'topic_type': topic_type,
                'payload': payload,
                'published_at': started_at,
                'error_type': 'action_internal_topic',
                'error': (
                    f'{topic_name}은 ROS2 Action 내부 Topic이므로 '
                    'Interface Lab의 일반 Message Publish에서 사용할 수 없습니다.'
                ),
                'graph_state': graph_state,
                'qos': self._publish_qos_state(topic_name, topic_type),
            }
            self._record_publish_history(result)
            return result
        if graph_state['conflicts']:
            conflict_types = ', '.join(
                sorted({str(item.get('type') or '') for item in graph_state['conflicts']})
            )
            result = {
                'success': False,
                'published': False,
                'sent_to_topic': False,
                'topic_name': topic_name,
                'topic_type': topic_type,
                'payload': payload,
                'published_at': started_at,
                'error_type': 'topic_type_conflict',
                'error': (
                    f'{topic_name}에는 다른 Message type({conflict_types})이 Graph에 있어 '
                    f'{topic_type} Publisher를 생성할 수 없습니다.'
                ),
                'graph_state': graph_state,
                'qos': self._publish_qos_state(topic_name, topic_type),
            }
            self._record_publish_history(result)
            return result
        try:
            message_class = get_message(topic_type)
            try:
                message = build_ros_message(message_class, payload, label='message')
            except InterfaceValidationError as exc:
                result = {
                    'success': False,
                    'published': False,
                    'sent_to_topic': False,
                    'topic_name': topic_name,
                    'topic_type': topic_type,
                    'payload': payload,
                    'published_at': started_at,
                    'error_type': 'validation_error',
                    'error': str(exc),
                    'details': exc.details,
                    'graph_state': graph_state,
                    'qos': self._publish_qos_state(topic_name, topic_type),
                }
                self._record_publish_history(result)
                return result
            publisher, created = self._publisher(topic_name, topic_type, message_class)
            if created:
                sleep(0.5)
                graph_state = self._topic_graph_state(topic_name=topic_name, topic_type=topic_type)
            publisher.publish(message)
            result = {
                'success': True,
                'published': True,
                'sent_to_topic': True,
                'topic_name': topic_name,
                'topic_type': topic_type,
                'payload': payload,
                'message_json': ros_message_to_json(message),
                'published_at': started_at,
                'subscriber_count': graph_state.get('subscriber_count', 0),
                'graph_state': graph_state,
                'qos': self._publish_qos_state(topic_name, topic_type),
            }
        except Exception as exc:
            result = {
                'success': False,
                'published': False,
                'sent_to_topic': False,
                'topic_name': topic_name,
                'topic_type': topic_type,
                'payload': payload,
                'published_at': started_at,
                'error': str(exc),
                'graph_state': graph_state,
                'qos': self._publish_qos_state(topic_name, topic_type),
            }
            self._record_publish_history(result)
            if isinstance(exc, InterfaceReceiveError):
                raise
            raise InterfaceReceiveError(str(exc)) from exc
        self._record_publish_history(result)
        return result

    def publish_history(self, *, limit: int | None = None) -> dict[str, Any]:
        """최근 Topic Publish 실행 이력을 제한 개수만큼 반환합니다."""
        normalized_limit = _normalize_limit(limit or MAX_PUBLISH_HISTORY_ITEMS)
        items = self._publish_history.snapshot()
        return {'history': items[:normalized_limit], 'meta': {'count': len(items[:normalized_limit])}}

    def start_continuous_publish(
        self,
        *,
        topic_name: str,
        topic_type: str,
        payload: dict[str, Any],
        hz: float = DEFAULT_CONTINUOUS_PUBLISH_HZ,
    ) -> dict[str, Any]:
        """사용자가 명시적으로 시작한 Topic 주기 발행을 시작합니다."""
        return self._continuous_publish_runtime.start(
            topic_name=topic_name,
            topic_type=topic_type,
            payload=payload,
            hz=hz,
        )

    def stop_continuous_publish(self, *, topic_name: str, topic_type: str) -> dict[str, Any]:
        """선택한 Topic의 주기 발행을 중지합니다."""
        return self._continuous_publish_runtime.stop(
            topic_name=topic_name,
            topic_type=topic_type,
        )

    def continuous_publishes(self) -> dict[str, Any]:
        """현재 및 최근 주기 발행 상태를 반환합니다."""
        return self._continuous_publish_runtime.snapshot()

    def stop_all_continuous_publishes(self) -> None:
        """Runtime 정리 전에 실행 중인 모든 주기 발행 thread를 중지합니다."""
        self._continuous_publish_runtime.stop_all()

    def reset_publish_history(self, *, topic_name: str | None = None, topic_type: str | None = None) -> dict[str, Any]:
        """선택한 Topic의 Publish 실행 이력을 삭제합니다."""
        if topic_name and topic_type:
            cleared = self._publish_history.remove(
                lambda item: (
                    item.get('topic_name') == topic_name
                    and item.get('topic_type') == topic_type
                )
            )
        elif topic_name:
            cleared = self._publish_history.remove(
                lambda item: item.get('topic_name') == topic_name
            )
        else:
            cleared = self._publish_history.remove(lambda _item: True)
        return {'cleared': cleared, 'topic_name': topic_name, 'topic_type': topic_type}

    def _ensure_registered_message(self, message_type: str) -> None:
        self._message_registry.ensure_available(message_type)

    def _publisher(self, topic_name: str, topic_type: str, message_class: type):
        return self._publisher_pool.get_or_create(
            topic_name=topic_name,
            topic_type=topic_type,
            message_class=message_class,
        )

    def _publish_qos_state(self, topic_name: str, topic_type: str) -> dict[str, Any]:
        return self._publisher_pool.qos_state(
            topic_name=topic_name,
            topic_type=topic_type,
        )

    def _record_publish_history(self, item: dict[str, Any]) -> None:
        item.setdefault('execution_source', 'interface_lab')
        item.setdefault('publisher_node', _interface_lab_node(self._node_getter))
        self._publish_history.record(item)

    def _topic_graph_state(self, *, topic_name: str, topic_type: str) -> dict[str, Any]:
        return self._topic_graph_inspector.state(
            topic_name=topic_name,
            topic_type=topic_type,
        )
