"""Topic 모니터링의 runtime 관련 기능을 담당하는 모듈입니다."""

from __future__ import annotations

import logging
from time import time
from typing import Any, Callable

from ros2_dashboard_monitor.config_loader import MonitorConfig
from ros2_dashboard_monitor.ros2_topic.filters import (
    is_supported_type,
    is_topic_included,
    should_deep_monitor,
)
from ros2_dashboard_monitor.ros2_topic.graph_collector import (
    collect_topic_graph,
)
from ros2_dashboard_monitor.ros2_topic.models import copy_message_preview
from ros2_dashboard_monitor.ros2_topic.preview import build_message_preview
from ros2_dashboard_monitor.ros2_topic.query_support import (
    build_topic_hz_response,
    hz_response,
    latest_response,
    load_message_class,
    select_subscription_qos,
)
from ros2_dashboard_monitor.ros2_topic.snapshot import (
    build_topic_snapshot,
    copy_subscription_snapshots,
)
from ros2_dashboard_monitor.ros2_topic.subscription_lifecycle import (
    cleanup_disappeared_subscriptions,
    ensure_subscription,
    monitor_subscriber_count,
    owned_subscription_endpoint_count,
)
from ros2_dashboard_monitor.ros2_topic.subscriptions import (
    DEFAULT_SUBSCRIPTION_CLEANUP_AFTER_SEC,
    has_subscription,
    update_subscription_entry,
)


LOGGER = logging.getLogger(__name__)


