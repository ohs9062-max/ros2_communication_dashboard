"""Topic Graph collector의 필터·endpoint·연결 종료 회귀 테스트입니다."""

from ros2_dashboard_monitor.ros2_topic.graph_collector import (
    collect_topic_graph,
)


class _GraphNode:
    def __init__(self) -> None:
        self.publishers = {'/active': 1, '/internal': 1, '/excluded': 1}
        self.subscribers = {'/active': 3, '/internal': 1, '/excluded': 0}

    def count_publishers(self, name: str) -> int:
        return self.publishers.get(name, 0)

    def count_subscribers(self, name: str) -> int:
        return self.subscribers.get(name, 0)


def _collect(
    *,
    names_and_types,
    previous_topics=None,
):
    return collect_topic_graph(
        node=_GraphNode(),
        names_and_types=names_and_types,
        previous_topics=previous_topics or {},
        updated_at=20.0,
        exclude_types=('internal_msgs/msg/Hidden',),
        is_included=lambda name: name != '/internal',
        is_supported=lambda topic_type: topic_type == 'std_msgs/msg/String',
        is_registered=lambda topic_type: topic_type == 'std_msgs/msg/String',
        auto_subscribe=lambda _name, _type, supported: supported,
        monitor_subscriber_count=lambda name, _type: 1 if name == '/active' else 0,
    )


def test_collector_filters_names_and_types_and_counts_external_endpoints() -> None:
    topics, externally_present = _collect(names_and_types=[
        ('/active', ['std_msgs/msg/String']),
        ('/internal', ['std_msgs/msg/String']),
        ('/excluded', ['internal_msgs/msg/Hidden']),
    ])

    assert [topic['name'] for topic in topics] == ['/active']
    assert topics[0]['publisher_count'] == 1
    assert topics[0]['raw_subscriber_count'] == 3
    assert topics[0]['monitor_subscriber_count'] == 1
    assert topics[0]['external_subscriber_count'] == 2
    assert topics[0]['graph_present'] is True
    assert externally_present == {'/active'}


def test_collector_retains_disconnected_previous_topic() -> None:
    previous = {
        '/gone': {
            'name': '/gone',
            'types': ['std_msgs/msg/String'],
            'publisher_count': 1,
            'subscriber_count': 2,
            'raw_subscriber_count': 2,
            'monitor_subscriber_count': 1,
            'external_subscriber_count': 1,
            'status': 'active',
            'last_seen_at': 10.0,
        },
    }

    topics, externally_present = _collect(
        names_and_types=[],
        previous_topics=previous,
    )

    assert externally_present == set()
    assert topics[0]['status'] == 'disconnected'
    assert topics[0]['last_seen_at'] == 10.0
    assert topics[0]['disconnected_at'] == 20.0
    assert topics[0]['publisher_count'] == 0
    assert topics[0]['external_subscriber_count'] == 0


def test_collector_does_not_treat_monitor_only_endpoint_as_external() -> None:
    node = _GraphNode()
    node.publishers['/monitor_only'] = 0
    node.subscribers['/monitor_only'] = 1
    previous = {
        '/monitor_only': {
            'name': '/monitor_only',
            'types': ['std_msgs/msg/String'],
            'publisher_count': 1,
            'subscriber_count': 1,
            'raw_subscriber_count': 1,
            'monitor_subscriber_count': 0,
            'external_subscriber_count': 1,
            'status': 'active',
            'last_seen_at': 9.0,
        },
    }

    topics, externally_present = collect_topic_graph(
        node=node,
        names_and_types=[('/monitor_only', ['std_msgs/msg/String'])],
        previous_topics=previous,
        updated_at=20.0,
        exclude_types=(),
        is_included=lambda _name: True,
        is_supported=lambda _type: True,
        is_registered=lambda _type: False,
        auto_subscribe=lambda _name, _type, _supported: True,
        monitor_subscriber_count=lambda _name, _type: 1,
    )

    assert externally_present == set()
    assert topics[0]['status'] == 'disconnected'
    assert topics[0]['raw_subscriber_count'] == 0
