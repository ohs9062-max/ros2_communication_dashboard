from ros2_dashboard_monitor.interface_lab.facade import InterfaceLabFacade


class RuntimeSpy:
    def __init__(self):
        self.calls = []

    def __getattr__(self, name):
        def call(*args, **kwargs):
            self.calls.append((name, args, kwargs))
            return {'method': name, 'args': args, 'kwargs': kwargs}
        return call


def facade():
    value = InterfaceLabFacade()
    value._service_call_runtime = RuntimeSpy()
    value._action_goal_runtime = RuntimeSpy()
    value._receive_runtime = RuntimeSpy()
    return value


def test_service_facade_preserves_exact_call_arguments():
    value = facade()
    result = value.call_service(
        service_name='/add',
        service_type='example_interfaces/srv/AddTwoInts',
        request_data={'a': 1, 'b': 2},
        timeout_sec=2.5,
    )
    assert result['method'] == 'call_service'
    assert result['kwargs'] == {
        'service_name': '/add',
        'service_type': 'example_interfaces/srv/AddTwoInts',
        'request_data': {'a': 1, 'b': 2},
        'timeout_sec': 2.5,
    }


def test_action_facade_preserves_goal_and_cancel_arguments():
    value = facade()
    goal = value.send_action_goal(
        action_name='/work', action_type='demo/action/Work',
        goal_data={'count': 3}, timeout_sec=4.0,
    )
    cancel = value.cancel_action_goal(
        action_name='/work', action_type='demo/action/Work', timeout_sec=1.0,
    )
    assert goal['kwargs']['goal_data'] == {'count': 3}
    assert cancel['method'] == 'cancel_goal'
    assert cancel['kwargs']['timeout_sec'] == 1.0


def test_topic_facade_preserves_receive_publish_and_history_filters():
    value = facade()
    receive = value.start_receive_topic(
        topic_name='/value', topic_type='demo/msg/Value', history_limit=42,
    )
    publish = value.start_continuous_topic_publish(
        topic_name='/value', topic_type='demo/msg/Value',
        payload={'data': 7}, hz=5.0,
    )
    history = value.receive_topic_history(
        topic_name='/value', topic_type='demo/msg/Value', limit=10,
    )
    assert receive['kwargs']['history_limit'] == 42
    assert publish['method'] == 'start_continuous_publish'
    assert publish['kwargs']['hz'] == 5.0
    assert history['kwargs']['limit'] == 10
