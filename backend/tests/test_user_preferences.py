from pathlib import Path

import yaml

from app.user_preferences.repository import (
    UserPreferencesError,
    UserPreferencesStore,
)


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
        assert 'Unsupported resource kind' in str(exc)
    else:
        raise AssertionError('unknown kind must be rejected')


def test_domain_preferences_deduplicate_validate_and_persist(tmp_path: Path) -> None:
    path = tmp_path / 'user_preferences.yaml'
    store = UserPreferencesStore(path)

    assert store.set_domain_ids([99, 0, 99, 2]) == {
        'domain_ids': [0, 2, 99], 'changed': True,
    }
    assert UserPreferencesStore(path).domain_ids() == [0, 2, 99]

    try:
        store.set_domain_ids([233])
    except UserPreferencesError as exc:
        assert '0 to 232' in str(exc)
    else:
        raise AssertionError('out-of-range Domain ID must be rejected')
