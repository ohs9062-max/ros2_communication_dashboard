from threading import Lock

from ros2_dashboard_monitor.monitor_config import MonitorConfig
from ros2_dashboard_monitor.ros2_action.runtime import ActionRuntime
from ros2_dashboard_monitor.ros2_node.runtime import NodeRuntime
from ros2_dashboard_monitor.ros2_service.runtime import ServiceRuntime


class _ServiceNode:
    visible = True

    def get_service_names_and_types(self):
        return [('/demo', ['example_interfaces/srv/Trigger'])] if self.visible else []

    def count_services(self, _name):
        return 1

    def count_clients(self, _name):
        return 0


class _NodeGraph:
    visible = True

    def get_node_names_and_namespaces(self):
        return [('demo', '/')] if self.visible else []

    def get_publisher_names_and_types_by_node(self, *_args): return []
    def get_subscriber_names_and_types_by_node(self, *_args): return []
    def get_service_names_and_types_by_node(self, *_args): return []
    def get_client_names_and_types_by_node(self, *_args): return []


def test_service_graph_missing_debounces_and_recovers(monkeypatch) -> None:
    node = _ServiceNode()
    times = iter((100.0, 101.0, 106.0, 107.0))
    monkeypatch.setattr('ros2_dashboard_monitor.ros2_service.runtime.time', lambda: next(times))
    runtime = ServiceRuntime(
        config=MonitorConfig(services_graph_missing_timeout_sec=5.0),
        lock=Lock(), node_getter=lambda: node,
    )

    assert runtime.update()[0]['status'] == 'active'
    node.visible = False
    pending = runtime.update()[0]
    assert pending['status'] == 'active'
    assert pending['graph_missing_pending'] is True
    assert runtime.update()[0]['status'] == 'disconnected'
    node.visible = True
    recovered = runtime.update()[0]
    assert recovered['status'] == 'active'
    assert recovered['graph_missing_pending'] is False


def test_action_graph_missing_debounces_and_recovers(monkeypatch) -> None:
    visible = {'value': True}
    times = iter((100.0, 101.0, 106.0, 107.0))
    monkeypatch.setattr('ros2_dashboard_monitor.ros2_action.runtime.time', lambda: next(times))
    monkeypatch.setattr(
        'ros2_dashboard_monitor.ros2_action.runtime.observe_action_qos',
        lambda *_args: {},
    )
    runtime = ActionRuntime(
        config=MonitorConfig(actions_graph_missing_timeout_sec=5.0),
        lock=Lock(), node_getter=lambda: object(),
    )
    runtime._action_names_and_types = lambda: (
        [('/demo', ['example_interfaces/action/Fibonacci'])] if visible['value'] else []
    )
    runtime._action_count_maps = lambda: ({'/demo': 1}, {}) if visible['value'] else ({}, {})
    runtime._ensure_subscriptions = lambda **_kwargs: {
        'status_supported': False, 'feedback_supported': False,
        'feedback_reason': None, 'result_supported': False,
        'result_policy': None, 'result_reason': None, 'qos': {},
    }
    runtime._runtime_snapshot = lambda _name: {}
    runtime._cleanup_disappeared_subscriptions = lambda _names: None
    runtime._result_runtime.update = lambda _actions: None

    assert runtime.update()[0]['status'] == 'active'
    visible['value'] = False
    assert runtime.update()[0]['status'] == 'active'
    assert runtime.update()[0]['status'] == 'disconnected'
    visible['value'] = True
    assert runtime.update()[0]['status'] == 'active'


def test_node_graph_missing_uses_stale_timeout_and_recovers(monkeypatch) -> None:
    node = _NodeGraph()
    times = iter((100.0, 101.0, 106.0, 107.0))
    monkeypatch.setattr('ros2_dashboard_monitor.ros2_node.runtime.time', lambda: next(times))
    runtime = NodeRuntime(
        exclude_names=(), exclude_prefixes=(), include_names=(), primary_names=('/demo',),
        lock=Lock(), node_getter=lambda: node, stale_timeout_sec=5.0,
    )
    runtime._action_servers_by_node = lambda *_args: []
    runtime._action_clients_by_node = lambda *_args: []

    assert runtime.update()[0]['status'] == 'active'
    node.visible = False
    assert runtime.update()[0]['status'] == 'active'
    assert runtime.update()[0]['status'] == 'disconnected'
    node.visible = True
    assert runtime.update()[0]['status'] == 'active'
