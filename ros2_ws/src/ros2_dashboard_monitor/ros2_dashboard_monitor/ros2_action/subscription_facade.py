"""Action status/feedback/result 관찰 subscription facade입니다."""

from __future__ import annotations

from time import time
from typing import Any

from ros2_dashboard_monitor.ros2_action.subscription_lifecycle import (
    action_capabilities,
    create_feedback_subscription,
    create_status_subscription,
    default_action_qos,
    destroy_entry_subscriptions,
    monitor_subscription_count,
    update_action_topic_subscriptions,
)
from ros2_dashboard_monitor.ros2_action.subscriptions import (
    action_history_snapshot,
    action_entry_matches,
    build_action_subscription_entry,
    runtime_snapshot,
    update_feedback_runtime,
    update_status_runtime,
)


class ActionSubscriptionFacade:
    """Action 관찰 endpoint 생성, callback 상태와 cleanup을 조정합니다."""

    def monitor_subscriber_count(self, topic_name: str) -> int:
        """Action status·feedback 관찰용 내부 subscription 수를 반환합니다."""
        with self._lock:
            entries = list(self._subscriptions.items())
        return monitor_subscription_count(entries, topic_name)

    def _ensure_subscriptions(
        self,
        *,
        name: str,
        action_type: str | None,
    ) -> dict[str, Any]:
        node = self._node_getter()
        if node is None:
            return self._capabilities(None)

        with self._lock:
            entry = self._subscriptions.get(name)
            if action_entry_matches(entry, action_type=action_type):
                update_action_topic_subscriptions(
                    node=node,
                    name=name,
                    action_type=action_type,
                    entry=entry,
                    status_enabled=self._config.actions_auto_monitor_status,
                    feedback_enabled=self._config.actions_auto_monitor_feedback,
                    status_callback=self._status_callback(name),
                    feedback_callback=self._feedback_callback(name),
                )
                return self._capabilities(entry)

            if entry is not None:
                self._destroy_entry_subscriptions(entry)

            entry = build_action_subscription_entry(
                action_name=name,
                action_type=action_type,
                history_limit=self._config.actions_history_limit,
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

    def history_for_action(
        self,
        *,
        action_name: str,
        action_type: str | None = None,
        limit: int | None = None,
    ) -> dict[str, Any]:
        history_limit = max(1, min(
            int(limit or self._config.actions_history_limit),
            self._config.actions_history_limit,
        ))
        with self._lock:
            entry = self._subscriptions.get(action_name)
            if (
                entry is not None
                and action_type
                and entry.get('type') != action_type
            ):
                entry = None
            history = action_history_snapshot(entry, limit=history_limit)
        return {
            'history': history,
            'meta': {
                'count': len(history),
                'limit': self._config.actions_history_limit,
                'source': 'monitor_observed',
            },
        }

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
