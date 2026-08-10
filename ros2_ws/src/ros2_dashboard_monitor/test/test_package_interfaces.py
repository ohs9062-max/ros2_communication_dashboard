from ros2_dashboard_monitor.interface_lab.management.package_interfaces import (
    registered_actions,
    registered_messages,
    registered_services,
)


def _registry():
    return {
        'packages': [{
            'name': 'demo_interfaces',
            'import_error': 'package import failed',
            'interfaces': {
                'msg': [{
                    'file_name': 'State.msg',
                    'type_name': 'State',
                    'type': 'demo_interfaces/msg/State',
                    'parsed': [{'name': 'value', 'type': 'string'}],
                    'import_available': True,
                }],
                'srv': [{
                    'file_name': 'Read.srv',
                    'type_name': 'Read',
                    'type': 'demo_interfaces/srv/Read',
                    'parsed': {'request': [], 'response': [{'name': 'value'}]},
                    'import_available': False,
                    'import_error': 'service import failed',
                }],
                'action': [{
                    'file_name': 'Move.action',
                    'type_name': 'Move',
                    'type': 'demo_interfaces/action/Move',
                    'parsed': {'goal': [], 'result': [], 'feedback': [{'name': 'progress'}]},
                    'import_available': True,
                }],
            },
        }],
    }


def test_registered_message_projection_preserves_schema_and_import_state():
    item = registered_messages(_registry())[0]
    assert item['message_type'] == 'demo_interfaces/msg/State'
    assert item['message_schema'] == [{'name': 'value', 'type': 'string'}]
    assert item['import_available'] is True
    assert item['import_error'] == 'package import failed'


def test_registered_service_projection_prefers_interface_import_error():
    item = registered_services(_registry())[0]
    assert item['service_type'] == 'demo_interfaces/srv/Read'
    assert item['response_schema'] == [{'name': 'value'}]
    assert item['import_error'] == 'service import failed'


def test_registered_action_projection_preserves_three_schemas():
    item = registered_actions(_registry())[0]
    assert item['action_type'] == 'demo_interfaces/action/Move'
    assert item['goal_schema'] == []
    assert item['result_schema'] == []
    assert item['feedback_schema'] == [{'name': 'progress'}]
