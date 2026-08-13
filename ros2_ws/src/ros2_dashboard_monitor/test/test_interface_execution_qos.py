from threading import RLock
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
    ExecutionQosError,
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


def test_service_split_rejects_different_manual_profiles():
    with pytest.raises(ExecutionQosError, match='only one QoSProfile'):
        resolve_split_service_execution_qos(
            '/add',
            selection={
                'request': manual_profile(depth=7),
                'response': manual_profile(depth=8),
            },
            remote_qos_getter=lambda _name: discovered_service_qos(),
        )


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
