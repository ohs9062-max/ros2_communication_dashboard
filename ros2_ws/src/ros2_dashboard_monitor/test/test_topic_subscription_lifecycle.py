"""Topic subscription 생명주기 helper의 회귀 테스트입니다."""

from threading import Lock
from types import SimpleNamespace

from ros2_dashboard_monitor.ros2_topic.subscription_lifecycle import (
    cleanup_disappeared_subscriptions,
    monitor_subscriber_count,
    owned_subscription_endpoint_count,
)


class _EndpointNode:
    def get_name(self) -> str:
        return 'dashboard_monitor'

    def get_namespace(self) -> str:
        return '/dashboard'

    def get_subscriptions_info_by_topic(self, _name: str):
        return [
            SimpleNamespace(
                node_name='dashboard_monitor',
                node_namespace='/dashboard',
            ),
            SimpleNamespace(node_name='other', node_namespace='/'),
        ]


class _CleanupNode:
    def __init__(self) -> None:
        self.destroyed = []

    def destroy_subscription(self, subscription) -> None:
        self.destroyed.append(subscription)


def test_owned_endpoint_count_uses_node_identity() -> None:
    assert owned_subscription_endpoint_count(_EndpointNode(), '/scan') == 1


def test_monitor_count_falls_back_to_runtime_entries_without_graph_api() -> None:
    count = monitor_subscriber_count(
        node=object(),
        lock=Lock(),
        subscriptions={
            '/feedback': {
                'type': 'example_interfaces/msg/String',
                'subscription': object(),
            },
        },
        name='/feedback',
        topic_type='example_interfaces/msg/String',
        action_monitor_subscriber_count=lambda _name: 2,
    )

    assert count == 3


def test_cleanup_removes_only_after_disappearance_grace_period() -> None:
    node = _CleanupNode()
    subscription = object()
    subscriptions = {
        '/gone': {
            'type': 'example_interfaces/msg/String',
            'subscription': subscription,
        },
    }
    lock = Lock()

    cleanup_disappeared_subscriptions(
        node=node,
        lock=lock,
        subscriptions=subscriptions,
        retained_topic_names=set(),
        now=10.0,
        cleanup_after_sec=5.0,
    )
    assert '/gone' in subscriptions

    cleanup_disappeared_subscriptions(
        node=node,
        lock=lock,
        subscriptions=subscriptions,
        retained_topic_names=set(),
        now=15.0,
        cleanup_after_sec=5.0,
    )
    assert subscriptions == {}
    assert node.destroyed == [subscription]


def test_ensure_subscription_recreates_on_profile_change() -> None:
    from rclpy.qos import DurabilityPolicy, QoSProfile, ReliabilityPolicy
    from ros2_dashboard_monitor.ros2_topic.subscription_lifecycle import ensure_subscription

    class _CreateDestroyNode:
        def __init__(self) -> None:
            self.created = []
            self.destroyed = []

        def create_subscription(self, msg_class, name, callback, qos_profile, **kwargs):
            sub = (name, qos_profile.reliability)
            self.created.append(sub)
            return sub

        def destroy_subscription(self, subscription) -> None:
            self.destroyed.append(subscription)

    node = _CreateDestroyNode()
    subscriptions = {}
    lock = Lock()

    profile1 = QoSProfile(depth=10, reliability=ReliabilityPolicy.BEST_EFFORT)
    qos1 = {'qos_status': 'incompatible', 'qos_detection_source': 'graph_profile_comparison'}

    ensure_subscription(
        node=node,
        lock=lock,
        subscriptions=subscriptions,
        name='/scan',
        topic_type='sensor_msgs/msg/LaserScan',
        message_class=object,
        callback=lambda _m: None,
        qos_resolver=lambda _n, _t: (profile1, qos1),
    )

    assert len(node.created) == 1
    assert subscriptions['/scan']['qos']['qos_status'] == 'incompatible'

    profile2 = QoSProfile(depth=10, reliability=ReliabilityPolicy.RELIABLE)
    qos2 = {'qos_status': 'compatible', 'qos_detection_source': 'graph_profile_comparison'}

    ensure_subscription(
        node=node,
        lock=lock,
        subscriptions=subscriptions,
        name='/scan',
        topic_type='sensor_msgs/msg/LaserScan',
        message_class=object,
        callback=lambda _m: None,
        qos_resolver=lambda _n, _t: (profile2, qos2),
    )

    assert len(node.destroyed) == 1
    assert len(node.created) == 2
    assert subscriptions['/scan']['qos']['qos_status'] == 'compatible'

def test_ensure_subscription_updates_incompatible_qos_in_place_when_compatible() -> None:
    from rclpy.qos import QoSProfile, ReliabilityPolicy
    from ros2_dashboard_monitor.ros2_topic.subscription_lifecycle import ensure_subscription

    class _MockNode:
        def create_subscription(self, msg_class, name, callback, qos_profile, **kwargs):
            return 'sub1'

        def destroy_subscription(self, subscription) -> None:
            pass

    node = _MockNode()
    subscriptions = {}
    lock = Lock()

    profile = QoSProfile(depth=10, reliability=ReliabilityPolicy.RELIABLE)
    qos_incompat = {'qos_status': 'incompatible', 'qos_detection_source': 'incompatible_qos_event'}

    ensure_subscription(
        node=node,
        lock=lock,
        subscriptions=subscriptions,
        name='/scan',
        topic_type='sensor_msgs/msg/LaserScan',
        message_class=object,
        callback=lambda _m: None,
        qos_resolver=lambda _n, _t: (profile, qos_incompat),
    )

    assert subscriptions['/scan']['qos']['qos_status'] == 'incompatible'

    qos_compat = {'qos_status': 'compatible', 'qos_detection_source': 'graph_profile_comparison'}

    ensure_subscription(
        node=node,
        lock=lock,
        subscriptions=subscriptions,
        name='/scan',
        topic_type='sensor_msgs/msg/LaserScan',
        message_class=object,
        callback=lambda _m: None,
        qos_resolver=lambda _n, _t: (profile, qos_compat),
    )

    assert subscriptions['/scan']['qos']['qos_status'] == 'compatible'
