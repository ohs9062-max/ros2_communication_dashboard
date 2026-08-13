from types import SimpleNamespace

from rclpy.qos import (
    DurabilityPolicy,
    QoSCompatibility,
    QoSProfile,
    HistoryPolicy,
    ReliabilityPolicy,
    qos_check_compatible,
    qos_profile_services_default,
)

import ros2_dashboard_monitor.qos as qos_module
from ros2_dashboard_monitor.interface_lab.execution.action_goal_runtime import ActionGoalRuntime
from ros2_dashboard_monitor.interface_lab.execution.service_call_runtime import ServiceCallRuntime
from ros2_dashboard_monitor.interface_lab.execution.service_call_executor import execute_service_call
from ros2_dashboard_monitor.qos import (
    choose_topic_qos,
    observe_topic_qos,
    qos_profile_dict,
)
from ros2_dashboard_monitor.ros2_action.subscription_lifecycle import (
    merge_action_topic_local_qos,
    observe_action_qos,
)


def endpoint(profile):
    return SimpleNamespace(
        node_name='remote', node_namespace='/', topic_type='pkg/msg/Value', qos_profile=profile,
    )


class TopicNode:
    def __init__(self, publishers=(), subscriptions=()):
        self.publishers = list(publishers)
        self.subscriptions = list(subscriptions)

    def get_publishers_info_by_topic(self, _name):
        return self.publishers

    def get_subscriptions_info_by_topic(self, _name):
        return self.subscriptions

    @staticmethod
    def get_name():
        return 'dashboard_monitor'

    @staticmethod
    def get_namespace():
        return '/'


def test_best_effort_publisher_is_incompatible_with_reliable_subscription():
    offered = QoSProfile(depth=10, reliability=ReliabilityPolicy.BEST_EFFORT)
    requested = QoSProfile(depth=10, reliability=ReliabilityPolicy.RELIABLE)
    compatibility, reason = qos_check_compatible(offered, requested)
    assert compatibility == QoSCompatibility.ERROR
    assert 'reliable' in reason.lower()


def test_topic_subscription_auto_applies_best_effort_publisher_qos():
    offered = QoSProfile(depth=5, reliability=ReliabilityPolicy.BEST_EFFORT)
    selected, state = choose_topic_qos(
        TopicNode(publishers=[endpoint(offered)]), '/value',
        local_role='subscription', default_profile=QoSProfile(depth=10),
    )
    assert selected.reliability == ReliabilityPolicy.BEST_EFFORT
    assert state['qos_status'] == 'compatible'
    assert state['qos_auto_applied'] is True


def test_graph_unknown_history_is_normalized_before_entity_creation():
    offered = QoSProfile(depth=5, history=HistoryPolicy.UNKNOWN)
    selected, state = choose_topic_qos(
        TopicNode(publishers=[endpoint(offered)]), '/value',
        local_role='subscription', default_profile=QoSProfile(depth=10),
    )
    assert selected.history == HistoryPolicy.KEEP_LAST
    assert state['qos_fallback_policies'] == ['history', 'liveliness']


def test_topic_graph_exposes_publisher_and_subscriber_qos():
    publisher = QoSProfile(
        depth=5,
        reliability=ReliabilityPolicy.BEST_EFFORT,
        durability=DurabilityPolicy.VOLATILE,
    )
    subscriber = QoSProfile(
        depth=7,
        reliability=ReliabilityPolicy.BEST_EFFORT,
        durability=DurabilityPolicy.VOLATILE,
    )

    state = observe_topic_qos(
        TopicNode(
            publishers=[endpoint(publisher)],
            subscriptions=[endpoint(subscriber)],
        ),
        '/value',
    )

    assert state['qos_status'] == 'compatible'
    assert state['publisher_qos'][0]['qos']['reliability'] == 'best_effort'
    assert state['publisher_qos'][0]['qos']['history'] == 'keep_last'
    assert state['publisher_qos'][0]['qos']['depth'] == 5
    assert state['subscriber_qos'][0]['qos']['depth'] == 7


def test_topic_graph_reports_confirmed_endpoint_mismatch():
    state = observe_topic_qos(
        TopicNode(
            publishers=[endpoint(QoSProfile(
                depth=1,
                reliability=ReliabilityPolicy.BEST_EFFORT,
            ))],
            subscriptions=[endpoint(QoSProfile(
                depth=1,
                reliability=ReliabilityPolicy.RELIABLE,
            ))],
        ),
        '/value',
    )

    assert state['qos_status'] == 'incompatible'
    assert 'reliability' in state['mismatch_policies']


