from ros2_dashboard_backend.topology import (
    build_role_node_index,
    related_nodes,
)


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
