from threading import Lock, RLock, Thread
from types import SimpleNamespace

import pytest
from rclpy.duration import Duration
from rclpy.qos import (
    DurabilityPolicy,
    HistoryPolicy,
    LivelinessPolicy,
    QoSProfile,
    ReliabilityPolicy,
    qos_profile_services_default,
)

from ros2_dashboard_monitor.interface_lab.execution.action_client_pool import ActionClientPool
from ros2_dashboard_monitor.interface_lab.execution.qos_profiles import (
    resolve_service_execution_qos,
    resolve_split_service_execution_qos,
)
from ros2_dashboard_monitor.interface_lab.execution.service_client_pool import ServiceClientPool
from ros2_dashboard_monitor.interface_lab.execution.topic_publisher_pool import TopicPublisherPool
from ros2_dashboard_monitor.interface_lab.execution.topic_receive_runtime import TopicReceiveRuntime


def manual_profile(*, reliability='reliable', depth=10, **advanced):
    return {
        'mode': 'manual',
        'profile': {
            'reliability': reliability,
            'durability': 'volatile',
            'history': 'keep_last',
            'depth': depth,
            **advanced,
        },
    }


def discovered_service_qos(
    *, reliability='reliable', durability='volatile', deadline_ns=500_000_000,
    lifespan_ns=2_000_000_000, liveliness='automatic', lease_duration_ns=3_000_000_000,
):
    request_qos = {
        'reliability': reliability,
        'durability': durability,
        'history': 'unknown',
        'depth': None,
        'deadline_ns': deadline_ns,
        'deadline_status': 'observed',
        'lifespan_ns': None,
        'lifespan_status': 'unknown',
        'liveliness': liveliness,
        'liveliness_lease_duration_ns': lease_duration_ns,
        'liveliness_lease_duration_status': 'observed',
    }
    response_qos = {
        **request_qos,
        'lifespan_ns': lifespan_ns,
        'lifespan_status': 'observed',
    }
    return {
        'qos_detection_source': 'fastdds_discovery',
        'subscriber_qos': [{'service_channel': 'request', 'qos': request_qos}],
        'publisher_qos': [{'service_channel': 'response', 'qos': response_qos}],
    }


class TopicExecutionNode:
    def __init__(self):
        self.created = []
        self.destroyed = []

    def get_publishers_info_by_topic(self, _name):
        return []

    def get_subscriptions_info_by_topic(self, _name):
        return []

    def get_name(self):
        return 'dashboard_monitor'

    def get_namespace(self):
        return '/'

    def create_publisher(self, _cls, _name, profile, **_kwargs):
        publisher = SimpleNamespace(profile=profile, id=len(self.created))
        self.created.append(publisher)
        return publisher

    def destroy_publisher(self, publisher):
        self.destroyed.append(publisher)

    def create_subscription(self, _cls, _name, _callback, profile, **_kwargs):
        subscription = SimpleNamespace(profile=profile, id=len(self.created))
        self.created.append(subscription)
        return subscription

    def destroy_subscription(self, subscription):
        self.destroyed.append(subscription)


def test_service_auto_uses_remote_compatibility_and_local_history_defaults():
    profile, state = resolve_service_execution_qos(
        '/add', selection={'mode': 'auto'},
        remote_qos_getter=lambda _name: discovered_service_qos(reliability='best_effort'),
    )

    assert profile.reliability == ReliabilityPolicy.BEST_EFFORT
    assert profile.history == qos_profile_services_default.history
    assert profile.depth == qos_profile_services_default.depth
    assert profile.deadline.nanoseconds == 500_000_000
    assert profile.lifespan.nanoseconds == 2_000_000_000
    assert profile.liveliness == LivelinessPolicy.AUTOMATIC
    assert profile.liveliness_lease_duration.nanoseconds == 3_000_000_000
    assert state['qos_mode'] == 'auto'
    assert state['fallback_used'] is False
    assert state['remote_qos']['subscriber_qos'][0]['qos']['history'] == 'unknown'


