from threading import Lock

from ros2_dashboard_monitor.config_loader import (
    DEFAULT_TOPIC_EXCLUDES,
    MonitorConfig,
    _monitor_config,
)
from ros2_dashboard_monitor.ros2_service.runtime import ServiceRuntime
from ros2_dashboard_monitor.ros2_topic.runtime import TopicRuntime


class _TopicNode:
    def __init__(self, name: str, full_type: str) -> None:
        self.name = name
        self.full_type = full_type

    def get_topic_names_and_types(self):
        return [(self.name, [self.full_type])]

    def count_publishers(self, _name):
        return 1

    def count_subscribers(self, _name):
        return 0

    def get_name(self):
        return 'monitor'

    def get_namespace(self):
        return '/'

    def get_subscriptions_info_by_topic(self, _name):
        return []


class _ServiceNode:
    def get_service_names_and_types(self):
        return [
            ('/internal/reset', ['example_interfaces/srv/Trigger']),
            ('/RobotControl', ['example_interfaces/srv/Trigger']),
        ]

    def count_services(self, _name):
        return 1

    def count_clients(self, _name):
        return 0


def test_missing_topic_exclude_names_uses_safe_defaults() -> None:
    config = _monitor_config({'topics': {}})

    assert config.topics_exclude == DEFAULT_TOPIC_EXCLUDES


def test_explicit_empty_topic_exclude_names_stays_empty() -> None:
    config = _monitor_config({'topics': {'exclude_names': []}})

    assert config.topics_exclude == ()


def test_explicit_topic_exclude_names_uses_only_configured_values() -> None:
    config = _monitor_config({
        'topics': {'exclude_names': ['/rosout']},
    })

    assert config.topics_exclude == ('/rosout',)


def test_camera_preview_limits_are_loaded_and_bounded() -> None:
    config = _monitor_config({
        'topics': {
            'camera_preview': {
                'demand_ttl_sec': 4,
                'min_interval_sec': 0.25,
                'max_source_bytes': 123456,
                'max_width': 640,
                'max_height': 480,
            },
        },
    })

    assert config.camera_preview.demand_ttl_sec == 4
    assert config.camera_preview.min_interval_sec == 0.25
    assert config.camera_preview.max_source_bytes == 123456
    assert config.camera_preview.max_width == 640
    assert config.camera_preview.max_height == 480


def test_topic_history_limit_is_loaded_and_bounded() -> None:
    assert _monitor_config({}).topics_history_limit == 100
    assert _monitor_config({'topics': {'history_limit': 12}}).topics_history_limit == 12
    assert _monitor_config({'topics': {'history_limit': 1000}}).topics_history_limit == 100


def test_action_history_limit_is_loaded_and_bounded() -> None:
    assert _monitor_config({}).actions_history_limit == 100
    assert _monitor_config({'actions': {'history_limit': 12}}).actions_history_limit == 12
    assert _monitor_config({'actions': {'history_limit': 1000}}).actions_history_limit == 100


def test_qos_alert_confirmation_count_uses_default_and_config_value() -> None:
    assert _monitor_config({}).qos_alerts.incompatible_confirmation_count == 3
    configured = _monitor_config({
        'alerts': {'qos': {'incompatible_confirmation_count': 2}},
    })
    assert configured.qos_alerts.incompatible_confirmation_count == 2


def test_graph_missing_timeouts_use_defaults_and_config_values() -> None:
    defaults = _monitor_config({})
    assert defaults.nodes_stale_timeout_sec == 5.0
    assert defaults.services_graph_missing_timeout_sec == 5.0
    assert defaults.actions_graph_missing_timeout_sec == 5.0
    configured = _monitor_config({
        'nodes': {'stale_timeout_sec': 2},
        'services': {'graph_missing_timeout_sec': 3},
        'actions': {'graph_missing_timeout_sec': 4},
    })
    assert configured.nodes_stale_timeout_sec == 2.0
    assert configured.services_graph_missing_timeout_sec == 3.0
    assert configured.actions_graph_missing_timeout_sec == 4.0


def test_primary_resource_names_are_loaded_separately_from_include_filters() -> None:
    config = _monitor_config({
        'services': {'primary_names': ['/robot/reset']},
        'actions': {'primary_names': ['/robot/navigate']},
        'nodes': {'primary_names': ['/robot/controller']},
    })

    assert config.services_primary_names == ('/robot/reset',)
    assert config.actions_primary_names == ('/robot/navigate',)
    assert config.nodes_primary_names == ('/robot/controller',)
    assert config.services_include == ()
    assert config.actions_include == ()
    assert config.nodes_include == ()


def test_topic_exclude_prefixes_are_applied_by_runtime() -> None:
    runtime = _topic_runtime(
        node=_TopicNode('/internal/data', 'std_msgs/msg/String'),
        config=_monitor_config({
            'topics': {
                'exclude_names': [],
                'exclude_prefixes': ['/internal'],
            },
        }),
    )

    runtime.update()

    assert runtime.snapshot()['topics'] == []


def test_topic_exclude_types_are_applied_by_runtime() -> None:
    runtime = _topic_runtime(
        node=_TopicNode('/camera', 'sensor_msgs/msg/Image'),
        config=_monitor_config({
            'topics': {
                'exclude_names': [],
                'exclude_types': ['sensor_msgs/msg/Image'],
            },
        }),
    )

    runtime.update()

    assert runtime.snapshot()['topics'] == []


def test_service_exclude_prefixes_override_include_names() -> None:
    node = _ServiceNode()
    config = _monitor_config({
        'services': {
            'include_names': ['/internal/reset', '/RobotControl'],
            'exclude_prefixes': ['/internal'],
        },
    })
    runtime = ServiceRuntime(
        config=config,
        lock=Lock(),
        node_getter=lambda: node,
    )

    services = runtime.update()

    assert [service['name'] for service in services] == ['/RobotControl']


def _topic_runtime(*, node: _TopicNode, config: MonitorConfig) -> TopicRuntime:
    return TopicRuntime(
        action_monitor_subscriber_count=lambda _name: 0,
        config=config,
        lock=Lock(),
        node_getter=lambda: node,
    )
