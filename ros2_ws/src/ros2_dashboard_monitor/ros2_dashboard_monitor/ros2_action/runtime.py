"""Action 모니터링의 runtime 관련 기능을 담당하는 모듈입니다."""

from __future__ import annotations

from time import time
from typing import Any, Callable

from ros2_dashboard_monitor.ros2_action.discovery import build_action_item
from ros2_dashboard_monitor.ros2_action.filters import is_action_included
from ros2_dashboard_monitor.ros2_action.graph import (
    action_clients_by_node,
    action_count_maps,
    action_servers_by_node,
    merge_action_counts,
    read_action_names_and_types,
)
from ros2_dashboard_monitor.ros2_action.models import action_meta
from ros2_dashboard_monitor.ros2_action.result_runtime import ActionResultRuntime
from ros2_dashboard_monitor.ros2_action.subscription_lifecycle import (
    action_capabilities,
    create_feedback_subscription,
    create_status_subscription,
    default_action_qos,
    destroy_entry_subscriptions,
    monitor_subscription_count,
)
from ros2_dashboard_monitor.ros2_action.subscriptions import (
    action_entry_matches,
    build_action_subscription_entry,
    runtime_snapshot,
    update_feedback_runtime,
    update_status_runtime,
)
from ros2_dashboard_monitor.config_loader import MonitorConfig
from ros2_dashboard_monitor.resource_state import (
    disconnected_resource,
    mark_graph_present,
)

