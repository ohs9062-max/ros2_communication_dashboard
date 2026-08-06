"""Runtime cache에 ROS Graph 관계와 Dashboard 실행 상태를 조립합니다."""

from __future__ import annotations

from typing import Any, Callable

from ros2_dashboard_monitor.monitor_helpers import (
    dashboard_execution_node,
    node_uses_system_primary as _node_uses_system_primary,
    runtime_state_map as _runtime_state_map,
    service_effective_status as _service_effective_status,
    system_primary_resources as _system_primary_resources,
    without_internal_node,
    without_internal_node as _without_internal_node,
    dashboard_execution_node as _dashboard_execution_node,
)
from ros2_dashboard_monitor.topology import related_nodes


def enrich_topic_snapshot(
    snapshot: dict[str, Any],
    *,
    role_nodes: dict[tuple[str, str, str], set[str]],
    internal_node: str,
    interface_states: dict[Any, Any],
    apply_primary_state: Callable[..., None],
) -> dict[str, Any]:
    for topic in snapshot['topics']:
        topic_types = topic.get('types') or []
        topic_name = str(topic.get('name') or '')
        states = [
            interface_states.get((topic_name, str(topic_type)), {})
            for topic_type in topic_types
        ]
        all_publishers = related_nodes(
            role_nodes,
            role='topic_publisher',
            resource_name=topic_name,
            resource_types=topic_types,
        )
        all_subscribers = related_nodes(
            role_nodes,
            role='topic_subscriber',
            resource_name=topic_name,
            resource_types=topic_types,
        )
        publishers = without_internal_node(all_publishers, internal_node)
        subscribers = without_internal_node(all_subscribers, internal_node)
        publisher_created = any(
            state.get('interface_publisher_created') is True for state in states
        )
        topic.update({
            'publisher_node_count': len(publishers),
            'subscriber_node_count': len(subscribers),
            'total_publisher_node_count': len(all_publishers),
            'total_subscriber_node_count': len(all_subscribers),
            'internal_publisher_node_count': len(all_publishers) - len(publishers),
            'internal_subscriber_node_count': len(all_subscribers) - len(subscribers),
            'external_subscriber_node_count': len(subscribers),
            'publisher_nodes': publishers,
            'subscriber_nodes': subscribers,
            'all_publisher_nodes': all_publishers,
            'all_subscriber_nodes': all_subscribers,
            'internal_publisher_nodes': [name for name in all_publishers if name == internal_node],
            'internal_subscriber_nodes': [name for name in all_subscribers if name == internal_node],
            'external_subscriber_nodes': subscribers,
            'publisher_endpoint_count': int(topic.get('publisher_count') or 0),
            'subscriber_endpoint_count': int(topic.get('subscriber_count') or 0),
            'internal_subscriber_endpoint_count': int(topic.get('monitor_subscriber_count') or 0),
            'external_subscriber_endpoint_count': int(topic.get('external_subscriber_count') or 0),
            'dashboard_communication': {
                'auto_monitoring_active': topic.get('deep_monitoring') is True,
                'interface_receive_active': any(
                    state.get('interface_receive_active') is True for state in states
                ),
                'interface_publisher_created': publisher_created,
                'execution_node': dashboard_execution_node(internal_node)
                if publisher_created else None,
            },
        })
        apply_primary_state(topic, kind='topics', name=topic_name)
    return snapshot

def assemble_service_snapshot(
    monitor,
    *,
    include_hidden: bool = False,
) -> dict[str, Any]:
    """Service Cache에 Node 관계와 최근 사용자 Call 결과를 합쳐 반환합니다."""
    snapshot = monitor._service_runtime.snapshot(include_hidden=True)
    role_nodes = monitor._role_node_index()
    internal_node = monitor._monitor_node_full_name()
    summaries = monitor._service_call_runtime.summary_by_service()
    dashboard_states = _runtime_state_map(
        monitor._service_call_runtime,
        'dashboard_state_by_service',
    )
    callable_items = monitor._service_call_runtime.callable_services()['services']
    allowlisted_types = {item.get('service_type') for item in callable_items}
    callable_names = {
        (item.get('service_name'), item.get('service_type'))
        for item in callable_items
        if item.get('callable') is True
    }
    for service in snapshot['services']:
        key = (service.get('name'), service.get('type'))
        all_server_nodes = related_nodes(
            role_nodes,
            role='service_server',
            resource_name=str(service.get('name') or ''),
            resource_types=[service.get('type')],
        )
        all_client_nodes = related_nodes(
            role_nodes,
            role='service_client',
            resource_name=str(service.get('name') or ''),
            resource_types=[service.get('type')],
        )
        server_nodes = _without_internal_node(
            all_server_nodes,
            internal_node,
        )
        client_nodes = _without_internal_node(
            all_client_nodes,
            internal_node,
        )
        service.update({
            'server_node_count': len(server_nodes),
            'client_node_count': len(client_nodes),
            'server_nodes': server_nodes,
            'client_nodes': client_nodes,
            'total_server_node_count': len(all_server_nodes),
            'total_client_node_count': len(all_client_nodes),
            'internal_server_node_count': (
                len(all_server_nodes) - len(server_nodes)
            ),
            'internal_client_node_count': (
                len(all_client_nodes) - len(client_nodes)
            ),
            'server_endpoint_count': int(service.get('server_count') or 0),
            'client_endpoint_count': int(service.get('client_count') or 0),
        })
        summary = summaries.get(key)
        allowlisted = service.get('type') in allowlisted_types
        service['allowlisted'] = allowlisted
        service['callable'] = key in callable_names
        if summary:
            service['last_call_summary'] = summary
        service['call_status'] = (
            summary.get('last_call_status')
            if summary
            else 'not_called'
        )
        service['effective_status'] = _service_effective_status(
            graph_status=service.get('status'),
            server_count=service.get('server_count'),
            summary=summary,
        )
        configured_primary = (
            service.get('name') in monitor._config.services_primary_names
        )
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
            service,
            kind='services',
            name=str(service.get('name') or ''),
        )
        service['call_count'] = summary.get('call_count', 0) if summary else 0
        service['success_count'] = summary.get('success_count', 0) if summary else 0
        service['failure_count'] = summary.get('failure_count', 0) if summary else 0
        service['dashboard_communication'] = {
            'interface_client_created': (
                dashboard_states.get(key, {}).get(
                    'interface_client_created',
                ) is True
            ),
            'has_call_history': summary is not None,
            'execution_node': (
                summary.get('requester_node')
                if summary and summary.get('requester_node')
                else _dashboard_execution_node(internal_node)
                if dashboard_states.get(key, {}).get(
                    'interface_client_created',
                ) is True
                else None
            ),
        }
    if not include_hidden:
        all_services = snapshot['services']
        preferences = getattr(monitor, '_priority_state', None)
        snapshot['services'] = [
            service for service in all_services
            if (
                service.get('hidden_by_default') is not True
                or service.get('user_primary') is True
            )
        ]
        snapshot['meta']['count'] = len(snapshot['services'])
        snapshot['meta']['visible_count'] = len(snapshot['services'])
        snapshot['meta']['hidden_count'] = sum(
            1 for service in all_services
            if (
                service.get('hidden_by_default') is True
                and not (
                    preferences
                    and preferences.contains(
                        'services',
                        str(service.get('name') or ''),
                    )
                )
            )
        )
    return snapshot

