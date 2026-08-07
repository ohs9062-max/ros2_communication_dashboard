"""사용자가 명시적으로 시작한 Interface Lab Topic 지속 발행 상태를 관리합니다."""

from __future__ import annotations

from threading import Event, Thread
from time import time
from typing import Any, Callable

from ros2_dashboard_monitor.interface_lab.execution.topic_support import (
    DEFAULT_CONTINUOUS_PUBLISH_HZ,
    InterfaceReceiveError,
    normalize_publish_hz,
)


class ContinuousTopicPublishRuntime:
    """지속 발행 thread와 실행 상태를 단일 책임으로 관리합니다."""

    def __init__(
        self,
        *,
        lock: Any,
        publish: Callable[..., dict[str, Any]],
    ) -> None:
        self._lock = lock
        self._publish = publish
        self._publishes: dict[tuple[str, str], dict[str, Any]] = {}

    def start(
        self,
        *,
        topic_name: str,
        topic_type: str,
        payload: dict[str, Any],
        hz: float = DEFAULT_CONTINUOUS_PUBLISH_HZ,
    ) -> dict[str, Any]:
        topic_name = topic_name.strip()
        topic_type = topic_type.strip()
        normalized_hz = normalize_publish_hz(hz)
        key = (topic_name, topic_type)
        with self._lock:
            active = self._publishes.get(key)
            if active and active.get('active'):
                raise InterfaceReceiveError('이미 지속 발행 중인 Topic입니다. 먼저 중지하세요.')

        first_result = self._publish(
            topic_name=topic_name,
            topic_type=topic_type,
            payload=payload,
        )
        if first_result.get('success') is not True:
            return {
                **first_result,
                'continuous': False,
                'active': False,
                'hz': normalized_hz,
            }

        state = {
            'topic_name': topic_name,
            'topic_type': topic_type,
            'payload': payload,
            'hz': normalized_hz,
            'active': True,
            'continuous': True,
            'started_at': time(),
            'stopped_at': None,
            'message_count': 1,
            'last_published_at': first_result.get('published_at'),
            'error': None,
            'stop_event': Event(),
            'thread': None,
        }
        thread = Thread(
            target=self._publish_loop,
            args=(key,),
            daemon=True,
            name=f'interface-topic-publish:{topic_name}',
        )
        state['thread'] = thread
        with self._lock:
            self._publishes[key] = state
        thread.start()
        return self._public_state(state)

    def stop(self, *, topic_name: str, topic_type: str) -> dict[str, Any]:
        key = (topic_name.strip(), topic_type.strip())
        with self._lock:
            state = self._publishes.get(key)
        if state is None:
            return {
                'topic_name': key[0],
                'topic_type': key[1],
                'active': False,
                'continuous': True,
                'message_count': 0,
            }
        state['stop_event'].set()
        thread = state.get('thread')
        if thread is not None and thread.is_alive():
            thread.join(timeout=2.0)
        with self._lock:
            state['active'] = False
            state['stopped_at'] = state.get('stopped_at') or time()
            return self._public_state(state)

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            items = [
                self._public_state(item)
                for _key, item in sorted(self._publishes.items())
            ]
        return {
            'publishes': items,
            'meta': {
                'count': len(items),
                'active_count': sum(1 for item in items if item['active']),
            },
        }

    def stop_all(self) -> None:
        with self._lock:
            states = list(self._publishes.values())
        for state in states:
            state['stop_event'].set()
        for state in states:
            thread = state.get('thread')
            if thread is not None and thread.is_alive():
                thread.join(timeout=2.0)

    def clear(self) -> None:
        self.stop_all()
        with self._lock:
            self._publishes = {}

    def _publish_loop(self, key: tuple[str, str]) -> None:
        with self._lock:
            state = self._publishes.get(key)
        if state is None:
            return
        interval_sec = 1.0 / state['hz']
        stop_event = state['stop_event']
        while not stop_event.wait(interval_sec):
            try:
                result = self._publish(
                    topic_name=state['topic_name'],
                    topic_type=state['topic_type'],
                    payload=state['payload'],
                )
                with self._lock:
                    state['message_count'] += 1 if result.get('success') is True else 0
                    state['last_published_at'] = result.get('published_at')
                    if result.get('success') is not True:
                        state['error'] = result.get('error') or '지속 발행에 실패했습니다.'
                        stop_event.set()
            except Exception as exc:
                with self._lock:
                    state['error'] = str(exc)
                stop_event.set()
        with self._lock:
            state['active'] = False
            state['stopped_at'] = state.get('stopped_at') or time()

    @staticmethod
    def _public_state(state: dict[str, Any]) -> dict[str, Any]:
        return {
            key: value
            for key, value in state.items()
            if key not in {'stop_event', 'thread'}
        }
