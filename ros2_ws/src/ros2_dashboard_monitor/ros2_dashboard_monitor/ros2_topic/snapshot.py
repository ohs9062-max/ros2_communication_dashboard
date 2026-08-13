"""Topic runtime 원시 상태를 공개 API snapshot으로 조립합니다."""

from __future__ import annotations

from typing import Any, Iterable

from ros2_dashboard_monitor.ros2_topic.models import copy_message_preview
from ros2_dashboard_monitor.ros2_topic.diagnostics import reception_diagnosis


UNKNOWN_QOS = {
    'qos_status': 'unknown',
    'qos_detection_source': 'unavailable',
    'local_qos': None,
    'remote_qos': [],
    'mismatch_policies': [],
    'mismatch_reason': None,
    'qos_auto_applied': False,
}


def copy_subscription_snapshots(
    subscriptions: dict[str, dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """Subscription runtime entry에서 공개 가능한 latest 상태만 복사합니다."""
    return {
        name: {
            'message_preview': copy_message_preview(entry.get('message_preview')),
            'last_received_at': entry.get('last_received_at'),
            'message_count': len(entry.get('timestamps', [])),
            'qos': entry.get('qos'),
        }
        for name, entry in subscriptions.items()
    }


def build_topic_snapshot(
    *,
    topics: Iterable[dict[str, Any]],
    subscriptions: dict[str, dict[str, Any]],
    subscription_errors: dict[str, str],
    last_updated: float,
    required_stream_names: tuple[str, ...],
    command_names: tuple[str, ...],
    stale_timeout_sec: float = 3.0,
) -> dict[str, Any]:
    """Graph/cache 상태에 사용자 정책과 공개 상태 필드를 결합합니다."""
    items = [topic.copy() for topic in topics]
    configured_names = dict.fromkeys((*required_stream_names, *command_names))
    present_names = {str(topic.get('name') or '') for topic in items}
    for name in configured_names:
        if name not in present_names:
            items.append(_missing_configured_topic(name, last_updated))

    for topic in items:
        _decorate_topic(
            topic,
            latest=subscriptions.get(str(topic.get('name') or ''), {}),
            subscription_error=subscription_errors.get(
                str(topic.get('name') or ''),
            ),
            required_stream_names=required_stream_names,
            command_names=command_names,
            observed_at=last_updated,
            stale_timeout_sec=stale_timeout_sec,
        )

    return {
        'topics': items,
        'count': len(items),
        'last_updated': last_updated,
    }


def _missing_configured_topic(name: str, last_updated: float) -> dict[str, Any]:
    return {
        'name': name,
        'types': [],
        'publisher_count': 0,
        'subscriber_count': 0,
        'raw_subscriber_count': 0,
        'monitor_subscriber_count': 0,
        'external_subscriber_count': 0,
        'status': 'not_discovered',
        'reason': 'configured topic is not visible in ROS2 graph',
        'last_updated': last_updated,
        'supported_type': False,
        'registered_interface_type': False,
        'deep_monitoring': False,
        'graph_present': False,
        'ever_discovered': False,
        'last_seen_at': None,
        'disconnected_at': None,
    }


def _decorate_topic(
    topic: dict[str, Any],
    *,
    latest: dict[str, Any],
    subscription_error: str | None,
    required_stream_names: tuple[str, ...],
    command_names: tuple[str, ...],
    observed_at: float,
    stale_timeout_sec: float,
) -> None:
    name = str(topic.get('name') or '')
    required_stream = name in required_stream_names
    command = name in command_names
    monitoring_role = _monitoring_role(topic, required_stream, command)

    topic['allowlisted'] = bool(
        topic.get('supported_type') or topic.get('deep_monitoring')
    )
    if topic.get('registered_interface_type') is True:
        primary_priority = 1
    elif required_stream or command or topic.get('supported_type') is True:
        primary_priority = 2
    else:
        primary_priority = None
    topic['primary'] = primary_priority is not None
    topic['primary_priority'] = primary_priority
    topic['monitoring_role'] = monitoring_role
    topic['hz_monitoring_configured'] = (
        required_stream or topic.get('supported_type') is True
    )
    topic['hz_monitoring_enabled'] = bool(topic.get('deep_monitoring'))
    topic['hz_monitoring_status'] = _hz_monitoring_status(topic, required_stream)
    preview = latest.get('message_preview')
    topic['observed'] = preview is not None
    topic['last_message_preview'] = preview
    topic['last_received_at'] = latest.get('last_received_at')
    topic['message_count'] = latest.get('message_count', 0)
    topic['detailed_monitoring_enabled'] = bool(topic.get('deep_monitoring'))
    topic['last_error'] = subscription_error
    topic.update(latest.get('qos') or UNKNOWN_QOS)
    topic['reception_diagnosis'] = reception_diagnosis(
        topic=topic,
        subscription=latest if latest else None,
        subscription_error=subscription_error,
        observed_at=observed_at,
        stale_timeout_sec=stale_timeout_sec,
    )


def _monitoring_role(
    topic: dict[str, Any],
    required_stream: bool,
    command: bool,
) -> str:
    if required_stream:
        return 'required_stream'
    if command:
        return 'command'
    if topic.get('registered_interface_type') is True:
        return 'registered_interface'
    if topic.get('supported_type') is True:
        return 'configured_type'
    return 'discovered'


def _hz_monitoring_status(
    topic: dict[str, Any],
    required_stream: bool,
) -> str:
    if required_stream and topic.get('graph_present') is False:
        return 'topic_not_discovered'
    if required_stream and topic.get('supported_type') is not True:
        return 'unsupported_type'
    if topic.get('deep_monitoring') is True:
        return 'active'
    if topic.get('supported_type') is True:
        return 'subscription_failed'
    return 'not_configured'
