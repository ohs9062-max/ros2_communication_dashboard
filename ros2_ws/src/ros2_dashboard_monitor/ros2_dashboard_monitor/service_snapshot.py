"""Service Graph와 Interface Lab Call 상태를 공개 snapshot으로 조립합니다."""

from __future__ import annotations

from typing import Any

from ros2_dashboard_monitor.monitor_helpers import (
    dashboard_execution_node,
    runtime_state_map,
    service_effective_status,
    without_internal_node,
)
from ros2_dashboard_monitor.topology import related_nodes


def assemble_service_snapshot(monitor, *, include_hidden: bool = False) -> dict[str, Any]:
    snapshot = monitor._service_runtime.snapshot(include_hidden=True)
    role_nodes = monitor._role_node_index()
    internal_node = monitor._monitor_node_full_name()
    summaries = monitor._service_call_runtime.summary_by_service()
    dashboard_states = runtime_state_map(
        monitor._service_call_runtime, 'dashboard_state_by_service',
    )
    callable_items = monitor._service_call_runtime.callable_services()['services']
    allowlisted_types = {item.get('service_type') for item in callable_items}
    callable_names = {
        (item.get('service_name'), item.get('service_type'))
        for item in callable_items if item.get('callable') is True
    }
    for service in snapshot['services']:
        key = (service.get('name'), service.get('type'))
        all_server_nodes = related_nodes(
            role_nodes, role='service_server',
            resource_name=str(service.get('name') or ''),
            resource_types=[service.get('type')],
        )
        all_client_nodes = related_nodes(
            role_nodes, role='service_client',
            resource_name=str(service.get('name') or ''),
            resource_types=[service.get('type')],
        )
        server_nodes = without_internal_node(all_server_nodes, internal_node)
        client_nodes = without_internal_node(all_client_nodes, internal_node)
        service.update({
            'server_node_count': len(server_nodes),
            'client_node_count': len(client_nodes),
            'server_nodes': server_nodes,
            'client_nodes': client_nodes,
            'total_server_node_count': len(all_server_nodes),
            'total_client_node_count': len(all_client_nodes),
            'internal_server_node_count': len(all_server_nodes) - len(server_nodes),
            'internal_client_node_count': len(all_client_nodes) - len(client_nodes),
            'server_endpoint_count': int(service.get('server_count') or 0),
            'client_endpoint_count': int(service.get('client_count') or 0),
        })
        summary = summaries.get(key)
        allowlisted = service.get('type') in allowlisted_types
        service['allowlisted'] = allowlisted
        service['callable'] = key in callable_names
        if summary:
            service['last_call_summary'] = summary
        service['call_status'] = summary.get('last_call_status') if summary else 'not_called'
        service['effective_status'] = service_effective_status(
            graph_status=service.get('status'),
            server_count=service.get('server_count'),
            summary=summary,
        )
        configured_primary = service.get('name') in monitor._config.services_primary_names
        if allowlisted:
            service['primary_priority'] = 1
            service['primary_source'] = 'registered_interface'
        elif configured_primary:
            service['primary_priority'] = 2
            service['primary_source'] = 'monitor_config'
        else:
            service['primary_priority'] = None
            service['primary_source'] = None
        service['primary'] = service['primary_priority'] is not None
        monitor._apply_primary_state(
            service, kind='services', name=str(service.get('name') or ''),
        )
        service['call_count'] = summary.get('call_count', 0) if summary else 0
        service['success_count'] = summary.get('success_count', 0) if summary else 0
        service['failure_count'] = summary.get('failure_count', 0) if summary else 0
        client_created = dashboard_states.get(key, {}).get('interface_client_created') is True
        service['dashboard_communication'] = {
            'interface_client_created': client_created,
            'has_call_history': summary is not None,
            'execution_node': (
                summary.get('requester_node')
                if summary and summary.get('requester_node')
                else dashboard_execution_node(internal_node) if client_created else None
            ),
        }
    if not include_hidden:
        all_services = snapshot['services']
        preferences = getattr(monitor, '_priority_state', None)
        snapshot['services'] = [
            service for service in all_services
            if service.get('hidden_by_default') is not True or service.get('user_primary') is True
        ]
        snapshot['meta']['count'] = len(snapshot['services'])
        snapshot['meta']['visible_count'] = len(snapshot['services'])
        snapshot['meta']['hidden_count'] = sum(
            1 for service in all_services
            if service.get('hidden_by_default') is True
            and not (
                preferences
                and preferences.contains('services', str(service.get('name') or ''))
            )
        )
    return snapshot
