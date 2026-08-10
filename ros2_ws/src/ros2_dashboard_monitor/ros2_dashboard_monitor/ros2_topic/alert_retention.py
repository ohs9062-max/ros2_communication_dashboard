"""상태 기반 Alert의 active/resolved retention과 meta를 관리합니다."""

from __future__ import annotations

from typing import Any

from ros2_dashboard_monitor.ros2_topic.models import (
    ALERT_LEVEL_CRITICAL,
    ALERT_LEVEL_ERROR,
    ALERT_LEVEL_WARNING,
)


ALERT_RESOLVED_RETENTION_SEC = 60.0


def retain_alerts(
    *,
    alert_history: list[dict[str, Any]] | None = None,
    current_alerts: list[dict[str, Any]],
    history_limit: int = 50,
    retained_alerts: dict[str, dict[str, Any]],
    retained_codes: set[str],
    detected_at: float,
    resolved_retention_sec: float = ALERT_RESOLVED_RETENTION_SEC,
) -> list[dict[str, Any]]:
    current_by_id = {
        alert['id']: alert for alert in current_alerts
        if alert.get('code') in retained_codes
    }
    passthrough = [
        alert for alert in current_alerts
        if alert.get('code') not in retained_codes
    ]
    visible = []

    for alert_id, alert in current_by_id.items():
        cached = retained_alerts.get(alert_id, {})
        active_alert = {
            **alert,
            'active': True,
            'alert_state': 'active',
            'first_detected_at': cached.get('first_detected_at', detected_at),
            'last_detected_at': detected_at,
            'resolved_at': None,
        }
        retained_alerts[alert_id] = active_alert
        visible.append(active_alert.copy())

    for alert_id, cached in list(retained_alerts.items()):
        if alert_id in current_by_id:
            continue
        was_resolved = cached.get('alert_state') == 'resolved'
        resolved_at = cached.get('resolved_at') or detected_at
        if detected_at - float(resolved_at) >= resolved_retention_sec:
            retained_alerts.pop(alert_id, None)
            continue
        resolved_alert = {
            **cached,
            'active': False,
            'alert_state': 'resolved',
            'resolved_at': resolved_at,
        }
        retained_alerts[alert_id] = resolved_alert
        visible.append(resolved_alert.copy())
        if alert_history is not None and not was_resolved:
            alert_history.insert(0, {
                **resolved_alert,
                'origin_id': alert_id,
                'id': f'{alert_id}:resolved:{resolved_at}',
            })
            del alert_history[history_limit:]

    return passthrough + visible


def build_alert_meta(alerts: list[dict[str, Any]]) -> dict[str, int]:
    active_alerts = [alert for alert in alerts if alert.get('alert_state') != 'resolved']
    return {
        'count': len(alerts),
        'active_count': len(active_alerts),
        'resolved_count': len(alerts) - len(active_alerts),
        'info_count': sum(1 for alert in active_alerts if alert['level'] == 'info'),
        'warning_count': sum(1 for alert in active_alerts if alert['level'] == ALERT_LEVEL_WARNING),
        'error_count': sum(1 for alert in active_alerts if alert['level'] == ALERT_LEVEL_ERROR),
        'critical_count': sum(1 for alert in active_alerts if alert['level'] == ALERT_LEVEL_CRITICAL),
    }
