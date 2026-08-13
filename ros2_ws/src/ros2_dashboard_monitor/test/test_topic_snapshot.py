"""Topic 공개 snapshot 조립 책임의 회귀 테스트입니다."""

from ros2_dashboard_monitor.ros2_topic.snapshot import build_topic_snapshot


def test_snapshot_adds_missing_configured_topics_without_duplicates() -> None:
    snapshot = build_topic_snapshot(
        topics=[{
            'name': '/command',
            'supported_type': True,
            'registered_interface_type': False,
            'deep_monitoring': True,
            'graph_present': True,
        }],
        subscriptions={},
        subscription_errors={},
        last_updated=12.5,
        required_stream_names=('/scan',),
        command_names=('/command',),
    )

    assert snapshot['count'] == 2
    items = {item['name']: item for item in snapshot['topics']}
    assert items['/scan']['status'] == 'not_discovered'
    assert items['/scan']['monitoring_role'] == 'required_stream'
    assert items['/scan']['hz_monitoring_status'] == 'topic_not_discovered'
    assert items['/command']['monitoring_role'] == 'command'
    assert items['/command']['primary_priority'] == 2


def test_snapshot_exposes_latest_qos_and_subscription_error() -> None:
    qos = {
        'qos_status': 'compatible',
        'qos_detection_source': 'graph_profile_comparison',
        'local_qos': {'reliability': 'best_effort'},
        'remote_qos': [{'reliability': 'best_effort'}],
        'mismatch_policies': [],
        'mismatch_reason': None,
        'qos_auto_applied': True,
    }
    snapshot = build_topic_snapshot(
        topics=[{
            'name': '/camera',
            'supported_type': True,
            'registered_interface_type': True,
            'deep_monitoring': True,
            'graph_present': True,
        }],
        subscriptions={
            '/camera': {
                'message_preview': {'width': 640},
                'last_received_at': 10.0,
                'message_count': 3,
                'qos': qos,
            },
        },
        subscription_errors={'/camera': 'previous failure'},
        last_updated=12.5,
        required_stream_names=(),
        command_names=(),
    )

    topic = snapshot['topics'][0]
    assert topic['last_message_preview'] == {'width': 640}
    assert topic['message_count'] == 3
    assert topic['qos_status'] == 'compatible'
    assert topic['qos_auto_applied'] is True
    assert topic['last_error'] == 'previous failure'
    assert topic['monitoring_role'] == 'registered_interface'
    assert topic['primary_priority'] == 1


def test_snapshot_uses_unknown_qos_only_when_runtime_has_no_profile() -> None:
    snapshot = build_topic_snapshot(
        topics=[{
            'name': '/unconfigured',
            'supported_type': False,
            'registered_interface_type': False,
            'deep_monitoring': False,
            'graph_present': True,
        }],
        subscriptions={},
        subscription_errors={},
        last_updated=1.0,
        required_stream_names=(),
        command_names=(),
    )

    topic = snapshot['topics'][0]
    assert topic['qos_status'] == 'unknown'
    assert topic['qos_detection_source'] == 'unavailable'
    assert topic['remote_qos'] == []
    assert topic['primary'] is False
    assert topic['hz_monitoring_status'] == 'not_configured'


def test_snapshot_keeps_graph_endpoint_qos_with_auto_applied_local_qos() -> None:
    snapshot = build_topic_snapshot(
        topics=[{
            'name': '/camera',
            'supported_type': True,
            'registered_interface_type': False,
            'deep_monitoring': True,
            'graph_present': True,
            'publisher_qos': [{'qos': {'depth': 4}}],
            'subscriber_qos': [{'qos': {'depth': 8}}],
            'graph_qos_status': 'compatible',
        }],
        subscriptions={'/camera': {
            'qos': {
                'qos_status': 'compatible',
                'qos_detection_source': 'graph_profile_comparison',
                'local_qos': {'depth': 4},
                'remote_qos': [],
                'mismatch_policies': [],
                'mismatch_reason': None,
                'qos_auto_applied': True,
            },
        }},
        subscription_errors={},
        last_updated=2.0,
        required_stream_names=(),
        command_names=(),
    )

    topic = snapshot['topics'][0]
    assert topic['publisher_qos'][0]['qos']['depth'] == 4
    assert topic['subscriber_qos'][0]['qos']['depth'] == 8
    assert topic['graph_qos_status'] == 'compatible'
    assert topic['local_qos']['depth'] == 4
    assert topic['qos_auto_applied'] is True


def test_snapshot_exposes_one_effective_status_for_graph_and_reception_state() -> None:
    snapshot = build_topic_snapshot(
        topics=[
            {
                'name': '/never', 'status': 'active', 'supported_type': True,
                'deep_monitoring': True, 'graph_present': True,
            },
            {
                'name': '/stale', 'status': 'active', 'supported_type': True,
                'deep_monitoring': True, 'graph_present': True,
            },
            {
                'name': '/recent', 'status': 'active', 'supported_type': True,
                'deep_monitoring': True, 'graph_present': True,
            },
            {
                'name': '/graph-only', 'status': 'waiting_publisher',
                'supported_type': False, 'deep_monitoring': False,
                'graph_present': True,
            },
        ],
        subscriptions={
            '/never': {'last_received_at': None},
            '/stale': {'last_received_at': 5.0},
            '/recent': {'last_received_at': 9.0},
        },
        subscription_errors={},
        last_updated=10.0,
        required_stream_names=(),
        command_names=(),
        stale_timeout_sec=3.0,
    )

    statuses = {
        topic['name']: (topic['status'], topic['effective_status'])
        for topic in snapshot['topics']
    }
    assert statuses == {
        '/never': ('active', 'never_received'),
        '/stale': ('active', 'stale'),
        '/recent': ('active', 'active'),
        '/graph-only': ('waiting_publisher', 'waiting_publisher'),
    }
