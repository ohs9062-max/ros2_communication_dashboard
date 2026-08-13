"""Topic 모니터링의 alerts 관련 기능을 담당하는 모듈입니다."""

from __future__ import annotations

from typing import Any

from ros2_dashboard_monitor.ros2_topic.models import (
    ALERT_CODE_TOPIC_MESSAGE_MISSING,
    ALERT_CODE_TOPIC_STALE,
    ALERT_CODE_WAITING_PUBLISHER,
    ALERT_LEVEL_ERROR,
    ALERT_LEVEL_WARNING,
    HZ_STATUS_NEVER_RECEIVED,
    HZ_STATUS_STALE,
    TOPIC_STATUS_WAITING_PUBLISHER,
)
from ros2_dashboard_monitor.ros2_topic.monitor_status_alerts import (
    monitor_status_alert as _monitor_status_alert,
)
from ros2_dashboard_monitor.ros2_topic.diagnostics import reception_diagnosis
from ros2_dashboard_monitor.ros2_topic.alert_retention import (
    ALERT_RESOLVED_RETENTION_SEC,
    build_alert_meta,
    retain_alerts,
)


def build_alerts(
    *,
    topics: list[dict[str, Any]],
    subscriptions: dict[str, dict[str, Any]],
    detected_at: float,
    stale_timeout_sec: float,
    required_stream_names: tuple[str, ...] = (),
    command_names: tuple[str, ...] = (),
) -> list[dict[str, Any]]:
    """Topic 수신 상태와 MonitorStatus 메시지에서 현재 Alert 후보를 만듭니다."""
    alerts_by_id = {}
    for topic in topics:
        for alert_item in _topic_alerts(
            topic=topic,
            subscriptions=subscriptions,
            detected_at=detected_at,
            stale_timeout_sec=stale_timeout_sec,
            required_stream_names=required_stream_names,
            command_names=command_names,
        ):
            alerts_by_id[alert_item['id']] = alert_item

        monitor_status_alert = _monitor_status_alert(
            topic=topic,
            subscriptions=subscriptions,
            detected_at=detected_at,
        )
        if monitor_status_alert is not None:
            alerts_by_id[monitor_status_alert['id']] = monitor_status_alert

    return list(alerts_by_id.values())


def _topic_alerts(
    *,
    topic: dict[str, Any],
    subscriptions: dict[str, dict[str, Any]],
    detected_at: float,
    stale_timeout_sec: float,
    required_stream_names: tuple[str, ...],
    command_names: tuple[str, ...],
) -> list[dict[str, Any]]:
    name = topic['name']
    publisher_count = topic['publisher_count']
    subscription = subscriptions.get(name)

    if name in command_names:
        return []

    if (
        name not in required_stream_names
        and topic.get('registered_interface_type') is not True
    ):
        return []

    if topic.get('status') == 'disconnected':
        return [
            _alert(
                level=ALERT_LEVEL_ERROR,
                source='topic',
                name=name,
                code='topic_disconnected',
                status='disconnected',
                message=(
                    'Topic connection lost; it is no longer visible '
                    'in the ROS2 graph.'
                ),
                last_received_at=topic.get('last_seen_at'),
                age_sec=None,
                detected_at=detected_at,
            ),
        ]

    if publisher_count > 0 and subscription is not None:
        alerts = _topic_message_alerts(
            name=name,
            first_observed_at=subscription.get('created_at'),
            last_received_at=subscription.get('last_received_at'),
            detected_at=detected_at,
            stale_timeout_sec=stale_timeout_sec,
        )
        diagnosis = reception_diagnosis(
            topic=topic,
            subscription=subscription,
            subscription_error=subscription.get('subscription_error'),
            observed_at=detected_at,
            stale_timeout_sec=stale_timeout_sec,
        )
        for alert in alerts:
            alert['diagnosis'] = diagnosis
            alert['related_alert_ids'] = (
                diagnosis.get('related_alert_ids', []) if diagnosis else []
            )
        return alerts

    if publisher_count == 0:
        return [
            _alert(
                level=ALERT_LEVEL_WARNING,
                source='topic',
                name=name,
                code=ALERT_CODE_WAITING_PUBLISHER,
                status=TOPIC_STATUS_WAITING_PUBLISHER,
                message='Subscriber exists but no publisher is available.',
                last_received_at=None,
                age_sec=None,
                detected_at=detected_at,
            ),
        ]

    return []


def _topic_message_alerts(
    *,
    name: str,
    first_observed_at: float | None,
    last_received_at: float | None,
    detected_at: float,
    stale_timeout_sec: float,
) -> list[dict[str, Any]]:
    if last_received_at is None:
        if (
            first_observed_at is None or
            detected_at - first_observed_at <= stale_timeout_sec
        ):
            return []

        return [
            _alert(
                level=ALERT_LEVEL_WARNING,
                source='topic',
                name=name,
                code=ALERT_CODE_TOPIC_MESSAGE_MISSING,
                status=HZ_STATUS_NEVER_RECEIVED,
                message=(
                    'Topic publisher exists but no message has been '
                    'received.'
                ),
                last_received_at=None,
                age_sec=None,
                detected_at=detected_at,
            ),
        ]

    age_sec = detected_at - last_received_at
    if age_sec > stale_timeout_sec:
        return [
            _alert(
                level=ALERT_LEVEL_WARNING,
                source='topic',
                name=name,
                code=ALERT_CODE_TOPIC_STALE,
                status=HZ_STATUS_STALE,
                message=(
                    'Topic message has not been received within stale '
                    'timeout.'
                ),
                last_received_at=last_received_at,
                age_sec=age_sec,
                detected_at=detected_at,
            ),
        ]

    return []


def _alert(
    *,
    level: str,
    source: str,
    name: str,
    code: str,
    status: str,
    message: str,
    last_received_at: float | None,
    age_sec: float | None,
    detected_at: float,
) -> dict[str, Any]:
    return {
        'id': f'{source}:{name}:{code}',
        'level': level,
        'source': source,
        'name': name,
        'code': code,
        'message': message,
        'status': status,
        'last_received_at': last_received_at,
        'age_sec': age_sec,
        'detected_at': detected_at,
    }
