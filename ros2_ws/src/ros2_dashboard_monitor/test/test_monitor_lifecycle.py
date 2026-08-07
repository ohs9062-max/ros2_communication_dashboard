"""Monitor rclpy Node와 spin thread 생명주기 회귀 테스트입니다."""

from threading import Event

from ros2_dashboard_monitor import monitor_lifecycle as lifecycle


class _Node:
    def __init__(self, name: str = 'test') -> None:
        self.name = name
        self.timers = []
        self.destroyed = False

    def create_timer(self, interval: float, callback) -> None:
        self.timers.append((interval, callback))

    def destroy_node(self) -> None:
        self.destroyed = True


class _Thread:
    def __init__(self) -> None:
        self.join_timeout = None

    def join(self, *, timeout: float) -> None:
        self.join_timeout = timeout


def test_create_monitor_node_initializes_rclpy_and_timer(monkeypatch) -> None:
    initialized = []
    monkeypatch.setattr(lifecycle.rclpy, 'init', lambda **kwargs: initialized.append(kwargs))
    monkeypatch.setattr(lifecycle, 'Node', _Node)
    callback = lambda: None

    node = lifecycle.create_monitor_node(
        poll_interval_sec=0.5,
        update_callback=callback,
    )

    assert initialized == [{'args': None}]
    assert node.name == lifecycle.MONITOR_NODE_NAME
    assert node.timers == [(0.5, callback)]


def test_spin_thread_runs_target_and_finishes() -> None:
    called = Event()

    thread = lifecycle.start_spin_thread(called.set)
    thread.join(timeout=1.0)

    assert called.is_set()
    assert thread.daemon is True


def test_shutdown_stops_rclpy_joins_thread_and_destroys_node(monkeypatch) -> None:
    shutdown = []
    monkeypatch.setattr(lifecycle.rclpy, 'ok', lambda: True)
    monkeypatch.setattr(lifecycle.rclpy, 'shutdown', lambda: shutdown.append(True))
    node = _Node()
    thread = _Thread()

    lifecycle.shutdown_monitor_node(node, thread)

    assert shutdown == [True]
    assert thread.join_timeout == lifecycle.SPIN_JOIN_TIMEOUT_SEC
    assert node.destroyed is True
