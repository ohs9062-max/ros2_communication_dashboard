from threading import RLock

import pytest
from rclpy.action import GoalResponse

from ros2_dashboard_monitor.interface_lab.server.action_server_runtime import (
    ActionServerError,
    ActionServerRuntime,
)
from ros2_dashboard_monitor.interface_lab.server.service_server_runtime import (
    ServiceServerError,
    ServiceServerRuntime,
)
from ros2_dashboard_monitor.multi_domain_monitor import MultiDomainRosMonitor


class _Message:
    def __init__(self):
        self.value = 0

    def get_fields_and_field_types(self):
        return {'value': 'int32'}


class _BusinessResponse:
    def __init__(self):
        self.success = True
        self.result_code = 0
        self.message = ''

    def get_fields_and_field_types(self):
        return {'success': 'bool', 'result_code': 'int32', 'message': 'string'}


class _BusinessService:
    Request = _Message
    Response = _BusinessResponse


class _BusinessAction:
    Goal = _Message
    Feedback = _Message
    Result = _BusinessResponse


class _Service:
    Request = _Message
    Response = _Message


class _Action:
    Goal = _Message
    Feedback = _Message
    Result = _Message


class _ServiceNode:
    def __init__(self):
        self.callback = None
        self.destroyed = []

    def create_service(self, service_class, name, callback):
        self.callback = callback
        return (service_class, name)

    def destroy_service(self, entity):
        self.destroyed.append(entity)


def test_service_server_uses_registered_type_and_records_real_request_response():
    node = _ServiceNode()
    runtime = ServiceServerRuntime(
        lock=RLock(),
        node_getter=lambda: node,
        registered_types_getter=lambda: [{
            'service_type': 'demo/srv/Test', 'import_available': True,
            'response_schema': [{'name': 'value', 'type': 'int32'}],
        }],
        service_class_loader=lambda _type: _Service,
    )

    started = runtime.start(
        service_name='/test', service_type='demo/srv/Test', response_data={'value': 7},
    )
    response = node.callback(_request(3), _Message())

    assert started['server']['service_name'] == '/test'
    assert response.value == 7
    assert runtime.history()['history'][0]['request'] == {'value': 3}
    assert runtime.history()['history'][0]['response'] == {'value': 7}
    runtime.stop(service_name='/test', service_type='demo/srv/Test')
    assert node.destroyed
    assert runtime.history()['meta']['count'] == 1
    assert runtime.reset_history(service_name='/test', service_type='demo/srv/Test')['cleared'] == 1
    assert runtime.history()['meta']['count'] == 0


def test_service_server_rejects_unregistered_or_unimportable_type():
    runtime = ServiceServerRuntime(
        lock=RLock(), node_getter=lambda: _ServiceNode(),
        registered_types_getter=lambda: [], service_class_loader=lambda _type: _Service,
    )
    with pytest.raises(ServiceServerError, match='importable registered'):
        runtime.start(service_name='/test', service_type='demo/srv/Test', response_data={})


def test_service_server_does_not_treat_business_success_false_as_transport_failure():
    node = _ServiceNode()
    runtime = ServiceServerRuntime(
        lock=RLock(), node_getter=lambda: node,
        registered_types_getter=lambda: [{'service_type': 'demo/srv/Business', 'import_available': True}],
        service_class_loader=lambda _type: _BusinessService,
    )
    runtime.start(
        service_name='/business', service_type='demo/srv/Business',
        response_data={'success': False, 'result_code': 17, 'message': 'device-defined'},
    )

    response = node.callback(_request(1), _BusinessResponse())
    history = runtime.history()['history'][0]

    assert response.success is False
    assert history['status'] == 'responded'
    assert history['request'] == {'value': 1}
    assert history['response'] == {
        'success': False, 'result_code': 17, 'message': 'device-defined',
    }


class _FakeActionServer:
    def __init__(self, _node, _action_class, _name, **callbacks):
        self.callbacks = callbacks
        self.destroyed = False

    def destroy(self):
        self.destroyed = True


class _GoalHandle:
    def __init__(self, value=5, cancel=False):
        self.request = _request(value)
        self.is_cancel_requested = cancel
        self.feedback = []
        self.state = None

    def publish_feedback(self, feedback):
        self.feedback.append(feedback.value)

    def succeed(self):
        self.state = 'succeeded'

    def canceled(self):
        self.state = 'canceled'


