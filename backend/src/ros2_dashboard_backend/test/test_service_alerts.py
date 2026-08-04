from threading import Lock

from ros2_dashboard_backend.service.alerts import build_service_alerts
from ros2_dashboard_backend.topic.alerts import retain_alerts
from ros2_dashboard_backend.ros_monitor import RosMonitor


def test_latest_user_service_call_timeout_builds_warning_alert() -> None:
    alerts = build_service_alerts(
        services=[_service(last_call_status='timeout')],
        detected_at=12.0,
    )

    assert alerts == [{
        'id': 'service:/RobotControl:service_call_timeout',
        'level': 'warning',
        'source': 'service',
        'name': '/RobotControl',
        'code': 'service_call_timeout',
        'message': 'The latest user Service call timed out.',
        'status': 'timeout',
        'last_received_at': 10.0,
        'age_sec': 2.0,
        'detected_at': 12.0,
    }]


def test_service_call_timeout_resolves_after_successful_call() -> None:
    cache = {}
    active_alerts = build_service_alerts(
        services=[_service(last_call_status='timeout')],
        detected_at=12.0,
    )
    active = retain_alerts(
        current_alerts=active_alerts,
        retained_alerts=cache,
        retained_codes={'service_call_timeout'},
        detected_at=12.0,
    )
    successful_alerts = build_service_alerts(
        services=[_service(last_call_status='success')],
        detected_at=13.0,
    )
    resolved = retain_alerts(
        current_alerts=successful_alerts,
        retained_alerts=cache,
        retained_codes={'service_call_timeout'},
        detected_at=13.0,
    )

    assert active[0]['alert_state'] == 'active'
    assert resolved[0]['alert_state'] == 'resolved'
    assert resolved[0]['active'] is False
    assert resolved[0]['resolved_at'] == 13.0


def test_latest_user_service_response_failure_builds_error_alert() -> None:
    service = _service(last_call_status='response_failed')
    service['last_call_summary']['last_error'] = 'controller rejected command'

    alerts = build_service_alerts(
        services=[service],
        detected_at=12.0,
    )

    assert alerts == [{
        'id': 'service:/RobotControl:service_call_failed',
        'level': 'error',
        'source': 'service',
        'name': '/RobotControl',
        'code': 'service_call_failed',
        'message': 'controller rejected command',
        'status': 'failed',
        'last_received_at': 10.0,
        'age_sec': 2.0,
        'detected_at': 12.0,
    }]


def test_unsent_service_failure_does_not_build_failure_alert() -> None:
    service = _service(last_call_status='response_failed')
    service['last_call_summary']['sent_to_server'] = False

    assert build_service_alerts(
        services=[service],
        detected_at=12.0,
    ) == []


def test_reset_alert_history_clears_only_resolved_history() -> None:
    monitor = RosMonitor.__new__(RosMonitor)
    monitor._lock = Lock()
    monitor._alert_history = [{'id': 'resolved-alert'}]
    monitor._retained_alerts = {'active-alert': {'active': True}}

    assert monitor.reset_alert_history() == {'cleared': 1}
    assert monitor._alert_history == []
    assert monitor._retained_alerts == {'active-alert': {'active': True}}


def test_reset_current_alerts_dismisses_visible_active_alerts() -> None:
    monitor = RosMonitor.__new__(RosMonitor)
    monitor._lock = Lock()
    monitor._visible_alert_ids = {'active-alert'}
    monitor._dismissed_alert_ids = set()
    monitor._retained_alerts = {'active-alert': {'active': True}}
    monitor._alert_history = [{'id': 'resolved-alert'}]

    assert monitor.reset_current_alerts() == {'cleared': 1}
    assert monitor._visible_alert_ids == set()
    assert monitor._dismissed_alert_ids == {'active-alert'}
    assert monitor._retained_alerts == {}
    assert monitor._alert_history == [{'id': 'resolved-alert'}]


def test_unsent_validation_failure_does_not_build_timeout_alert() -> None:
    service = _service(last_call_status='timeout')
    service['last_call_summary']['sent_to_server'] = False

    assert build_service_alerts(
        services=[service],
        detected_at=12.0,
    ) == []


def _service(*, last_call_status: str) -> dict:
    return {
        'name': '/RobotControl',
        'category': 'user',
        'hidden_by_default': False,
        'status': 'active',
        'allowlisted': True,
        'last_call_summary': {
            'last_call_status': last_call_status,
            'last_called_at': 10.0,
            'sent_to_server': True,
        },
    }
