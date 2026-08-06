"""Interface Lab Action 후보를 위한 ROS2 Graph discovery와 endpoint 집계입니다."""

from __future__ import annotations

from typing import Any, Callable


NamesAndTypes = list[tuple[str, list[str]]]
CountMap = dict[tuple[str, str], int]


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
