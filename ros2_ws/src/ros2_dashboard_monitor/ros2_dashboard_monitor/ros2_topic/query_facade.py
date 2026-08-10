"""Topic latest/Hz 공개 조회 흐름을 제공하는 facade입니다."""

from __future__ import annotations

from typing import Any

from ros2_dashboard_monitor.ros2_topic.query_support import (
    build_topic_hz_response,
    hz_response,
    latest_response,
)


class TopicQueryFacade:
    """Topic 조회 요청 검증과 공개 응답 조립을 담당합니다."""

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
