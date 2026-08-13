"""Interface Lab Action 후보를 위한 ROS2 Graph discovery와 endpoint 집계입니다."""

from __future__ import annotations

from typing import Any, Callable


NamesAndTypes = list[tuple[str, list[str]]]
CountMap = dict[tuple[str, str], int]


def registered_actions_from_registry(
    registry: dict[str, Any],
    package_actions: list[dict[str, Any]],
    schema_loader: Callable[[str], tuple[list[Any], list[Any], list[Any]]],
) -> list[dict[str, Any]]:
    """Registry와 완성 package Action을 실행 후보 형식으로 정규화합니다."""
    actions = []
    for item in registry.get('actions', []):
        build = item.get('build') or {}
        package_name = build.get('interface_package')
        type_name = item.get('type_name')
        if not package_name or not type_name:
            continue
        action_type = f'{package_name}/action/{type_name}'
        goal_schema = item.get('parsed', {}).get('goal', [])
        result_schema = item.get('parsed', {}).get('result', [])
        feedback_schema = item.get('parsed', {}).get('feedback', [])
        if build.get('import_available') is True and not goal_schema:
            goal_schema, result_schema, feedback_schema = schema_loader(action_type)
        actions.append({
            'file_name': item.get('file_name'),
            'type_name': type_name,
            'action_type': action_type,
            'goal_schema': goal_schema,
            'result_schema': result_schema,
            'feedback_schema': feedback_schema,
            'saved_path': build.get('saved_path'),
            'import_available': build.get('import_available') is True,
            'import_error': build.get('import_error'),
            'source': item.get('source', 'single_upload'),
            'package_name': package_name,
        })
    actions.extend(package_actions)
    return actions


def build_action_state(
    entry: dict[str, Any],
    graph_item: dict[str, Any] | None,
    qos_getter: Callable[[str], dict[str, Any]],
) -> dict[str, Any]:
    """등록 정보와 정확히 일치하는 Graph 항목을 공개 실행 상태로 결합합니다."""
    server_count = int(graph_item.get('server_count') or 0) if graph_item else 0
    server_available = server_count > 0
    import_available = entry['import_available'] is True
    callable_now = import_available and server_available
    reason = None
    if not import_available:
        reason = entry.get('import_error') or 'The Action type could not be imported.'
    elif not server_available:
        reason = 'Action server is not available.'
    return {
        'action_name': graph_item['name'] if graph_item else '',
        'action_type': entry['action_type'],
        'full_type': entry['action_type'],
        'graph_type': graph_item['type'] if graph_item else None,
        'selected_import_type': entry['action_type'],
        'file_name': entry['file_name'],
        'type_name': entry['type_name'],
        'goal_schema': entry['goal_schema'],
        'result_schema': entry['result_schema'],
        'feedback_schema': entry['feedback_schema'],
        'import_available': import_available,
        'import_error': entry.get('import_error'),
        'server_available': server_available,
        'server_count': server_count,
        'client_count': int(graph_item.get('client_count') or 0) if graph_item else 0,
        'callable': callable_now,
        'executable': callable_now,
        'reason': reason,
        'qos': qos_getter(graph_item['name'] if graph_item else ''),
        'saved_path': entry.get('saved_path'),
        'source': entry.get('source', 'single_interface'),
        'package_name': entry.get('package_name'),
    }


def build_callable_actions(
    registered: list[dict[str, Any]],
    graph: list[dict[str, Any]],
    qos_getter: Callable[[str], dict[str, Any]],
) -> dict[str, Any]:
    """등록 type과 Graph type을 exact match해 callable Action 응답을 만듭니다."""
    actions: list[dict[str, Any]] = []
    for entry in registered:
        matching = [item for item in graph if item['type'] == entry['action_type']]
        if not matching:
            actions.append(build_action_state(entry, None, qos_getter))
            continue
        actions.extend(build_action_state(entry, item, qos_getter) for item in matching)
    actions.sort(key=lambda item: (item['action_type'], item['action_name']))
    return {
        'actions': actions,
        'meta': {
            'count': len(actions),
            'registered_count': len(registered),
            'callable_count': sum(1 for item in actions if item['callable']),
        },
    }


def find_allowed_action(
    action_name: str,
    action_type: str,
    registered: list[dict[str, Any]],
    graph: list[dict[str, Any]],
) -> dict[str, Any] | None:
    """import 가능한 등록 type이며 정확한 server가 있는 Action만 반환합니다."""
    if not any(
        item['action_type'] == action_type and item['import_available'] is True
        for item in registered
    ):
        return None
    return next((
        item for item in graph
        if item['name'] == action_name
        and item['type'] == action_type
        and item['server_count'] > 0
    ), None)


def discover_action_graph(
    node_getter: Callable[[], Any],
    graph_query: Callable[[Any], NamesAndTypes],
    count_maps_getter: Callable[[], tuple[CountMap, CountMap]],
) -> list[dict[str, Any]]:
    node = node_getter()
    if node is None:
        return []
    try:
        names_and_types = graph_query(node)
    except Exception:
        return []
    server_counts, client_counts = count_maps_getter()
    return [
        {
            'name': name,
            'type': action_type,
            'server_count': server_counts.get((name, action_type), 0),
            'client_count': client_counts.get((name, action_type), 0),
        }
        for name, types in names_and_types
        for action_type in sorted(set(types))
    ]


def build_action_count_maps(
    node_getter: Callable[[], Any],
    server_query: Callable[[str, str], NamesAndTypes],
    client_query: Callable[[str, str], NamesAndTypes],
) -> tuple[CountMap, CountMap]:
    node = node_getter()
    if node is None:
        return {}, {}
    server_counts: CountMap = {}
    client_counts: CountMap = {}
    try:
        node_names = node.get_node_names_and_namespaces()
    except Exception:
        return server_counts, client_counts
    for node_name, namespace in node_names:
        merge_action_counts(server_counts, server_query(node_name, namespace))
        merge_action_counts(client_counts, client_query(node_name, namespace))
    return server_counts, client_counts


def query_action_endpoints(
    node_getter: Callable[[], Any],
    query: Callable[[Any, str, str], NamesAndTypes],
    node_name: str,
    namespace: str,
) -> NamesAndTypes:
    node = node_getter()
    if node is None:
        return []
    try:
        return query(node, node_name, namespace)
    except Exception:
        return []


def merge_action_counts(counts: CountMap, names_and_types: NamesAndTypes) -> None:
    for name, types in names_and_types:
        for action_type in set(types):
            key = (name, action_type)
            counts[key] = counts.get(key, 0) + 1
