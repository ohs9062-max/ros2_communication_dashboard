"""Topic 자동 구독과 수신 상태 갱신을 제공하는 facade입니다."""

from __future__ import annotations

import logging
from time import time
from typing import Any

from ros2_dashboard_monitor.ros2_topic.filters import should_deep_monitor
from ros2_dashboard_monitor.ros2_topic.camera_preview import (
    encode_camera_preview,
    is_camera_topic_type,
)
from ros2_dashboard_monitor.ros2_topic.preview import build_message_preview
from ros2_dashboard_monitor.ros2_topic.query_support import (
    load_message_class,
    select_subscription_qos,
)
from ros2_dashboard_monitor.ros2_topic.subscription_lifecycle import (
    ensure_subscription,
    monitor_subscriber_count,
    owned_subscription_endpoint_count,
)
from ros2_dashboard_monitor.ros2_topic.subscriptions import (
    has_subscription,
    update_subscription_entry,
)


LOGGER = logging.getLogger(__name__)


class TopicSubscriptionFacade:
    """Topic subscription 생성, 자동 선택과 callback 상태를 조정합니다."""

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
            history_limit=self._config.topics_history_limit,
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

    def _latest_message_callback(self, name: str, topic_type: str):
        def callback(message: Any) -> None:
            received_at = time()
            preview = build_message_preview(topic_type, message)
            image_preview = None
            if is_camera_topic_type(topic_type):
                with self._lock:
                    entry = self._subscriptions.get(name)
                    requested_until = float(
                        (entry or {}).get('image_preview_requested_until') or 0.0,
                    )
                    last_encoded_at = float(
                        (entry or {}).get('image_preview_encoded_at') or 0.0,
                    )
                    if entry is not None and requested_until < received_at:
                        entry.pop('image_preview', None)
                        entry.pop('image_preview_frame_received_at', None)
                if (
                    requested_until >= received_at
                    and received_at - last_encoded_at
                    >= self._config.camera_preview.min_interval_sec
                ):
                    limits = self._config.camera_preview
                    image_preview = encode_camera_preview(
                        topic_type,
                        message,
                        max_source_bytes=limits.max_source_bytes,
                        max_width=limits.max_width,
                        max_height=limits.max_height,
                    )
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
                if image_preview is not None:
                    entry['image_preview'] = image_preview
                    entry['image_preview_encoded_at'] = received_at
                    entry['image_preview_frame_received_at'] = received_at

        return callback

    @staticmethod
    def _message_class(topic_type: str) -> type | None:
        return load_message_class(topic_type)

    def _qos_profile(self, topic_name: str, topic_type: str):
        return select_subscription_qos(
            self._node_getter(),
            topic_name,
            topic_type,
        )
