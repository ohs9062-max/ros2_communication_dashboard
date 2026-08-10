"""ROS2 Topic Graph endpoint를 runtime 원시 상태로 수집합니다."""

from __future__ import annotations

from typing import Any, Callable, Iterable

from ros2_dashboard_monitor.resource_state import (
    disconnected_resource,
    mark_graph_present,
)
from ros2_dashboard_monitor.ros2_topic.discovery import build_topic_item
from ros2_dashboard_monitor.ros2_topic.filters import is_topic_type_excluded
from ros2_dashboard_monitor.qos import observe_topic_qos


TOPIC_COUNT_FIELDS = (
    'publisher_count',
    'subscriber_count',
    'raw_subscriber_count',
    'monitor_subscriber_count',
    'external_subscriber_count',
)


def collect_topic_graph(
    *,
    node: Any,
    names_and_types: Iterable[tuple[str, list[str]]],
    previous_topics: dict[str, dict[str, Any]],
    updated_at: float,
    exclude_types: tuple[str, ...],
    is_included: Callable[[str], bool],
    is_supported: Callable[[str | None], bool],
    is_registered: Callable[[str | None], bool],
    auto_subscribe: Callable[[str, str | None, bool], bool],
    monitor_subscriber_count: Callable[[str, str | None], int],
) -> tuple[list[dict[str, Any]], set[str]]:
    """필터링된 Graph 항목과 외부 endpoint가 존재하는 Topic 이름을 반환합니다."""
    topics = []
    externally_present_names = set()

    for name, types in names_and_types:
        if not is_included(name):
            continue
        if any(
            is_topic_type_excluded(topic_type, exclude_types=exclude_types)
            for topic_type in types
        ):
            continue

        topic_type = types[0] if types else None
        supported_type = is_supported(topic_type)
        deep_monitoring = auto_subscribe(name, topic_type, supported_type)
        publisher_count = node.count_publishers(name)
        raw_subscriber_count = node.count_subscribers(name)
        monitor_count = monitor_subscriber_count(name, topic_type)
        external_count = max(0, raw_subscriber_count - monitor_count)
        externally_present = publisher_count > 0 or external_count > 0
        if externally_present:
            externally_present_names.add(name)

        topic = build_topic_item(
            name=name,
            types=list(types),
            publisher_count=publisher_count,
            raw_subscriber_count=raw_subscriber_count,
            monitor_subscriber_count=monitor_count,
            external_subscriber_count=external_count,
            updated_at=updated_at,
            supported_type=supported_type,
            registered_interface_type=is_registered(topic_type),
            deep_monitoring=deep_monitoring,
        )
        topic.update(observe_topic_qos(node, name))
        if externally_present:
            mark_graph_present(topic, observed_at=updated_at)
        elif name in previous_topics:
            topic = _disconnected(previous_topics[name], updated_at)
        topics.append(topic)

    current_names = {topic['name'] for topic in topics}
    topics.extend(
        _disconnected(cached, updated_at)
        for name, cached in previous_topics.items()
        if name not in current_names
    )
    topics.sort(key=lambda topic: topic['name'])
    return topics, externally_present_names


def _disconnected(
    cached: dict[str, Any],
    detected_at: float,
) -> dict[str, Any]:
    return disconnected_resource(
        cached,
        detected_at=detected_at,
        count_fields=TOPIC_COUNT_FIELDS,
    )
