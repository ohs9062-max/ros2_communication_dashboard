"""Action Graph 조회와 endpoint count 집계 회귀 테스트입니다."""

from ros2_dashboard_monitor.ros2_action import graph


class _Node:
    def get_node_names_and_namespaces(self):
        return [('server_a', '/'), ('server_b', '/robots')]


def test_action_count_maps_aggregates_each_node_endpoint(monkeypatch) -> None:
    monkeypatch.setattr(
        graph,
        'get_action_server_names_and_types_by_node',
        lambda _node, node_name, _namespace: [
            ('/shared', ['demo/action/Work']),
            (f'/{node_name}', ['demo/action/Work']),
        ],
    )
    monkeypatch.setattr(
        graph,
        'get_action_client_names_and_types_by_node',
        lambda _node, _node_name, _namespace: [
            ('/shared', ['demo/action/Work']),
        ],
    )

    servers, clients = graph.action_count_maps(_Node())

    assert servers == {'/shared': 2, '/server_a': 1, '/server_b': 1}
    assert clients == {'/shared': 2}


def test_action_names_query_failure_returns_empty_list(monkeypatch) -> None:
    def fail(_node):
        raise RuntimeError('graph unavailable')

    monkeypatch.setattr(graph, 'get_action_names_and_types', fail)

    assert graph.read_action_names_and_types(_Node()) == []


def test_node_graph_failure_returns_empty_count_maps() -> None:
    class BrokenNode:
        def get_node_names_and_namespaces(self):
            raise RuntimeError('node graph unavailable')

    assert graph.action_count_maps(BrokenNode()) == ({}, {})
