from pathlib import Path

from ros2_dashboard_monitor.dds_observer import FastDdsQosObserver
from ros2_dashboard_monitor.monitor_config import FastDdsObserverConfig
from ros2_dashboard_monitor.ros2_action.subscription_lifecycle import observe_action_qos

from test_qos import TopicNode


def endpoint(service_name, channel, kind):
    return {
        'guid': f'{service_name}-{channel}-{kind}',
        'dds_topic': f'rq{service_name}Request',
        'dds_type': 'example_interfaces::srv::dds_::AddTwoInts_Request_',
        'service_name': service_name,
        'service_channel': channel,
        'endpoint_kind': kind,
        'service_role': (
            'server'
            if (channel, kind) in {('request', 'reader'), ('response', 'writer')}
            else 'client'
        ),
        'qos': {
            'reliability': 'reliable',
            'durability': 'volatile',
            'history': 'unknown',
            'depth': None,
            'deadline_ns': None,
            'deadline_status': 'infinite',
            'lifespan_ns': None,
            'lifespan_status': 'infinite' if kind == 'writer' else 'unknown',
            'liveliness': 'automatic',
            'liveliness_lease_duration_ns': None,
            'liveliness_lease_duration_status': 'infinite',
        },
    }


def observer_with(endpoints):
    observer = FastDdsQosObserver(
        FastDdsObserverConfig(), executable_resolver=lambda: Path('/unused'),
    )
    observer._snapshot = {
        'available': True,
        'source': 'fastdds_discovery',
        'endpoints': endpoints,
    }
    return observer


def test_service_qos_exposes_discovered_values_without_inventing_history_depth():
    observer = observer_with([
        endpoint('/add', 'request', 'reader'),
        endpoint('/add', 'response', 'writer'),
    ])

    state = observer.service_qos('/add')

    assert state['qos_detection_source'] == 'fastdds_discovery'
    assert state['subscriber_qos'][0]['service_channel'] == 'request'
    assert state['publisher_qos'][0]['service_channel'] == 'response'
    assert state['remote_qos'][0]['qos']['history'] == 'unknown'
    assert state['remote_qos'][0]['qos']['depth'] is None


def test_action_uses_dds_services_and_keeps_topic_graph_observation():
    names = {
        '/work/_action/send_goal',
        '/work/_action/get_result',
        '/work/_action/cancel_goal',
    }
    observer = observer_with([
        endpoint(name, 'request', 'reader')
        for name in names
    ])

    state = observe_action_qos(TopicNode(), '/work', observer.service_qos)

    assert state['goal']['qos_detection_source'] == 'fastdds_discovery'
    assert state['result']['qos_detection_source'] == 'fastdds_discovery'
    assert state['cancel']['qos_detection_source'] == 'fastdds_discovery'
    assert state['feedback']['qos_detection_source'] == 'graph_unavailable'
    assert state['status']['qos_detection_source'] == 'graph_unavailable'


def test_unavailable_observer_degrades_only_service_qos():
    observer = FastDdsQosObserver(FastDdsObserverConfig(enabled=False))

    state = observer.service_qos('/add')

    assert state['qos_visibility'] == 'graph_unavailable'
    assert state['local_qos'] is None
    assert state['observer_reason'] == 'observer_not_started'


def test_non_fastdds_rmw_does_not_start_vendor_helper():
    resolved = []
    observer = FastDdsQosObserver(
        FastDdsObserverConfig(),
        executable_resolver=lambda: resolved.append(True) or Path('/unused'),
    )

    observer.start('rmw_cyclonedds_cpp', 42)

    assert resolved == []
    assert observer.snapshot()['reason'] == 'unsupported_rmw'
