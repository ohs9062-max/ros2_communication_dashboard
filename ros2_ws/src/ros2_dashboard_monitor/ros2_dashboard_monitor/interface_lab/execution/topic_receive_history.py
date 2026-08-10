"""Interface Lab Topic Receive의 메시지 이력을 관리합니다."""

from __future__ import annotations

from time import time
from typing import Any, Callable

from ros2_dashboard_monitor.interface_lab.execution.topic_support import (
    DEFAULT_TOPIC_HISTORY_LIMIT,
    normalize_limit,
)


class TopicReceiveHistory:
    """Topic별 bounded history와 message count를 thread-safe하게 갱신합니다."""

    def __init__(
        self,
        *,
        lock: Any,
        message_to_json: Callable[[Any], Any],
        topics: dict[tuple[str, str], dict[str, Any]],
    ) -> None:
        self._lock = lock
        self._message_to_json = message_to_json
        self._topics = topics
        self._sequence = 0

    def record(self, topic_name: str, topic_type: str, message: Any) -> None:
        """수신 메시지를 JSON-safe event로 변환해 Topic history에 기록합니다."""
        received_at = time()
        try:
            message_json = self._message_to_json(message)
            error = None
        except Exception as exc:
            message_json = None
            error = str(exc)
        preview = message_json if message_json is not None else {'error': error}
        key = (topic_name, topic_type)
        with self._lock:
            item = self._topics.get(key)
            if item is None:
                return
            self._sequence += 1
            event = {
                'topic_name': topic_name,
                'topic_type': topic_type,
                'received_at': received_at,
                'sequence': self._sequence,
                'message_preview': preview,
                'message_json': message_json,
                'size_bytes': len(str(preview).encode('utf-8')),
                'error': error,
            }
            history = item.setdefault('history', [])
            history.insert(0, event)
            del history[int(item.get('history_limit') or DEFAULT_TOPIC_HISTORY_LIMIT):]
            item['message_count'] = int(item.get('message_count') or 0) + 1
            item['last_message'] = event
            item['last_received_at'] = received_at
            item['error'] = error

    def response(
        self,
        *,
        topic_name: str | None = None,
        topic_type: str | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        """선택 조건에 맞는 최신 수신 이력을 반환합니다."""
        normalized_limit = normalize_limit(limit or DEFAULT_TOPIC_HISTORY_LIMIT)
        with self._lock:
            if topic_name and topic_type:
                items = list(self._topics.get((topic_name, topic_type), {}).get('history', []))
            elif topic_name:
                items = [
                    event
                    for key, item in self._topics.items()
                    if key[0] == topic_name
                    for event in item.get('history', [])
                ]
            else:
                items = [
                    event
                    for item in self._topics.values()
                    for event in item.get('history', [])
                ]
        items.sort(key=lambda event: event.get('received_at') or 0, reverse=True)
        visible = items[:normalized_limit]
        return {'history': visible, 'meta': {'count': len(visible)}}

    def reset(
        self,
        *,
        topic_name: str | None = None,
        topic_type: str | None = None,
    ) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        """선택 Topic 상태와 이력을 제거하고 destroy할 subscription 항목을 반환합니다."""
        with self._lock:
            if topic_name and topic_type:
                item = self._topics.pop((topic_name, topic_type), None)
                removed_items = [] if item is None else [item]
            elif topic_name:
                matching_keys = [key for key in self._topics if key[0] == topic_name]
                removed_items = [self._topics.pop(key) for key in matching_keys]
            else:
                removed_items = list(self._topics.values())
                self._topics.clear()
            cleared = sum(len(item.get('history', [])) for item in removed_items)

        return ({
            'cleared': cleared,
            'removed': len(removed_items),
            'topic_name': topic_name,
            'topic_type': topic_type,
        }, removed_items)
