"""Service 모니터링의 alerts 관련 기능을 담당하는 모듈입니다."""

from __future__ import annotations

from typing import Any

from ros2_dashboard_backend.service.models import SERVICE_CATEGORY_USER


def build_service_alerts(
    *,
    services: list[dict[str, Any]],
    detected_at: float,
) -> list[dict[str, Any]]:
    """주요 Service의 연결 종료와 최근 Call 실패를 Alert로 변환합니다."""
    alerts = []
    for service in services:
        if service.get('category') != SERVICE_CATEGORY_USER:
            continue

        if service.get('hidden_by_default') is True:
            continue

        call_summary = service.get('last_call_summary')
        if (
            isinstance(call_summary, dict)
            and call_summary.get('sent_to_server') is True
            and call_summary.get('last_call_status') == 'timeout'
        ):
            last_called_at = call_summary.get('last_called_at')
            age_sec = None
            if isinstance(last_called_at, (int, float)):
                age_sec = max(0.0, detected_at - last_called_at)
            alerts.append({
                'id': f'service:{service["name"]}:service_call_timeout',
                'level': 'warning',
                'source': 'service',
                'name': service['name'],
                'code': 'service_call_timeout',
                'message': 'The latest user Service call timed out.',
                'status': 'timeout',
                'last_received_at': last_called_at,
                'age_sec': age_sec,
                'detected_at': detected_at,
            })

        if (
            isinstance(call_summary, dict)
            and call_summary.get('sent_to_server') is True
            and call_summary.get('last_call_status') in {
                'failed',
                'response_failed',
                'service_call_error',
            }
        ):
            last_called_at = call_summary.get('last_called_at')
            age_sec = None
            if isinstance(last_called_at, (int, float)):
                age_sec = max(0.0, detected_at - last_called_at)
            alerts.append({
                'id': f'service:{service["name"]}:service_call_failed',
                'level': 'error',
                'source': 'service',
                'name': service['name'],
                'code': 'service_call_failed',
                'message': (
                    call_summary.get('last_error')
                    or 'The latest user Service call failed.'
                ),
                'status': 'failed',
                'last_received_at': last_called_at,
                'age_sec': age_sec,
                'detected_at': detected_at,
            })

        if (
            service.get('status') == 'disconnected'
            and service.get('allowlisted') is True
        ):
            alerts.append({
                'id': f'service:{service["name"]}:service_disconnected',
                'level': 'error',
                'source': 'service',
                'name': service['name'],
                'code': 'service_disconnected',
                'message': (
                    'Service connection lost; it is no longer visible '
                    'in the ROS2 graph.'
                ),
                'status': 'disconnected',
                'last_received_at': service.get('last_seen_at'),
                'age_sec': None,
                'detected_at': detected_at,
            })
            continue

    return alerts
