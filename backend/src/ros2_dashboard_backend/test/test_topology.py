from ros2_dashboard_backend.topology import (
    build_role_node_index,
    related_nodes,
)
from ros2_dashboard_backend.config_loader import MonitorConfig
from ros2_dashboard_backend.ros_monitor import RosMonitor


def _entity(name: str, full_type: str) -> dict:
    return {'name': name, 'type': full_type, 'types': [full_type]}


def test_role_node_index_is_a_reversible_unique_relationship_map() -> None:
    nodes = [
        {
            'full_name': '/demo_robot_control_service',
            'graph_present': True,
            'topic_publishers': [],
            'topic_subscribers': [],
            'service_servers': [
                _entity('/RobotControl', 'rths_interfaces/srv/RobotControl'),
            ],
            'service_clients': [],
            'action_servers': [],
            'action_clients': [],
        },
        {
            'full_name': '/ros2_dashboard_topic_monitor',
            'graph_present': True,
            'topic_publishers': [],
            'topic_subscribers': [],
            'service_servers': [],
            'service_clients': [
                _entity('/RobotControl', 'rths_interfaces/srv/RobotControl'),
            ],
            'action_servers': [],
            'action_clients': [
                _entity('/CanControl', 'rths_interfaces/action/CanControl'),
            ],
        },
        {
            'full_name': '/demo_can_control_server',
            'graph_present': True,
            'topic_publishers': [],
            'topic_subscribers': [],
            'service_servers': [],
            'service_clients': [],
            'action_servers': [
                _entity('/CanControl', 'rths_interfaces/action/CanControl'),
            ],
            'action_clients': [],
        },
    ]

    index = build_role_node_index(nodes)

    assert related_nodes(
        index,
        role='service_server',
        resource_name='/RobotControl',
        resource_types=['rths_interfaces/srv/RobotControl'],
    ) == ['/demo_robot_control_service']
    assert related_nodes(
        index,
        role='service_client',
        resource_name='/RobotControl',
        resource_types=['rths_interfaces/srv/RobotControl'],
    ) == ['/ros2_dashboard_topic_monitor']
    assert related_nodes(
        index,
        role='action_server',
        resource_name='/CanControl',
        resource_types=['rths_interfaces/action/CanControl'],
    ) == ['/demo_can_control_server']
    assert related_nodes(
        index,
        role='action_client',
        resource_name='/CanControl',
        resource_types=['rths_interfaces/action/CanControl'],
    ) == ['/ros2_dashboard_topic_monitor']


def test_role_node_index_deduplicates_and_excludes_disconnected_nodes() -> None:
    relation = _entity(
        '/demo_cleaning_schedule',
        'rths_interfaces/msg/CleaningSchedule',
    )
    nodes = [
        {
            'full_name': '/ros2_dashboard_topic_monitor',
            'graph_present': True,
            'topic_publishers': [],
            'topic_subscribers': [relation, relation],
            'service_servers': [],
            'service_clients': [],
            'action_servers': [],
            'action_clients': [],
        },
        {
            'full_name': '/old_subscriber',
            'graph_present': False,
            'topic_publishers': [],
            'topic_subscribers': [relation],
            'service_servers': [],
            'service_clients': [],
            'action_servers': [],
            'action_clients': [],
        },
    ]

    index = build_role_node_index(nodes)

    assert related_nodes(
        index,
        role='topic_subscriber',
        resource_name='/demo_cleaning_schedule',
        resource_types=['rths_interfaces/msg/CleaningSchedule'],
    ) == ['/ros2_dashboard_topic_monitor']


def test_node_snapshot_marks_only_the_dashboard_node_as_internal() -> None:
    monitor = RosMonitor.__new__(RosMonitor)
    monitor._node = _MonitorNode()
    monitor._node_runtime = _NodeRuntime()

    nodes = monitor.node_snapshot()['nodes']

    assert nodes == [
        {
            'full_name': '/ros2_dashboard_topic_monitor',
            'is_internal': True,
            'primary': False,
            'system_primary': False,
            'user_primary': False,
            'is_primary': False,
        },
        {
            'full_name': '/robot',
            'is_internal': False,
            'primary': False,
            'system_primary': False,
            'user_primary': False,
            'is_primary': False,
        },
    ]


