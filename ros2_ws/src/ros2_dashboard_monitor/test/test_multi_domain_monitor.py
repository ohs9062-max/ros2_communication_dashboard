"""Multi-domain runtime lifecycle and resource routing regressions."""

from pathlib import Path
from types import SimpleNamespace

import pytest

from ros2_dashboard_monitor import multi_domain_monitor as module


class _Runtime:
    instances = {}

    def __init__(self, _config, *, priority_state=None, domain_id=None, observer_port=None):
        self.domain_id = domain_id
        self.observer_port = observer_port
        self.started = False
        self.stopped = False
        self.instances[domain_id] = self

    def start(self):
        self.started = True

    def stop(self):
        self.stopped = True

    def domain_snapshot(self):
        return {'status': 'monitoring' if self.started and not self.stopped else 'stopped'}

    def publish_topic(self, **kwargs):
        return {'runtime_domain_id': self.domain_id, **kwargs}

    def topic_publish_history(self, **_kwargs):
        return {'history': [{'topic_name': '/same', 'topic_type': 'demo/msg/Value'}]}

    def topic_hz(self, name):
        return {'success': True, 'data': {'name': name, 'hz': self.domain_id}}


@pytest.fixture
def monitor(monkeypatch):
    _Runtime.instances = {}
    monkeypatch.setattr(module, 'RosMonitor', _Runtime)
    monkeypatch.setattr(module, '_stored_domain_ids', lambda: [])
    config = SimpleNamespace(fastdds_observer=SimpleNamespace(port=8766))
    return module.MultiDomainRosMonitor(config)


def test_add_remove_and_empty_domain_list_control_exact_runtimes(monitor):
    monitor.set_domain_ids([2, 0])
    zero = _Runtime.instances[0]
    two = _Runtime.instances[2]

    assert zero.started and two.started
    assert zero.observer_port == 8766
    assert two.observer_port == 8768

    monitor.set_domain_ids([2])
    assert zero.stopped is True
    assert two.stopped is False

    snapshot = monitor.set_domain_ids([])
    assert two.stopped is True
    assert snapshot['domains'] == []
    assert snapshot['active_domain_ids'] == []


def test_execution_requires_domain_when_multiple_and_routes_selected_domain(monitor):
    monitor.set_domain_ids([0, 2])

    assert monitor.publish_topic(domain_id=2, topic_name='/same')['runtime_domain_id'] == 2
    with pytest.raises(ValueError, match='domain_id is required'):
        monitor.publish_topic(topic_name='/same')

    history = monitor.topic_publish_history()['history']
    assert {(item['domain_id'], item['resource_key']) for item in history} == {
        (0, '0:/same'),
        (2, '2:/same'),
    }


def test_topic_hz_response_keeps_selected_domain_resource_identity(monitor):
    monitor.set_domain_ids([0, 2])

    response = monitor.topic_hz('/same', domain_id=2)

    assert response['data'] == {
        'name': '/same',
        'hz': 2,
        'domain_id': 2,
        'resource_key': '2:/same',
    }


def test_callable_resources_drop_domain_placeholders_and_keep_real_candidate():
    values = [
        {
            'service_name': '', 'service_type': 'demo/srv/Read',
            'domain_id': domain_id, 'resource_key': f'{domain_id}:', 'callable': False,
        }
        for domain_id in range(5)
    ]
    values.append({
        'service_name': '/read', 'service_type': 'demo/srv/Read',
        'domain_id': 2, 'resource_key': '2:/read', 'callable': True, 'server_count': 1,
    })

    resources = module._actual_callable_resources(values, 'services')

    assert len(resources) == 1
    assert resources[0]['resource_key'] == '2:/read'

    assert module._actual_callable_resources(values[:-1], 'services') == []


def test_same_named_callable_in_multiple_domains_keeps_each_actual_resource():
    values = [
        {
            'action_name': '/work', 'action_type': 'demo/action/Work',
            'domain_id': domain_id, 'resource_key': f'{domain_id}:/work',
            'callable': True, 'server_count': 1,
        }
        for domain_id in (0, 2)
    ]

    resources = module._actual_callable_resources(values, 'actions')

    assert len(resources) == 2
    assert [item['resource_key'] for item in resources] == ['0:/work', '2:/work']


def test_callable_query_uses_cached_server_presence_to_skip_empty_domain():
    class Runtime:
        def __init__(self, count):
            self._service_runtime = self
            self._action_runtime = self
            self.count = count

        def snapshot(self, include_hidden=None):
            if include_hidden is not None:
                assert include_hidden is True
                return {'services': [{'server_count': self.count}]}
            return {'actions': [{'server_count': self.count}]}

    assert module._runtime_has_server(Runtime(1), 'services') is True
    assert module._runtime_has_server(Runtime(0), 'services') is False
    assert module._runtime_has_server(Runtime(1), 'actions') is True


def test_snapshot_reuse_keeps_domain_slice_for_node_and_alert_assembly(monitor):
    class Runtime:
        def __init__(self, domain_id):
            self.domain_id = domain_id
            self.received = {}

        def node_snapshot(self, **snapshots):
            self.received['node'] = snapshots
            return {'nodes': [{'name': f'/node_{self.domain_id}'}]}

        def alerts(self, **snapshots):
            self.received['alert'] = snapshots
            return {'data': []}

    runtimes = {domain_id: Runtime(domain_id) for domain_id in (0, 2)}
    monitor._runtimes = runtimes
    topics = {'topics': [
        {'name': '/same', 'domain_id': 0},
        {'name': '/same', 'domain_id': 2},
    ]}
    services = {'services': []}
    actions = {'actions': []}

    nodes = monitor.node_snapshot(
        topic_snapshot=topics, service_snapshot=services, action_snapshot=actions,
    )
    monitor.alerts(
        topic_snapshot=topics, service_snapshot=services,
        action_snapshot=actions, node_snapshot=nodes,
    )

    assert runtimes[0].received['node']['topic_snapshot']['topics'] == [topics['topics'][0]]
    assert runtimes[2].received['node']['topic_snapshot']['topics'] == [topics['topics'][1]]
    assert runtimes[0].received['alert']['node_snapshot']['nodes'][0]['domain_id'] == 0
    assert runtimes[2].received['alert']['node_snapshot']['nodes'][0]['domain_id'] == 2


def test_stored_domains_come_only_from_user_preferences_yaml(tmp_path, monkeypatch):
    preferences = Path(tmp_path) / 'user_preferences.yaml'
    preferences.write_text('domains:\n  ids: [2, 0, 2, true]\n', encoding='utf-8')
    monkeypatch.setenv('USER_PREFERENCES_PATH', str(preferences))
    monkeypatch.setenv('ROS_DOMAIN_ID', '99')

    assert module._stored_domain_ids() == [0, 2]