def assemble_action_snapshot(monitor) -> dict[str, Any]:
    """Action Cache에 Node 관계와 최근 사용자 Goal 결과를 합쳐 반환합니다."""
    snapshot = monitor._action_runtime.snapshot()
    role_nodes = monitor._role_node_index()
    internal_node = monitor._monitor_node_full_name()
    summaries = monitor._action_goal_runtime.summary_by_action()
    dashboard_states = _runtime_state_map(
        monitor._action_goal_runtime,
        'dashboard_state_by_action',
    )
    callable_items = monitor._action_goal_runtime.callable_actions()['actions']
    allowlisted_types = {item.get('action_type') for item in callable_items}
    callable_names = {
        (item.get('action_name'), item.get('action_type'))
        for item in callable_items
        if item.get('callable') is True
    }
    for action in snapshot['actions']:
        key = (action.get('name'), action.get('type'))
        all_server_nodes = related_nodes(
            role_nodes,
            role='action_server',
            resource_name=str(action.get('name') or ''),
            resource_types=[action.get('type')],
        )
        all_client_nodes = related_nodes(
            role_nodes,
            role='action_client',
            resource_name=str(action.get('name') or ''),
            resource_types=[action.get('type')],
        )
        server_nodes = _without_internal_node(
            all_server_nodes,
            internal_node,
        )
        client_nodes = _without_internal_node(
            all_client_nodes,
            internal_node,
        )
        action.update({
            'server_node_count': len(server_nodes),
            'client_node_count': len(client_nodes),
            'server_nodes': server_nodes,
            'client_nodes': client_nodes,
            'total_server_node_count': len(all_server_nodes),
            'total_client_node_count': len(all_client_nodes),
            'internal_server_node_count': (
                len(all_server_nodes) - len(server_nodes)
            ),
            'internal_client_node_count': (
                len(all_client_nodes) - len(client_nodes)
            ),
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
        configured_primary = (
            action.get('name') in monitor._config.actions_primary_names
        )
        runtime = action.get('runtime') or {}
        observed_primary = (
            int(runtime.get('observed_goal_count') or 0) > 0
            or str(runtime.get('last_goal_status') or '').lower()
            not in {'', 'unknown'}
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
            action,
            kind='actions',
            name=str(action.get('name') or ''),
        )
        action['dashboard_communication'] = {
            'monitoring_active': (
                action.get('status_supported') is True
                or action.get('feedback_supported') is True
            ),
            'status_monitoring_active': (
                action.get('status_supported') is True
            ),
            'feedback_monitoring_active': (
                action.get('feedback_supported') is True
            ),
            'interface_client_created': (
                dashboard_states.get(key, {}).get(
                    'interface_client_created',
                ) is True
            ),
            'has_goal_history': summary is not None,
            'execution_node': (
                summary.get('requester_node')
                if summary and summary.get('requester_node')
                else _dashboard_execution_node(internal_node)
                if dashboard_states.get(key, {}).get(
                    'interface_client_created',
                ) is True
                else None
            ),
        }
    return snapshot

def assemble_node_snapshot(monitor) -> dict[str, Any]:
    """Node Cache에 Dashboard 내부 Node 여부를 표시해 반환합니다."""
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
        _system_primary_resources(
            topics=monitor.snapshot()['topics'],
            services=monitor.service_snapshot(include_hidden=True)['services'],
            actions=monitor.action_snapshot()['actions'],
        )
        if has_resource_runtimes
        else set()
    )
    for node in snapshot['nodes']:
        node['is_internal'] = node.get('full_name') == internal_node
        node['primary'] = bool(
            node.get('primary')
            or node.get('status') == 'disconnected'
            or _node_uses_system_primary(node, system_resources)
        )
        monitor._apply_primary_state(
            node,
            kind='nodes',
            name=str(node.get('full_name') or node.get('name') or ''),
        )
    return snapshot
