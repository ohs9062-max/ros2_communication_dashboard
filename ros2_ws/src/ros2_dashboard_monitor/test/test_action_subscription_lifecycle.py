"""Action status/feedback subscription lifecycle 회귀 테스트입니다."""

from rclpy.qos import QoSProfile
from types import SimpleNamespace

from ros2_dashboard_monitor.ros2_action import subscription_lifecycle as lifecycle
from ros2_dashboard_monitor.ros2_action.subscriptions import (
    action_history_snapshot,
    build_action_subscription_entry,
    update_feedback_runtime,
    update_goal_result,
    update_status_runtime,
)


class _Node:
    def __init__(self) -> None:
        self.created = []
        self.destroyed = []

    def create_subscription(
        self, message_class, topic_name, callback, qos_profile, **kwargs,
    ):
        subscription = (message_class, topic_name)
        self.created.append({
            'subscription': subscription,
            'callback': callback,
            'qos_profile': qos_profile,
            'kwargs': kwargs,
        })
        return subscription

    def destroy_subscription(self, subscription) -> None:
        self.destroyed.append(subscription)


def test_status_subscription_stores_selected_qos(monkeypatch) -> None:
    node = _Node()
    entry = {}
    qos = {
        'qos_status': 'compatible',
        'qos_detection_source': 'graph_profile_comparison',
    }
    monkeypatch.setattr(lifecycle, 'load_status_message_class', lambda: object)
    monkeypatch.setattr(
        lifecycle,
        'choose_topic_qos',
        lambda *_args, **_kwargs: (QoSProfile(depth=3), qos),
    )

    supported = lifecycle.create_status_subscription(
        node=node,
        name='/work',
        entry=entry,
        enabled=True,
        callback=lambda _message: None,
    )

    assert supported is True
    assert node.created[0]['subscription'][1] == '/work/_action/status'
    assert entry['status_subscription'] == node.created[0]['subscription']
    assert entry['qos']['status'] is qos


def test_disabled_feedback_records_reason_without_creating_subscription() -> None:
    node = _Node()
    entry = {}

    supported = lifecycle.create_feedback_subscription(
        node=node,
        name='/work',
        action_type='demo_interfaces/action/Work',
        entry=entry,
        enabled=False,
        callback=lambda _message: None,
    )

    assert supported is False
    assert entry['feedback_reason'] == 'feedback monitoring disabled'
    assert node.created == []


def test_count_capabilities_and_destroy_preserve_entry_contract() -> None:
    node = _Node()
    status = object()
    feedback = object()
    entry = {
        'status_subscription': status,
        'feedback_subscription': feedback,
        'status_supported': True,
        'feedback_supported': True,
        'result_supported': True,
        'result_policy': 'observed_goals',
        'qos': lifecycle.default_action_qos(),
    }

    assert lifecycle.monitor_subscription_count(
        [('/work', entry)], '/work/_action/status',
    ) == 1
    assert lifecycle.action_capabilities(entry)['result_supported'] is True

    lifecycle.destroy_entry_subscriptions(node, entry)
    assert node.destroyed == [status, feedback]


def test_update_action_topic_subscriptions_recreates_on_profile_change(monkeypatch) -> None:
    from rclpy.qos import DurabilityPolicy, QoSProfile, ReliabilityPolicy

    node = _Node()
    entry = {
        'status_subscription': ('msg_cls', '/work/_action/status'),
        'status_qos_profile': QoSProfile(depth=10, reliability=ReliabilityPolicy.BEST_EFFORT),
        'feedback_subscription': ('msg_cls', '/work/_action/feedback'),
        'feedback_qos_profile': QoSProfile(depth=10, reliability=ReliabilityPolicy.BEST_EFFORT),
        'qos': {
            'status': {'qos_status': 'incompatible'},
            'feedback': {'qos_status': 'incompatible'},
        },
    }

    monkeypatch.setattr(lifecycle, 'load_status_message_class', lambda: object)
    monkeypatch.setattr(lifecycle, 'load_feedback_message_class', lambda _t: object)

    new_profile = QoSProfile(depth=10, reliability=ReliabilityPolicy.RELIABLE)
    compat_qos = {'qos_status': 'compatible', 'qos_detection_source': 'graph_profile_comparison'}
    monkeypatch.setattr(
        lifecycle,
        'choose_topic_qos',
        lambda _n, topic, **_kwargs: (new_profile, dict(compat_qos)),
    )

    lifecycle.update_action_topic_subscriptions(
        node=node,
        name='/work',
        action_type='demo_interfaces/action/Work',
        entry=entry,
        status_enabled=True,
        feedback_enabled=True,
        status_callback=lambda _m: None,
        feedback_callback=lambda _m: None,
    )

    assert len(node.destroyed) == 2
    assert len(node.created) == 2
    assert entry['qos']['status']['qos_status'] == 'compatible'
    assert entry['qos']['feedback']['qos_status'] == 'compatible'

