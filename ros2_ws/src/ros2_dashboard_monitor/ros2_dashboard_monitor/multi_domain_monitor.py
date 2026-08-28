"""Domain별 rclpy Context를 독립적으로 보유하고 snapshot을 합칩니다.

ROS_DOMAIN_ID는 하나의 Context에만 적용할 수 있으므로 환경변수를 바꾸지 않는다.
각 child RosMonitor가 Context, Node, Fast DDS observer를 하나씩 소유한다.
"""

from __future__ import annotations

from copy import deepcopy
import os
from pathlib import Path
from threading import Lock
from typing import Any

import yaml

from ros2_dashboard_monitor.ros_monitor import RosMonitor
from ros2_dashboard_monitor.snapshot_summary import assemble_websocket_snapshot
from time import time


class MultiDomainRosMonitor:
    """여러 독립 Domain runtime의 monitoring 결과를 domain_id로 구분해 합친다."""

    def __init__(self, config: Any, *, priority_state: Any = None) -> None:
        self._config = config
        self._priority_state = priority_state
        self._lock = Lock()
        self._runtimes: dict[int, RosMonitor] = {}
        self._configured_domain_ids: list[int] = _stored_domain_ids()

    def start(self) -> None:
        with self._lock:
            # domains.ids is the only persisted multi-domain source.  Do not
            # infer a runtime from ROS_DOMAIN_ID when the list is empty.
            desired = list(self._configured_domain_ids)
        self.set_domain_ids(desired)

    def stop(self) -> None:
        with self._lock:
            runtimes = list(self._runtimes.values())
            self._runtimes = {}
        for runtime in runtimes:
            runtime.stop()

    def set_domain_ids(self, domain_ids: list[int]) -> dict[str, Any]:
        """Start only added domains and stop only removed domains."""
        desired = sorted(set(int(value) for value in domain_ids))
        if any(value < 0 or value > 232 for value in desired):
            raise ValueError('ROS Domain ID must be between 0 and 232.')
        with self._lock:
            self._configured_domain_ids = desired
            current = set(self._runtimes)
            add = [domain_id for domain_id in desired if domain_id not in current]
            remove = [domain_id for domain_id in current if domain_id not in desired]
            removed = [self._runtimes.pop(domain_id) for domain_id in remove]
            for domain_id in add:
                self._runtimes[domain_id] = RosMonitor(
                    self._config,
                    priority_state=self._priority_state,
                    domain_id=domain_id,
                    observer_port=_observer_port(
                        self._config.fastdds_observer.port,
                        domain_id,
                    ),
                )
            added = [self._runtimes[domain_id] for domain_id in add]
        for runtime in removed:
            runtime.stop()
        for runtime in added:
            runtime.start()
        return self.domain_snapshot()

    def domain_snapshot(self) -> dict[str, Any]:
        with self._lock:
            runtimes = dict(self._runtimes)
            configured = list(self._configured_domain_ids)
        items = []
        for domain_id in configured:
            runtime = runtimes.get(domain_id)
            status = runtime.domain_snapshot().get('status') if runtime else 'stopped'
            items.append({'domain_id': domain_id, 'status': status})
        active = [item['domain_id'] for item in items if item['status'] == 'monitoring']
        return {
            'active_domain_ids': active,
            'domains': items,
            'status': 'monitoring' if active else 'stopped',
            'multiple_domain_runtime_supported': True,
        }

    def snapshot(self) -> dict[str, Any]:
        return self._merge('topics', 'snapshot')

    def service_snapshot(self, *, include_hidden: bool = False) -> dict[str, Any]:
        return self._merge('services', 'service_snapshot', include_hidden=include_hidden)

    def action_snapshot(self) -> dict[str, Any]:
        return self._merge('actions', 'action_snapshot')

    def node_snapshot(
        self,
        *,
        topic_snapshot: dict[str, Any] | None = None,
        service_snapshot: dict[str, Any] | None = None,
        action_snapshot: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        values = []
        for domain_id, runtime in self._items():
            snapshot = runtime.node_snapshot(
                topic_snapshot=_domain_collection(topic_snapshot, 'topics', domain_id),
                service_snapshot=_domain_collection(service_snapshot, 'services', domain_id),
                action_snapshot=_domain_collection(action_snapshot, 'actions', domain_id),
            )
            values.extend(_tag_domain_items(snapshot.get('nodes', []), domain_id))
        return {'nodes': values, 'meta': {'count': len(values)}}

    def alerts(
        self,
        *,
        action_snapshot: dict[str, Any] | None = None,
        node_snapshot: dict[str, Any] | None = None,
        service_snapshot: dict[str, Any] | None = None,
        topic_snapshot: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        values = []
        for domain_id, runtime in self._items():
            snapshot = runtime.alerts(
                action_snapshot=_domain_collection(action_snapshot, 'actions', domain_id),
                node_snapshot=_domain_collection(node_snapshot, 'nodes', domain_id),
                service_snapshot=_domain_collection(service_snapshot, 'services', domain_id),
                topic_snapshot=_domain_collection(topic_snapshot, 'topics', domain_id),
            )
            for item in snapshot.get('data', []):
                value = deepcopy(item)
                value['domain_id'] = domain_id
                value['resource_key'] = f'{domain_id}:{value.get("name", "")}'
                # Alert DB/API identity must not collide across identical names.
                value['id'] = f'domain:{domain_id}:{value.get("id", "")}'
                value['alert_key'] = f'domain:{domain_id}:{value.get("alert_key", value["id"])}'
                values.append(value)
        return {'data': values, 'meta': _alert_meta(values)}

    def websocket_snapshot(self, **snapshots: Any) -> dict[str, Any]:
        """Keep the existing WebSocket schema while using aggregate snapshots."""
        topics = snapshots.get('topic_snapshot') or self.snapshot()
        services = snapshots.get('service_snapshot') or self.service_snapshot()
        actions = snapshots.get('action_snapshot') or self.action_snapshot()
        nodes = snapshots.get('node_snapshot') or self.node_snapshot()
        alerts = snapshots.get('alerts') or self.alerts()
        return assemble_websocket_snapshot(
            timestamp=time(), topic_snapshot=topics, service_snapshot=services,
            action_snapshot=actions, node_snapshot=nodes, alerts=alerts,
        )

    def latest_message(self, name: str, *, domain_id: int | None = None) -> dict[str, Any]:
        return self._runtime(domain_id).latest_message(name)

    def topic_hz(self, name: str, *, domain_id: int | None = None) -> dict[str, Any]:
        result = deepcopy(self._runtime(domain_id).topic_hz(name))
        if domain_id is not None:
            data = result.setdefault('data', {})
            data['domain_id'] = int(domain_id)
            data['resource_key'] = f'{int(domain_id)}:{name}'
        return result

    def topic_history(self, name: str, *, limit: int | None = None, domain_id: int | None = None) -> dict[str, Any]:
        return self._runtime(domain_id).topic_history(name, limit=limit)

    def image_preview(self, name: str, *, domain_id: int | None = None) -> dict[str, Any]:
        result = self._runtime(domain_id).image_preview(name)
        if domain_id is not None:
            data = result.setdefault('data', {})
            data['domain_id'] = int(domain_id)
            data['resource_key'] = f'{int(domain_id)}:{name}'
        return result

    def stop_image_preview(self, name: str, *, domain_id: int | None = None) -> dict[str, Any]:
        result = self._runtime(domain_id).stop_image_preview(name)
        if domain_id is not None:
            data = result.setdefault('data', {})
            data['domain_id'] = int(domain_id)
            data['resource_key'] = f'{int(domain_id)}:{name}'
        return result

    def service_history(self, *, service_name: str, service_type: str | None = None, limit: int = 30, domain_id: int | None = None) -> dict[str, Any]:
        return self._runtime(domain_id).service_history(service_name=service_name, service_type=service_type, limit=limit)

    def action_history(self, *, action_name: str, action_type: str | None = None, limit: int = 100, domain_id: int | None = None) -> dict[str, Any]:
        return self._runtime(domain_id).action_history(action_name=action_name, action_type=action_type, limit=limit)

    def callable_services(self) -> dict[str, Any]:
        return self._callables('callable_services', 'services')

    def callable_actions(self) -> dict[str, Any]:
        return self._callables('callable_actions', 'actions')

    def call_service(self, *, domain_id: int | None = None, **kwargs: Any) -> dict[str, Any]:
        return self._runtime(domain_id).call_service(**kwargs)

    def service_server_types(self) -> dict[str, Any]:
        return self._server_types('service_server_types', 'services')

    def start_service_server(self, *, domain_id: int | None = None, **kwargs: Any) -> dict[str, Any]:
        return self._tag_server_result(
            self._runtime(domain_id).start_service_server(**kwargs), domain_id,
            name=kwargs.get('service_name'), key='server',
        )

    def stop_service_server(self, *, domain_id: int | None = None, **kwargs: Any) -> dict[str, Any]:
        return self._tag_server_result(
            self._runtime(domain_id).stop_service_server(**kwargs), domain_id,
            name=kwargs.get('service_name'), key='stopped',
        )

    def service_server_status(self) -> dict[str, Any]:
        return self._aggregate_runtime_collection('service_server_status', 'servers')

    def service_server_history(self) -> dict[str, Any]:
        return self._aggregate_runtime_collection('service_server_history', 'history')

    def send_action_goal(self, *, domain_id: int | None = None, **kwargs: Any) -> dict[str, Any]:
        return self._runtime(domain_id).send_action_goal(**kwargs)

    def cancel_action_goal(self, *, domain_id: int | None = None, **kwargs: Any) -> dict[str, Any]:
        return self._runtime(domain_id).cancel_action_goal(**kwargs)

    def action_server_types(self) -> dict[str, Any]:
        return self._server_types('action_server_types', 'actions')

    def start_action_server(self, *, domain_id: int | None = None, **kwargs: Any) -> dict[str, Any]:
        return self._tag_server_result(
            self._runtime(domain_id).start_action_server(**kwargs), domain_id,
            name=kwargs.get('action_name'), key='server',
        )

    def stop_action_server(self, *, domain_id: int | None = None, **kwargs: Any) -> dict[str, Any]:
        return self._tag_server_result(
            self._runtime(domain_id).stop_action_server(**kwargs), domain_id,
            name=kwargs.get('action_name'), key='stopped',
        )

    def action_server_status(self) -> dict[str, Any]:
        return self._aggregate_runtime_collection('action_server_status', 'servers')

    def action_server_history(self) -> dict[str, Any]:
        return self._aggregate_runtime_collection('action_server_history', 'history')

    def callable_messages(self) -> dict[str, Any]:
        """Merge registered Message types and retain Domain on Graph candidates."""
        by_type: dict[str, dict[str, Any]] = {}
        for domain_id, runtime in self._items():
            for item in runtime.callable_messages().get('messages', []):
                message_type = str(item.get('message_type') or item.get('full_type') or '')
                if not message_type:
                    continue
                current = by_type.setdefault(message_type, {
                    **deepcopy(item), 'graph_topics': [], 'graph_conflicts': [],
                })
                for field in ('graph_topics', 'graph_conflicts'):
                    for graph_item in item.get(field, []):
                        value = deepcopy(graph_item)
                        value['domain_id'] = domain_id
                        value['resource_key'] = f'{domain_id}:{value.get("name", "")}'
                        current[field].append(value)
        messages = sorted(by_type.values(), key=lambda item: item.get('message_type') or '')
        return {'messages': messages, 'meta': {'count': len(messages)}}

    def message_schema(self, *, message_type: str) -> dict[str, Any]:
        item = next(
            (value for value in self.callable_messages()['messages']
             if value.get('message_type') == message_type),
            None,
        )
        if item is None:
            raise ValueError(f'Message type is not registered: {message_type}')
        return item

    def publish_topic(self, *, domain_id: int | None = None, **kwargs: Any) -> dict[str, Any]:
        return self._runtime(domain_id).publish_topic(**kwargs)

    def start_continuous_topic_publish(self, *, domain_id: int | None = None, **kwargs: Any) -> dict[str, Any]:
        return self._runtime(domain_id).start_continuous_topic_publish(**kwargs)

    def stop_continuous_topic_publish(self, *, domain_id: int | None = None, **kwargs: Any) -> dict[str, Any]:
        return self._runtime(domain_id).stop_continuous_topic_publish(**kwargs)

    def start_receive_topic(self, *, domain_id: int | None = None, **kwargs: Any) -> dict[str, Any]:
        return self._runtime(domain_id).start_receive_topic(**kwargs)

    def stop_receive_topic(self, *, domain_id: int | None = None, **kwargs: Any) -> dict[str, Any]:
        return self._runtime(domain_id).stop_receive_topic(**kwargs)

    def receive_topics(self) -> dict[str, Any]:
        return self._aggregate_runtime_collection('receive_topics', 'topics')

    def receive_topic_history(self, **kwargs: Any) -> dict[str, Any]:
        return self._aggregate_runtime_collection('receive_topic_history', 'history', **kwargs)

    def topic_publish_history(self, **kwargs: Any) -> dict[str, Any]:
        return self._aggregate_runtime_collection('topic_publish_history', 'history', **kwargs)

    def continuous_topic_publishes(self) -> dict[str, Any]:
        return self._aggregate_runtime_collection('continuous_topic_publishes', 'publishes')

    def service_call_history(self) -> dict[str, Any]:
        return self._aggregate_runtime_collection('service_call_history', 'calls')

    def action_goal_history(self) -> dict[str, Any]:
        return self._aggregate_runtime_collection('action_goal_history', 'goals')

    def receive_service_history(self) -> dict[str, Any]:
        return self._aggregate_runtime_collection('receive_service_history', 'history')

    def receive_action_history(self) -> dict[str, Any]:
        return self._aggregate_runtime_collection('receive_action_history', 'history')

    def reset_topic_publish_history(self, *, domain_id: int | None = None, **kwargs: Any) -> dict[str, Any]:
        return self._reset_runtime('reset_topic_publish_history', domain_id=domain_id, **kwargs)

    def reset_receive_topic_history(self, *, domain_id: int | None = None, **kwargs: Any) -> dict[str, Any]:
        return self._reset_runtime('reset_receive_topic_history', domain_id=domain_id, **kwargs)

    def reset_service_call_history(self, *, domain_id: int | None = None, **kwargs: Any) -> dict[str, Any]:
        return self._reset_runtime('reset_service_call_history', domain_id=domain_id, **kwargs)

    def reset_action_goal_history(self, *, domain_id: int | None = None, **kwargs: Any) -> dict[str, Any]:
        return self._reset_runtime('reset_action_goal_history', domain_id=domain_id, **kwargs)

    def reset_receive_service_history(self, *, domain_id: int | None = None, **kwargs: Any) -> dict[str, Any]:
        return self._reset_runtime('reset_receive_service_history', domain_id=domain_id, **kwargs)

    def reset_receive_action_history(self, *, domain_id: int | None = None, **kwargs: Any) -> dict[str, Any]:
        return self._reset_runtime('reset_receive_action_history', domain_id=domain_id, **kwargs)

    def reset_alert_history(self) -> dict[str, Any]:
        return self._reset_runtime('reset_alert_history', domain_id=None)

    def reset_current_alerts(self) -> dict[str, Any]:
        return self._reset_runtime('reset_current_alerts', domain_id=None)

    def _callables(self, method: str, key: str) -> dict[str, Any]:
        values = []
        for domain_id, runtime in self._items():
            if not _runtime_has_server(runtime, key):
                continue
            for item in getattr(runtime, method)().get(key, []):
                value = deepcopy(item)
                value['domain_id'] = domain_id
                name = value.get('service_name') or value.get('action_name') or value.get('name') or ''
                value['resource_key'] = f'{domain_id}:{name}'
                values.append(value)
        resources = _actual_callable_resources(values, key)
        return {key: resources, 'meta': {'count': len(resources)}}

    def _server_types(self, method: str, key: str) -> dict[str, Any]:
        values = []
        for domain_id, runtime in self._items():
            for item in getattr(runtime, method)().get(key, []):
                value = deepcopy(item)
                value['domain_id'] = domain_id
                type_name = value.get('service_type') or value.get('action_type') or ''
                value['resource_key'] = f'{domain_id}:{type_name}'
                values.append(value)
        return {key: values, 'meta': {'count': len(values)}}

    @staticmethod
    def _tag_server_result(
        result: dict[str, Any], domain_id: int | None, *, name: Any, key: str,
    ) -> dict[str, Any]:
        value = deepcopy(result)
        payload = value.get(key)
        if isinstance(payload, dict) and domain_id is not None:
            payload['domain_id'] = int(domain_id)
            payload['resource_key'] = f'{int(domain_id)}:{str(name or "")}'
        return value

    def _aggregate_runtime_collection(self, method: str, key: str, **kwargs: Any) -> dict[str, Any]:
        values = []
        for domain_id, runtime in self._items():
            for item in getattr(runtime, method)(**kwargs).get(key, []):
                value = deepcopy(item)
                value['domain_id'] = domain_id
                name = value.get('topic_name') or value.get('service_name') or value.get('action_name') or ''
                value['resource_key'] = f'{domain_id}:{name}'
                values.append(value)
        return {key: values, 'meta': {'count': len(values)}}

    def _reset_runtime(self, method: str, *, domain_id: int | None, **kwargs: Any) -> dict[str, Any]:
        if domain_id is not None:
            return getattr(self._runtime(domain_id), method)(**kwargs)
        results = [getattr(runtime, method)(**kwargs) for _, runtime in self._items()]
        return {
            key: sum(int(result.get(key, 0) or 0) for result in results)
            for key in {key for result in results for key in result if isinstance(result.get(key), int)}
        }

    def _merge(self, key: str, method: str, **kwargs: Any) -> dict[str, Any]:
        items: list[dict[str, Any]] = []
        latest = 0.0
        for domain_id, runtime in self._items():
            snapshot = getattr(runtime, method)(**kwargs)
            latest = max(latest, float(snapshot.get('last_updated', 0.0) or 0.0))
            for item in snapshot.get(key, []):
                value = deepcopy(item)
                value['domain_id'] = domain_id
                value['resource_key'] = f'{domain_id}:{value.get("name", value.get("full_name", ""))}'
                items.append(value)
        result: dict[str, Any] = {key: items, 'meta': {'count': len(items)}}
        if key == 'topics':
            result.update({'count': len(items), 'last_updated': latest})
        return result

    def _items(self) -> list[tuple[int, RosMonitor]]:
        with self._lock:
            return sorted(self._runtimes.items())

    def _runtime(self, domain_id: int | None) -> RosMonitor:
        with self._lock:
            target = domain_id
            if target is None:
                if len(self._runtimes) == 1:
                    return next(iter(self._runtimes.values()))
                raise ValueError('domain_id is required when multiple Domains are monitored.')
            runtime = self._runtimes.get(int(target))
        if runtime is None:
            raise ValueError(f'Domain {target} is not being monitored.')
        return runtime


def _stored_domain_ids() -> list[int]:
    """Read the same Backend-owned preferences file used by the Domains UI."""
    configured = os.getenv('USER_PREFERENCES_PATH')
    path = Path(configured).expanduser() if configured else (
        Path(os.getenv('ROS2_DASHBOARD_WS_ROOT', '')).expanduser().parent
        / 'backend' / 'config' / 'user_preferences.yaml'
        if os.getenv('ROS2_DASHBOARD_WS_ROOT')
        else Path(__file__).resolve().parents[4] / 'backend' / 'config' / 'user_preferences.yaml'
    )
    try:
        data = yaml.safe_load(path.read_text(encoding='utf-8')) or {}
        values = data.get('domains', {}).get('ids', [])
    except (OSError, UnicodeError, yaml.YAMLError, AttributeError):
        return []
    return sorted({
        int(value) for value in values
        if isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= 232
    })


def _observer_port(base_port: int, domain_id: int) -> int:
    # A separate loopback HTTP port is required per passive Fast DDS helper.
    return int(base_port) + int(domain_id)


def _actual_callable_resources(values: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    """Return only exact Graph resources while preserving their Domain identity."""
    name_field = 'service_name' if key == 'services' else 'action_name'
    type_field = 'service_type' if key == 'services' else 'action_type'
    discovered: dict[tuple[int, str, str], dict[str, Any]] = {}
    for value in values:
        name = str(value.get(name_field) or '')
        resource_type = str(value.get(type_field) or '')
        domain_id = value.get('domain_id')
        if (
            not name or not resource_type or not isinstance(domain_id, int)
            or int(value.get('server_count') or 0) <= 0
        ):
            continue
        identity = (domain_id, name, resource_type)
        current = discovered.get(identity)
        if current is None or (value.get('callable') is True and current.get('callable') is not True):
            discovered[identity] = value

    return [
        deepcopy(discovered[identity])
        for identity in sorted(discovered, key=lambda item: (item[1], item[2], item[0]))
    ]


def _runtime_has_server(runtime: RosMonitor, key: str) -> bool:
    if key == 'services':
        items = runtime._service_runtime.snapshot(include_hidden=True).get('services', [])
    else:
        items = runtime._action_runtime.snapshot().get('actions', [])
    return any(int(item.get('server_count') or 0) > 0 for item in items)


def _domain_collection(
    snapshot: dict[str, Any] | None,
    key: str,
    domain_id: int,
) -> dict[str, Any] | None:
    if snapshot is None:
        return None
    values = [
        item for item in snapshot.get(key, [])
        if item.get('domain_id') == domain_id
    ]
    return {**snapshot, key: values, 'meta': {'count': len(values)}}


def _tag_domain_items(items: list[dict[str, Any]], domain_id: int) -> list[dict[str, Any]]:
    values = []
    for item in items:
        value = deepcopy(item)
        value['domain_id'] = domain_id
        value['resource_key'] = f'{domain_id}:{value.get("name", value.get("full_name", ""))}'
        values.append(value)
    return values


def _alert_meta(values: list[dict[str, Any]]) -> dict[str, int]:
    return {
        'count': len(values),
        'warning_count': sum(item.get('level') == 'warning' for item in values),
        'error_count': sum(item.get('level') == 'error' for item in values),
        'critical_count': sum(item.get('level') == 'critical' for item in values),
    }
