"""Interface Lab Topic Graph 조회와 type 충돌 상태 계산."""

from __future__ import annotations

from typing import Any, Callable

from ros2_dashboard_monitor.interface_lab.execution.topic_support import safe_count


class TopicGraphInspector:
    """rclpy Node의 Topic Graph를 Interface Lab용 모델로 변환합니다."""

    def __init__(self, *, node_getter: Callable[[], Any]) -> None:
        self._node_getter = node_getter

    def topics(self) -> list[dict[str, Any]]:
        node = self._node_getter()
        if node is None:
            return []
        try:
            names_and_types = node.get_topic_names_and_types()
        except Exception:
            return []

        graph = []
        for name, types in names_and_types:
            for topic_type in sorted(set(types)):
                graph.append({
                    'name': name,
                    'type': topic_type,
                    'publisher_count': safe_count(lambda: node.count_publishers(name)),
                    'subscriber_count': safe_count(lambda: node.count_subscribers(name)),
                })
        return graph

    def topics_for_type(self, topic_type: str) -> list[dict[str, Any]]:
        return [item for item in self.topics() if item.get('type') == topic_type]

    def state(self, *, topic_name: str, topic_type: str) -> dict[str, Any]:
        same_name = [item for item in self.topics() if item.get('name') == topic_name]
        exact = [item for item in same_name if item.get('type') == topic_type]
        conflicts = [item for item in same_name if item.get('type') != topic_type]
        return {
            'topic_name': topic_name,
            'topic_type': topic_type,
            'exists': bool(same_name),
            'type_matches': bool(exact) or not same_name,
            'exact_matches': exact,
            'conflicts': conflicts,
            'warning': (
                'The ROS2 graph contains the same Topic name with a different type.'
                if conflicts else (
                    'No Topic with the same name is currently visible in the ROS2 graph.'
                    if not same_name else None
                )
            ),
            'publisher_count': max(
                [int(item.get('publisher_count') or 0) for item in exact] or [0]
            ),
            'subscriber_count': max(
                [int(item.get('subscriber_count') or 0) for item in exact] or [0]
            ),
        }
