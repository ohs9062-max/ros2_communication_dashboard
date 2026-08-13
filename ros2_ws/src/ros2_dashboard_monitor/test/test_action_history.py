"""Interface Lab Action history 이벤트와 summary 회귀 테스트입니다."""

from ros2_dashboard_monitor.interface_lab.execution.action_history import (
    build_receive_history,
    summarize_action_history,
)


def _goal(*, sent_at: float, success: bool = True, status=None) -> dict:
    return {
        'action_name': '/work',
        'action_type': 'demo_interfaces/action/Work',
        'goal': {'count': 1},
        'accepted': True,
        'feedback': [{'progress': 0.5}],
        'result': {'done': success},
        'success': success,
        'status': status,
        'sent_at': sent_at,
        'sent_to_server': True,
        'elapsed_ms': 12.0,
        'execution_source': 'interface_lab',
        'requester_node': {'name': '/monitor'},
    }


def test_receive_history_expands_feedback_before_result() -> None:
    history = build_receive_history(
        [_goal(sent_at=10.0)],
        reset_at=None,
        reset_by_key={},
    )

    assert history['meta']['count'] == 2
    assert [item['direction'] for item in history['history']] == [
        'action_feedback', 'action_result',
    ]
    assert history['history'][0]['feedback'] == {'progress': 0.5}
    assert history['history'][1]['result'] == {'done': True}
    assert [item['received_at'] for item in history['history']] == [10.0, 10.0]


def test_action_summary_and_receive_history_use_actual_response_times() -> None:
    goal = _goal(sent_at=10.0)
    goal['feedback'] = [{'progress': 0.25}, {'progress': 0.75}]
    goal['feedback_timestamps'] = [11.0, 12.0]
    goal['result_received_at'] = 13.0

    summary = summarize_action_history([goal])[
        ('/work', 'demo_interfaces/action/Work')
    ]
    history = build_receive_history(
        [goal],
        reset_at=None,
        reset_by_key={},
    )

    assert summary['last_feedback_at'] == 12.0
    assert summary['last_result_at'] == 13.0
    assert [item['received_at'] for item in history['history']] == [11.0, 12.0, 13.0]


def test_receive_history_applies_global_and_exact_reset_boundaries() -> None:
    goals = [_goal(sent_at=10.0), _goal(sent_at=20.0)]

    globally_reset = build_receive_history(
        goals,
        reset_at=10.0,
        reset_by_key={},
    )
    exactly_reset = build_receive_history(
        goals,
        reset_at=None,
        reset_by_key={('/work', 'demo_interfaces/action/Work'): 20.0},
    )

    assert globally_reset['meta']['count'] == 2
    assert exactly_reset['meta']['count'] == 0


def test_summary_counts_outcomes_and_limits_recent_history() -> None:
    goals = [
        _goal(sent_at=float(index), success=index % 2 == 0,
              status='canceled' if index == 1 else None)
        for index in range(7)
    ]

    summary = summarize_action_history(goals)[
        ('/work', 'demo_interfaces/action/Work')
    ]

    assert summary['goal_count'] == 7
    assert summary['success_count'] == 4
    assert summary['failure_count'] == 3
    assert summary['canceled_count'] == 1
    assert len(summary['history']) == 5
