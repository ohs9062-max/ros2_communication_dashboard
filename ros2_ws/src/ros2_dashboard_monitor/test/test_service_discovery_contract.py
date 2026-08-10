from ros2_dashboard_monitor.interface_lab.execution.service_discovery import (
    build_callable_services,
    find_allowed_service,
    registered_services_from_registry,
)


def _registered():
    return [{
        'file_name': 'Read.srv',
        'type_name': 'Read',
        'service_type': 'demo_interfaces/srv/Read',
        'request_schema': [],
        'response_schema': [],
        'import_available': True,
        'import_error': None,
    }]


def test_registered_service_uses_generated_schema_when_registry_schema_is_empty():
    registry = {'services': [{
        'file_name': 'Read.srv',
        'type_name': 'Read',
        'parsed': {'request': [], 'response': []},
        'build': {
            'interface_package': 'demo_interfaces',
            'import_available': True,
        },
    }]}
    services = registered_services_from_registry(
        registry,
        [],
        lambda _type: ([{'name': 'key'}], [{'name': 'value'}]),
    )
    assert services[0]['request_schema'] == [{'name': 'key'}]
    assert services[0]['response_schema'] == [{'name': 'value'}]


def test_callable_service_requires_exact_type_and_server():
    graph = [{
        'name': '/read',
        'type': 'demo_interfaces/srv/Read',
        'server_count': 1,
        'client_count': 2,
    }]
    response = build_callable_services(_registered(), graph, {'qos_status': 'unknown'})
    assert response['meta']['callable_count'] == 1
    assert response['services'][0]['service_name'] == '/read'
    assert response['services'][0]['qos_status'] == 'unknown'


def test_allowed_service_rejects_unregistered_or_serverless_target():
    graph = [{
        'name': '/read',
        'type': 'demo_interfaces/srv/Read',
        'server_count': 0,
        'client_count': 0,
    }]
    assert find_allowed_service('/read', 'demo_interfaces/srv/Read', _registered(), graph) is None
    graph[0]['server_count'] = 1
    assert find_allowed_service('/read', 'other/srv/Read', _registered(), graph) is None
