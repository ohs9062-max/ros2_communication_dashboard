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