def test_update_action_topic_subscriptions_updates_incompatible_qos_in_place_when_compatible(monkeypatch) -> None:
    from rclpy.qos import QoSProfile, ReliabilityPolicy

    node = _Node()
    same_profile = QoSProfile(depth=10, reliability=ReliabilityPolicy.RELIABLE)
    entry = {
        'status_subscription': ('msg_cls', '/work/_action/status'),
        'status_qos_profile': same_profile,
        'feedback_subscription': ('msg_cls', '/work/_action/feedback'),
        'feedback_qos_profile': same_profile,
        'qos': {
            'status': {'qos_status': 'incompatible'},
            'feedback': {'qos_status': 'incompatible'},
        },
    }

    compat_qos = {'qos_status': 'compatible', 'qos_detection_source': 'graph_profile_comparison'}
    monkeypatch.setattr(
        lifecycle,
        'choose_topic_qos',
        lambda _n, topic, **_kwargs: (same_profile, dict(compat_qos)),
    )

    lifecycle.update_action_topic_subscriptions(
        node=node,
        name='/work',
        action_type='demo_interfaces/action/Work',
        entry=entry,
        status_enabled=True,
        feedback_enabled=True,
        status_callback=lambda _m: None,
        feedback_callback=lambda _m: None,
    )

    assert len(node.destroyed) == 0
    assert len(node.created) == 0
    assert entry['qos']['status']['qos_status'] == 'compatible'
    assert entry['qos']['feedback']['qos_status'] == 'compatible'


def test_observed_action_history_is_bounded_and_records_real_events() -> None:
    class Feedback:
        __slots__ = ('_progress',)

        def __init__(self, progress: int) -> None:
            self._progress = progress

    goal_id = SimpleNamespace(uuid=[1, 2, 3, 4])
    goal_info = SimpleNamespace(goal_id=goal_id)
    entry = build_action_subscription_entry(
        action_name='/work',
        action_type='pkg/action/Work',
        history_limit=3,
    )

    accepted = SimpleNamespace(
        status_list=[SimpleNamespace(goal_info=goal_info, status=1)],
    )
    update_status_runtime(entry, message=accepted, received_at=1.0)
    update_status_runtime(entry, message=accepted, received_at=1.1)
    update_feedback_runtime(
        entry,
        message=SimpleNamespace(goal_id=goal_id, feedback=Feedback(50)),
        received_at=2.0,
    )
    succeeded = SimpleNamespace(
        status_list=[SimpleNamespace(goal_info=goal_info, status=4)],
    )
    update_status_runtime(entry, message=succeeded, received_at=3.0)
    update_goal_result(
        entry,
        goal_id='01020304',
        state={
            'result_status': 'success',
            'result_preview': {'done': True},
            'result_error': None,
        },
        received_at=4.0,
    )

    history = action_history_snapshot(entry, limit=10)
    assert [item['event_type'] for item in history] == [
        'result', 'status', 'feedback',
    ]
    assert history[0]['result'] == {'done': True}
    assert history[1]['status_label'] == 'succeeded'
    assert history[2]['feedback'] == [{'progress': 50}]
    assert all(item['execution_source'] == 'monitor_observed' for item in history)
    assert all(item['goal'] is None for item in history)
