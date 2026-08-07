"""Monitor configuration models and YAML value normalization."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ros2_dashboard_monitor.ros2_topic.models import SUPPORTED_PREVIEW_TYPES


DEFAULT_TOPIC_EXCLUDES = (
    '/parameter_events',
    '/rosout',
    '/tf',
    '/tf_static',
    '/clock',
)
DEFAULT_SUPPORTED_TOPIC_TYPES = SUPPORTED_PREVIEW_TYPES


@dataclass(frozen=True)
class ServiceActiveCheckTarget:
    name: str
    service_type: str
    timeout_sec: float
    request: dict[str, Any] | None
    success_field: str | None


@dataclass(frozen=True)
class ServiceActiveCheckConfig:
    enabled: bool = False
    interval_sec: float = 10.0
    default_timeout_sec: float = 2.0
    allowlist: tuple[ServiceActiveCheckTarget, ...] = ()


@dataclass(frozen=True)
class MonitorConfig:
    poll_interval_sec: float = 1.0
    stale_timeout_sec: float = 3.0
    hz_window_sec: float = 5.0
    topics_auto_discover: bool = True
    topics_auto_subscribe_supported_types: bool = True
    topics_include: tuple[str, ...] = ()
    topics_exclude: tuple[str, ...] = DEFAULT_TOPIC_EXCLUDES
    topics_exclude_prefixes: tuple[str, ...] = ()
    topics_exclude_types: tuple[str, ...] = ()
    topics_supported_types: tuple[str, ...] = DEFAULT_SUPPORTED_TOPIC_TYPES
    topics_registered_types: tuple[str, ...] = ()
    topics_required_stream_names: tuple[str, ...] = ()
    topics_command_names: tuple[str, ...] = ()
    services_include: tuple[str, ...] = ()
    services_primary_names: tuple[str, ...] = ()
    services_exclude: tuple[str, ...] = ()
    services_exclude_prefixes: tuple[str, ...] = ()
    services_active_check: ServiceActiveCheckConfig = field(
        default_factory=ServiceActiveCheckConfig,
    )
    nodes_include: tuple[str, ...] = ()
    nodes_primary_names: tuple[str, ...] = ()
    nodes_exclude: tuple[str, ...] = ()
    nodes_exclude_prefixes: tuple[str, ...] = ()
    nodes_stale_timeout_sec: float = 5.0
    actions_include: tuple[str, ...] = ()
    actions_primary_names: tuple[str, ...] = ()
    actions_exclude: tuple[str, ...] = ()
    actions_exclude_prefixes: tuple[str, ...] = ()
    actions_auto_monitor_status: bool = True
    actions_auto_monitor_feedback: bool = True
    actions_auto_fetch_result_for_observed_goals: bool = True


def build_monitor_config(
    data: dict[str, Any],
    *,
    registered_message_types: tuple[str, ...] = (),
) -> MonitorConfig:
    monitor = mapping(data.get('monitor'))
    topics = mapping(data.get('topics'))
    services = mapping(data.get('services'))
    nodes = mapping(data.get('nodes'))
    actions = mapping(data.get('actions'))

    return MonitorConfig(
        poll_interval_sec=positive_float(monitor.get('poll_interval_sec'), default=1.0),
        stale_timeout_sec=positive_float(monitor.get('stale_timeout_sec'), default=3.0),
        hz_window_sec=positive_float(monitor.get('hz_window_sec'), default=5.0),
        topics_auto_discover=boolean(topics.get('auto_discover'), default=True),
        topics_auto_subscribe_supported_types=boolean(
            topics.get('auto_subscribe_supported_types'), default=True,
        ),
        topics_include=config_string_tuple(topics, 'include'),
        topics_exclude=config_string_tuple(
            topics, 'exclude', default=DEFAULT_TOPIC_EXCLUDES,
        ),
        topics_exclude_prefixes=config_string_tuple(topics, 'exclude_prefixes'),
        topics_exclude_types=config_string_tuple(topics, 'exclude_types'),
        topics_supported_types=tuple(dict.fromkeys(
            string_tuple(
                topics.get('supported_types'),
                default=DEFAULT_SUPPORTED_TOPIC_TYPES,
            ) + registered_message_types,
        )),
        topics_registered_types=tuple(dict.fromkeys(registered_message_types)),
        topics_required_stream_names=string_tuple(topics.get('required_stream_names')),
        topics_command_names=string_tuple(topics.get('command_names')),
        services_include=config_string_tuple(services, 'include'),
        services_primary_names=config_string_tuple(services, 'primary_names'),
        services_exclude=config_string_tuple(services, 'exclude'),
        services_exclude_prefixes=config_string_tuple(services, 'exclude_prefixes'),
        services_active_check=service_active_check_config(services.get('active_check')),
        nodes_include=config_string_tuple(nodes, 'include'),
        nodes_primary_names=config_string_tuple(nodes, 'primary_names'),
        nodes_exclude=config_string_tuple(nodes, 'exclude'),
        nodes_exclude_prefixes=config_string_tuple(nodes, 'exclude_prefixes'),
        nodes_stale_timeout_sec=positive_float(
            nodes.get('stale_timeout_sec'), default=5.0,
        ),
        actions_include=config_string_tuple(actions, 'include'),
        actions_primary_names=config_string_tuple(actions, 'primary_names'),
        actions_exclude=config_string_tuple(actions, 'exclude'),
        actions_exclude_prefixes=config_string_tuple(actions, 'exclude_prefixes'),
        actions_auto_monitor_status=boolean(
            actions.get('auto_monitor_status'), default=True,
        ),
        actions_auto_monitor_feedback=boolean(
            actions.get('auto_monitor_feedback'), default=True,
        ),
        actions_auto_fetch_result_for_observed_goals=boolean(
            actions.get('auto_fetch_result_for_observed_goals'), default=True,
        ),
    )


def mapping(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def positive_float(value: Any, *, default: float) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return default
    return parsed if parsed > 0 else default


def boolean(value: Any, *, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in ('true', '1', 'yes', 'on'):
            return True
        if normalized in ('false', '0', 'no', 'off'):
            return False
    return default


def string_tuple(
    value: Any,
    *,
    default: tuple[str, ...] = (),
) -> tuple[str, ...]:
    if not isinstance(value, list):
        return default
    return tuple(item for item in value if isinstance(item, str) and item)


def config_string_tuple(
    data: dict[str, Any],
    base_key: str,
    *,
    default: tuple[str, ...] = (),
) -> tuple[str, ...]:
    """Prefer current keys while retaining legacy ``*_names`` compatibility."""
    explicit_key = f'{base_key}_names'
    if base_key in data:
        return string_tuple(data.get(base_key), default=default)
    if explicit_key in data:
        return string_tuple(data.get(explicit_key), default=default)
    return default


def service_active_check_config(value: Any) -> ServiceActiveCheckConfig:
    data = mapping(value)
    default_timeout_sec = positive_float(
        data.get('default_timeout_sec'), default=2.0,
    )
    return ServiceActiveCheckConfig(
        enabled=boolean(data.get('enabled'), default=False),
        interval_sec=positive_float(data.get('interval_sec'), default=10.0),
        default_timeout_sec=default_timeout_sec,
        allowlist=service_active_check_allowlist(
            data.get('allowlist'), default_timeout_sec=default_timeout_sec,
        ),
    )


def service_active_check_allowlist(
    value: Any,
    *,
    default_timeout_sec: float,
) -> tuple[ServiceActiveCheckTarget, ...]:
    if not isinstance(value, list):
        return ()

    targets = []
    for item in value:
        data = mapping(item)
        name = data.get('name')
        service_type = data.get('type')
        if not isinstance(name, str) or not name:
            continue
        if not isinstance(service_type, str) or not service_type:
            continue

        request = data.get('request')
        if request is not None and not isinstance(request, dict):
            request = None
        success_field = data.get('success_field')
        if success_field is not None and not isinstance(success_field, str):
            success_field = None

        targets.append(ServiceActiveCheckTarget(
            name=name,
            service_type=service_type,
            timeout_sec=positive_float(
                data.get('timeout_sec'), default=default_timeout_sec,
            ),
            request=request,
            success_field=success_field,
        ))
    return tuple(targets)
