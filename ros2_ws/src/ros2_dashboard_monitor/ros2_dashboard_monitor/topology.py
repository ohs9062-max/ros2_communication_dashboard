"""ROS2 Graph의 Node-리소스-타입-역할 관계 집계를 담당합니다."""

from __future__ import annotations

from collections.abc import Iterable
from typing import Any


ROLE_ENTITY_FIELDS = {
    'topic_publisher': 'topic_publishers',
    'topic_subscriber': 'topic_subscribers',
    'service_server': 'service_servers',
    'service_client': 'service_clients',
    'action_server': 'action_servers',
    'action_client': 'action_clients',
}


def build_role_node_index(
    nodes: Iterable[dict[str, Any]],
) -> dict[tuple[str, str, str], set[str]]:
    """활성 Node snapshot을 역할/리소스/타입별 고유 Node 집합으로 변환합니다."""
    index: dict[tuple[str, str, str], set[str]] = {}
    for node in nodes:
        if node.get('graph_present') is False:
            continue
        node_name = str(node.get('full_name') or '')
        if not node_name:
            continue
        for role, field_name in ROLE_ENTITY_FIELDS.items():
            for entity in node.get(field_name) or []:
                resource_name = str(entity.get('name') or '')
                types = entity.get('types') or [entity.get('type')]
                for full_type in types:
                    if not resource_name or not full_type:
                        continue
                    key = (role, resource_name, str(full_type))
                    index.setdefault(key, set()).add(node_name)
    return index


def related_nodes(
    index: dict[tuple[str, str, str], set[str]],
    *,
    role: str,
    resource_name: str,
    resource_types: Iterable[str | None],
) -> list[str]:
    """하나의 리소스와 exact type/role로 연결된 고유 Node 이름을 반환합니다."""
    nodes: set[str] = set()
    for full_type in resource_types:
        if full_type:
            nodes.update(index.get((role, resource_name, str(full_type)), set()))
    return sorted(nodes)
