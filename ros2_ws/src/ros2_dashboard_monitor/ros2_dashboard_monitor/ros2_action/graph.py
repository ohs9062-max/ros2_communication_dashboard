"""rclpy Action Graph 조회와 server/client endpoint 집계를 담당합니다."""

from __future__ import annotations

import logging
from typing import Any, Callable

from rclpy.action.graph import (
    get_action_client_names_and_types_by_node,
    get_action_names_and_types,
    get_action_server_names_and_types_by_node,
)


LOGGER = logging.getLogger(__name__)
NamesAndTypes = list[tuple[str, list[str]]]


def read_action_names_and_types(node: Any) -> NamesAndTypes:
    """전체 Action Graph를 읽고 조회 실패 시 빈 목록을 반환합니다."""
    if node is None:
        return []
    try:
        return get_action_names_and_types(node)
    except Exception as exc:  # pragma: no cover
        LOGGER.warning('Failed to read action graph: %s', exc)
        return []


def action_count_maps(
    node: Any,
) -> tuple[dict[str, int], dict[str, int]]:
    """ROS Node별 Action server/client endpoint를 Action 이름별로 집계합니다."""
    if node is None:
        return {}, {}

    server_counts: dict[str, int] = {}
    client_counts: dict[str, int] = {}
    try:
        node_names = node.get_node_names_and_namespaces()
    except Exception as exc:  # pragma: no cover
        LOGGER.warning('Failed to read ROS2 node graph: %s', exc)
        return server_counts, client_counts

    for node_name, namespace in node_names:
        merge_action_counts(
            server_counts,
            action_servers_by_node(
                node,
                node_name,
                namespace,
            ),
        )
        merge_action_counts(
            client_counts,
            action_clients_by_node(
                node,
                node_name,
                namespace,
            ),
        )
    return server_counts, client_counts


def merge_action_counts(
    counts: dict[str, int],
    names_and_types: NamesAndTypes,
) -> None:
    """한 Node의 Action endpoint 목록을 이름별 count map에 더합니다."""
    for name, _types in names_and_types:
        counts[name] = counts.get(name, 0) + 1


def action_servers_by_node(
    node: Any,
    node_name: str,
    namespace: str,
) -> NamesAndTypes:
    """한 Node가 제공하는 Action server 목록을 안전하게 조회합니다."""
    return _names_by_node(
        node,
        node_name,
        namespace,
        reader=get_action_server_names_and_types_by_node,
        endpoint_kind='servers',
    )


def action_clients_by_node(
    node: Any,
    node_name: str,
    namespace: str,
) -> NamesAndTypes:
    """한 Node가 생성한 Action client 목록을 안전하게 조회합니다."""
    return _names_by_node(
        node,
        node_name,
        namespace,
        reader=get_action_client_names_and_types_by_node,
        endpoint_kind='clients',
    )


def _names_by_node(
    node: Any,
    node_name: str,
    namespace: str,
    *,
    reader: Callable[[Any, str, str], NamesAndTypes],
    endpoint_kind: str,
) -> NamesAndTypes:
    try:
        return reader(node, node_name, namespace)
    except Exception as exc:  # pragma: no cover
        LOGGER.debug(
            'Failed to read action %s for %s%s: %s',
            endpoint_kind,
            namespace,
            node_name,
            exc,
        )
        return []
