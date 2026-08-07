from ros2_dashboard_monitor.ros2_topic.monitor_status_alerts import monitor_status_alert


MONITOR_STATUS_TYPE = 'ros2_dashboard_interfaces/msg/MonitorStatus'


def test_monitor_status_warning_is_converted_with_stable_identity():
    topic = {'name': '/monitor/status', 'types': [MONITOR_STATUS_TYPE]}
    subscriptions = {'/monitor/status': {
        'last_received_at': 8.0,
        'message_preview': {
            'level': ' WARNING ',
            'device_name': 'motor',
            'node_name': '/controller',
            'status': 'hot',
            'message': 'Motor temperature is high.',
            'values': [{'key': 'temperature', 'value': '85'}],
        },
    }}

    alert = monitor_status_alert(topic=topic, subscriptions=subscriptions, detected_at=10.5)

    assert alert['id'] == 'monitor_status:/monitor/status:motor:warning:hot'
    assert alert['code'] == 'monitor_status_warning'
    assert alert['age_sec'] == 2.5
    assert alert['values'] == [{'key': 'temperature', 'value': '85'}]


def test_monitor_status_ignores_normal_level_and_unrelated_topic_type():
    normal = {'/monitor/status': {'message_preview': {'level': 'info'}}}
    assert monitor_status_alert(
        topic={'name': '/monitor/status', 'types': [MONITOR_STATUS_TYPE]},
        subscriptions=normal,
        detected_at=1.0,
    ) is None
    assert monitor_status_alert(
        topic={'name': '/monitor/status', 'types': ['std_msgs/msg/String']},
        subscriptions=normal,
        detected_at=1.0,
    ) is None
