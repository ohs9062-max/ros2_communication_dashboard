from pathlib import Path

import ros2_dashboard_monitor.dds_observer as dds_observer
from ros2_dashboard_monitor.dds_observer import FastDdsQosObserver
from ros2_dashboard_monitor.monitor_config import FastDdsObserverConfig
from ros2_dashboard_monitor.ros2_action.subscription_lifecycle import observe_action_qos

from test_qos import TopicNode


def endpoint(service_name, channel, kind):
    return {
        'guid': f'participant-{service_name}|{channel}-{kind}',
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
    observer._replace_snapshot({
        'available': True,
        'source': 'fastdds_discovery',
        'endpoints': endpoints,
    })
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
    assert state['remote_qos'][0]['participant_id'] == 'participant-/add'


def test_service_qos_does_not_copy_unrelated_service_endpoints():
    class Uncopyable:
        def __deepcopy__(self, memo):
            raise AssertionError('unrelated endpoint was copied')

    unrelated = endpoint('/other', 'request', 'reader')
    unrelated['qos'] = Uncopyable()
    observer = observer_with([
        endpoint('/add', 'request', 'reader'),
        endpoint('/add', 'response', 'writer'),
        unrelated,
    ])

    state = observer.service_qos('/add')

    assert state['qos_detection_source'] == 'fastdds_discovery'
    assert len(state['remote_qos']) == 2


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


def test_observer_executable_falls_back_to_sibling_install(monkeypatch, tmp_path):
    install_root = tmp_path / 'install'
    monitor_prefix = install_root / 'ros2_dashboard_monitor'
    executable = (
        install_root / 'ros2_dashboard_dds_observer' / 'lib'
        / 'ros2_dashboard_dds_observer' / 'fastdds_qos_observer'
    )
    executable.parent.mkdir(parents=True)
    executable.touch()

    def package_prefix(package_name):
        if package_name == 'ros2_dashboard_dds_observer':
            raise LookupError('observer missing from stale ament environment')
        return str(monitor_prefix)

    monkeypatch.setattr(dds_observer, 'get_package_prefix', package_prefix)

    assert dds_observer.observer_executable() == executable
