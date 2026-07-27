import pytest

from ros2_dashboard_backend.interface_lab.execution.service_call_runtime import (
    ServiceCallError,
    ServiceCallRuntime,
)


def test_validation_error_does_not_create_service_client(monkeypatch):
    from rths_interfaces.srv import ScheduleCrud
    import ros2_dashboard_backend.interface_lab.execution.service_call_runtime as call_runtime

    runtime = ServiceCallRuntime(lock=None, node_getter=lambda: object())
    runtime._lock = _NoopLock()
    runtime._allowed_service = lambda service_name, service_type: {
        'name': service_name,
        'type': service_type,
        'server_count': 1,
    }
    monkeypatch.setattr(
        call_runtime,
        'load_service_class',
        lambda service_type: ScheduleCrud,
    )

    def fail_client(*args, **kwargs):
        raise AssertionError('client must not be created on validation error')

    runtime._client = fail_client

    result = runtime.call_service(
        service_name='/ScheduleCrud',
        service_type='rths_interfaces/srv/ScheduleCrud',
        request_data={
            'cmd': 'abc',
            'table_name': 'cleaning_schedule',
            'items': [],
            'only_active': True,
            'where': '',
            'options': '',
        },
        timeout_sec=1.0,
    )

    assert result['success'] is False
    assert result['called'] is False
    assert result['sent_to_server'] is False
    assert result['error_type'] == 'validation_error'
    assert runtime.history()['calls'][0]['error_type'] == 'validation_error'


def test_response_success_false_is_recorded_as_call_failure(monkeypatch):
    runtime = _callable_runtime(monkeypatch, response={'success': False, 'message': 'rejected'})

    result = runtime.call_service(
        service_name='/RobotControl',
        service_type='demo_interfaces/srv/RobotControl',
        request_data={},
        timeout_sec=1.0,
    )

    assert result['success'] is False
    assert result['error_type'] == 'response_failed'
    summary = runtime.summary_by_service()[
        ('/RobotControl', 'demo_interfaces/srv/RobotControl')
    ]
    assert summary['last_call_status'] == 'response_failed'
    assert summary['sent_to_server'] is True


def test_timeout_then_success_recovers_latest_call_status(monkeypatch):
    runtime = _callable_runtime(monkeypatch, completes=False)

    with pytest.raises(ServiceCallError, match='timeout'):
        runtime.call_service(
            service_name='/RobotControl',
            service_type='demo_interfaces/srv/RobotControl',
            request_data={},
            timeout_sec=0.001,
        )

    key = ('/RobotControl', 'demo_interfaces/srv/RobotControl')
    assert runtime.summary_by_service()[key]['last_call_status'] == 'timeout'

    runtime._client = lambda *_args: _FakeClient(
        _FakeFuture(response={'success': True}),
    )
    result = runtime.call_service(
        service_name='/RobotControl',
        service_type='demo_interfaces/srv/RobotControl',
        request_data={},
        timeout_sec=1.0,
    )

    assert result['success'] is True
    assert runtime.summary_by_service()[key]['last_call_status'] == 'success'


class _NoopLock:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class _FakeService:
    class Request:
        pass


class _FakeFuture:
    def __init__(self, *, response=None, completes=True):
        self._response = response
        self._completes = completes

    def add_done_callback(self, callback):
        if self._completes:
            callback(self)

    def result(self):
        return self._response


class _FakeClient:
    def __init__(self, future):
        self._future = future

    def service_is_ready(self):
        return True

    def call_async(self, _request):
        return self._future


def _callable_runtime(monkeypatch, *, response=None, completes=True):
    import ros2_dashboard_backend.interface_lab.execution.service_call_runtime as call_runtime

    runtime = ServiceCallRuntime(lock=_NoopLock(), node_getter=lambda: object())
    runtime._allowed_service = lambda *_args: {'server_count': 1}
    runtime._client = lambda *_args: _FakeClient(
        _FakeFuture(response=response, completes=completes),
    )
    monkeypatch.setattr(call_runtime, 'refresh_install_python_paths', lambda: None)
    monkeypatch.setattr(call_runtime, 'load_service_class', lambda _type: _FakeService)
    monkeypatch.setattr(call_runtime, 'build_ros_message', lambda *_args, **_kwargs: object())
    monkeypatch.setattr(call_runtime, 'ros_message_to_json', lambda value: value)
    return runtime
