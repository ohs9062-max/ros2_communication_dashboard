"""Interface Lab Topic subscription과 수신 이력 상태를 관리합니다."""

from __future__ import annotations

from time import time
from typing import Any, Callable

from ros2_dashboard_monitor.interface_lab.execution.topic_support import (
    DEFAULT_TOPIC_HISTORY_LIMIT,
    InterfaceReceiveError,
    normalize_limit,
)
from ros2_dashboard_monitor.interface_lab.execution.qos_profiles import (
    ExecutionQosError,
    profile_fingerprint,
    resolve_topic_execution_qos,
)
from ros2_dashboard_monitor.interface_lab.execution.topic_receive_history import (
    TopicReceiveHistory,
)
from ros2_dashboard_monitor.qos import subscription_events


class TopicReceiveRuntime:
    """Topic Subscription lifecycle과 메시지별 bounded history를 관리합니다."""

    def __init__(
        self,
        *,
        ensure_registered: Callable[[str], None],
        graph_state: Callable[..., dict[str, Any]],
        lock: Any,
        message_loader: Callable[[str], type],
        message_to_json: Callable[[Any], Any],
        node_getter: Callable[[], Any],
    ) -> None:
        self._ensure_registered = ensure_registered
        self._graph_state = graph_state
        self._lock = lock
        self._message_loader = message_loader
        self._node_getter = node_getter
        self._topics: dict[tuple[str, str], dict[str, Any]] = {}
        self._history = TopicReceiveHistory(
            lock=lock,
            message_to_json=message_to_json,
            topics=self._topics,
        )

    def start(
        self,
        *,
        topic_name: str,
        topic_type: str,
        history_limit: int = DEFAULT_TOPIC_HISTORY_LIMIT,
        qos_selection: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        node = self._node_getter()
        if node is None:
            raise InterfaceReceiveError('ROS2 monitor node가 실행 중이 아닙니다.')
        topic_name = topic_name.strip()
        topic_type = topic_type.strip()
        if not topic_name.startswith('/'):
            raise InterfaceReceiveError('topic_name은 /로 시작해야 합니다.')
        self._ensure_registered(topic_type)
        try:
            message_class = self._message_loader(topic_type)
        except Exception as exc:
            raise InterfaceReceiveError(f'topic type import 실패: {exc}') from exc
        limit = normalize_limit(history_limit)
        graph_state = self._graph_state(topic_name=topic_name, topic_type=topic_type)
        try:
            qos_profile, qos = resolve_topic_execution_qos(
                node, topic_name, local_role='subscription', selection=qos_selection,
            )
        except ExecutionQosError as exc:
            raise InterfaceReceiveError(str(exc)) from exc
        fingerprint = profile_fingerprint(qos_profile)
        key = (topic_name, topic_type)
        with self._lock:
            existing = self._topics.get(key)
            if (
                existing is not None
                and existing.get('subscription') is not None
                and existing.get('qos_fingerprint') == fingerprint
            ):
                existing['history_limit'] = limit
                existing['graph_state'] = graph_state
                existing['receiving'] = True
                return self._public_state(key, existing)
            previous_subscription = existing.get('subscription') if existing else None
        if previous_subscription is not None:
            node.destroy_subscription(previous_subscription)
        subscription = node.create_subscription(
            message_class,
            topic_name,
            lambda message: self._record_message(topic_name, topic_type, message),
            qos_profile,
            event_callbacks=subscription_events(qos, 'topic_qos_incompatible'),
        )
        with self._lock:
            previous = self._topics.get(key) or {}
            self._topics[key] = {
                'topic_name': topic_name,
                'topic_type': topic_type,
                'history_limit': limit,
                'subscription': subscription,
                'receiving': True,
                'qos': qos,
                'qos_fingerprint': fingerprint,
                'graph_state': graph_state,
                'history': previous.get('history', []),
                'message_count': previous.get('message_count', 0),
                'last_message': previous.get('last_message'),
                'last_received_at': previous.get('last_received_at'),
                'error': previous.get('error'),
                'started_at': time(),
            }
            return self._public_state(key, self._topics[key])

    def stop(self, *, topic_name: str, topic_type: str | None = None) -> dict[str, Any]:
        topic_name = topic_name.strip()
        topic_type = topic_type.strip() if topic_type else None
        with self._lock:
            if topic_type:
                key = (topic_name, topic_type)
                item = self._topics.get(key)
            else:
                key, item = next(
                    (
                        (candidate_key, candidate)
                        for candidate_key, candidate in self._topics.items()
                        if candidate_key[0] == topic_name
                    ),
                    ((topic_name, ''), None),
                )
        if item is None:
            return {'topic_name': topic_name, 'topic_type': topic_type, 'receiving': False}
        node = self._node_getter()
        subscription = item.get('subscription')
        if node is not None and subscription is not None:
            try:
                node.destroy_subscription(subscription)
            except Exception as exc:
                return {
                    'topic_name': topic_name,
                    'topic_type': key[1],
                    'receiving': False,
                    'error': str(exc),
                }
        with self._lock:
            item['subscription'] = None
            item['receiving'] = False
        return {'topic_name': topic_name, 'topic_type': key[1], 'receiving': False}

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            items = [self._public_state(key, item) for key, item in sorted(self._topics.items())]
        return {'topics': items, 'meta': {'count': len(items)}}

    def state_by_topic(
        self,
        *,
        publisher_keys: set[tuple[str, str]],
    ) -> dict[tuple[str, str], dict[str, bool]]:
        with self._lock:
            keys = set(self._topics) | publisher_keys
            return {
                key: {
                    'interface_receive_active': bool(
                        self._topics.get(key, {}).get('receiving')
                        and self._topics.get(key, {}).get('subscription') is not None
                    ),
                    'interface_publisher_created': key in publisher_keys,
                }
                for key in keys
            }

    def history(
        self,
        *,
        topic_name: str | None = None,
        topic_type: str | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        return self._history.response(
            topic_name=topic_name,
            topic_type=topic_type,
            limit=limit,
        )

    def reset_history(
        self,
        *,
        topic_name: str | None = None,
        topic_type: str | None = None,
    ) -> dict[str, Any]:
        result, removed_items = self._history.reset(
            topic_name=topic_name,
            topic_type=topic_type,
        )
        self._destroy_subscriptions(removed_items)
        return result

    def clear(self) -> None:
        with self._lock:
            items = list(self._topics.values())
            self._topics.clear()
        self._destroy_subscriptions(items)

    def _destroy_subscriptions(self, items: list[dict[str, Any]]) -> None:
        node = self._node_getter()
        if node is None:
            return
        for item in items:
            subscription = item.get('subscription')
            if subscription is None:
                continue
            try:
                node.destroy_subscription(subscription)
            except Exception:
                pass

    def _record_message(self, topic_name: str, topic_type: str, message: Any) -> None:
        self._history.record(topic_name, topic_type, message)

    @staticmethod
    def _public_state(key: tuple[str, str], item: dict[str, Any]) -> dict[str, Any]:
        return {
            'topic_name': key[0],
            'topic_type': item.get('topic_type'),
            'full_type': item.get('topic_type'),
            'receiving': bool(item.get('receiving', item.get('subscription') is not None)),
            'history_limit': item.get('history_limit'),
            'message_count': item.get('message_count', 0),
            'last_message': item.get('last_message'),
            'last_received_at': item.get('last_received_at'),
            'error': item.get('error'),
            'started_at': item.get('started_at'),
            'qos': item.get('qos'),
            'graph_state': item.get('graph_state'),
        }
