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


class _Executor:
    def __init__(self, *, context) -> None:
        self.context = context
        self.added = []
        self.removed = []
        self.spun = False
        self.shutdown_timeout = None

    def add_node(self, node) -> None:
        self.added.append(node)

    def remove_node(self, node) -> None:
        self.removed.append(node)

    def spin(self) -> None:
        self.spun = True

    def shutdown(self, *, timeout_sec: float) -> None:
        self.shutdown_timeout = timeout_sec


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


def test_spin_uses_an_executor_bound_to_the_explicit_context(monkeypatch) -> None:
    executors = []
    monkeypatch.setattr(
        lifecycle,
        'SingleThreadedExecutor',
        lambda **kwargs: executors.append(_Executor(**kwargs)) or executors[-1],
    )
    context = object()
    node = _Node()

    lifecycle.spin_monitor_node(node, context=context)

    assert len(executors) == 1
    assert executors[0].context is context
    assert executors[0].added == [node]
    assert executors[0].spun is True
    assert executors[0].removed == [node]
    assert executors[0].shutdown_timeout == lifecycle.SPIN_JOIN_TIMEOUT_SEC
