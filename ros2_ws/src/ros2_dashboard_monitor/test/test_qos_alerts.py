from ros2_dashboard_monitor.alert_assembler import reconcile_alert_state
from ros2_dashboard_monitor.qos_alerts import (
    build_qos_alert_candidates,
    confirm_qos_alerts,
)


def test_partial_unknown_and_observed_never_build_qos_alerts() -> None:
    topics = [
        _topic('/partial', 'partial', 1.0),
        _topic('/unknown', 'unknown', 1.0),
        _topic('/observed', 'observed', 1.0),
    ]
    assert build_qos_alert_candidates(
        topics=topics, services=[], actions=[], detected_at=2.0,
    ) == []


def test_graph_incompatible_requires_distinct_observations_and_is_warning() -> None:
    confirmation = {}
    confirmed = []
    for updated_at in (1.0, 1.0, 2.0, 3.0):
        candidates = build_qos_alert_candidates(
            topics=[_topic('/scan', 'compatible', updated_at, graph='incompatible')],
            services=[], actions=[], detected_at=updated_at,
        )
        confirmed = confirm_qos_alerts(
            candidates,
            confirmation_state=confirmation,
            required_count=3,
        )
    assert len(confirmed) == 1
    assert confirmed[0]['code'] == 'topic_qos_incompatible'
    assert confirmed[0]['level'] == 'warning'
    assert 'incompatible endpoint pairs: 1/2' in confirmed[0]['message']


def test_rmw_event_and_all_remote_incompatible_are_error() -> None:
    rmw = _topic('/rmw', 'incompatible', 1.0)
    rmw['qos_detection_source'] = 'incompatible_qos_event'
    all_remote = _topic('/all', 'incompatible', 1.0)
    all_remote.update({
        'compatible_endpoint_count': 0,
        'remote_endpoint_count': 2,
    })
    alerts = build_qos_alert_candidates(
        topics=[rmw, all_remote], services=[], actions=[], detected_at=2.0,
    )
    assert [alert['level'] for alert in alerts] == ['error', 'error']


def test_action_qos_alerts_are_distinct_per_channel() -> None:
    action = {
        'name': '/navigate_to_pose',
        'primary': True,
        'graph_present': True,
        'last_updated': 10.0,
        'qos': {
            'goal': {'qos_status': 'incompatible'},
            'result': {'qos_status': 'compatible'},
            'cancel': {'qos_status': 'unknown'},
            'feedback': {'qos_status': 'incompatible'},
            'status': {'qos_status': 'partial'},
        },
    }
    alerts = build_qos_alert_candidates(
        topics=[], services=[], actions=[action], detected_at=11.0,
    )
    assert [alert['id'] for alert in alerts] == [
        'action:/navigate_to_pose:action_qos_incompatible:goal',
        'action:/navigate_to_pose:action_qos_incompatible:feedback',
    ]
    assert alerts[1]['channel'] == 'feedback'
    assert 'Feedback Topic' in alerts[1]['message']


def test_confirmed_qos_alert_resolves_and_recurrence_starts_fresh() -> None:
    confirmation = {}
    retained = {}
    history = []
    confirmed = []
    for token in (1.0, 2.0, 3.0):
        confirmed = confirm_qos_alerts(
            build_qos_alert_candidates(
                topics=[_topic('/scan', 'incompatible', token)],
                services=[], actions=[], detected_at=token,
            ),
            confirmation_state=confirmation,
            required_count=3,
        )
    active, _, _ = reconcile_alert_state(
        current_alerts=confirmed,
        dismissed_alert_ids=set(),
        alert_history=history,
        retained_alerts=retained,
        detected_at=3.0,
    )
    assert active[0]['alert_state'] == 'active'

    assert confirm_qos_alerts(
        [], confirmation_state=confirmation, required_count=3,
    ) == []
    resolved, _, _ = reconcile_alert_state(
        current_alerts=[],
        dismissed_alert_ids=set(),
        alert_history=history,
        retained_alerts=retained,
        detected_at=4.0,
    )
    assert resolved[0]['alert_state'] == 'resolved'

    recurrence = confirm_qos_alerts(
        build_qos_alert_candidates(
            topics=[_topic('/scan', 'incompatible', 5.0)],
            services=[], actions=[], detected_at=5.0,
        ),
        confirmation_state=confirmation,
        required_count=3,
    )
    assert recurrence == []


