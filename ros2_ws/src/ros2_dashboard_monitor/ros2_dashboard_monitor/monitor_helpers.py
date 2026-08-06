"""RosMonitor snapshot 조립에서 사용하는 순수 helper."""

from __future__ import annotations

from typing import Any

def without_internal_node(
    node_names: list[str],
    internal_node: str,
) -> list[str]:
    """Dashboard 내부 Node를 제외한 ROS2 통신 참여 Node를 반환합니다."""
    return [name for name in node_names if name != internal_node]


def dashboard_execution_node(internal_node: str) -> dict[str, Any]:
    return {
        'name': internal_node,
        'display_name': 'Dashboard Interface Lab',
        'is_internal': True,
    }


def runtime_state_map(runtime: Any, method_name: str) -> dict[Any, Any]:
    """선택 Runtime이 제공하는 Dashboard 통신 상태를 안전하게 읽습니다."""
    method = getattr(runtime, method_name, None)
    if not callable(method):
        return {}
    return method()


def system_primary_resources(
    *,
    topics: list[dict[str, Any]],
    services: list[dict[str, Any]],
    actions: list[dict[str, Any]],
) -> set[tuple[str, str, str]]:
    resources: set[tuple[str, str, str]] = set()
    for kind, items in (
        ('topic', topics),
        ('service', services),
        ('action', actions),
    ):
        for item in items:
            if item.get('system_primary') is not True:
                continue
            name = str(item.get('name') or '')
            types = item.get('types') or [item.get('type')]
            for full_type in types:
                if name and full_type:
                    resources.add((kind, name, str(full_type)))
    return resources


def node_uses_system_primary(
    node: dict[str, Any],
    resources: set[tuple[str, str, str]],
) -> bool:
    for kind, fields in (
        ('topic', ('topic_publishers', 'topic_subscribers')),
        ('service', ('service_servers', 'service_clients')),
        ('action', ('action_servers', 'action_clients')),
    ):
        for field in fields:
            for entity in node.get(field) or []:
                name = str(entity.get('name') or '')
                types = entity.get('types') or [entity.get('type')]
                if any(
                    (kind, name, str(full_type)) in resources
                    for full_type in types
                    if full_type
                ):
                    return True
    return False


def service_effective_status(
    *,
    graph_status: str | None,
    server_count: Any,
    summary: dict[str, Any] | None,
) -> str:
    status = str(graph_status or 'unknown')
    if status == 'disconnected' or int(server_count or 0) <= 0:
        return status

    if not summary or summary.get('sent_to_server') is not True:
        return status

    call_status = str(summary.get('last_call_status') or '')
    if call_status == 'timeout':
        return 'timeout'
    if call_status == 'success':
        return 'active'
    return 'failed'


