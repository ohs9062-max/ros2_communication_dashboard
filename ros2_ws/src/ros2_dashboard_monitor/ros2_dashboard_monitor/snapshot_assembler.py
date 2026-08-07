"""Topic snapshot을 보강하고 기존 resource assembler import를 호환합니다."""

from __future__ import annotations

from typing import Any, Callable

from ros2_dashboard_monitor.action_snapshot import assemble_action_snapshot
from ros2_dashboard_monitor.monitor_helpers import dashboard_execution_node, without_internal_node
from ros2_dashboard_monitor.node_snapshot import assemble_node_snapshot
from ros2_dashboard_monitor.service_snapshot import assemble_service_snapshot
from ros2_dashboard_monitor.topology import related_nodes

__all__ = [
    'assemble_action_snapshot',
    'assemble_node_snapshot',
    'assemble_service_snapshot',
    'enrich_topic_snapshot',
]


def enrich_topic_snapshot(
    snapshot: dict[str, Any],
    *,
    role_nodes: dict[tuple[str, str, str], set[str]],
    internal_node: str,
    interface_states: dict[Any, Any],
    apply_primary_state: Callable[..., None],
) -> dict[str, Any]:
    """Topic Cache에 Node 관계와 Dashboard 실행 상태를 합칩니다."""
    for topic in snapshot['topics']:
        topic_types = topic.get('types') or []
        topic_name = str(topic.get('name') or '')
        states = [
            interface_states.get((topic_name, str(topic_type)), {})
            for topic_type in topic_types
        ]
        all_publishers = related_nodes(
            role_nodes,
            role='topic_publisher',
            resource_name=topic_name,
            resource_types=topic_types,
        )
        all_subscribers = related_nodes(
            role_nodes,
            role='topic_subscriber',
            resource_name=topic_name,
            resource_types=topic_types,
        )
        publishers = without_internal_node(all_publishers, internal_node)
        subscribers = without_internal_node(all_subscribers, internal_node)
        publisher_created = any(
            state.get('interface_publisher_created') is True for state in states
        )
        topic.update({
            'publisher_node_count': len(publishers),
            'subscriber_node_count': len(subscribers),
            'total_publisher_node_count': len(all_publishers),
            'total_subscriber_node_count': len(all_subscribers),
            'internal_publisher_node_count': len(all_publishers) - len(publishers),
            'internal_subscriber_node_count': len(all_subscribers) - len(subscribers),
            'external_subscriber_node_count': len(subscribers),
            'publisher_nodes': publishers,
            'subscriber_nodes': subscribers,
            'all_publisher_nodes': all_publishers,
            'all_subscriber_nodes': all_subscribers,
            'internal_publisher_nodes': [name for name in all_publishers if name == internal_node],
            'internal_subscriber_nodes': [name for name in all_subscribers if name == internal_node],
            'external_subscriber_nodes': subscribers,
            'publisher_endpoint_count': int(topic.get('publisher_count') or 0),
            'subscriber_endpoint_count': int(topic.get('subscriber_count') or 0),
            'internal_subscriber_endpoint_count': int(topic.get('monitor_subscriber_count') or 0),
            'external_subscriber_endpoint_count': int(topic.get('external_subscriber_count') or 0),
            'dashboard_communication': {
                'auto_monitoring_active': topic.get('deep_monitoring') is True,
                'interface_receive_active': any(
                    state.get('interface_receive_active') is True for state in states
                ),
                'interface_publisher_created': publisher_created,
                'execution_node': (
                    dashboard_execution_node(internal_node) if publisher_created else None
                ),
            },
        })
        apply_primary_state(topic, kind='topics', name=topic_name)
    return snapshot
