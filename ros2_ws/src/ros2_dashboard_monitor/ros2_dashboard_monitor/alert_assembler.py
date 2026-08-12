"""ROS2 Runtime 상태에서 Alert를 생성하고 메모리 상태를 조정합니다."""

from __future__ import annotations

from typing import Any

from ros2_dashboard_monitor.ros2_action.alerts import build_action_alerts
from ros2_dashboard_monitor.ros2_node.alerts import build_node_alerts
from ros2_dashboard_monitor.ros2_service.alerts import build_service_alerts
from ros2_dashboard_monitor.ros2_topic.alerts import (
    build_alert_meta,
    build_alerts,
    retain_alerts,
)
from ros2_dashboard_monitor.qos_alerts import (
    build_qos_alert_candidates,
    confirm_qos_alerts,
)


RETAINED_ALERT_CODES = {
    'topic_message_missing',
    'topic_stale',
    'topic_disconnected',
    'service_disconnected',
    'service_call_failed',
    'service_call_timeout',
    'action_disconnected',
    'action_goal_aborted',
    'action_goal_canceled',
    'action_goal_rejected',
    'action_goal_send_failed',
    'action_result_timeout',
    'action_result_unavailable',
    'node_stale',
    'topic_qos_incompatible',
    'service_qos_incompatible',
    'action_qos_incompatible',
}


def collect_runtime_alerts(
    *,
    topics: list[dict[str, Any]],
    subscriptions: dict[str, dict[str, Any]],
    services: list[dict[str, Any]],
    actions: list[dict[str, Any]],
    nodes: list[dict[str, Any]],
    detected_at: float,
    stale_timeout_sec: float,
    required_stream_names: tuple[str, ...],
    command_names: tuple[str, ...],
    qos_topics: list[dict[str, Any]] | None = None,
    qos_confirmation_state: dict[str, dict[str, Any]] | None = None,
    qos_incompatible_confirmation_count: int = 3,
) -> list[dict[str, Any]]:
    """Topic·Service·Action·Node 상태 판정 결과를 하나의 Alert 목록으로 합칩니다."""
    alerts = build_alerts(
        topics=topics,
        subscriptions=subscriptions,
        detected_at=detected_at,
        stale_timeout_sec=stale_timeout_sec,
        required_stream_names=required_stream_names,
        command_names=command_names,
    )
    alerts.extend(build_service_alerts(services=services, detected_at=detected_at))
    alerts.extend(build_action_alerts(actions=actions, detected_at=detected_at))
    alerts.extend(build_node_alerts(nodes=nodes, detected_at=detected_at))
    qos_candidates = build_qos_alert_candidates(
        topics=qos_topics if qos_topics is not None else topics,
        services=services,
        actions=actions,
        detected_at=detected_at,
    )
    alerts.extend(confirm_qos_alerts(
        qos_candidates,
        confirmation_state=(
            qos_confirmation_state
            if qos_confirmation_state is not None
            else {}
        ),
        required_count=qos_incompatible_confirmation_count,
    ))
    return alerts


def reconcile_alert_state(
    *,
    current_alerts: list[dict[str, Any]],
    dismissed_alert_ids: set[str],
    alert_history: list[dict[str, Any]],
    retained_alerts: dict[str, dict[str, Any]],
    detected_at: float,
    history_limit: int = 50,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], set[str]]:
    """Dismiss/retain/resolve 정책을 적용하고 공개 history와 visible ID를 반환합니다."""
    current_ids = {
        alert['id'] for alert in current_alerts if alert.get('id')
    }
    dismissed_alert_ids.intersection_update(current_ids)
    visible_alerts = [
        alert for alert in current_alerts
        if alert.get('id') not in dismissed_alert_ids
    ]
    visible_alerts = retain_alerts(
        alert_history=alert_history,
        current_alerts=visible_alerts,
        history_limit=history_limit,
        retained_alerts=retained_alerts,
        retained_codes=RETAINED_ALERT_CODES,
        detected_at=detected_at,
    )
    history_snapshot = [alert.copy() for alert in alert_history]
    visible_ids = {
        alert['id'] for alert in visible_alerts
        if alert.get('id') and alert.get('alert_state') != 'resolved'
    }
    return visible_alerts, history_snapshot, visible_ids


def alert_response(
    alerts: list[dict[str, Any]],
    history: list[dict[str, Any]],
) -> dict[str, Any]:
    """기존 REST/transport Alert 응답 계약을 조립합니다."""
    return {
        'success': True,
        'data': alerts,
        'history': history,
        'meta': build_alert_meta(alerts),
        'message': 'ROS2 alerts fetched successfully',
    }
