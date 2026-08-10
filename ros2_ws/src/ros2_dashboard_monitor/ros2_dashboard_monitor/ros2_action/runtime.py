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
from ros2_dashboard_monitor.ros2_action.subscription_facade import (
    ActionSubscriptionFacade,
)
from ros2_dashboard_monitor.config_loader import MonitorConfig
from ros2_dashboard_monitor.resource_state import (
    disconnected_resource,
    mark_graph_present,
)

class ActionRuntime(ActionSubscriptionFacade):
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
