"""Action 모니터링의 alerts 관련 기능을 담당하는 모듈입니다."""

from __future__ import annotations

from typing import Any

from ros2_dashboard_backend.action.models import (
    ALERT_CODE_ACTION_GOAL_ABORTED,
    ALERT_CODE_ACTION_GOAL_CANCELED,
    ALERT_CODE_ACTION_GOAL_REJECTED,
    ALERT_CODE_ACTION_GOAL_SEND_FAILED,
    ALERT_CODE_ACTION_RESULT_TIMEOUT,
    ALERT_CODE_ACTION_RESULT_UNAVAILABLE,
    ALERT_LEVEL_ERROR,
    ALERT_LEVEL_WARNING,
    GOAL_STATUS_ABORTED,
    GOAL_STATUS_CANCELED,
)


def build_action_alerts(
    *,
    actions: list[dict[str, Any]],
    detected_at: float,
) -> list[dict[str, Any]]:
    """Action 모니터링에서 Action 실행 또는 상태를 처리하는 함수입니다."""
    alerts = []
    for action in actions:
        if (
            action.get('status') == 'disconnected'
            and action.get('allowlisted') is True
        ):
            alerts.append(
                _build_alert(
                    action=action,
                    detected_at=detected_at,
                    level=ALERT_LEVEL_ERROR,
                    code='action_disconnected',
                    message=(
                        'Action connection lost; it is no longer visible '
                        'in the ROS2 graph.'
                    ),
                    last_received_at=action.get('last_seen_at'),
                ),
            )
            continue

        runtime = action.get('runtime', {})
        summary = action.get('last_goal_summary')
        summary = summary if isinstance(summary, dict) else None
        last_goal_status = (
            summary.get('last_goal_status')
            if summary
            else runtime.get('last_goal_status')
        )
        last_goal_at = (
            summary.get('last_goal_sent_at')
            if summary
            else runtime.get('last_status_at')
        )
        if last_goal_status == GOAL_STATUS_ABORTED:
            alerts.append(
                _build_alert(
                    action=action,
                    detected_at=detected_at,
                    level=ALERT_LEVEL_ERROR,
                    code=ALERT_CODE_ACTION_GOAL_ABORTED,
                    message='Action goal aborted.',
                    last_received_at=last_goal_at,
                    status=GOAL_STATUS_ABORTED,
                ),
            )
        elif last_goal_status == GOAL_STATUS_CANCELED:
            alerts.append(
                _build_alert(
                    action=action,
                    detected_at=detected_at,
                    level=ALERT_LEVEL_WARNING,
                    code=ALERT_CODE_ACTION_GOAL_CANCELED,
                    message='Action goal canceled.',
                    last_received_at=last_goal_at,
                    status=GOAL_STATUS_CANCELED,
                ),
            )
        elif last_goal_status == 'goal_rejected':
            alerts.append(
                _build_alert(
                    action=action,
                    detected_at=detected_at,
                    level=ALERT_LEVEL_WARNING,
                    code=ALERT_CODE_ACTION_GOAL_REJECTED,
                    message='Action goal was rejected.',
                    last_received_at=last_goal_at,
                    status='goal_rejected',
                ),
            )
        elif last_goal_status in ('goal_send_failed', 'goal_accept_timeout'):
            alerts.append(
                _build_alert(
                    action=action,
                    detected_at=detected_at,
                    level=ALERT_LEVEL_ERROR,
                    code=ALERT_CODE_ACTION_GOAL_SEND_FAILED,
                    message=(
                        'Action goal acceptance timed out.'
                        if last_goal_status == 'goal_accept_timeout'
                        else 'Action goal transmission failed.'
                    ),
                    last_received_at=last_goal_at,
                    status=last_goal_status,
                ),
            )
        elif last_goal_status == 'result_timeout':
            alerts.append(
                _build_alert(
                    action=action,
                    detected_at=detected_at,
                    level=ALERT_LEVEL_WARNING,
                    code=ALERT_CODE_ACTION_RESULT_TIMEOUT,
                    message='Action result timed out.',
                    last_received_at=last_goal_at,
                    status='result_timeout',
                ),
            )
        elif last_goal_status == 'result_receive_failed':
            alerts.append(
                _build_alert(
                    action=action,
                    detected_at=detected_at,
                    level=ALERT_LEVEL_ERROR,
                    code=ALERT_CODE_ACTION_RESULT_UNAVAILABLE,
                    message='Action result reception failed.',
                    last_received_at=last_goal_at,
                    status='result_receive_failed',
                ),
            )

        if runtime.get('result_error') and not summary:
            alerts.append(
                _build_alert(
                    action=action,
                    detected_at=detected_at,
                    level=ALERT_LEVEL_ERROR,
                    code=ALERT_CODE_ACTION_RESULT_UNAVAILABLE,
                    message='Action result lookup failed.',
                    last_received_at=runtime.get('last_status_at'),
                    status='result_receive_failed',
                ),
            )

    return alerts


def _build_alert(
    *,
    action: dict[str, Any],
    detected_at: float,
    level: str,
    code: str,
    message: str,
    last_received_at: float | None,
    status: str | None = None,
) -> dict[str, Any]:
    name = action['name']
    return {
        'id': f'action:{name}:{code}',
        'level': level,
        'source': 'action',
        'name': name,
        'code': code,
        'message': message,
        'status': status or action.get('status'),
        'last_received_at': last_received_at,
        'age_sec': None,
        'detected_at': detected_at,
    }
