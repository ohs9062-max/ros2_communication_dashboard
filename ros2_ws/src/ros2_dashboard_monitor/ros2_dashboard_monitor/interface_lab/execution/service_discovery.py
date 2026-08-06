"""Interface Lab Service 후보를 위한 ROS2 Graph discovery helper입니다."""

from __future__ import annotations

from typing import Any, Callable


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
