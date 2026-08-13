from ros2_dashboard_monitor.ros2_action.models import action_meta
from ros2_dashboard_monitor.ros2_node.models import node_meta
from ros2_dashboard_monitor.resource_state import (
    debounce_disconnected_resource,
    disconnected_resource,
    mark_graph_present,
)
from ros2_dashboard_monitor.ros2_service.models import service_meta


def test_graph_resource_transitions_from_present_to_disconnected() -> None:
    present = mark_graph_present(
        {
            'name': '/demo',
            'status': 'active',
            'publisher_count': 1,
        },
        observed_at=100.0,
    )
    disconnected = disconnected_resource(
        present,
        detected_at=105.0,
        count_fields=('publisher_count',),
    )

    assert present['graph_present'] is True
    assert present['ever_discovered'] is True
    assert present['last_seen_at'] == 100.0
    assert disconnected['status'] == 'disconnected'
    assert disconnected['graph_present'] is False
    assert disconnected['disconnected_at'] == 105.0
    assert disconnected['last_seen_at'] == 100.0
    assert disconnected['publisher_count'] == 0


def test_graph_missing_is_pending_until_timeout_and_recovers_immediately() -> None:
    present = mark_graph_present({'name': '/demo', 'status': 'active', 'publisher_count': 1}, observed_at=100.0)
    pending = debounce_disconnected_resource(
        present, detected_at=101.0, timeout_sec=3.0,
        count_fields=('publisher_count',),
    )
    still_pending = debounce_disconnected_resource(
        pending, detected_at=103.9, timeout_sec=3.0,
        count_fields=('publisher_count',),
    )
    disconnected = debounce_disconnected_resource(
        still_pending, detected_at=104.0, timeout_sec=3.0,
        count_fields=('publisher_count',),
    )
    recovered = mark_graph_present(
        {**disconnected, 'status': 'active', 'publisher_count': 1},
        observed_at=104.1,
    )

    assert pending['status'] == 'active'
    assert pending['graph_missing_pending'] is True
    assert still_pending['status'] == 'active'
    assert disconnected['status'] == 'disconnected'
    assert recovered['status'] == 'active'
    assert recovered['graph_present'] is True
    assert recovered['graph_missing_pending'] is False


def test_disconnected_is_error_but_unknown_is_neutral_in_meta() -> None:
    services = [
        {'status': 'unknown', 'hidden_by_default': False},
        {'status': 'disconnected', 'hidden_by_default': False},
    ]
    actions = [
        {'status': 'unknown'},
        {'status': 'disconnected'},
    ]
    nodes = [
        {'status': 'unknown'},
        {'status': 'disconnected'},
    ]

    assert service_meta(
        services=services,
        last_updated=1.0,
    )['error_count'] == 1
    assert action_meta(
        actions=actions,
        last_updated=1.0,
    )['error_count'] == 1
    assert node_meta(
        nodes=nodes,
        last_updated=1.0,
    )['error_count'] == 1
