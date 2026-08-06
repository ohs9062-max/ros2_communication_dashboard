import pytest

from ros2_dashboard_monitor.ros2_action.alerts import build_action_alerts
from ros2_dashboard_monitor.interface_lab.execution.action_goal_runtime import (
    _goal_summary,
)
from ros2_dashboard_monitor.ros2_topic.alerts import retain_alerts


@pytest.mark.parametrize(
    ('status_code', 'expected'),
    [
        (1, 'accepted'),
        (2, 'executing'),
        (3, 'canceling'),
        (4, 'succeeded'),
        (5, 'canceled'),
        (6, 'aborted'),
    ],
)
def test_user_goal_summary_maps_ros_status_codes(
    status_code: int,
    expected: str,
) -> None:
    summary = _goal_summary({
        'success': status_code == 4,
        'status': status_code,
        'action_name': '/RobotControl',
        'action_type': 'demo_interfaces/action/RobotControl',
        'sent_to_server': True,
    })

    assert summary['last_goal_status'] == expected


@pytest.mark.parametrize(
    ('status', 'code', 'level'),
    [
        ('aborted', 'action_goal_aborted', 'error'),
        ('canceled', 'action_goal_canceled', 'warning'),
        ('goal_rejected', 'action_goal_rejected', 'warning'),
        ('goal_send_failed', 'action_goal_send_failed', 'error'),
        ('goal_accept_timeout', 'action_goal_send_failed', 'error'),
        ('result_timeout', 'action_result_timeout', 'warning'),
        ('result_receive_failed', 'action_result_unavailable', 'error'),
    ],
)
def test_user_goal_failures_build_action_alerts(
    status: str,
    code: str,
    level: str,
) -> None:
    alerts = build_action_alerts(
        actions=[_action(status)],
        detected_at=12.0,
    )

    assert len(alerts) == 1
    assert alerts[0]['code'] == code
    assert alerts[0]['level'] == level
    assert alerts[0]['status'] == status


def test_action_failure_alert_resolves_after_success() -> None:
    cache = {}
    active = retain_alerts(
        current_alerts=build_action_alerts(
            actions=[_action('aborted')],
            detected_at=12.0,
        ),
        retained_alerts=cache,
        retained_codes={'action_goal_aborted'},
        detected_at=12.0,
    )
    resolved = retain_alerts(
        current_alerts=build_action_alerts(
            actions=[_action('succeeded')],
            detected_at=13.0,
        ),
        retained_alerts=cache,
        retained_codes={'action_goal_aborted'},
        detected_at=13.0,
    )

    assert active[0]['alert_state'] == 'active'
    assert resolved[0]['alert_state'] == 'resolved'
    assert resolved[0]['resolved_at'] == 13.0


def _action(last_goal_status: str) -> dict:
    return {
        'name': '/RobotControl',
        'type': 'demo_interfaces/action/RobotControl',
        'status': 'active',
        'allowlisted': True,
        'runtime': {
            'last_goal_status': 'unknown',
            'result_error': None,
        },
        'last_goal_summary': {
            'last_goal_status': last_goal_status,
            'last_goal_sent_at': 10.0,
        },
    }
