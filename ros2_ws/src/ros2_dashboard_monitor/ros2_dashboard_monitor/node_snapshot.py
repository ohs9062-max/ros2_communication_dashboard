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
        node['is_auxiliary'] = is_auxiliary_node(node)
        configured_primary = bool(node.get('primary'))
        node['primary'] = bool(
            configured_primary
            or (
                not node['is_auxiliary']
                and (
                    node.get('status') == 'disconnected'
                    or node_uses_system_primary(node, system_resources)
                )
            )
        )
        monitor._apply_primary_state(
            node,
            kind='nodes',
            name=str(node.get('full_name') or node.get('name') or ''),
        )
    return snapshot


def is_auxiliary_node(node: dict[str, Any]) -> bool:
    """주요 목록에서 숨길 ROS2 구현 보조 Node를 판정합니다."""
    name = str(node.get('name') or '')
    full_name = str(node.get('full_name') or '')
    leaf_name = (full_name.rsplit('/', 1)[-1] or name).lower()
    return (
        'transform_listener' in leaf_name
        or leaf_name.startswith('launch_ros_')
        or leaf_name.endswith('_rclcpp_node')
        or leaf_name.endswith('_action_client')
    )
