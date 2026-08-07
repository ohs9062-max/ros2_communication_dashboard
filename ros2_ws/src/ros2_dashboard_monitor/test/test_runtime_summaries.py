from ros2_dashboard_monitor.interface_lab.execution.action_goal_runtime import ActionGoalRuntime
from ros2_dashboard_monitor.interface_lab.execution.service_call_runtime import ServiceCallRuntime
from ros2_dashboard_monitor.interface_lab.execution.service_discovery import discover_service_graph
from ros2_dashboard_monitor.ros_monitor import _service_effective_status


def test_service_history_summary_includes_validation_not_sent():
    runtime = ServiceCallRuntime(lock=_NoopLock(), node_getter=lambda: None)
    runtime._record_history({
        'success': False,
        'service_name': '/ScheduleCrud',
        'service_type': 'rths_interfaces/srv/ScheduleCrud',
        'request': {'cmd': 'bad'},
        'response': None,
        'elapsed_ms': 1.2,
        'called_at': 10.0,
        'called': False,
        'sent_to_server': False,
        'error_type': 'validation_error',
        'error': 'bad cmd',
        'details': ['request.cmd: expected integer'],
    })

    summary = runtime.summary_by_service()[('/ScheduleCrud', 'rths_interfaces/srv/ScheduleCrud')]

    assert summary['last_call_status'] == 'validation_error'
    assert summary['sent_to_server'] is False
    assert summary['failure_count'] == 1
    assert summary['history'][0]['last_error'] == 'bad cmd'
    assert summary['requester_node'] == {
        'name': '/ros2_dashboard_topic_monitor',
        'display_name': 'Dashboard Interface Lab',
        'is_internal': True,
    }


def test_service_receive_history_and_reset_are_runtime_owned():
    runtime = ServiceCallRuntime(lock=_NoopLock(), node_getter=lambda: None)
    runtime._record_history({
        'success': True,
        'service_name': '/ScheduleCrud',
        'service_type': 'rths_interfaces/srv/ScheduleCrud',
        'request': {'cmd': 1},
        'response': {'ok': True},
        'elapsed_ms': 1.2,
        'called_at': 10.0,
        'called': True,
        'sent_to_server': True,
    })

    history = runtime.receive_history()

    assert history['meta']['count'] == 1
    assert history['history'][0]['direction'] == 'service_response'
    assert history['history'][0]['requester_node']['is_internal'] is True
    assert runtime.reset_receive_history(service_name='/ScheduleCrud', service_type='rths_interfaces/srv/ScheduleCrud') == {
        'cleared': 1,
    }
    assert runtime.receive_history()['meta']['count'] == 0
    assert runtime.history()['meta']['count'] == 1


def test_service_effective_status_keeps_graph_and_call_results_separate():
    timeout_summary = {
        'last_call_status': 'timeout',
        'sent_to_server': True,
    }
    success_summary = {
        'last_call_status': 'success',
        'sent_to_server': True,
    }

    assert _service_effective_status(
        graph_status='active',
        server_count=1,
        summary=timeout_summary,
    ) == 'timeout'
    assert _service_effective_status(
        graph_status='active',
        server_count=1,
        summary=success_summary,
    ) == 'active'
    assert _service_effective_status(
        graph_status='waiting_server',
        server_count=0,
        summary=timeout_summary,
    ) == 'waiting_server'


def test_service_discovery_preserves_each_exact_type_and_counts():
    class Node:
        def get_service_names_and_types(self):
            return [('/demo', ['pkg/srv/B', 'pkg/srv/A', 'pkg/srv/A'])]

        def count_services(self, name):
            assert name == '/demo'
            return 2

    graph = discover_service_graph(lambda: Node(), lambda name: 3 if name == '/demo' else 0)

    assert graph == [
        {'name': '/demo', 'type': 'pkg/srv/A', 'server_count': 2, 'client_count': 3},
        {'name': '/demo', 'type': 'pkg/srv/B', 'server_count': 2, 'client_count': 3},
    ]