def test_service_auto_uses_compatible_bounds_from_both_dds_directions():
    remote = discovered_service_qos(
        reliability='best_effort', deadline_ns=900_000_000,
        liveliness='automatic', lease_duration_ns=4_000_000_000,
    )
    remote['publisher_qos'][0]['qos'].update({
        'reliability': 'reliable',
        'deadline_ns': 300_000_000,
        'liveliness': 'manual_by_topic',
        'liveliness_lease_duration_ns': 1_000_000_000,
    })

    profile, state = resolve_service_execution_qos(
        '/add', selection={'mode': 'auto'}, remote_qos_getter=lambda _name: remote,
    )

    assert profile.reliability == ReliabilityPolicy.BEST_EFFORT
    assert profile.deadline.nanoseconds == 900_000_000
    assert profile.liveliness == LivelinessPolicy.AUTOMATIC
    assert profile.liveliness_lease_duration.nanoseconds == 4_000_000_000
    assert state['fallback_used'] is False


def test_service_auto_keeps_discovered_values_when_one_direction_is_missing():
    remote = discovered_service_qos(
        reliability='best_effort', deadline_ns=250_000_000,
        liveliness='manual_by_topic', lease_duration_ns=750_000_000,
    )
    remote['publisher_qos'] = []

    profile, state = resolve_service_execution_qos(
        '/add', selection={'mode': 'auto'}, remote_qos_getter=lambda _name: remote,
    )

    assert profile.reliability == ReliabilityPolicy.BEST_EFFORT
    assert profile.deadline.nanoseconds == 250_000_000
    assert profile.liveliness == LivelinessPolicy.MANUAL_BY_TOPIC
    assert profile.liveliness_lease_duration.nanoseconds == 750_000_000
    assert profile.history == qos_profile_services_default.history
    assert profile.lifespan == qos_profile_services_default.lifespan
    assert state['fallback_used'] is False


def test_service_auto_preserves_discovered_infinite_durations():
    remote = discovered_service_qos()
    for endpoint in (*remote['subscriber_qos'], *remote['publisher_qos']):
        qos = endpoint['qos']
        for field in ('deadline', 'liveliness_lease_duration'):
            qos[f'{field}_ns'] = None
            qos[f'{field}_status'] = 'infinite'
    remote['publisher_qos'][0]['qos'].update({
        'lifespan_ns': None,
        'lifespan_status': 'infinite',
    })

    profile, _state = resolve_service_execution_qos(
        '/add', selection={'mode': 'auto'}, remote_qos_getter=lambda _name: remote,
    )

    assert profile.deadline.nanoseconds == 2 ** 63 - 1
    assert profile.lifespan.nanoseconds == 2 ** 63 - 1
    assert profile.liveliness_lease_duration.nanoseconds == 2 ** 63 - 1


def test_service_auto_uses_local_default_for_unknown_discovered_policy():
    remote = discovered_service_qos()
    for endpoint in (*remote['subscriber_qos'], *remote['publisher_qos']):
        endpoint['qos']['liveliness'] = 'unknown'

    profile, state = resolve_service_execution_qos(
        '/add', selection={'mode': 'auto'}, remote_qos_getter=lambda _name: remote,
    )

    assert profile.liveliness == qos_profile_services_default.liveliness
    assert profile.deadline.nanoseconds == 500_000_000
    assert state['fallback_used'] is False


def test_service_auto_falls_back_when_remote_qos_is_unavailable():
    profile, state = resolve_service_execution_qos(
        '/add', selection={'mode': 'auto'},
        remote_qos_getter=lambda _name: {'qos_detection_source': 'graph_unavailable'},
    )

    assert profile.reliability == qos_profile_services_default.reliability
    assert state['fallback_used'] is True
    assert state['fallback_reason'] == (
        'Remote QoS is unavailable. The default ROS2 QoS is used.'
    )


