from ros2_dashboard_monitor.priority_state import PriorityState


def test_priority_state_is_transient_backend_mirror() -> None:
    state = PriorityState()
    state.replace({'topics': ['/user_only'], 'nodes': ['/robot']})
    assert state.contains('topics', '/user_only') is True
    assert state.contains('services', '/user_only') is False
    state.replace({'topics': []})
    assert state.contains('topics', '/user_only') is False
