"""프로젝트 MonitorStatus 메시지를 Dashboard Alert로 변환합니다."""

from __future__ import annotations

from typing import Any

from ros2_dashboard_monitor.ros2_topic.models import (
    ALERT_LEVEL_CRITICAL,
    ALERT_LEVEL_ERROR,
    ALERT_LEVEL_WARNING,
    MONITOR_STATUS_TYPE,
    copy_values,
    text_or_empty,
    topic_primary_type,
)


def monitor_status_alert(
    *,
    topic: dict[str, Any],
    subscriptions: dict[str, dict[str, Any]],
    detected_at: float,
) -> dict[str, Any] | None:
    """MonitorStatus의 warning/error/critical payload만 Alert로 변환합니다."""
    if topic_primary_type(topic) != MONITOR_STATUS_TYPE:
        return None

    name = topic['name']
    subscription = subscriptions.get(name)
    if subscription is None:
        return None

    preview = subscription.get('message_preview')
    if not isinstance(preview, dict):
        return None

    level = normalized_level(preview.get('level'))
    if level not in (
        ALERT_LEVEL_WARNING,
        ALERT_LEVEL_ERROR,
        ALERT_LEVEL_CRITICAL,
    ):
        return None

    last_received_at = subscription.get('last_received_at')
    age_sec = None
    if last_received_at is not None:
        age_sec = detected_at - last_received_at

    device_name = text_or_empty(preview.get('device_name', ''))
    status = text_or_empty(preview.get('status', ''))
    message = text_or_empty(preview.get('message', ''))
    if not message:
        message = f'MonitorStatus reported {level}.'

    return {
        'id': monitor_status_alert_id(
            name=name,
            device_name=device_name,
            level=level,
            status=status,
        ),
        'level': level,
        'source': 'monitor_status',
        'name': name,
        'code': f'monitor_status_{level}',
        'message': message,
        'status': status,
        'device_name': device_name,
        'node_name': text_or_empty(preview.get('node_name', '')),
        'values': copy_values(preview.get('values')),
        'last_received_at': last_received_at,
        'age_sec': age_sec,
        'detected_at': detected_at,
    }


def normalized_level(value: Any) -> str:
    if value is None:
        return ''
    return str(value).strip().lower()


def monitor_status_alert_id(
    *,
    name: str,
    device_name: str,
    level: str,
    status: str,
) -> str:
    parts = ['monitor_status', name, device_name, level]
    if status:
        parts.append(status)
    return ':'.join(parts)
