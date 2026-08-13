from ros2_dashboard_monitor.transport import api as transport_api


class _Monitor:
    def __init__(self):
        self.calls = []
        self.topics = {'topics': [{'name': '/topic'}]}
        self.all_services = {
            'services': [
                {'name': '/visible', 'hidden_by_default': False},
                {'name': '/hidden', 'hidden_by_default': True},
            ],
            'meta': {'count': 2},
        }
        self.actions = {'actions': [{'name': '/action'}], 'meta': {}}
        self.nodes = {'nodes': [{'name': '/node'}], 'meta': {}}

    def snapshot(self):
        self.calls.append('topics')
        return self.topics

    def service_snapshot(self, *, include_hidden=False):
        self.calls.append(('services', include_hidden))
        assert include_hidden is True
        return self.all_services

    def action_snapshot(self):
        self.calls.append('actions')
        return self.actions

    def node_snapshot(self, **snapshots):
        self.calls.append(('nodes', snapshots))
        return self.nodes

    def alerts(self, **snapshots):
        self.calls.append(('alerts', snapshots))
        return {'data': [], 'meta': {}}

    def websocket_snapshot(self, **snapshots):
        self.calls.append(('websocket', snapshots))
        return {'type': 'monitor_snapshot'}


def test_transport_snapshot_reuses_each_resource_snapshot(monkeypatch) -> None:
    monitor = _Monitor()
    monkeypatch.setattr(transport_api, 'ros_monitor', monitor)
    monkeypatch.setattr(transport_api, 'apply_status', lambda: {'status': 'idle'})

    response = transport_api.transport_snapshot()

    assert monitor.calls[:3] == ['topics', ('services', True), 'actions']
    node_snapshots = monitor.calls[3][1]
    assert node_snapshots == {
        'topic_snapshot': monitor.topics,
        'service_snapshot': monitor.all_services,
        'action_snapshot': monitor.actions,
    }
    assert [item['name'] for item in response['data']['services']['services']] == [
        '/visible',
    ]
    assert response['data']['services']['meta']['hidden_count'] == 1
    assert sum(call == 'topics' for call in monitor.calls) == 1
    assert sum(call == 'actions' for call in monitor.calls) == 1
    assert sum(call == ('services', True) for call in monitor.calls) == 1
