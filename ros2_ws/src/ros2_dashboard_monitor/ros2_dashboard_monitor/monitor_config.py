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
class FastDdsObserverConfig:
    enabled: bool = True
    port: int = 8766
    poll_interval_sec: float = 0.5
    request_timeout_sec: float = 0.2


@dataclass(frozen=True)
class CameraPreviewConfig:
    demand_ttl_sec: float = 3.0
    min_interval_sec: float = 0.5
    max_source_bytes: int = 4_000_000
    max_width: int = 1920
    max_height: int = 1080


@dataclass(frozen=True)
class QosAlertConfig:
    incompatible_confirmation_count: int = 3


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
    topics_history_limit: int = 100
    camera_preview: CameraPreviewConfig = field(default_factory=CameraPreviewConfig)
    qos_alerts: QosAlertConfig = field(default_factory=QosAlertConfig)
    services_include: tuple[str, ...] = ()
    services_primary_names: tuple[str, ...] = ()
    services_exclude: tuple[str, ...] = ()
    services_exclude_prefixes: tuple[str, ...] = ()
    services_graph_missing_timeout_sec: float = 5.0
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
    actions_graph_missing_timeout_sec: float = 5.0
    actions_auto_monitor_status: bool = True
    actions_auto_monitor_feedback: bool = True
    actions_auto_fetch_result_for_observed_goals: bool = True
    actions_history_limit: int = 100
    fastdds_observer: FastDdsObserverConfig = field(
        default_factory=FastDdsObserverConfig,
    )


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
    fastdds_observer = mapping(data.get('fastdds_observer'))
    camera_preview = mapping(topics.get('camera_preview'))
    qos_alerts = mapping(mapping(data.get('alerts')).get('qos'))

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
        topics_history_limit=bounded_integer(
            topics.get('history_limit'), default=100,
            minimum=1, maximum=500,
        ),
        camera_preview=CameraPreviewConfig(
            demand_ttl_sec=positive_float(
                camera_preview.get('demand_ttl_sec'), default=3.0,
            ),
            min_interval_sec=positive_float(
                camera_preview.get('min_interval_sec'), default=0.5,
            ),
            max_source_bytes=bounded_integer(
                camera_preview.get('max_source_bytes'), default=4_000_000,
                minimum=1024, maximum=32_000_000,
            ),
            max_width=bounded_integer(
                camera_preview.get('max_width'), default=1920,
                minimum=1, maximum=8192,
            ),
            max_height=bounded_integer(
                camera_preview.get('max_height'), default=1080,
                minimum=1, maximum=8192,
            ),
        ),
        qos_alerts=QosAlertConfig(
            incompatible_confirmation_count=bounded_integer(
                qos_alerts.get('incompatible_confirmation_count'), default=3,
                minimum=1, maximum=20,
            ),
        ),
        services_include=config_string_tuple(services, 'include'),
        services_primary_names=config_string_tuple(services, 'primary_names'),
        services_exclude=config_string_tuple(services, 'exclude'),
        services_exclude_prefixes=config_string_tuple(services, 'exclude_prefixes'),
        services_graph_missing_timeout_sec=positive_float(
            services.get('graph_missing_timeout_sec'), default=5.0,
        ),
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
        actions_graph_missing_timeout_sec=positive_float(
            actions.get('graph_missing_timeout_sec'), default=5.0,
        ),
        actions_auto_monitor_status=boolean(
            actions.get('auto_monitor_status'), default=True,
        ),
        actions_auto_monitor_feedback=boolean(
            actions.get('auto_monitor_feedback'), default=True,
        ),
        actions_auto_fetch_result_for_observed_goals=boolean(
            actions.get('auto_fetch_result_for_observed_goals'), default=True,
        ),
        actions_history_limit=bounded_integer(
            actions.get('history_limit'), default=100,
            minimum=1, maximum=500,
        ),
        fastdds_observer=FastDdsObserverConfig(
            enabled=boolean(fastdds_observer.get('enabled'), default=True),
            port=bounded_integer(
                fastdds_observer.get('port'), default=8766,
                minimum=1, maximum=65535,
            ),
            poll_interval_sec=positive_float(
                fastdds_observer.get('poll_interval_sec'), default=0.5,
            ),
            request_timeout_sec=positive_float(
                fastdds_observer.get('request_timeout_sec'), default=0.2,
            ),
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


def bounded_integer(
    value: Any, *, default: int, minimum: int, maximum: int,
) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default
    return parsed if minimum <= parsed <= maximum else default


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
