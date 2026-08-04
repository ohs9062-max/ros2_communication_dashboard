from pathlib import Path

import yaml

from ros2_dashboard_backend.user_preferences import (
    UserPreferencesError,
    UserPreferencesStore,
)
from ros2_dashboard_backend.ros_monitor import RosMonitor


def test_user_preferences_create_deduplicate_remove_and_persist(
    tmp_path: Path,
) -> None:
    path = tmp_path / 'user_preferences.yaml'
    store = UserPreferencesStore(path)

    assert path.is_file()
    assert store.snapshot()['priority']['topics'] == []

    first = store.set_priority('topics', '/custom/data', True)
    duplicate = store.set_priority('topics', '/custom/data', True)
    store.set_priority('nodes', '/custom_node', True)

    assert first['changed'] is True
    assert duplicate['changed'] is False
    assert UserPreferencesStore(path).snapshot()['priority'] == {
        'topics': ['/custom/data'],
        'services': [],
        'actions': [],
        'nodes': ['/custom_node'],
    }

    removed = store.set_priority('topics', '/custom/data', False)
    duplicate_remove = store.set_priority('topics', '/custom/data', False)
    assert removed['changed'] is True
    assert duplicate_remove['changed'] is False
    assert yaml.safe_load(path.read_text(encoding='utf-8'))['priority']['topics'] == []


def test_user_preferences_reject_unknown_kind(tmp_path: Path) -> None:
    store = UserPreferencesStore(tmp_path / 'user_preferences.yaml')

    try:
        store.set_priority('robots', '/robot', True)
    except UserPreferencesError as exc:
        assert '지원하지 않는' in str(exc)
    else:
        raise AssertionError('unknown kind must be rejected')


def test_final_primary_is_union_of_system_and_user_priority(tmp_path: Path) -> None:
    store = UserPreferencesStore(tmp_path / 'user_preferences.yaml')
    store.set_priority('topics', '/user_only', True)
    monitor = RosMonitor.__new__(RosMonitor)
    monitor._user_preferences = store

    automatic = {'name': '/automatic', 'primary': True}
    user_only = {'name': '/user_only', 'primary': False}
    monitor._apply_primary_state(automatic, kind='topics', name='/automatic')
    monitor._apply_primary_state(user_only, kind='topics', name='/user_only')

    assert automatic == {
        'name': '/automatic',
        'primary': True,
        'system_primary': True,
        'user_primary': False,
        'is_primary': True,
    }
    assert user_only == {
        'name': '/user_only',
        'primary': True,
        'system_primary': False,
        'user_primary': True,
        'is_primary': True,
    }

    store.set_priority('topics', '/automatic', False)
    monitor._apply_primary_state(automatic, kind='topics', name='/automatic')
    assert automatic['system_primary'] is True
    assert automatic['user_primary'] is False
    assert automatic['is_primary'] is True
