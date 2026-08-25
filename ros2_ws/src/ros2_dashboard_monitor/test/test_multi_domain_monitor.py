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


def test_stored_domains_come_only_from_user_preferences_yaml(tmp_path, monkeypatch):
    preferences = Path(tmp_path) / 'user_preferences.yaml'
    preferences.write_text('domains:\n  ids: [2, 0, 2, true]\n', encoding='utf-8')
    monkeypatch.setenv('USER_PREFERENCES_PATH', str(preferences))
    monkeypatch.setenv('ROS_DOMAIN_ID', '99')

    assert module._stored_domain_ids() == [0, 2]