def test_manual_profile_applies_advanced_qos_and_preserves_defaults_when_omitted():
    default_profile, _state = resolve_service_execution_qos(
        '/add', selection=manual_profile(), remote_qos_getter=None,
    )
    advanced_profile, state = resolve_service_execution_qos(
        '/add',
        selection=manual_profile(
            deadline={'value': 1000, 'unit': 'ms'},
            lifespan={'value': 2.5, 'unit': 's'},
            liveliness='manual_by_topic',
            lease_duration={'value': 750, 'unit': 'us'},
        ),
        remote_qos_getter=None,
    )

    assert default_profile.deadline.nanoseconds == 0
    assert default_profile.lifespan.nanoseconds == 0
    assert default_profile.liveliness == LivelinessPolicy.SYSTEM_DEFAULT
    assert default_profile.liveliness_lease_duration.nanoseconds == 0
    assert advanced_profile.deadline.nanoseconds == 1_000_000_000
    assert advanced_profile.lifespan.nanoseconds == 2_500_000_000
    assert advanced_profile.liveliness == LivelinessPolicy.MANUAL_BY_TOPIC
    assert advanced_profile.liveliness_lease_duration.nanoseconds == 750_000
    assert state['dashboard_qos']['deadline_ns'] == 1_000_000_000


def test_service_split_auto_uses_one_profile_for_request_and_response():
    profile, state = resolve_split_service_execution_qos(
        '/add',
        selection={'request': {'mode': 'auto'}, 'response': {'mode': 'auto'}},
        remote_qos_getter=lambda _name: discovered_service_qos(reliability='best_effort'),
    )

    assert profile.reliability == ReliabilityPolicy.BEST_EFFORT
    assert state['request']['qos_mode'] == 'auto'
    assert state['response']['qos_mode'] == 'auto'
    assert state['request']['dashboard_qos'] == state['response']['dashboard_qos']


def test_service_split_marks_different_manual_profiles_incompatible():
    _profile, state = resolve_split_service_execution_qos(
        '/add',
        selection={
            'request': manual_profile(depth=7),
            'response': manual_profile(depth=8),
        },
        remote_qos_getter=lambda _name: discovered_service_qos(),
    )

    assert state['qos_status'] == 'incompatible'
    assert state['qos_error_type'] == 'service_profile_mismatch'
    assert state['local_qos'] is None
    assert state['request']['local_qos']['depth'] == 7
    assert state['response']['local_qos']['depth'] == 8
    assert 'only one QoSProfile' in state['mismatch_reason']


def test_topic_publisher_is_recreated_when_manual_qos_changes():
    node = TopicExecutionNode()
    pool = TopicPublisherPool(lock=RLock(), node_getter=lambda: node)

    auto, auto_created = pool.get_or_create(
        topic_name='/value', topic_type='pkg/msg/Value', message_class=object,
        qos_selection={'mode': 'auto'},
    )
    reliable, reliable_created = pool.get_or_create(
        topic_name='/value', topic_type='pkg/msg/Value', message_class=object,
        qos_selection=manual_profile(),
    )
    best_effort, best_effort_created = pool.get_or_create(
        topic_name='/value', topic_type='pkg/msg/Value', message_class=object,
        qos_selection=manual_profile(reliability='best_effort'),
    )
    deadline, deadline_created = pool.get_or_create(
        topic_name='/value', topic_type='pkg/msg/Value', message_class=object,
        qos_selection=manual_profile(
            reliability='best_effort', deadline={'value': 1, 'unit': 's'},
        ),
    )

    assert auto_created is True
    assert reliable_created is False
    assert reliable is auto
    assert best_effort_created is True
    assert best_effort.profile.reliability == ReliabilityPolicy.BEST_EFFORT
    assert deadline_created is True
    assert deadline.profile.deadline.nanoseconds == 1_000_000_000
    assert node.destroyed == [auto, best_effort]