def test_action_qos_keeps_services_unknown_and_observes_internal_topics():
    node = TopicNode(publishers=[endpoint(QoSProfile(depth=3))])

    state = observe_action_qos(node, '/work')

    assert state['goal']['local_qos'] is None
    assert state['goal']['qos_visibility'] == 'graph_unavailable'
    reason = 'Action Service endpoint QoS could not be discovered from the ROS2 graph.'
    assert state['result']['mismatch_reason'] == reason
    assert state['cancel']['mismatch_reason'] == reason
    assert state['feedback']['publisher_qos'][0]['qos']['depth'] == 3
    assert state['status']['publisher_qos'][0]['qos']['depth'] == 3


def test_action_qos_merges_only_existing_topic_subscription_profiles():
    observed = observe_action_qos(TopicNode(), '/work')
    applied = {
        'feedback': {
            'local_qos': {'reliability': 'best_effort'},
            'qos_auto_applied': True,
            'qos_fallback_policies': ['history', 'depth'],
        },
        'goal': {'local_qos': {'reliability': 'reliable'}},
    }

    merged = merge_action_topic_local_qos(observed, applied)

    assert merged['feedback']['local_qos']['reliability'] == 'best_effort'
    assert merged['feedback']['qos_auto_applied'] is True
    assert merged['goal']['local_qos'] is None


def test_service_client_uses_services_default_qos():
    captured = {}
    node = SimpleNamespace(create_client=lambda cls, name, **kwargs: captured.update(kwargs) or object())
    runtime = ServiceCallRuntime(lock=__import__('threading').RLock(), node_getter=lambda: node)
    runtime._client('/add', 'example_interfaces/srv/AddTwoInts', object)
    assert qos_profile_dict(captured['qos_profile']) == qos_profile_dict(qos_profile_services_default)
    assert runtime._service_qos()['qos_status'] == 'unknown'


def test_service_timeout_is_not_reported_as_qos_incompatible():
    recorded = []
    future = SimpleNamespace(add_done_callback=lambda _callback: None)
    client = SimpleNamespace(service_is_ready=lambda: True, call_async=lambda _request: future)
    try:
        execute_service_call(
            service_name='/slow', service_type='pkg/srv/Slow', request_data={}, timeout=0.001,
            service_class_loader=lambda _type: SimpleNamespace(Request=object),
            client_getter=lambda *_args: client,
            validation_result_builder=lambda **kwargs: kwargs,
            record_history=recorded.append, error_class=ValueError,
            message_builder=lambda *_args, **_kwargs: object(), response_serializer=lambda value: value,
        )
    except ValueError:
        pass
    assert recorded[-1]['error_type'] == 'timeout'
    assert 'qos' not in recorded[-1]['error_type']


def test_action_client_uses_five_independent_qos_profiles(monkeypatch):
    captured = {}
    node = TopicNode()
    monkeypatch.setattr(
        'ros2_dashboard_monitor.interface_lab.execution.action_goal_runtime.ActionClient',
        lambda _node, _cls, _name, **kwargs: captured.update(kwargs) or object(),
    )
    runtime = ActionGoalRuntime(lock=__import__('threading').RLock(), node_getter=lambda: node)
    runtime._client('/work', 'pkg/action/Work', object)
    assert set(captured) == {
        'goal_service_qos_profile', 'result_service_qos_profile',
        'cancel_service_qos_profile', 'feedback_sub_qos_profile',
        'status_sub_qos_profile',
    }


def test_action_feedback_auto_applies_best_effort():
    feedback = QoSProfile(depth=3, reliability=ReliabilityPolicy.BEST_EFFORT)
    node = TopicNode(publishers=[endpoint(feedback)])
    runtime = ActionGoalRuntime(lock=__import__('threading').RLock(), node_getter=lambda: node)
    profiles = runtime._action_qos_profiles(node, '/work')
    assert profiles['feedback'].reliability == ReliabilityPolicy.BEST_EFFORT
    assert profiles['state']['feedback']['qos_status'] == 'compatible'


def test_conflicting_topic_endpoints_report_partial(monkeypatch):
    profiles = [
        QoSProfile(depth=1, reliability=ReliabilityPolicy.RELIABLE),
        QoSProfile(depth=1, durability=DurabilityPolicy.TRANSIENT_LOCAL),
    ]
    calls = {'count': 0}
    def alternating(_publisher, _subscription):
        calls['count'] += 1
        return (QoSCompatibility.OK, '') if calls['count'] % 2 else (QoSCompatibility.ERROR, 'reliability conflict')
    monkeypatch.setattr(qos_module, 'qos_check_compatible', alternating)
    _, state = choose_topic_qos(
        TopicNode(publishers=[endpoint(profile) for profile in profiles]), '/mixed',
        local_role='subscription', default_profile=QoSProfile(depth=10),
    )
    assert state['qos_status'] == 'partial'
    assert state['compatible_endpoint_count'] == 1
