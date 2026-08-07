"""Action status/feedback subscription lifecycle 회귀 테스트입니다."""

from rclpy.qos import QoSProfile

from ros2_dashboard_monitor.ros2_action import subscription_lifecycle as lifecycle


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
