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