def test_service_pool_keys_clients_by_selected_qos():
    created = []
    node = SimpleNamespace(
        create_client=lambda _cls, _name, **kwargs: created.append(kwargs['qos_profile']) or object(),
    )
    pool = ServiceClientPool(
        lock=RLock(), node_getter=lambda: node, unavailable_error=lambda: RuntimeError('missing'),
    )
    reliable = QoSProfile(depth=10, reliability=ReliabilityPolicy.RELIABLE)
    best_effort = QoSProfile(depth=10, reliability=ReliabilityPolicy.BEST_EFFORT)
    advanced = QoSProfile(
        depth=10,
        reliability=ReliabilityPolicy.BEST_EFFORT,
        deadline=Duration(nanoseconds=1_000_000),
    )

    first = pool.get_or_create('/add', 'pkg/srv/Add', object, reliable, {'qos_mode': 'manual'})
    repeated = pool.get_or_create('/add', 'pkg/srv/Add', object, reliable, {'qos_mode': 'manual'})
    changed = pool.get_or_create('/add', 'pkg/srv/Add', object, best_effort, {'qos_mode': 'manual'})
    advanced_client = pool.get_or_create(
        '/add', 'pkg/srv/Add', object, advanced, {'qos_mode': 'manual'},
    )

    assert first is repeated
    assert changed is not first
    assert advanced_client is not changed
    assert [profile.reliability for profile in created] == [
        ReliabilityPolicy.RELIABLE,
        ReliabilityPolicy.BEST_EFFORT,
        ReliabilityPolicy.BEST_EFFORT,
    ]


def test_topic_subscription_is_recreated_when_manual_qos_changes():
    node = TopicExecutionNode()
    runtime = TopicReceiveRuntime(
        ensure_registered=lambda _type: None,
        graph_state=lambda **_kwargs: {},
        lock=RLock(),
        message_loader=lambda _type: object,
        message_to_json=lambda value: value,
        node_getter=lambda: node,
    )

    first = runtime.start(
        topic_name='/value', topic_type='pkg/msg/Value',
        qos_selection=manual_profile(depth=7),
    )
    changed = runtime.start(
        topic_name='/value', topic_type='pkg/msg/Value',
        qos_selection=manual_profile(
            depth=7, lease_duration={'value': 2, 'unit': 's'},
        ),
    )

    assert first['qos']['dashboard_qos']['depth'] == 7
    assert changed['qos']['dashboard_qos']['depth'] == 7
    assert changed['qos']['dashboard_qos']['liveliness_lease_duration_ns'] == 2_000_000_000
    assert len(node.created) == 2
    assert node.destroyed == [node.created[0]]


def test_action_manual_passes_service_and_topic_profiles_to_all_channels():
    captured = []
    node = TopicExecutionNode()
    pool = ActionClientPool(
        lock=RLock(), node_getter=lambda: node,
        client_factory=lambda *_args, **kwargs: captured.append(kwargs) or object(),
        dds_qos_getter=lambda _name: discovered_service_qos(),
    )
    selection = {
        'mode': 'manual',
        'service_profile': {
            'reliability': 'reliable', 'durability': 'transient_local',
            'history': 'keep_last', 'depth': 7,
        },
        'topic_profile': {
            'reliability': 'best_effort', 'durability': 'volatile',
            'history': 'keep_all', 'depth': 10,
        },
    }

    first = pool.get_or_create('/work', 'pkg/action/Work', object, selection)
    repeated = pool.get_or_create('/work', 'pkg/action/Work', object, selection)
    changed_selection = {
        **selection,
        'service_profile': {**selection['service_profile'], 'depth': 8},
    }
    changed = pool.get_or_create('/work', 'pkg/action/Work', object, changed_selection)
    profiles = captured[0]

    assert first is repeated
    assert changed is not first
    assert len(captured) == 2
    for key in ('goal_service_qos_profile', 'result_service_qos_profile', 'cancel_service_qos_profile'):
        assert profiles[key].reliability == ReliabilityPolicy.RELIABLE
        assert profiles[key].durability == DurabilityPolicy.TRANSIENT_LOCAL
        assert profiles[key].history == HistoryPolicy.KEEP_LAST
        assert profiles[key].depth == 7
    for key in ('feedback_sub_qos_profile', 'status_sub_qos_profile'):
        assert profiles[key].reliability == ReliabilityPolicy.BEST_EFFORT
        assert profiles[key].history == HistoryPolicy.KEEP_ALL
        assert profiles[key].depth == 0


