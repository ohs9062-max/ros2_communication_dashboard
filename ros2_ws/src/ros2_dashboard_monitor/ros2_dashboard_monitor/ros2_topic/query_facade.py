"""Topic latest/Hz 공개 조회 흐름을 제공하는 facade입니다."""

from __future__ import annotations

from typing import Any
from time import time

from ros2_dashboard_monitor.ros2_topic.camera_preview import (
    is_camera_topic_type,
)

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

    def topic_history(self, name: str, *, limit: int | None = None) -> dict[str, Any]:
        """Return bounded messages actually received by the Monitor Subscription."""
        topic_type = self._topic_type(name)
        if topic_type is None:
            return {
                'success': False,
                'data': [],
                'meta': {'count': 0, 'limit': 0, 'source': 'monitor_subscription'},
                'message': 'Topic not found',
            }
        if not self._is_supported_type(topic_type):
            return {
                'success': False,
                'data': [],
                'meta': {'count': 0, 'limit': 0, 'source': 'monitor_subscription'},
                'message': 'unsupported topic type',
            }

        message_class = self._message_class(topic_type)
        if message_class is None:
            return {
                'success': False,
                'data': [],
                'meta': {'count': 0, 'limit': 0, 'source': 'monitor_subscription'},
                'message': 'Failed to import topic message class',
            }
        self._ensure_subscription(name, topic_type, message_class)
        selected_limit = min(
            max(1, int(limit or self._config.topics_history_limit)),
            self._config.topics_history_limit,
        )
        with self._lock:
            entry = self._subscriptions.get(name, {})
            history = list(entry.get('history') or ())[:selected_limit]
            items = [
                {
                    **item,
                    'name': name,
                    'type': topic_type,
                }
                for item in history
            ]
        return {
            'success': True,
            'data': items,
            'meta': {
                'count': len(items),
                'limit': self._config.topics_history_limit,
                'source': 'monitor_subscription',
            },
            'message': 'Recent Topic data fetched successfully',
        }

    def image_preview(self, name: str) -> dict[str, Any]:
        """Refresh a live Camera preview lease and return its newest frame."""
        if self._node_getter() is None:
            return self._image_preview_response(
                success=False, name=name, message='ROS2 monitor is not running',
            )

        topic_type = self._topic_type(name)
        if topic_type is None:
            return self._image_preview_response(
                success=False, name=name, message='Topic not found',
            )
        if not is_camera_topic_type(topic_type):
            return self._image_preview_response(
                success=False, name=name, topic_type=topic_type,
                message='Topic is not a supported Camera image type',
            )

        message_class = self._message_class(topic_type)
        if message_class is None:
            return self._image_preview_response(
                success=False, name=name, topic_type=topic_type,
                message='Failed to import topic message class',
            )
        self._ensure_subscription(name, topic_type, message_class)

        requested_at = time()
        with self._lock:
            entry = self._subscriptions.get(name, {})
            entry['image_preview_requested_until'] = (
                requested_at + self._config.camera_preview.demand_ttl_sec
            )
            metadata = entry.get('message_preview')
            image_preview = entry.get('image_preview')
            last_received_at = entry.get('last_received_at')
            frame_received_at = entry.get('image_preview_frame_received_at')

        if image_preview is None:
            image_preview = {
                'status': 'awaiting_frame',
                'mime_type': None,
                'size_bytes': 0,
                'data_url': None,
                'error': None,
            }
        return self._image_preview_response(
            success=True,
            name=name,
            topic_type=topic_type,
            received=metadata is not None,
            last_received_at=last_received_at,
            frame_received_at=frame_received_at,
            metadata=metadata,
            image_preview=image_preview,
            message='Camera Topic preview fetched successfully',
        )

    def stop_image_preview(self, name: str) -> dict[str, Any]:
        """Immediately release one Browser live-preview demand and its frame."""
        with self._lock:
            entry = self._subscriptions.get(name)
            if entry is not None:
                entry.pop('image_preview_requested_until', None)
                entry.pop('image_preview', None)
                entry.pop('image_preview_encoded_at', None)
                entry.pop('image_preview_frame_received_at', None)
        return {
            'success': True,
            'data': {'name': name},
            'message': 'Camera Topic live preview stopped',
        }

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

    @staticmethod
    def _image_preview_response(
        *,
        success: bool,
        name: str,
        message: str,
        topic_type: str | None = None,
        received: bool = False,
        last_received_at: float | None = None,
        frame_received_at: float | None = None,
        metadata: dict[str, Any] | None = None,
        image_preview: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return {
            'success': success,
            'data': {
                'name': name,
                'type': topic_type,
                'received': received,
                'last_received_at': last_received_at,
                'frame_received_at': frame_received_at,
                'metadata': metadata.copy() if isinstance(metadata, dict) else None,
                'preview': image_preview.copy() if isinstance(image_preview, dict) else None,
            },
            'message': message,
        }