def test_non_primary_resources_do_not_build_qos_alerts() -> None:
    topic = _topic('/internal', 'incompatible', 1.0)
    topic['primary'] = False
    assert build_qos_alert_candidates(
        topics=[topic], services=[], actions=[], detected_at=2.0,
    ) == []


def test_service_qos_alert_recovery_lifecycle() -> None:
    confirmation = {}
    retained = {}
    history = []
    confirmed = []

    # 1. Incompatible detected for 3 ticks -> Active alert confirmed
    for token in (1.0, 2.0, 3.0):
        confirmed = confirm_qos_alerts(
            build_qos_alert_candidates(
                topics=[],
                services=[_service('/RobotControl', 'incompatible', token)],
                actions=[],
                detected_at=token,
            ),
            confirmation_state=confirmation,
            required_count=3,
        )
    assert len(confirmed) == 1
    assert confirmed[0]['id'] == 'service:/RobotControl:service_qos_incompatible'

    active, _, _ = reconcile_alert_state(
        current_alerts=confirmed,
        dismissed_alert_ids=set(),
        alert_history=history,
        retained_alerts=retained,
        detected_at=3.0,
    )
    assert len(active) == 1
    assert active[0]['alert_state'] == 'active'

    # 2. QoS recovers to compatible -> Candidate list empty -> Alert resolves
    candidates = build_qos_alert_candidates(
        topics=[],
        services=[_service('/RobotControl', 'compatible', 4.0)],
        actions=[],
        detected_at=4.0,
    )
    assert candidates == []

    confirmed = confirm_qos_alerts(
        candidates, confirmation_state=confirmation, required_count=3,
    )
    assert confirmed == []

    resolved, _, _ = reconcile_alert_state(
        current_alerts=[],
        dismissed_alert_ids=set(),
        alert_history=history,
        retained_alerts=retained,
        detected_at=4.0,
    )
    assert len(resolved) == 1
    assert resolved[0]['id'] == 'service:/RobotControl:service_qos_incompatible'
    assert resolved[0]['alert_state'] == 'resolved'
    assert resolved[0]['resolved_at'] == 4.0


def test_action_5_channel_qos_alert_independent_recovery_lifecycle() -> None:
    for channel in ('goal', 'result', 'cancel', 'feedback', 'status'):
        confirmation = {}
        retained = {}
        history = []
        confirmed = []

        # 1. Incompatible on this specific channel for 3 ticks -> Alert confirmed
        for token in (1.0, 2.0, 3.0):
            qos_map = {c: {'qos_status': 'compatible'} for c in ('goal', 'result', 'cancel', 'feedback', 'status')}
            qos_map[channel] = {'qos_status': 'incompatible'}
            confirmed = confirm_qos_alerts(
                build_qos_alert_candidates(
                    topics=[],
                    services=[],
                    actions=[_action('/navigate_to_pose', qos_map, token)],
                    detected_at=token,
                ),
                confirmation_state=confirmation,
                required_count=3,
            )
        assert len(confirmed) == 1
        assert confirmed[0]['id'] == f'action:/navigate_to_pose:action_qos_incompatible:{channel}'
        assert confirmed[0]['channel'] == channel

        active, _, _ = reconcile_alert_state(
            current_alerts=confirmed,
            dismissed_alert_ids=set(),
            alert_history=history,
            retained_alerts=retained,
            detected_at=3.0,
        )
        assert len(active) == 1
        assert active[0]['alert_state'] == 'active'

        # 2. Channel recovers to compatible -> Alert resolves
        qos_map[channel] = {'qos_status': 'compatible'}
        candidates = build_qos_alert_candidates(
            topics=[],
            services=[],
            actions=[_action('/navigate_to_pose', qos_map, 4.0)],
            detected_at=4.0,
        )
        assert candidates == []

        confirmed = confirm_qos_alerts(
            candidates, confirmation_state=confirmation, required_count=3,
        )
        assert confirmed == []

        resolved, _, _ = reconcile_alert_state(
            current_alerts=[],
            dismissed_alert_ids=set(),
            alert_history=history,
            retained_alerts=retained,
            detected_at=4.0,
        )
        assert len(resolved) == 1
        assert resolved[0]['id'] == f'action:/navigate_to_pose:action_qos_incompatible:{channel}'
        assert resolved[0]['alert_state'] == 'resolved'