def test_action_auto_uses_discovery_for_services_and_graph_for_topics():
    captured = []
    node = TopicExecutionNode()
    pool = ActionClientPool(
        lock=RLock(), node_getter=lambda: node,
        client_factory=lambda *_args, **kwargs: captured.append(kwargs) or object(),
        dds_qos_getter=lambda _name: discovered_service_qos(reliability='best_effort'),
    )

    pool.get_or_create('/work', 'pkg/action/Work', object, {'mode': 'auto'})
    profiles = captured[0]

    assert profiles['goal_service_qos_profile'].reliability == ReliabilityPolicy.BEST_EFFORT
    assert profiles['goal_service_qos_profile'].deadline.nanoseconds == 500_000_000
    assert profiles['goal_service_qos_profile'].lifespan.nanoseconds == 2_000_000_000
    assert profiles['goal_service_qos_profile'].liveliness == LivelinessPolicy.AUTOMATIC
    assert profiles['goal_service_qos_profile'].liveliness_lease_duration.nanoseconds == 3_000_000_000
    assert profiles['result_service_qos_profile'].history == qos_profile_services_default.history
    assert profiles['cancel_service_qos_profile'].depth == qos_profile_services_default.depth
    assert profiles['feedback_sub_qos_profile'].depth == 10
    assert profiles['status_sub_qos_profile'].depth == 1


def test_dashboard_state_reads_cached_qos_without_graph_or_dds_recalculation():
    dds_calls = []
    node = TopicExecutionNode()
    pool = ActionClientPool(
        lock=RLock(), node_getter=lambda: node,
        client_factory=lambda *_args, **_kwargs: object(),
        dds_qos_getter=lambda name: dds_calls.append(name) or discovered_service_qos(),
    )
    pool.get_or_create('/work', 'pkg/action/Work', object, {'mode': 'auto'})
    initial_dds_calls = len(dds_calls)

    for _ in range(5):
        state = pool.dashboard_state()

    assert state[('/work', 'pkg/action/Work')]['interface_client_created'] is True
    assert len(dds_calls) == initial_dds_calls


def test_action_dashboard_state_does_not_reenter_non_reentrant_lock():
    node = TopicExecutionNode()
    pool = ActionClientPool(
        lock=Lock(), node_getter=lambda: node,
        client_factory=lambda *_args, **_kwargs: object(),
        dds_qos_getter=lambda _name: discovered_service_qos(),
    )
    pool.get_or_create('/work', 'pkg/action/Work', object, {'mode': 'auto'})
    completed = []
    thread = Thread(target=lambda: completed.append(pool.dashboard_state()), daemon=True)

    thread.start()
    thread.join(timeout=0.5)

    assert not thread.is_alive()
    assert completed[0][('/work', 'pkg/action/Work')]['interface_client_created'] is True


def test_action_dashboard_state_uses_latest_reused_client_profile():
    node = TopicExecutionNode()
    pool = ActionClientPool(
        lock=RLock(), node_getter=lambda: node,
        client_factory=lambda *_args, **_kwargs: object(),
        dds_qos_getter=lambda _name: discovered_service_qos(),
    )
    compatible = {
        part: manual_profile(reliability='reliable')
        for part in ('goal', 'result', 'cancel')
    }
    incompatible = {
        **compatible,
        'goal': manual_profile(reliability='best_effort'),
    }

    first_compatible = pool.get_or_create(
        '/work', 'pkg/action/Work', object, compatible,
    )
    pool.get_or_create('/work', 'pkg/action/Work', object, incompatible)
    reused_compatible = pool.get_or_create(
        '/work', 'pkg/action/Work', object, compatible,
    )
    state = pool.dashboard_state()[('/work', 'pkg/action/Work')]['qos']

    assert reused_compatible is first_compatible
    assert state['goal']['qos_status'] == 'compatible'
    assert state['goal']['local_qos']['reliability'] == 'reliable'


