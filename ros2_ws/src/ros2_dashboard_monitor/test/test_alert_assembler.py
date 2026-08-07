"""Monitor Alert 조립과 메모리 상태 전이 회귀 테스트입니다."""

from ros2_dashboard_monitor.alert_assembler import (
    alert_response,
    collect_runtime_alerts,
    reconcile_alert_state,
)


def _service_timeout() -> dict:
    return {
        'name': '/RobotControl',
        'category': 'user',
        'hidden_by_default': False,
        'status': 'active',
        'allowlisted': True,
        'last_call_summary': {
            'last_call_status': 'timeout',
            'last_called_at': 10.0,
            'sent_to_server': True,
        },
    }


def test_collect_runtime_alerts_combines_resource_builders() -> None:
    alerts = collect_runtime_alerts(
        topics=[],
        subscriptions={},
        services=[_service_timeout()],
        actions=[],
        nodes=[],
        detected_at=12.0,
        stale_timeout_sec=3.0,
        required_stream_names=(),
        command_names=(),
    )

    assert [alert['code'] for alert in alerts] == ['service_call_timeout']


def test_reconcile_hides_dismissed_current_alert_and_clears_stale_dismissal() -> None:
    current = collect_runtime_alerts(
        topics=[],
        subscriptions={},
        services=[_service_timeout()],
        actions=[],
        nodes=[],
        detected_at=12.0,
        stale_timeout_sec=3.0,
        required_stream_names=(),
        command_names=(),
    )
    dismissed = {current[0]['id'], 'already-resolved'}
    history = []
    retained = {}

    alerts, history_snapshot, visible_ids = reconcile_alert_state(
        current_alerts=current,
        dismissed_alert_ids=dismissed,
        alert_history=history,
        retained_alerts=retained,
        detected_at=12.0,
    )

    assert alerts == []
    assert history_snapshot == []
    assert visible_ids == set()
    assert dismissed == {current[0]['id']}


def test_alert_response_keeps_public_keys() -> None:
    response = alert_response([], [{'id': 'resolved'}])

    assert response['success'] is True
    assert response['data'] == []
    assert response['history'] == [{'id': 'resolved'}]
    assert response['meta']['count'] == 0
    assert response['message'] == 'ROS2 alerts fetched successfully'
