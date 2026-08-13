"""Interface Lab 단일 Topic Publish 요청을 검증하고 실행합니다."""

from __future__ import annotations

from time import sleep, time
from typing import Any, Callable

from ros2_dashboard_monitor.interface_lab.common.value_converter import InterfaceValidationError
from ros2_dashboard_monitor.interface_lab.execution.topic_support import InterfaceReceiveError


class TopicPublishExecutor:
    def __init__(
        self,
        *,
        build_message: Callable[..., Any],
        ensure_registered: Callable[[str], None],
        graph_state: Callable[..., dict[str, Any]],
        is_action_internal: Callable[[str], bool],
        message_loader: Callable[[str], type],
        message_to_json: Callable[[Any], Any],
        publisher: Callable[..., tuple[Any, bool]],
        qos_state: Callable[[str, str], dict[str, Any]],
        record_history: Callable[[dict[str, Any]], None],
        node_getter: Callable[[], Any],
    ) -> None:
        self._build_message = build_message
        self._ensure_registered = ensure_registered
        self._graph_state = graph_state
        self._is_action_internal = is_action_internal
        self._message_loader = message_loader
        self._message_to_json = message_to_json
        self._publisher = publisher
        self._qos_state = qos_state
        self._record_history = record_history
        self._node_getter = node_getter

    def publish(
        self, *, topic_name: str, topic_type: str, payload: dict[str, Any],
        qos_selection: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if self._node_getter() is None:
            raise InterfaceReceiveError('The ROS2 monitor node is not running.')
        topic_name = topic_name.strip()
        topic_type = topic_type.strip()
        if not topic_name.startswith('/'):
            raise InterfaceReceiveError('topic_name must start with /.')
        self._ensure_registered(topic_type)
        started_at = time()
        graph_state = self._graph_state(topic_name=topic_name, topic_type=topic_type)
        if self._is_action_internal(topic_name):
            return self._record_failure(
                topic_name=topic_name,
                topic_type=topic_type,
                payload=payload,
                published_at=started_at,
                graph_state=graph_state,
                error_type='action_internal_topic',
                error=(
                    f'{topic_name} is an internal ROS2 Action Topic and cannot be used '
                    'for regular Message publishing in Interface Lab.'
                ),
            )
        if graph_state['conflicts']:
            conflict_types = ', '.join(sorted({
                str(item.get('type') or '') for item in graph_state['conflicts']
            }))
            return self._record_failure(
                topic_name=topic_name,
                topic_type=topic_type,
                payload=payload,
                published_at=started_at,
                graph_state=graph_state,
                error_type='topic_type_conflict',
                error=(
                    f'{topic_name} already exists in the ROS2 graph with a different '
                    f'Message type ({conflict_types}). The {topic_type} publisher was not created.'
                ),
            )
        try:
            message_class = self._message_loader(topic_type)
            try:
                message = self._build_message(message_class, payload, label='message')
            except InterfaceValidationError as exc:
                return self._record_failure(
                    topic_name=topic_name,
                    topic_type=topic_type,
                    payload=payload,
                    published_at=started_at,
                    graph_state=graph_state,
                    error_type='validation_error',
                    error=str(exc),
                    details=exc.details,
                )
            publisher, created = self._publisher(
                topic_name, topic_type, message_class, qos_selection,
            )
            if created:
                sleep(0.5)
                graph_state = self._graph_state(topic_name=topic_name, topic_type=topic_type)
            publisher.publish(message)
            result = {
                'success': True,
                'published': True,
                'sent_to_topic': True,
                'topic_name': topic_name,
                'topic_type': topic_type,
                'payload': payload,
                'message_json': self._message_to_json(message),
                'published_at': started_at,
                'subscriber_count': graph_state.get('subscriber_count', 0),
                'graph_state': graph_state,
                'qos': self._qos_state(topic_name, topic_type),
            }
        except Exception as exc:
            self._record_failure(
                topic_name=topic_name,
                topic_type=topic_type,
                payload=payload,
                published_at=started_at,
                graph_state=graph_state,
                error=str(exc),
            )
            if isinstance(exc, InterfaceReceiveError):
                raise
            raise InterfaceReceiveError(str(exc)) from exc
        self._record_history(result)
        return result

    def _record_failure(self, *, details: Any = None, error_type: str | None = None, **values: Any) -> dict[str, Any]:
        result = {
            'success': False,
            'published': False,
            'sent_to_topic': False,
            **values,
            'qos': self._qos_state(values['topic_name'], values['topic_type']),
        }
        if error_type is not None:
            result['error_type'] = error_type
        if details is not None:
            result['details'] = details
        self._record_history(result)
        return result