def test_service_qos_refresh_recalculates_only_when_remote_qos_changes():
    remote = discovered_service_qos(reliability='best_effort')
    dds_calls = []
    node = SimpleNamespace(create_client=lambda *_args, **_kwargs: object())
    pool = ServiceClientPool(
        lock=RLock(), node_getter=lambda: node,
        unavailable_error=lambda: RuntimeError('unavailable'),
        dds_qos_getter=lambda name: dds_calls.append(name) or remote,
    )
    profile, state = resolve_split_service_execution_qos(
        '/add', selection={'mode': 'auto'}, remote_qos_getter=lambda _name: remote,
    )
    pool.get_or_create('/add', 'pkg/srv/Add', object, profile, state, selection={'mode': 'auto'})

    pool.refresh_qos()
    first_state = pool.dashboard_state()[('/add', 'pkg/srv/Add')]
    pool.refresh_qos()
    unchanged_state = pool.dashboard_state()[('/add', 'pkg/srv/Add')]
    remote = discovered_service_qos(reliability='reliable')
    pool.refresh_qos()
    changed_state = pool.dashboard_state()[('/add', 'pkg/srv/Add')]

    assert len(dds_calls) == 3
    assert first_state['qos_status'] == 'compatible'
    assert unchanged_state == first_state
    assert changed_state['qos_status'] == 'compatible'
    assert changed_state['dashboard_qos']['reliability'] == 'reliable'


def test_service_dashboard_state_preserves_preflight_qos_without_client():
    pool = ServiceClientPool(
        lock=RLock(), node_getter=lambda: None,
        unavailable_error=lambda: RuntimeError('unavailable'),
        dds_qos_getter=lambda _name: discovered_service_qos(reliability='best_effort'),
    )
    _profile, incompatible = resolve_split_service_execution_qos(
        '/add', selection=manual_profile(reliability='reliable'),
        remote_qos_getter=lambda _name: discovered_service_qos(reliability='best_effort'),
    )

    pool.record_qos_attempt(
        '/add', 'pkg/srv/Add', incompatible,
        manual_profile(reliability='reliable'),
    )
    state = pool.dashboard_state()[('/add', 'pkg/srv/Add')]

    assert state['interface_client_created'] is False
    assert state['qos_status'] == 'incompatible'
    assert state['qos_detection_source'] == 'fastdds_discovery'


def test_service_dashboard_qos_recovers_after_incompatible_attempt():
    node = SimpleNamespace(create_client=lambda *_args, **_kwargs: object())
    pool = ServiceClientPool(
        lock=RLock(), node_getter=lambda: node,
        unavailable_error=lambda: RuntimeError('unavailable'),
    )
    remote = discovered_service_qos(reliability='best_effort')

    for reliability, expected in (
        ('best_effort', 'compatible'),
        ('reliable', 'incompatible'),
        ('best_effort', 'compatible'),
    ):
        selection = manual_profile(reliability=reliability)
        profile, state = resolve_split_service_execution_qos(
            '/add', selection=selection,
            remote_qos_getter=lambda _name: remote,
        )
        pool.get_or_create(
            '/add', 'pkg/srv/Add', object, profile, state, selection=selection,
        )
        assert pool.dashboard_state()[('/add', 'pkg/srv/Add')]['qos_status'] == expected