class TopicRuntime:
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

    def latest_message(self, name: str) -> dict[str, Any]:
        """Topic을 구독할 수 있는지 확인하고 현재 최신 메시지를 반환합니다."""
        if self._node_getter() is None:
            return self._latest_response(
                success=False,
                name=name,
                message='ROS2 monitor is not running',
            )

        topic_type = self._topic_type(name)
        if topic_type is None:
            return self._latest_response(
                success=False,
                name=name,
                message='Topic not found',
            )

        if not self._is_supported_type(topic_type):
            return self._latest_response(
                success=False,
                name=name,
                topic_type=topic_type,
                message='unsupported topic type',
            )

        message_class = self._message_class(topic_type)
        if message_class is None:
            return self._latest_response(
                success=False,
                name=name,
                topic_type=topic_type,
                message='Failed to import topic message class',
            )

        self._ensure_subscription(name, topic_type, message_class)

        with self._lock:
            entry = self._subscriptions.get(name, {})
            message_preview = entry.get('message_preview')
            last_received_at = entry.get('last_received_at')

        return self._latest_response(
            success=True,
            name=name,
            topic_type=topic_type,
            received=message_preview is not None,
            last_received_at=last_received_at,
            message_preview=message_preview,
            message='Latest topic message fetched successfully',
        )

    def topic_hz(self, name: str) -> dict[str, Any]:
        """Topic을 구독할 수 있는지 확인하고 최근 timestamp 창의 Hz를 반환합니다."""
        if self._node_getter() is None:
            return self._hz_response(
                success=False,
                name=name,
                message='ROS2 monitor is not running',
            )

        topic_type = self._topic_type(name)
        if topic_type is None:
            return self._hz_response(
                success=False,
                name=name,
                message='Topic not found',
            )

        if not self._is_supported_type(topic_type):
            return self._hz_response(
                success=False,
                name=name,
                topic_type=topic_type,
                message='unsupported topic type',
            )

        message_class = self._message_class(topic_type)
        if message_class is None:
            return self._hz_response(
                success=False,
                name=name,
                topic_type=topic_type,
                message='Failed to import topic message class',
            )

        self._ensure_subscription(name, topic_type, message_class)
        return self._topic_hz_snapshot(name, topic_type)

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

    def _auto_subscribe_topic(
        self,
        name: str,
        topic_type: str | None,
        supported_type: bool,
    ) -> bool:
        if not should_deep_monitor(
            auto_discover=self._config.topics_auto_discover,
            auto_subscribe_supported_types=(
                self._config.topics_auto_subscribe_supported_types
            ),
            topic_type=topic_type,
            supported_type=supported_type,
        ):
            return False

        message_class = self._message_class(topic_type)
        if message_class is None:
            return False

        try:
            self._ensure_subscription(name, topic_type, message_class)
        except Exception as exc:
            with self._lock:
                self._subscription_errors[name] = str(exc)
            LOGGER.warning(
                'Failed to auto-subscribe Topic %s (%s): %s',
                name,
                topic_type,
                exc,
            )
            return False
        with self._lock:
            self._subscription_errors.pop(name, None)
        return self._has_subscription(name, topic_type)

    def _ensure_subscription(
        self,
        name: str,
        topic_type: str,
        message_class: type,
    ) -> None:
        ensure_subscription(
            node=self._node_getter(),
            lock=self._lock,
            subscriptions=self._subscriptions,
            name=name,
            topic_type=topic_type,
            message_class=message_class,
            callback=self._latest_message_callback(name, topic_type),
            qos_resolver=self._qos_profile,
        )

    def _has_subscription(self, name: str, topic_type: str) -> bool:
        with self._lock:
            entry = self._subscriptions.get(name)
            return has_subscription(entry, topic_type=topic_type)

    def _monitor_subscriber_count(
        self,
        name: str,
        topic_type: str | None,
    ) -> int:
        return monitor_subscriber_count(
            node=self._node_getter(),
            lock=self._lock,
            subscriptions=self._subscriptions,
            name=name,
            topic_type=topic_type,
            action_monitor_subscriber_count=(
                self._action_monitor_subscriber_count
            ),
        )

    @staticmethod
    def _owned_subscription_endpoint_count(
        node: Any,
        topic_name: str,
    ) -> int | None:
        return owned_subscription_endpoint_count(node, topic_name)

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

    def _latest_message_callback(self, name: str, topic_type: str):
        def callback(message: Any) -> None:
            received_at = time()
            preview = build_message_preview(topic_type, message)
            with self._lock:
                entry = self._subscriptions.get(name)
                if entry is None:
                    return

                update_subscription_entry(
                    entry,
                    message_preview=preview,
                    received_at=received_at,
                    window_sec=self._config.hz_window_sec,
                )

        return callback

    def _topic_hz_snapshot(
        self,
        name: str,
        topic_type: str,
    ) -> dict[str, Any]:
        return build_topic_hz_response(
            lock=self._lock,
            subscriptions=self._subscriptions,
            name=name,
            topic_type=topic_type,
            window_sec=self._config.hz_window_sec,
            stale_timeout_sec=self._config.stale_timeout_sec,
        )

    @staticmethod
    def _message_class(topic_type: str) -> type | None:
        return load_message_class(topic_type)

    def _qos_profile(self, topic_name: str, topic_type: str):
        return select_subscription_qos(
            self._node_getter(),
            topic_name,
            topic_type,
        )

    @staticmethod
    def _latest_response(
        *,
        success: bool,
        name: str,
        message: str,
        topic_type: str | None = None,
        received: bool = False,
        last_received_at: float | None = None,
        message_preview: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return latest_response(
            success=success,
            name=name,
            message=message,
            topic_type=topic_type,
            received=received,
            last_received_at=last_received_at,
            message_preview=message_preview,
        )

    @staticmethod
    def _hz_response(
        *,
        success: bool,
        name: str,
        message: str,
        topic_type: str | None = None,
        received: bool = False,
        message_count: int = 0,
        window_sec: float = 5.0,
        hz: float = 0.0,
        last_received_at: float | None = None,
        age_sec: float | None = None,
        is_stale: bool = False,
        status: str = 'never_received',
    ) -> dict[str, Any]:
        return hz_response(
            success=success,
            name=name,
            message=message,
            topic_type=topic_type,
            received=received,
            message_count=message_count,
            window_sec=window_sec,
            hz=hz,
            last_received_at=last_received_at,
            age_sec=age_sec,
            is_stale=is_stale,
            status=status,
        )
