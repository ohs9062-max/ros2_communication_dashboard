"""Topic 모니터링의 runtime 관련 기능을 담당하는 모듈입니다."""

from __future__ import annotations

from time import time
from typing import Any, Callable

from ros2_dashboard_monitor.config_loader import MonitorConfig
from ros2_dashboard_monitor.ros2_topic.filters import (
    is_supported_type,
    is_topic_included,
)
from ros2_dashboard_monitor.ros2_topic.graph_collector import (
    collect_topic_graph,
)
from ros2_dashboard_monitor.ros2_topic.models import copy_message_preview
from ros2_dashboard_monitor.ros2_topic.query_facade import TopicQueryFacade
from ros2_dashboard_monitor.ros2_topic.snapshot import (
    build_topic_snapshot,
    copy_subscription_snapshots,
)
from ros2_dashboard_monitor.ros2_topic.subscription_lifecycle import (
    cleanup_disappeared_subscriptions,
)
from ros2_dashboard_monitor.ros2_topic.subscription_facade import (
    TopicSubscriptionFacade,
)
from ros2_dashboard_monitor.ros2_topic.subscriptions import (
    DEFAULT_SUBSCRIPTION_CLEANUP_AFTER_SEC,
)


class TopicRuntime(TopicQueryFacade, TopicSubscriptionFacade):
    """Topic 모니터링 runtime 상태와 cache를 관리하는 클래스입니다."""

    def __init__(
        self,
        *,
        action_monitor_subscriber_count: Callable[[str], int],
        config: MonitorConfig,
        lock: Any,
        node_getter: Callable[[], Any],
    ) -> None:
        """Topic Graph 조회, 자동 구독, latest·Hz Cache에 필요한 의존성을 저장합니다."""
        self._action_monitor_subscriber_count = (
            action_monitor_subscriber_count
        )
        self._config = config
        self._lock = lock
        self._node_getter = node_getter
        self._topics: list[dict[str, Any]] = []
        self._last_updated = 0.0
        self._subscriptions: dict[str, dict[str, Any]] = {}
        self._subscription_errors: dict[str, str] = {}

    def clear(self) -> None:
        """Topic 모니터링에서 cache와 runtime 상태를 초기화하는 함수입니다."""
        with self._lock:
            self._topics = []
            self._last_updated = 0.0
            self._subscriptions = {}
            self._subscription_errors = {}

    def snapshot(self) -> dict[str, Any]:
        """Topic Graph Cache에 최신 메시지와 마지막 수신 시각을 합쳐 반환합니다."""
        with self._lock:
            topics = [topic.copy() for topic in self._topics]
            subscriptions = copy_subscription_snapshots(self._subscriptions)
            subscription_errors = self._subscription_errors.copy()
            last_updated = self._last_updated

        return build_topic_snapshot(
            topics=topics,
            subscriptions=subscriptions,
            subscription_errors=subscription_errors,
            last_updated=last_updated,
            required_stream_names=self._config.topics_required_stream_names,
            command_names=self._config.topics_command_names,
            stale_timeout_sec=self._config.stale_timeout_sec,
        )

    def alert_snapshot(
        self,
    ) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]]]:
        """Alert 계산에 필요한 Topic 목록과 subscription 상태를 함께 복사합니다."""
        with self._lock:
            topics = [topic.copy() for topic in self._topics]
            subscriptions = {
                name: {
                    'created_at': entry.get('created_at'),
                    'last_received_at': entry.get('last_received_at'),
                    'message_preview': copy_message_preview(
                        entry.get('message_preview'),
                    ),
                    'qos': entry.get('qos'),
                    'subscription_error': self._subscription_errors.get(name),
                }
                for name, entry in self._subscriptions.items()
            }

        return topics, subscriptions

    def update(self) -> None:
        """Topic 모니터링에서 runtime 상태를 갱신하는 함수입니다."""
        node = self._node_getter()
        if node is None:
            return

        updated_at = time()
        with self._lock:
            previous_topics = {
                topic['name']: topic.copy()
                for topic in self._topics
            }

        topics, externally_present_topic_names = collect_topic_graph(
            node=node,
            names_and_types=node.get_topic_names_and_types(),
            previous_topics=previous_topics,
            updated_at=updated_at,
            exclude_types=self._config.topics_exclude_types,
            is_included=self._is_topic_included,
            is_supported=self._is_supported_type,
            is_registered=(
                lambda topic_type: (
                    topic_type in self._config.topics_registered_types
                )
            ),
            auto_subscribe=self._auto_subscribe_topic,
            monitor_subscriber_count=self._monitor_subscriber_count,
        )

        with self._lock:
            self._topics = topics
            self._last_updated = updated_at

        self._cleanup_disappeared_subscriptions(
            externally_present_topic_names,
            updated_at,
        )

    def _is_topic_included(self, name: str) -> bool:
        return is_topic_included(
            name,
            include_names=self._config.topics_include,
            exclude_names=self._config.topics_exclude,
            exclude_prefixes=self._config.topics_exclude_prefixes,
        )

    def _topic_type(self, name: str) -> str | None:
        with self._lock:
            for topic in self._topics:
                if topic.get('name') != name:
                    continue

                if topic.get('graph_present') is False:
                    return None

                topic_types = topic.get('types')
                if isinstance(topic_types, list) and topic_types:
                    return topic_types[0]

        return None

    def _is_supported_type(self, topic_type: str | None) -> bool:
        return is_supported_type(
            topic_type,
            supported_types=self._config.topics_supported_types,
        )

    def _cleanup_disappeared_subscriptions(
        self,
        externally_present_topic_names: set[str],
        now: float,
    ) -> None:
        cleanup_disappeared_subscriptions(
            node=self._node_getter(),
            lock=self._lock,
            subscriptions=self._subscriptions,
            retained_topic_names=externally_present_topic_names,
            now=now,
            cleanup_after_sec=DEFAULT_SUBSCRIPTION_CLEANUP_AFTER_SEC,
        )