def test_action_accepts_five_independent_channel_profiles():
    captured = []
    node = TopicExecutionNode()
    pool = ActionClientPool(
        lock=RLock(), node_getter=lambda: node,
        client_factory=lambda *_args, **kwargs: captured.append(kwargs) or object(),
        dds_qos_getter=lambda _name: discovered_service_qos(reliability='best_effort'),
    )

    selection = {
        'goal': manual_profile(
            reliability='reliable', depth=1,
            deadline={'value': 100, 'unit': 'ms'},
        ),
        'result': manual_profile(reliability='best_effort', depth=2),
        'cancel': manual_profile(reliability='reliable', depth=3),
        'feedback': manual_profile(
            reliability='best_effort', depth=4, lifespan={'value': 3, 'unit': 's'},
        ),
        'status': manual_profile(
            reliability='reliable', depth=5, liveliness='automatic',
            lease_duration={'value': 4, 'unit': 's'},
        ),
    }
    first = pool.get_or_create('/work', 'pkg/action/Work', object, selection)
    repeated = pool.get_or_create('/work', 'pkg/action/Work', object, selection)
    changed = pool.get_or_create('/work', 'pkg/action/Work', object, {
        **selection,
        'goal': manual_profile(
            reliability='reliable', depth=1,
            deadline={'value': 101, 'unit': 'ms'},
        ),
    })
    profiles = captured[0]

    assert profiles['goal_service_qos_profile'].reliability == ReliabilityPolicy.RELIABLE
    assert profiles['goal_service_qos_profile'].depth == 1
    assert profiles['goal_service_qos_profile'].deadline.nanoseconds == 100_000_000
    assert profiles['result_service_qos_profile'].reliability == ReliabilityPolicy.BEST_EFFORT
    assert profiles['result_service_qos_profile'].depth == 2
    assert profiles['cancel_service_qos_profile'].reliability == ReliabilityPolicy.RELIABLE
    assert profiles['cancel_service_qos_profile'].depth == 3
    assert profiles['feedback_sub_qos_profile'].reliability == ReliabilityPolicy.BEST_EFFORT
    assert profiles['feedback_sub_qos_profile'].depth == 4
    assert profiles['feedback_sub_qos_profile'].lifespan.nanoseconds == 3_000_000_000
    assert profiles['status_sub_qos_profile'].reliability == ReliabilityPolicy.RELIABLE
    assert profiles['status_sub_qos_profile'].depth == 5
    assert profiles['status_sub_qos_profile'].liveliness == LivelinessPolicy.AUTOMATIC
    assert profiles['status_sub_qos_profile'].liveliness_lease_duration.nanoseconds == 4_000_000_000
    assert first is repeated
    assert changed is not first
    assert len(captured) == 2


def test_service_auto_and_manual_qos_status():
    remote = discovered_service_qos(reliability='best_effort')

    # Auto mode with compatible remote
    _profile, auto_state = resolve_service_execution_qos(
        '/add', selection={'mode': 'auto'}, remote_qos_getter=lambda _name: remote,
    )
    assert auto_state['qos_status'] == 'compatible'
    assert auto_state['qos_detection_source'] == 'fastdds_discovery'

    # Manual mode with compatible profile (best_effort writer can satisfy best_effort reader)
    _profile, manual_ok = resolve_service_execution_qos(
        '/add',
        selection=manual_profile(reliability='best_effort'),
        remote_qos_getter=lambda _name: remote,
    )
    assert manual_ok['qos_status'] == 'compatible'
    assert manual_ok['qos_detection_source'] == 'fastdds_discovery'

    # Manual mode with incompatible profile (client response reader reliable cannot receive from server best_effort writer)
    _profile, manual_incompat = resolve_service_execution_qos(
        '/add',
        selection=manual_profile(reliability='reliable'),
        remote_qos_getter=lambda _name: remote,
    )
    assert manual_incompat['qos_status'] == 'incompatible'
    assert manual_incompat['qos_detection_source'] == 'fastdds_discovery'

    # Remote unavailable
    _profile, unavailable_state = resolve_service_execution_qos(
        '/add', selection={'mode': 'auto'}, remote_qos_getter=None,
    )
    assert unavailable_state['qos_status'] == 'unknown'