def test_action_server_accepts_goal_publishes_feedback_and_returns_result():
    created = []

    def factory(*args, **kwargs):
        server = _FakeActionServer(*args, **kwargs)
        created.append(server)
        return server

    runtime = ActionServerRuntime(
        lock=RLock(), node_getter=lambda: object(),
        registered_types_getter=lambda: [{'action_type': 'demo/action/Test', 'import_available': True}],
        action_class_loader=lambda _type: _Action, server_factory=factory,
    )
    runtime.start(
        action_name='/test', action_type='demo/action/Test',
        feedback_data={'value': 4}, result_data={'value': 9}, result_delay_sec=0,
    )
    callbacks = created[0].callbacks
    assert callbacks['goal_callback'](_request(2)) is GoalResponse.ACCEPT
    handle = _GoalHandle()
    result = callbacks['execute_callback'](handle)

    assert handle.feedback == [4]
    assert handle.state == 'succeeded'
    assert result.value == 9
    assert runtime.history()['history'][0]['status'] == 'succeeded'
    runtime.stop(action_name='/test', action_type='demo/action/Test')
    assert runtime.history()['meta']['count'] == 2
    assert runtime.reset_history(action_name='/test', action_type='demo/action/Test')['cleared'] == 2
    assert runtime.history()['meta']['count'] == 0


def test_action_server_configured_reject_is_not_fake_active_state():
    created = []

    def factory(*args, **kwargs):
        server = _FakeActionServer(*args, **kwargs)
        created.append(server)
        return server

    runtime = ActionServerRuntime(
        lock=RLock(), node_getter=lambda: object(),
        registered_types_getter=lambda: [{'action_type': 'demo/action/Test', 'import_available': True}],
        action_class_loader=lambda _type: _Action, server_factory=factory,
    )
    runtime.start(
        action_name='/test', action_type='demo/action/Test', feedback_data={'value': 0},
        result_data={'value': 0}, accept_goals=False,
    )
    response = created[0].callbacks['goal_callback'](_request(8))
    assert response is GoalResponse.REJECT
    assert runtime.history()['history'][0]['status'] == 'rejected'


def test_action_server_does_not_interpret_result_success_payload():
    created = []

    def factory(*args, **kwargs):
        server = _FakeActionServer(*args, **kwargs)
        created.append(server)
        return server

    runtime = ActionServerRuntime(
        lock=RLock(), node_getter=lambda: object(),
        registered_types_getter=lambda: [{'action_type': 'demo/action/Business', 'import_available': True}],
        action_class_loader=lambda _type: _BusinessAction, server_factory=factory,
    )
    runtime.start(
        action_name='/business', action_type='demo/action/Business',
        feedback_data={'value': 4},
        result_data={'success': False, 'result_code': 23, 'message': 'device-defined'},
        result_delay_sec=0,
    )
    callbacks = created[0].callbacks
    assert callbacks['goal_callback'](_request(6)) is GoalResponse.ACCEPT
    handle = _GoalHandle(value=6)

    result = callbacks['execute_callback'](handle)
    history = runtime.history()['history'][0]

    assert handle.state == 'succeeded'
    assert result.success is False
    assert history['status'] == 'succeeded'
    assert history['goal'] == {'value': 6}
    assert history['feedback'] == {'value': 4}
    assert history['result'] == {
        'success': False, 'result_code': 23, 'message': 'device-defined',
    }


def test_action_server_rejects_unregistered_type():
    runtime = ActionServerRuntime(
        lock=RLock(), node_getter=lambda: object(), registered_types_getter=lambda: [],
        action_class_loader=lambda _type: _Action, server_factory=_FakeActionServer,
    )
    with pytest.raises(ActionServerError, match='importable registered'):
        runtime.start(
            action_name='/test', action_type='demo/action/Test',
            feedback_data={}, result_data={},
        )


def test_multi_domain_server_result_preserves_domain_resource_identity():
    tagged = MultiDomainRosMonitor._tag_server_result(
        {'success': True, 'server': {'service_name': '/test'}},
        99,
        name='/test',
        key='server',
    )
    assert tagged['server']['domain_id'] == 99
    assert tagged['server']['resource_key'] == '99:/test'


def _request(value):
    message = _Message()
    message.value = value
    return message