def test_resource_snapshots_exclude_dashboard_node_from_topology_counts() -> None:
    monitor = RosMonitor.__new__(RosMonitor)
    monitor._config = MonitorConfig()
    monitor._node = _MonitorNode()
    monitor._node_runtime = _RelationNodeRuntime()
    monitor._topic_runtime = _TopicRuntime()
    monitor._service_runtime = _ServiceRuntime()
    monitor._service_call_runtime = _ExecutionRuntime()
    monitor._action_runtime = _ActionRuntime()
    monitor._action_goal_runtime = _ExecutionRuntime()
    monitor._receive_runtime = _ReceiveRuntime()

    topic = monitor.snapshot()['topics'][0]
    service = monitor.service_snapshot()['services'][0]
    action = monitor.action_snapshot()['actions'][0]

    assert topic['total_publisher_node_count'] == 2
    assert topic['publisher_node_count'] == 1
    assert topic['total_subscriber_node_count'] == 2
    assert topic['subscriber_node_count'] == 1
    assert topic['subscriber_nodes'] == ['/robot']
    assert topic['external_subscriber_node_count'] == 1
    assert topic['dashboard_communication'] == {
        'auto_monitoring_active': True,
        'interface_receive_active': True,
        'interface_publisher_created': True,
    }

    assert service['total_server_node_count'] == 2
    assert service['server_node_count'] == 1
    assert service['total_client_node_count'] == 2
    assert service['client_node_count'] == 1
    assert service['client_nodes'] == ['/robot']
    assert service['dashboard_communication'] == {
        'interface_client_created': True,
        'has_call_history': False,
    }

    assert action['total_server_node_count'] == 2
    assert action['server_node_count'] == 1
    assert action['total_client_node_count'] == 2
    assert action['client_node_count'] == 1
    assert action['client_nodes'] == ['/robot']
    assert action['dashboard_communication'] == {
        'monitoring_active': True,
        'status_monitoring_active': True,
        'feedback_monitoring_active': True,
        'interface_client_created': True,
        'has_goal_history': False,
    }


class _MonitorNode:
    def get_fully_qualified_name(self):
        return '/ros2_dashboard_topic_monitor'


class _NodeRuntime:
    def snapshot(self):
        return {
            'nodes': [
                {'full_name': '/ros2_dashboard_topic_monitor'},
                {'full_name': '/robot'},
            ],
            'meta': {},
        }


class _RelationNodeRuntime:
    def snapshot(self):
        topic = _entity('/demo', 'demo_msgs/msg/Demo')
        service = _entity('/Demo', 'demo_interfaces/srv/Demo')
        action = _entity('/DemoAction', 'demo_interfaces/action/Demo')
        return {
            'nodes': [
                _relation_node('/ros2_dashboard_topic_monitor', topic, service, action),
                _relation_node('/robot', topic, service, action),
            ],
            'meta': {},
        }


def _relation_node(full_name, topic, service, action):
    return {
        'full_name': full_name,
        'graph_present': True,
        'topic_publishers': [topic],
        'topic_subscribers': [topic],
        'service_servers': [service],
        'service_clients': [service],
        'action_servers': [action],
        'action_clients': [action],
    }


class _TopicRuntime:
    def snapshot(self):
        return {
            'topics': [{
                'name': '/demo',
                'types': ['demo_msgs/msg/Demo'],
                'publisher_count': 2,
                'subscriber_count': 2,
                'monitor_subscriber_count': 1,
                'external_subscriber_count': 1,
                'deep_monitoring': True,
            }],
            'meta': {},
        }


class _ServiceRuntime:
    def snapshot(self, *, include_hidden=False):
        return {
            'services': [{
                'name': '/Demo',
                'type': 'demo_interfaces/srv/Demo',
                'status': 'active',
                'server_count': 2,
                'client_count': 2,
            }],
            'meta': {},
        }


class _ActionRuntime:
    def snapshot(self):
        return {
            'actions': [{
                'name': '/DemoAction',
                'type': 'demo_interfaces/action/Demo',
                'server_count': 2,
                'client_count': 2,
                'status_supported': True,
                'feedback_supported': True,
            }],
            'meta': {},
        }


class _ExecutionRuntime:
    def summary_by_service(self):
        return {}

    def summary_by_action(self):
        return {}

    def callable_services(self):
        return {'services': []}

    def callable_actions(self):
        return {'actions': []}

    def dashboard_state_by_service(self):
        return {
            ('/Demo', 'demo_interfaces/srv/Demo'): {
                'interface_client_created': True,
            },
        }

    def dashboard_state_by_action(self):
        return {
            ('/DemoAction', 'demo_interfaces/action/Demo'): {
                'interface_client_created': True,
            },
        }


class _ReceiveRuntime:
    def dashboard_state_by_topic(self):
        return {
            ('/demo', 'demo_msgs/msg/Demo'): {
                'interface_receive_active': True,
                'interface_publisher_created': True,
            },
        }