def test_service_and_action_snapshot_updates_compatible_qos():
    from ros2_dashboard_monitor.action_snapshot import assemble_action_snapshot
    from ros2_dashboard_monitor.service_snapshot import assemble_service_snapshot

    class FakeServiceRuntime:
        def snapshot(self, **_kwargs):
            return {
                'services': [{
                    'name': '/add',
                    'type': 'pkg/srv/Add',
                    'qos_status': 'observed',
                    'qos_detection_source': 'fastdds_discovery',
                    'server_count': 1,
                    'client_count': 1,
                }],
                'meta': {'count': 1},
            }

    class FakeServiceCallRuntime:
        def summary_by_service(self):
            return {}

        def callable_services(self):
            return {'services': [{'service_name': '/add', 'service_type': 'pkg/srv/Add', 'callable': True}]}

        def dashboard_state_by_service(self):
            return {
                ('/add', 'pkg/srv/Add'): {
                    'interface_client_created': True,
                    'qos_status': 'compatible',
                    'qos_detection_source': 'fastdds_discovery',
                    'local_qos': {'reliability': 'best_effort'},
                },
            }

    class FakeActionRuntime:
        def snapshot(self):
            return {
                'actions': [{
                    'name': '/work',
                    'type': 'pkg/action/Work',
                    'server_count': 1,
                    'client_count': 1,
                    'qos': {
                        'goal': {'qos_status': 'observed'},
                        'result': {'qos_status': 'observed'},
                        'cancel': {'qos_status': 'observed'},
                        'feedback': {'qos_status': 'observed'},
                        'status': {'qos_status': 'observed'},
                    },
                }],
                'meta': {'count': 1},
            }

    class FakeActionGoalRuntime:
        def summary_by_action(self):
            return {}

        def callable_actions(self):
            return {'actions': [{'action_name': '/work', 'action_type': 'pkg/action/Work', 'callable': True}]}

        def dashboard_state_by_action(self):
            return {
                ('/work', 'pkg/action/Work'): {
                    'interface_client_created': True,
                    'qos': {
                        'goal': {'qos_status': 'compatible', 'local_qos': {'reliability': 'reliable'}},
                        'result': {'qos_status': 'compatible', 'local_qos': {'reliability': 'reliable'}},
                        'cancel': {'qos_status': 'compatible', 'local_qos': {'reliability': 'reliable'}},
                        'feedback': {'qos_status': 'compatible', 'local_qos': {'reliability': 'best_effort'}},
                        'status': {'qos_status': 'compatible', 'local_qos': {'reliability': 'reliable'}},
                    },
                },
            }

    class FakeMonitor:
        def __init__(self):
            self._service_runtime = FakeServiceRuntime()
            self._service_call_runtime = FakeServiceCallRuntime()
            self._action_runtime = FakeActionRuntime()
            self._action_goal_runtime = FakeActionGoalRuntime()
            self._config = SimpleNamespace(services_primary_names=[], actions_primary_names=[])

        def _role_node_index(self):
            return {}

        def _monitor_node_full_name(self):
            return '/monitor'

        def _apply_primary_state(self, item, **_kwargs):
            item['is_primary'] = False

    monitor = FakeMonitor()

    # Service snapshot verification
    srv_snapshot = assemble_service_snapshot(monitor, include_hidden=True)
    service = srv_snapshot['services'][0]
    assert service['qos_status'] == 'compatible'
    assert service['local_qos'] == {'reliability': 'best_effort'}

    monitor._service_call_runtime.dashboard_state_by_service = lambda: {
        ('/add', 'pkg/srv/Add'): {
            'interface_client_created': False,
            'qos_status': 'incompatible',
            'qos_detection_source': 'fastdds_discovery',
            'mismatch_reason': 'Manual QoS profile is incompatible with remote Service QoS.',
            'local_qos': {'reliability': 'reliable'},
        },
    }
    blocked_snapshot = assemble_service_snapshot(monitor, include_hidden=True)
    blocked_service = blocked_snapshot['services'][0]
    assert blocked_service['qos_status'] == 'incompatible'
    assert blocked_service['dashboard_communication']['interface_client_created'] is False

    # Action snapshot verification
    act_snapshot = assemble_action_snapshot(monitor)
    action = act_snapshot['actions'][0]
    for channel in ('goal', 'result', 'cancel', 'feedback', 'status'):
        assert action['qos'][channel]['qos_status'] == 'compatible'
