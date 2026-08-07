"""Node 상태와 시스템 주요 리소스 관계를 공개 snapshot으로 조립합니다."""

from __future__ import annotations

from typing import Any

from ros2_dashboard_monitor.monitor_helpers import (
    node_uses_system_primary,
    system_primary_resources,
)


def assemble_node_snapshot(monitor) -> dict[str, Any]:
    snapshot = monitor._node_runtime.snapshot()
    internal_node = monitor._monitor_node_full_name()
    has_resource_runtimes = all(hasattr(monitor, name) for name in (
        '_topic_runtime',
        '_service_runtime',
        '_service_call_runtime',
        '_action_runtime',
        '_action_goal_runtime',
    ))
    system_resources = (
        system_primary_resources(
            topics=monitor.snapshot()['topics'],
            services=monitor.service_snapshot(include_hidden=True)['services'],
            actions=monitor.action_snapshot()['actions'],
        )
        if has_resource_runtimes else set()
    )
    for node in snapshot['nodes']:
        node['is_internal'] = node.get('full_name') == internal_node
        node['primary'] = bool(
            node.get('primary')
            or node.get('status') == 'disconnected'
            or node_uses_system_primary(node, system_resources)
        )
        monitor._apply_primary_state(
            node,
            kind='nodes',
            name=str(node.get('full_name') or node.get('name') or ''),
        )
    return snapshot