class ActionRuntime:
    """Action 모니터링 runtime 상태와 cache를 관리하는 클래스입니다."""

    def __init__(
        self,
        *,
        config: MonitorConfig,
        lock: Any,
        node_getter: Callable[[], Any],
    ) -> None:
        """Action Graph 조회와 status·feedback 관찰에 필요한 의존성을 저장합니다."""
        self._config = config
        self._lock = lock
        self._node_getter = node_getter
        self._actions: list[dict[str, Any]] = []
        self._last_updated = 0.0
        self._subscriptions: dict[str, dict[str, Any]] = {}
        self._result_runtime = ActionResultRuntime(
            action_subscriptions=self._subscriptions,
            auto_fetch_result_for_observed_goals=(
                config.actions_auto_fetch_result_for_observed_goals
            ),
            lock=lock,
            node_getter=node_getter,
        )

    def clear(self) -> None:
        """Action 모니터링에서 cache와 runtime 상태를 초기화하는 함수입니다."""
        with self._lock:
            self._actions = []
            self._last_updated = 0.0
            self._subscriptions.clear()

        self._result_runtime.clear()

    def snapshot(self) -> dict[str, Any]:
        """현재 Action Graph와 관찰 상태 Cache를 복사해 반환합니다."""
        with self._lock:
            actions = [action.copy() for action in self._actions]
            last_updated = self._last_updated

        return {
            'actions': actions,
            'meta': action_meta(
                actions=actions,
                last_updated=last_updated,
            ),
        }

    def update(self) -> list[dict[str, Any]]:
        """Action 모니터링에서 runtime 상태를 갱신하는 함수입니다."""
        node = self._node_getter()
        if node is None:
            return []

        actions = []
        updated_at = time()
        action_names_and_types = self._action_names_and_types()
        server_counts, client_counts = self._action_count_maps()
        with self._lock:
            previous_actions = {
                (action.get('name'), action.get('type')): action.copy()
                for action in self._actions
            }

        for name, types in action_names_and_types:
            if not is_action_included(
                name,
                include_names=self._config.actions_include,
                exclude_names=self._config.actions_exclude,
                exclude_prefixes=self._config.actions_exclude_prefixes,
            ):
                continue

            action_type = types[0] if types else None
            capabilities = self._ensure_subscriptions(
                name=name,
                action_type=action_type,
            )
            runtime = self._runtime_snapshot(name)
            action = build_action_item(
                name=name,
                action_type=action_type,
                server_count=server_counts.get(name, 0),
                client_count=client_counts.get(name, 0),
                updated_at=updated_at,
                status_supported=capabilities['status_supported'],
                feedback_supported=capabilities['feedback_supported'],
                feedback_reason=capabilities['feedback_reason'],
                result_supported=capabilities['result_supported'],
                result_policy=capabilities['result_policy'],
                result_reason=capabilities['result_reason'],
                runtime=runtime,
            )
            mark_graph_present(action, observed_at=updated_at)
            action['qos'] = capabilities['qos']
            actions.append(action)

        current_keys = {
            (action.get('name'), action.get('type'))
            for action in actions
        }
        for key, cached in previous_actions.items():
            if key in current_keys:
                continue
            actions.append(
                disconnected_resource(
                    cached,
                    detected_at=updated_at,
                    count_fields=('server_count', 'client_count'),
                ),
            )

        actions.sort(key=lambda action: action['name'])

        with self._lock:
            self._actions = actions
            self._last_updated = updated_at

        self._cleanup_disappeared_subscriptions(
            {name for name, _types in action_names_and_types},
        )
        self._result_runtime.update([
            action for action in actions
            if action.get('graph_present') is True
        ])
        return actions

    def monitor_subscriber_count(self, topic_name: str) -> int:
        """Action status·feedback 관찰용 내부 subscription 수를 반환합니다."""
        with self._lock:
            entries = list(self._subscriptions.items())
        return monitor_subscription_count(entries, topic_name)

    def _action_names_and_types(self) -> list[tuple[str, list[str]]]:
        return read_action_names_and_types(self._node_getter())

    def _action_count_maps(self) -> tuple[dict[str, int], dict[str, int]]:
        return action_count_maps(self._node_getter())

    def _action_servers_by_node(
        self,
        node_name: str,
        namespace: str,
    ) -> list[tuple[str, list[str]]]:
        node = self._node_getter()
        return action_servers_by_node(node, node_name, namespace)

    def _action_clients_by_node(
        self,
        node_name: str,
        namespace: str,
    ) -> list[tuple[str, list[str]]]:
        node = self._node_getter()
        return action_clients_by_node(node, node_name, namespace)

    @staticmethod
    def _merge_action_counts(
        *,
        counts: dict[str, int],
        names_and_types: list[tuple[str, list[str]]],
    ) -> None:
        merge_action_counts(counts, names_and_types)

    def _ensure_subscriptions(
        self,
        *,
        name: str,
        action_type: str | None,
    ) -> dict[str, Any]:
        if self._node_getter() is None:
            return self._capabilities(None)

        with self._lock:
            entry = self._subscriptions.get(name)
            if action_entry_matches(entry, action_type=action_type):
                return self._capabilities(entry)

            if entry is not None:
                self._destroy_entry_subscriptions(entry)

            entry = build_action_subscription_entry(
                action_type=action_type,
            )
            self._subscriptions[name] = entry

        status_supported = self._maybe_create_status_subscription(
            name,
            entry,
        )
        feedback_supported = self._maybe_create_feedback_subscription(
            name,
            action_type,
            entry,
        )
        result_supported, result_policy, result_reason = (
            self._result_runtime.support(action_type)
        )

        with self._lock:
            current = self._subscriptions.get(name)
            if current is entry:
                current['status_supported'] = status_supported
                current['feedback_supported'] = feedback_supported
                current['result_supported'] = result_supported
                current['result_policy'] = result_policy
                current['result_reason'] = result_reason

        return self._capabilities(entry)

    @staticmethod
    def _capabilities(entry: dict[str, Any] | None) -> dict[str, Any]:
        return action_capabilities(entry)

    def _maybe_create_status_subscription(
        self,
        name: str,
        entry: dict[str, Any],
    ) -> bool:
        return create_status_subscription(
            node=self._node_getter(),
            name=name,
            entry=entry,
            enabled=self._config.actions_auto_monitor_status,
            callback=self._status_callback(name),
        )

    def _maybe_create_feedback_subscription(
        self,
        name: str,
        action_type: str | None,
        entry: dict[str, Any],
    ) -> bool:
        return create_feedback_subscription(
            node=self._node_getter(),
            name=name,
            action_type=action_type,
            entry=entry,
            enabled=self._config.actions_auto_monitor_feedback,
            callback=self._feedback_callback(name),
        )

    @staticmethod
    def _default_action_qos() -> dict[str, Any]:
        return default_action_qos()

    def _runtime_snapshot(self, name: str) -> dict[str, Any]:
        with self._lock:
            return runtime_snapshot(self._subscriptions.get(name))

    def _status_callback(self, name: str):
        def callback(message: Any) -> None:
            received_at = time()
            with self._lock:
                entry = self._subscriptions.get(name)
                if entry is None:
                    return

                update_status_runtime(
                    entry,
                    message=message,
                    received_at=received_at,
                )

        return callback

    def _feedback_callback(self, name: str):
        def callback(message: Any) -> None:
            received_at = time()
            with self._lock:
                entry = self._subscriptions.get(name)
                if entry is None:
                    return

                update_feedback_runtime(
                    entry,
                    message=message,
                    received_at=received_at,
                )

        return callback

    def _cleanup_disappeared_subscriptions(
        self,
        action_names: set[str],
    ) -> None:
        if self._node_getter() is None:
            return

        with self._lock:
            stale_names = [
                name for name in self._subscriptions
                if name not in action_names
            ]
            stale_entries = [
                self._subscriptions.pop(name)
                for name in stale_names
            ]

        self._result_runtime.cleanup_actions(stale_names)

        for entry in stale_entries:
            self._destroy_entry_subscriptions(entry)

    def _destroy_entry_subscriptions(
        self,
        entry: dict[str, Any],
    ) -> None:
        destroy_entry_subscriptions(self._node_getter(), entry)