def test_action_multi_channel_partial_recovery_lifecycle() -> None:
    confirmation = {}
    retained = {}
    history = []
    confirmed = []

    # Both goal and feedback are incompatible
    for token in (1.0, 2.0, 3.0):
        qos_map = {
            'goal': {'qos_status': 'incompatible'},
            'result': {'qos_status': 'compatible'},
            'cancel': {'qos_status': 'compatible'},
            'feedback': {'qos_status': 'incompatible'},
            'status': {'qos_status': 'compatible'},
        }
        confirmed = confirm_qos_alerts(
            build_qos_alert_candidates(
                topics=[],
                services=[],
                actions=[_action('/navigate_to_pose', qos_map, token)],
                detected_at=token,
            ),
            confirmation_state=confirmation,
            required_count=3,
        )
    assert len(confirmed) == 2
    assert {c['id'] for c in confirmed} == {
        'action:/navigate_to_pose:action_qos_incompatible:goal',
        'action:/navigate_to_pose:action_qos_incompatible:feedback',
    }
    active, _, _ = reconcile_alert_state(
        current_alerts=confirmed,
        dismissed_alert_ids=set(),
        alert_history=history,
        retained_alerts=retained,
        detected_at=3.0,
    )
    assert len(active) == 2

    # Feedback recovers, goal remains incompatible
    qos_map['feedback'] = {'qos_status': 'compatible'}
    candidates = build_qos_alert_candidates(
        topics=[],
        services=[],
        actions=[_action('/navigate_to_pose', qos_map, 4.0)],
        detected_at=4.0,
    )
    assert len(candidates) == 1
    assert candidates[0]['id'] == 'action:/navigate_to_pose:action_qos_incompatible:goal'

    confirmed = confirm_qos_alerts(
        candidates, confirmation_state=confirmation, required_count=3,
    )
    assert len(confirmed) == 1
    assert confirmed[0]['id'] == 'action:/navigate_to_pose:action_qos_incompatible:goal'

    current_alerts, _, _ = reconcile_alert_state(
        current_alerts=confirmed,
        dismissed_alert_ids=set(),
        alert_history=history,
        retained_alerts=retained,
        detected_at=4.0,
    )
    # Goal is active, feedback is resolved
    active_ids = {a['id'] for a in current_alerts if a['alert_state'] == 'active'}
    resolved_ids = {a['id'] for a in current_alerts if a['alert_state'] == 'resolved'}
    assert active_ids == {'action:/navigate_to_pose:action_qos_incompatible:goal'}
    assert resolved_ids == {'action:/navigate_to_pose:action_qos_incompatible:feedback'}

    # Goal also recovers -> All resolved
    qos_map['goal'] = {'qos_status': 'compatible'}
    candidates = build_qos_alert_candidates(
        topics=[],
        services=[],
        actions=[_action('/navigate_to_pose', qos_map, 5.0)],
        detected_at=5.0,
    )
    assert candidates == []

    confirmed = confirm_qos_alerts(
        candidates, confirmation_state=confirmation, required_count=3,
    )
    assert confirmed == []

    current_alerts, _, _ = reconcile_alert_state(
        current_alerts=[],
        dismissed_alert_ids=set(),
        alert_history=history,
        retained_alerts=retained,
        detected_at=5.0,
    )
    assert len(current_alerts) == 2
    assert {a['id'] for a in current_alerts} == {
        'action:/navigate_to_pose:action_qos_incompatible:goal',
        'action:/navigate_to_pose:action_qos_incompatible:feedback',
    }
    assert all(a['alert_state'] == 'resolved' for a in current_alerts)


def _topic(
    name: str,
    status: str,
    updated_at: float,
    *,
    graph: str | None = None,
) -> dict:
    return {
        'name': name,
        'primary': True,
        'graph_present': True,
        'monitoring_role': 'required_stream',
        'last_updated': updated_at,
        'qos_status': status,
        'qos_detection_source': 'graph_profile_comparison',
        'graph_qos_status': graph,
        'graph_qos_detection_source': 'graph_endpoint_info',
        'endpoint_pair_count': 2,
        'incompatible_endpoint_pair_count': 1,
        'mismatch_policies': ['reliability'],
    }


def _service(
    name: str,
    status: str,
    updated_at: float,
) -> dict:
    return {
        'name': name,
        'primary': True,
        'graph_present': True,
        'updated_at': updated_at,
        'qos_status': status,
        'qos_detection_source': 'fastdds_discovery',
        'mismatch_policies': ['reliability'],
    }


def _action(
    name: str,
    qos: dict,
    updated_at: float,
) -> dict:
    return {
        'name': name,
        'primary': True,
        'graph_present': True,
        'updated_at': updated_at,
        'qos': qos,
    }
