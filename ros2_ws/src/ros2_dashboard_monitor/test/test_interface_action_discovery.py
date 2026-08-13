from ros2_dashboard_monitor.interface_lab.execution.action_discovery import (
    build_callable_actions,
    find_allowed_action,
    registered_actions_from_registry,
)


def registered(action_type='demo_interfaces/action/Work', import_available=True):
    package_name, _, type_name = action_type.split('/')
    return {
        'file_name': f'{type_name}.action',
        'type_name': type_name,
        'action_type': action_type,
        'goal_schema': [],
        'result_schema': [],
        'feedback_schema': [],
        'import_available': import_available,
        'import_error': None,
        'source': 'single_upload',
        'package_name': package_name,
        'saved_path': None,
    }


def test_registered_actions_loads_missing_schema_and_appends_packages():
    package_action = registered('package_interfaces/action/Move')
    registry = {'actions': [{
        'file_name': 'Work.action',
        'type_name': 'Work',
        'build': {'interface_package': 'demo_interfaces', 'import_available': True},
        'parsed': {},
    }]}

    actions = registered_actions_from_registry(
        registry,
        [package_action],
        lambda action_type: ([{'name': action_type}], [{'name': 'result'}], [{'name': 'feedback'}]),
    )

    assert actions[0]['goal_schema'] == [{'name': 'demo_interfaces/action/Work'}]
    assert actions[1] is package_action


def test_callable_actions_exact_type_match_preserves_unmatched_registration():
    actions = build_callable_actions(
        [registered(), registered('other_interfaces/action/Work')],
        [{
            'name': '/work',
            'type': 'demo_interfaces/action/Work',
            'server_count': 1,
            'client_count': 2,
        }],
        lambda name: {'name': name},
    )

    assert actions['meta'] == {'count': 2, 'registered_count': 2, 'callable_count': 1}
    assert actions['actions'][0]['action_name'] == '/work'
    assert actions['actions'][0]['qos'] == {'name': '/work'}
    assert actions['actions'][1]['action_name'] == ''
    assert actions['actions'][1]['reason'] == 'Action server is not available.'


def test_allowed_action_requires_importable_exact_server():
    graph = [
        {'name': '/work', 'type': 'demo_interfaces/action/Work', 'server_count': 1},
        {'name': '/work', 'type': 'other_interfaces/action/Work', 'server_count': 2},
    ]

    assert find_allowed_action('/work', 'demo_interfaces/action/Work', [registered()], graph) == graph[0]
    assert find_allowed_action('/work', 'other_interfaces/action/Work', [registered()], graph) is None
    assert find_allowed_action(
        '/work', 'demo_interfaces/action/Work', [registered(import_available=False)], graph,
    ) is None
