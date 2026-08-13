"""WebSocket 전송용 ROS2 snapshot 요약 함수."""

from __future__ import annotations

from typing import Any


def assemble_websocket_snapshot(
    *,
    timestamp: float,
    topic_snapshot: dict[str, Any],
    service_snapshot: dict[str, Any],
    action_snapshot: dict[str, Any],
    node_snapshot: dict[str, Any],
    alerts: dict[str, Any],
) -> dict[str, Any]:
    """전체 Cache snapshot을 Browser WebSocket용 경량 payload로 축약합니다."""
    return {
        'type': 'monitor_snapshot',
        'timestamp': timestamp,
        'data': {
            'topics': websocket_topic_meta(topic_snapshot['topics']),
            'services': websocket_service_meta(
                service_snapshot['services'], service_snapshot['meta'],
            ),
            'actions': websocket_action_meta(
                action_snapshot['actions'], action_snapshot['meta'],
            ),
            'nodes': websocket_node_meta(
                node_snapshot['nodes'], node_snapshot['meta'],
            ),
            'alerts': alerts['data'],
        },
    }


def websocket_topic_meta(topics: list[dict[str, Any]]) -> dict[str, Any]:
    statuses = [
        item.get('effective_status') or item.get('status')
        for item in topics
    ]
    return {
        'count': len(topics),
        'active_count': sum(1 for status in statuses if status == 'active'),
        'warning_count': sum(
            1 for status in statuses
            if status in ('warning', 'stale', 'no_subscriber', 'waiting_publisher')
        ),
        'error_count': sum(
            1 for status in statuses
            if status in ('error', 'critical', 'disconnected', 'never_received')
        ),
        'deep_monitoring_count': sum(1 for item in topics if item.get('deep_monitoring') is True),
        'stale_count': sum(1 for status in statuses if status in ('stale', 'disconnected')),
        'latest': {
            item['name']: {
                'message_preview': item.get('last_message_preview'),
                'last_received_at': item.get('last_received_at'),
            }
            for item in topics
            if item.get('last_message_preview') is not None
        },
    }


def websocket_service_meta(
    services: list[dict[str, Any]],
    meta: dict[str, Any],
) -> dict[str, int]:
    return {
        'count': int(meta.get('count') or meta.get('visible_count') or 0),
        'active_count': int(meta.get('active_count') or 0),
        'warning_count': int(meta.get('warning_count') or 0),
        'error_count': int(meta.get('error_count') or 0),
        'callable_count': sum(1 for item in services if item.get('callable') is True),
        'last_call_count': sum(1 for item in services if item.get('last_call_summary')),
    }


def websocket_action_meta(
    actions: list[dict[str, Any]],
    meta: dict[str, Any],
) -> dict[str, int]:
    return {
        'count': int(meta.get('count') or 0),
        'active_count': int(meta.get('active_count') or 0),
        'warning_count': int(meta.get('warning_count') or 0),
        'error_count': int(meta.get('error_count') or 0),
        'observed_goal_count': int(meta.get('observed_goal_count') or 0),
        'executing_count': sum(
            1 for item in actions
            if item.get('runtime', {}).get('last_goal_status') == 'executing'
        ),
        'failed_count': sum(
            1 for item in actions
            if item.get('runtime', {}).get('last_goal_status') == 'aborted'
        ),
        'callable_count': sum(1 for item in actions if item.get('callable') is True),
        'last_goal_count': sum(1 for item in actions if item.get('last_goal_summary')),
    }


def websocket_node_meta(
    nodes: list[dict[str, Any]],
    meta: dict[str, Any],
) -> dict[str, int]:
    return {
        'count': int(meta.get('count') or len(nodes)),
        'active_count': int(meta.get('active_count') or 0),
        'warning_count': int(meta.get('warning_count') or 0),
        'error_count': int(meta.get('error_count') or 0),
        'stale_count': sum(1 for item in nodes if item.get('status') in ('stale', 'disconnected')),
    }
