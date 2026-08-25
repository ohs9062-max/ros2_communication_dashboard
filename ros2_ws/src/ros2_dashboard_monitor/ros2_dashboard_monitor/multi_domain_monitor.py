"""Domain별 rclpy Context를 독립적으로 보유하고 snapshot을 합칩니다.

ROS_DOMAIN_ID는 하나의 Context에만 적용할 수 있으므로 환경변수를 바꾸지 않는다.
각 child RosMonitor가 Context, Node, Fast DDS observer를 하나씩 소유한다.
"""

from __future__ import annotations

from copy import deepcopy
import os
from threading import Lock
from typing import Any

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
        self._configured_domain_ids: list[int] = []
        self._default_domain_id = _configured_domain_id(config)

    def start(self) -> None:
        with self._lock:
            desired = self._configured_domain_ids or [self._default_domain_id]
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
                    # First configured runtime retains the legacy observer port.
                    # Added runtimes receive adjacent loopback ports.
                    observer_port=_observer_port(
                        self._config.fastdds_observer.port,
                        desired.index(domain_id),
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
        for domain_id in configured or [self._default_domain_id]:
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

    def node_snapshot(self, **_: Any) -> dict[str, Any]:
        return self._merge('nodes', 'node_snapshot')

    def alerts(self, **_: Any) -> dict[str, Any]:
        values = []
        for domain_id, runtime in self._items():
            snapshot = runtime.alerts()
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
        return self._runtime(domain_id).topic_hz(name)

    def topic_history(self, name: str, *, limit: int | None = None, domain_id: int | None = None) -> dict[str, Any]:
        return self._runtime(domain_id).topic_history(name, limit=limit)

    def image_preview(self, name: str, *, domain_id: int | None = None) -> dict[str, Any]:
        return self._runtime(domain_id).image_preview(name)

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

    def send_action_goal(self, *, domain_id: int | None = None, **kwargs: Any) -> dict[str, Any]:
        return self._runtime(domain_id).send_action_goal(**kwargs)

    def _callables(self, method: str, key: str) -> dict[str, Any]:
        values = []
        for domain_id, runtime in self._items():
            for item in getattr(runtime, method)().get(key, []):
                value = deepcopy(item)
                value['domain_id'] = domain_id
                name = value.get('service_name') or value.get('action_name') or value.get('name') or ''
                value['resource_key'] = f'{domain_id}:{name}'
                values.append(value)
        return {key: values, 'meta': {'count': len(values)}}

    def __getattr__(self, name: str) -> Any:
        """Keep existing Interface Lab routes on the legacy default Domain.

        Those routes do not yet carry a domain_id selector.  Monitoring snapshots
        are multi-domain; explicit execution stays backwards compatible rather
        than accidentally broadcasting a user command to every Domain.
        """
        return getattr(self._runtime(None), name)

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
                # Legacy Interface Lab routes do not carry domain_id yet. Keep
                # their existing ROS_DOMAIN_ID target rather than changing it
                # merely because a numerically smaller Domain was added.
                target = (
                    self._default_domain_id
                    if self._default_domain_id in self._runtimes
                    else (self._configured_domain_ids[0] if self._configured_domain_ids else self._default_domain_id)
                )
            runtime = self._runtimes.get(int(target))
        if runtime is None:
            raise ValueError(f'Domain {target} is not being monitored.')
        return runtime


def _configured_domain_id(config: Any) -> int:
    # The existing single-domain config remains the fallback for old installations.
    value = os.getenv('ROS_DOMAIN_ID', getattr(config, 'ros_domain_id', 0))
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _observer_port(base_port: int, offset: int) -> int:
    # A separate loopback HTTP port is required per passive Fast DDS helper.
    return int(base_port) + int(offset)


def _alert_meta(values: list[dict[str, Any]]) -> dict[str, int]:
    return {
        'count': len(values),
        'warning_count': sum(item.get('level') == 'warning' for item in values),
        'error_count': sum(item.get('level') == 'error' for item in values),
        'critical_count': sum(item.get('level') == 'critical' for item in values),
    }
