"""Interface Lab Service 후보를 위한 ROS2 Graph discovery helper입니다."""

from __future__ import annotations

from typing import Any, Callable


def registered_services_from_registry(
    registry: dict[str, Any],
    package_services: list[dict[str, Any]],
    schema_loader: Callable[[str], tuple[list[Any], list[Any]]],
) -> list[dict[str, Any]]:
    """Registry와 완성 package Service를 실행 후보 형식으로 정규화합니다."""
    services = []
    for item in registry.get('services', []):
        build = item.get('build') or {}
        package_name = build.get('interface_package')
        type_name = item.get('type_name')
        if not package_name or not type_name:
            continue
        service_type = f'{package_name}/srv/{type_name}'
        request_schema = item.get('parsed', {}).get('request', [])
        response_schema = item.get('parsed', {}).get('response', [])
        if build.get('import_available') is True and not request_schema:
            request_schema, response_schema = schema_loader(service_type)
        services.append({
            'file_name': item.get('file_name'),
            'type_name': type_name,
            'service_type': service_type,
            'request_schema': request_schema,
            'response_schema': response_schema,
            'saved_path': build.get('saved_path'),
            'import_available': build.get('import_available') is True,
            'import_error': build.get('import_error'),
            'source': item.get('source', 'single_upload'),
            'package_name': package_name,
        })
    services.extend(package_services)
    return services


def build_service_state(
    entry: dict[str, Any],
    graph_item: dict[str, Any] | None,
    qos: dict[str, Any],
) -> dict[str, Any]:
    """등록 정보와 exact Graph 항목을 공개 Service 실행 상태로 결합합니다."""
    server_count = int(graph_item.get('server_count') or 0) if graph_item else 0
    server_available = server_count > 0
    import_available = entry['import_available'] is True
    callable_now = import_available and server_available
    reason = None
    if not import_available:
        reason = entry.get('import_error') or 'The Service type could not be imported.'
    elif not server_available:
        reason = 'Service server is not available.'
    return {
        'service_name': graph_item['name'] if graph_item else '',
        'service_type': entry['service_type'],
        'file_name': entry['file_name'],
        'type_name': entry['type_name'],
        'request_schema': entry['request_schema'],
        'response_schema': entry['response_schema'],
        'import_available': import_available,
        'import_error': entry.get('import_error'),
        'server_available': server_available,
        'server_count': server_count,
        'client_count': int(graph_item.get('client_count') or 0) if graph_item else 0,
        'callable': callable_now,
        'reason': reason,
        'saved_path': entry.get('saved_path'),
        'source': entry.get('source', 'single_interface'),
        'package_name': entry.get('package_name'),
        **qos,
    }


def build_callable_services(
    registered: list[dict[str, Any]],
    graph: list[dict[str, Any]],
    qos: dict[str, Any],
) -> dict[str, Any]:
    """등록 type과 Graph type을 exact match해 callable Service 응답을 만듭니다."""
    services: list[dict[str, Any]] = []
    for entry in registered:
        matching = [item for item in graph if item['type'] == entry['service_type']]
        if not matching:
            services.append(build_service_state(entry, None, qos))
            continue
        services.extend(build_service_state(entry, item, qos) for item in matching)
    services.sort(key=lambda item: (item['service_type'], item['service_name']))
    return {
        'services': services,
        'meta': {
            'count': len(services),
            'registered_count': len(registered),
            'callable_count': sum(1 for item in services if item['callable']),
        },
    }


def find_allowed_service(
    service_name: str,
    service_type: str,
    registered: list[dict[str, Any]],
    graph: list[dict[str, Any]],
) -> dict[str, Any] | None:
    """Import 가능한 등록 type이며 정확한 server가 있는 Service만 반환합니다."""
    if not any(
        item['service_type'] == service_type and item['import_available'] is True
        for item in registered
    ):
        return None
    return next((
        item for item in graph
        if item['name'] == service_name
        and item['type'] == service_type
        and item['server_count'] > 0
    ), None)


def discover_service_graph(
    node_getter: Callable[[], Any],
    client_count_getter: Callable[[str], int],
) -> list[dict[str, Any]]:
    node = node_getter()
    if node is None:
        return []
    try:
        names_and_types = node.get_service_names_and_types()
    except Exception:
        return []
    graph = []
    for name, types in names_and_types:
        try:
            server_count = node.count_services(name)
        except Exception:
            server_count = 0
        for service_type in sorted(set(types)):
            graph.append({
                'name': name,
                'type': service_type,
                'server_count': server_count,
                'client_count': client_count_getter(name),
            })
    return graph


def count_service_clients(node_getter: Callable[[], Any], name: str) -> int:
    node = node_getter()
    if node is None:
        return 0
    count_clients = getattr(node, 'count_clients', None)
    if count_clients is None:
        return 0
    try:
        return count_clients(name)
    except Exception:
        return 0
