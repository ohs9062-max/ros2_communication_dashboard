"""RosMonitor가 노출하는 Interface Lab 실행 API 위임 계층입니다."""

from __future__ import annotations

from typing import Any


class InterfaceLabFacade:
    """Service·Action·Topic 실행 요청을 각 runtime에 그대로 위임합니다."""

    def callable_services(self) -> dict[str, Any]:
        return self._service_call_runtime.callable_services()

    def call_service(
        self, *, service_name: str, service_type: str,
        request_data: dict[str, Any], timeout_sec: float | None = None,
        qos_selection: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        kwargs = dict(
            service_name=service_name,
            service_type=service_type,
            request_data=request_data,
            timeout_sec=timeout_sec,
        )
        if qos_selection is not None:
            kwargs['qos_selection'] = qos_selection
        return self._service_call_runtime.call_service(**kwargs)

    def service_call_history(self) -> dict[str, Any]:
        return self._service_call_runtime.history()

    def service_history(
        self, *, service_name: str, service_type: str | None = None,
        limit: int = 30,
    ) -> dict[str, Any]:
        return self._service_call_runtime.history_for_service(
            service_name=service_name,
            service_type=service_type,
            limit=limit,
        )

    def reset_service_call_history(self, *, service_name: str | None = None, service_type: str | None = None) -> dict[str, Any]:
        return self._service_call_runtime.reset_history(service_name=service_name, service_type=service_type)

    def receive_service_history(self) -> dict[str, Any]:
        return self._service_call_runtime.receive_history()

    def reset_receive_service_history(
        self, *, service_name: str | None = None, service_type: str | None = None,
    ) -> dict[str, Any]:
        return self._service_call_runtime.reset_receive_history(
            service_name=service_name,
            service_type=service_type,
        )

    def service_server_types(self) -> dict[str, Any]:
        services = self._service_server_runtime.registered_types()
        return {'services': services, 'meta': {'count': len(services)}}

    def start_service_server(self, **kwargs: Any) -> dict[str, Any]:
        return self._service_server_runtime.start(**kwargs)

    def stop_service_server(self, **kwargs: Any) -> dict[str, Any]:
        return self._service_server_runtime.stop(**kwargs)

    def service_server_status(self) -> dict[str, Any]:
        return self._service_server_runtime.status()

    def service_server_history(self) -> dict[str, Any]:
        return self._service_server_runtime.history()

    def reset_service_server_history(self, **kwargs: Any) -> dict[str, Any]:
        return self._service_server_runtime.reset_history(**kwargs)

    def callable_actions(self) -> dict[str, Any]:
        return self._action_goal_runtime.callable_actions()

    def send_action_goal(
        self, *, action_name: str, action_type: str,
        goal_data: dict[str, Any], timeout_sec: float | None = None,
        qos_selection: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        kwargs = dict(
            action_name=action_name,
            action_type=action_type,
            goal_data=goal_data,
            timeout_sec=timeout_sec,
        )
        if qos_selection is not None:
            kwargs['qos_selection'] = qos_selection
        return self._action_goal_runtime.send_goal(**kwargs)

    def cancel_action_goal(
        self, *, action_name: str, action_type: str,
        timeout_sec: float | None = None,
    ) -> dict[str, Any]:
        return self._action_goal_runtime.cancel_goal(
            action_name=action_name,
            action_type=action_type,
            timeout_sec=timeout_sec,
        )

    def action_goal_history(self) -> dict[str, Any]:
        return self._action_goal_runtime.history()

    def action_history(
        self, *, action_name: str, action_type: str | None = None,
        limit: int = 30,
    ) -> dict[str, Any]:
        return self._action_goal_runtime.history_for_action(
            action_name=action_name,
            action_type=action_type,
            limit=limit,
        )

    def reset_action_goal_history(self, *, action_name: str | None = None, action_type: str | None = None) -> dict[str, Any]:
        return self._action_goal_runtime.reset_history(action_name=action_name, action_type=action_type)

    def receive_action_history(self) -> dict[str, Any]:
        return self._action_goal_runtime.receive_history()

    def reset_receive_action_history(
        self, *, action_name: str | None = None, action_type: str | None = None,
    ) -> dict[str, Any]:
        return self._action_goal_runtime.reset_receive_history(
            action_name=action_name,
            action_type=action_type,
        )

    def action_server_types(self) -> dict[str, Any]:
        actions = self._action_server_runtime.registered_types()
        return {'actions': actions, 'meta': {'count': len(actions)}}

    def start_action_server(self, **kwargs: Any) -> dict[str, Any]:
        return self._action_server_runtime.start(**kwargs)

    def stop_action_server(self, **kwargs: Any) -> dict[str, Any]:
        return self._action_server_runtime.stop(**kwargs)

    def action_server_status(self) -> dict[str, Any]:
        return self._action_server_runtime.status()

    def action_server_history(self) -> dict[str, Any]:
        return self._action_server_runtime.history()

    def reset_action_server_history(self, **kwargs: Any) -> dict[str, Any]:
        return self._action_server_runtime.reset_history(**kwargs)

    def start_receive_topic(
        self, *, topic_name: str, topic_type: str, history_limit: int = 100,
        qos_selection: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return self._receive_runtime.start_topic(
            topic_name=topic_name,
            topic_type=topic_type,
            history_limit=history_limit,
            qos_selection=qos_selection,
        )

    def stop_receive_topic(
        self, *, topic_name: str, topic_type: str | None = None,
    ) -> dict[str, Any]:
        return self._receive_runtime.stop_topic(
            topic_name=topic_name,
            topic_type=topic_type,
        )

    def receive_topics(self) -> dict[str, Any]:
        return self._receive_runtime.topics()

    def receive_topic_history(
        self, *, topic_name: str | None = None,
        topic_type: str | None = None, limit: int | None = None,
    ) -> dict[str, Any]:
        return self._receive_runtime.topic_history(
            topic_name=topic_name,
            topic_type=topic_type,
            limit=limit,
        )

    def reset_receive_topic_history(
        self, *, topic_name: str | None = None, topic_type: str | None = None,
    ) -> dict[str, Any]:
        return self._receive_runtime.reset_topic_history(
            topic_name=topic_name,
            topic_type=topic_type,
        )

    def callable_messages(self) -> dict[str, Any]:
        return self._receive_runtime.callable_messages()

    def message_schema(self, *, message_type: str) -> dict[str, Any]:
        return self._receive_runtime.message_schema(message_type=message_type)

    def publish_topic(
        self, *, topic_name: str, topic_type: str, payload: dict[str, Any],
        qos_selection: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return self._receive_runtime.publish_topic(
            topic_name=topic_name,
            topic_type=topic_type,
            payload=payload,
            qos_selection=qos_selection,
        )

    def start_continuous_topic_publish(
        self, *, topic_name: str, topic_type: str,
        payload: dict[str, Any], hz: float,
        qos_selection: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return self._receive_runtime.start_continuous_publish(
            topic_name=topic_name,
            topic_type=topic_type,
            payload=payload,
            hz=hz,
            qos_selection=qos_selection,
        )

    def stop_continuous_topic_publish(
        self, *, topic_name: str, topic_type: str,
    ) -> dict[str, Any]:
        return self._receive_runtime.stop_continuous_publish(
            topic_name=topic_name,
            topic_type=topic_type,
        )

    def continuous_topic_publishes(self) -> dict[str, Any]:
        return self._receive_runtime.continuous_publishes()

    def topic_publish_history(self, *, limit: int | None = None) -> dict[str, Any]:
        return self._receive_runtime.publish_history(limit=limit)

    def reset_topic_publish_history(
        self, *, topic_name: str | None = None, topic_type: str | None = None,
    ) -> dict[str, Any]:
        return self._receive_runtime.reset_publish_history(
            topic_name=topic_name,
            topic_type=topic_type,
        )