def test_action_history_summary_includes_result_and_feedback():
    runtime = ActionGoalRuntime(lock=_NoopLock(), node_getter=lambda: None)
    runtime._record_history({
        'success': True,
        'action_name': '/CanControl',
        'action_type': 'rths_interfaces/action/CanControl',
        'goal': {'node_id': 1},
        'accepted': True,
        'feedback': [{'stage': 'sending'}],
        'result': {'success': True},
        'elapsed_ms': 12.0,
        'sent_at': 20.0,
        'sent_to_server': True,
    })

    summary = runtime.summary_by_action()[('/CanControl', 'rths_interfaces/action/CanControl')]

    assert summary['status'] == 'success'
    assert summary['last_feedback_preview'] == {'stage': 'sending'}
    assert summary['last_result_preview'] == {'success': True}
    assert summary['success_count'] == 1
    assert summary['requester_node']['display_name'] == 'Dashboard Interface Lab'


def test_action_receive_history_and_reset_are_runtime_owned():
    runtime = ActionGoalRuntime(lock=_NoopLock(), node_getter=lambda: None)
    runtime._record_history({
        'success': True,
        'action_name': '/CanControl',
        'action_type': 'rths_interfaces/action/CanControl',
        'goal': {'node_id': 1},
        'accepted': True,
        'feedback': [{'stage': 'sending'}],
        'result': {'success': True},
        'elapsed_ms': 12.0,
        'sent_at': 20.0,
        'sent_to_server': True,
    })

    history = runtime.receive_history()

    assert history['meta']['count'] == 2
    assert [item['direction'] for item in history['history']] == [
        'action_feedback',
        'action_result',
    ]
    assert all(item['requester_node']['is_internal'] for item in history['history'])
    assert runtime.reset_receive_history(action_name='/CanControl', action_type='rths_interfaces/action/CanControl') == {
        'cleared': 2,
    }
    assert runtime.receive_history()['meta']['count'] == 0
    assert runtime.history()['meta']['count'] == 1


def test_action_graph_preserves_each_type_and_exact_type_counts():
    runtime = ActionGoalRuntime(lock=_NoopLock(), node_getter=lambda: object())
    runtime._action_count_maps = lambda: (
        {
            ('/CanControl', 'can_interfaces/action/CanControl'): 1,
            ('/CanControl', 'rths_interfaces/action/CanControl'): 2,
        },
        {
            ('/CanControl', 'rths_interfaces/action/CanControl'): 1,
        },
    )
    runtime._action_servers_by_node = lambda _name, _namespace: []
    runtime._action_clients_by_node = lambda _name, _namespace: []

    import ros2_dashboard_monitor.interface_lab.execution.action_goal_runtime as goal_runtime

    original = goal_runtime.get_action_names_and_types
    goal_runtime.get_action_names_and_types = lambda _node: [
        (
            '/CanControl',
            [
                'can_interfaces/action/CanControl',
                'rths_interfaces/action/CanControl',
            ],
        ),
    ]
    try:
        graph = runtime._action_graph()
    finally:
        goal_runtime.get_action_names_and_types = original

    assert graph == [
        {
            'name': '/CanControl',
            'type': 'can_interfaces/action/CanControl',
            'server_count': 1,
            'client_count': 0,
        },
        {
            'name': '/CanControl',
            'type': 'rths_interfaces/action/CanControl',
            'server_count': 2,
            'client_count': 1,
        },
    ]


def test_action_client_cache_is_keyed_by_name_and_type():
    created = []
    runtime = ActionGoalRuntime(lock=_NoopLock(), node_getter=lambda: object())

    import ros2_dashboard_monitor.interface_lab.execution.action_goal_runtime as goal_runtime

    original = goal_runtime.ActionClient
    goal_runtime.ActionClient = lambda _node, action_class, name, **_kwargs: created.append(
        (name, action_class),
    ) or object()
    try:
        rths_client = runtime._client(
            '/CanControl',
            'rths_interfaces/action/CanControl',
            'rths-class',
        )
        can_client = runtime._client(
            '/CanControl',
            'can_interfaces/action/CanControl',
            'can-class',
        )
        assert runtime._client(
            '/CanControl',
            'rths_interfaces/action/CanControl',
            'rths-class',
        ) is rths_client
    finally:
        goal_runtime.ActionClient = original

    assert rths_client is not can_client
    assert created == [
        ('/CanControl', 'rths-class'),
        ('/CanControl', 'can-class'),
    ]


class _NoopLock:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False
