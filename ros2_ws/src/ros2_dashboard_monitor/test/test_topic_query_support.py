"""Topic latest/Hz query helper의 공개 계약 회귀 테스트입니다."""

from threading import Lock
from time import time

from example_interfaces.msg import String

from ros2_dashboard_monitor.ros2_topic.query_support import (
    build_topic_hz_response,
    hz_response,
    latest_response,
    load_message_class,
)


def test_message_class_loader_accepts_only_message_type_syntax() -> None:
    assert load_message_class('example_interfaces/msg/String') is String
    assert load_message_class('example_interfaces/srv/AddTwoInts') is None
    assert load_message_class('missing/msg/Unknown') is None


def test_latest_and_hz_response_keys_remain_stable() -> None:
    latest = latest_response(
        success=True,
        name='/demo',
        topic_type='example_interfaces/msg/String',
        received=True,
        last_received_at=1.5,
        message_preview={'data': 'hello'},
        message='ok',
    )
    hz = hz_response(success=False, name='/demo', message='not found')

    assert latest == {
        'success': True,
        'data': {
            'name': '/demo',
            'type': 'example_interfaces/msg/String',
            'received': True,
            'last_received_at': 1.5,
            'message_preview': {'data': 'hello'},
        },
        'message': 'ok',
    }
    assert hz['data'] == {
        'name': '/demo',
        'type': None,
        'received': False,
        'message_count': 0,
        'window_sec': 5.0,
        'hz': 0.0,
        'last_received_at': None,
        'age_sec': None,
        'is_stale': False,
        'status': 'never_received',
    }


def test_hz_response_prunes_old_timestamps_and_reports_recent_rate() -> None:
    now = time()
    subscriptions = {
        '/demo': {
            'timestamps': [now - 10.0, now - 0.2, now - 0.1],
            'last_received_at': now - 0.1,
        },
    }

    response = build_topic_hz_response(
        lock=Lock(),
        subscriptions=subscriptions,
        name='/demo',
        topic_type='example_interfaces/msg/String',
        window_sec=1.0,
        stale_timeout_sec=2.0,
    )

    assert response['success'] is True
    assert response['data']['received'] is True
    assert response['data']['message_count'] == 2
    assert response['data']['hz'] > 0
    assert len(subscriptions['/demo']['timestamps']) == 2
