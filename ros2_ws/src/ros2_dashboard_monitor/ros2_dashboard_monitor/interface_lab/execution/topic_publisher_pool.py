"""Interface Lab Topic Publisher와 실제 적용 QoS 상태를 관리합니다."""

from __future__ import annotations

from typing import Any, Callable

from ros2_dashboard_monitor.interface_lab.execution.topic_support import (
    InterfaceReceiveError,
)
from ros2_dashboard_monitor.interface_lab.execution.qos_profiles import (
    profile_fingerprint,
    resolve_topic_execution_qos,
)
from ros2_dashboard_monitor.qos import publisher_events


class TopicPublisherPool:
    """Topic 이름·타입별 Publisher를 생성하고 재사용합니다."""

    def __init__(self, *, lock: Any, node_getter: Callable[[], Any]) -> None:
        self._lock = lock
        self._node_getter = node_getter
        self._publishers: dict[tuple[str, str], dict[str, Any]] = {}

    def keys(self) -> list[tuple[str, str]]:
        with self._lock:
            return list(self._publishers)

    def get_or_create(
        self,
        *,
        topic_name: str,
        topic_type: str,
        message_class: type,
        qos_selection: dict[str, Any] | None = None,
    ) -> tuple[Any, bool]:
        key = (topic_name, topic_type)
        node = self._node_getter()
        if node is None:
            raise InterfaceReceiveError('ROS2 monitor node가 실행 중이 아닙니다.')
        qos_profile, qos = resolve_topic_execution_qos(
            node, topic_name, local_role='publisher', selection=qos_selection,
        )
        fingerprint = profile_fingerprint(qos_profile)
        with self._lock:
            entry = self._publishers.get(key)
            if entry is not None and entry.get('fingerprint') == fingerprint:
                return entry['publisher'], False
            if entry is not None:
                node.destroy_publisher(entry['publisher'])
            publisher = node.create_publisher(
                message_class,
                topic_name,
                qos_profile,
                event_callbacks=publisher_events(qos, 'topic_qos_incompatible'),
            )
            self._publishers[key] = {
                'publisher': publisher,
                'qos': qos,
                'fingerprint': fingerprint,
            }
            return publisher, True

    def qos_state(self, *, topic_name: str, topic_type: str) -> dict[str, Any]:
        with self._lock:
            entry = self._publishers.get((topic_name, topic_type))
            if entry is not None:
                return entry['qos']
        node = self._node_getter()
        if node is None:
            return {}
        return resolve_topic_execution_qos(
            node, topic_name, local_role='publisher', selection=None,
        )[1]

    def clear(self) -> None:
        with self._lock:
            publishers = [entry['publisher'] for entry in self._publishers.values()]
            self._publishers = {}
        node = self._node_getter()
        if node is None:
            return
        for publisher in publishers:
            try:
                node.destroy_publisher(publisher)
            except Exception:
                pass
