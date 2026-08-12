"""Action Graph와 Interface Lab Goal 상태를 공개 snapshot으로 조립합니다."""

from __future__ import annotations

from typing import Any

from ros2_dashboard_monitor.monitor_helpers import (
    dashboard_execution_node,
    runtime_state_map,
    without_internal_node,
)
from ros2_dashboard_monitor.topology import related_nodes


def assemble_action_snapshot(monitor) -> dict[str, Any]:
    snapshot = monitor._action_runtime.snapshot()
    role_nodes = monitor._role_node_index()
    internal_node = monitor._monitor_node_full_name()
    summaries = monitor._action_goal_runtime.summary_by_action()
    dashboard_states = runtime_state_map(
        monitor._action_goal_runtime, 'dashboard_state_by_action',
    )
    callable_items = monitor._action_goal_runtime.callable_actions()['actions']
    allowlisted_types = {item.get('action_type') for item in callable_items}
    callable_names = {
        (item.get('action_name'), item.get('action_type'))
        for item in callable_items if item.get('callable') is True
    }
    for action in snapshot['actions']:
        key = (action.get('name'), action.get('type'))
        all_server_nodes = related_nodes(
            role_nodes, role='action_server',
            resource_name=str(action.get('name') or ''),
            resource_types=[action.get('type')],
        )
        all_client_nodes = related_nodes(
            role_nodes, role='action_client',
            resource_name=str(action.get('name') or ''),
            resource_types=[action.get('type')],
        )
        server_nodes = without_internal_node(all_server_nodes, internal_node)
        client_nodes = without_internal_node(all_client_nodes, internal_node)
        action.update({
            'server_node_count': len(server_nodes),
            'client_node_count': len(client_nodes),
            'server_nodes': server_nodes,
            'client_nodes': client_nodes,
            'total_server_node_count': len(all_server_nodes),
            'total_client_node_count': len(all_client_nodes),
            'internal_server_node_count': len(all_server_nodes) - len(server_nodes),
            'internal_client_node_count': len(all_client_nodes) - len(client_nodes),
            'server_endpoint_count': int(action.get('server_count') or 0),
            'client_endpoint_count': int(action.get('client_count') or 0),
        })
        summary = summaries.get(key)
        allowlisted = action.get('type') in allowlisted_types
        action['allowlisted'] = allowlisted
        action['callable'] = key in callable_names
        if summary:
            action['last_goal_summary'] = summary
        action['goal_count'] = summary.get('goal_count', 0) if summary else 0
        action['success_count'] = summary.get('success_count', 0) if summary else 0
        action['failure_count'] = summary.get('failure_count', 0) if summary else 0
        action['canceled_count'] = summary.get('canceled_count', 0) if summary else 0
        configured_primary = action.get('name') in monitor._config.actions_primary_names
        runtime = action.get('runtime') or {}
        observed_primary = (
            int(runtime.get('observed_goal_count') or 0) > 0
            or str(runtime.get('last_goal_status') or '').lower() not in {'', 'unknown'}
            or bool(runtime.get('feedback_preview'))
            or bool(runtime.get('result_preview'))
            or bool(runtime.get('result_status'))
            or bool(runtime.get('result_error'))
        )
        if allowlisted:
            action['primary_priority'] = 1
            action['primary_source'] = 'registered_interface'
        elif configured_primary:
            action['primary_priority'] = 2
            action['primary_source'] = 'monitor_config'
        elif observed_primary:
            action['primary_priority'] = 3
            action['primary_source'] = 'observed_activity'
        else:
            action['primary_priority'] = None
            action['primary_source'] = None
        action['primary'] = action['primary_priority'] is not None
        monitor._apply_primary_state(
            action, kind='actions', name=str(action.get('name') or ''),
        )
        client_created = dashboard_states.get(key, {}).get('interface_client_created') is True
        if client_created:
            applied_qos = dashboard_states[key].get('qos') or {}
            for part, state in (action.get('qos') or {}).items():
                local_state = applied_qos.get(part) or {}
                if isinstance(state, dict):
                    state['local_qos'] = local_state.get('local_qos')
                    if local_state.get('qos_status') == 'incompatible':
                        state.update({
                            field: local_state.get(field)
                            for field in (
                                'qos_status',
                                'qos_detection_source',
                                'mismatch_policies',
                                'mismatch_reason',
                                'qos_error_type',
                                'compatible_endpoint_count',
                                'remote_endpoint_count',
                            )
                            if field in local_state
                        })
        action['dashboard_communication'] = {
            'monitoring_active': (
                action.get('status_supported') is True
                or action.get('feedback_supported') is True
            ),
            'status_monitoring_active': action.get('status_supported') is True,
            'feedback_monitoring_active': action.get('feedback_supported') is True,
            'interface_client_created': client_created,
            'has_goal_history': summary is not None,
            'execution_node': (
                summary.get('requester_node')
                if summary and summary.get('requester_node')
                else dashboard_execution_node(internal_node) if client_created else None
            ),
        }
    return snapshot
