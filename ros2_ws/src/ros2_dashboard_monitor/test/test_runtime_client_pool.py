import threading
import time

from ros2_dashboard_monitor.interface_lab.execution.runtime_storage import RuntimeClientPool


def test_client_factory_can_reenter_shared_state_lock() -> None:
    shared_lock = threading.Lock()
    pool = RuntimeClientPool(shared_lock)
    completed = threading.Event()
    result = []

    def factory():
        with shared_lock:
            return object()

    def create() -> None:
        result.append(pool.get_or_create('action', factory))
        completed.set()

    worker = threading.Thread(target=create, daemon=True)
    worker.start()

    assert completed.wait(1.0), 'client factory deadlocked on the shared state lock'
    worker.join(timeout=1.0)
    assert not worker.is_alive()
    assert pool.get_or_create('action', factory) is result[0]


def test_concurrent_client_creation_runs_factory_once() -> None:
    pool = RuntimeClientPool(threading.Lock())
    start = threading.Barrier(6)
    count_lock = threading.Lock()
    creation_count = 0
    results = []

    def factory():
        nonlocal creation_count
        with count_lock:
            creation_count += 1
        time.sleep(0.01)
        return object()

    def create() -> None:
        start.wait()
        results.append(pool.get_or_create('action', factory))

    workers = [threading.Thread(target=create) for _ in range(6)]
    for worker in workers:
        worker.start()
    for worker in workers:
        worker.join(timeout=1.0)

    assert all(not worker.is_alive() for worker in workers)
    assert creation_count == 1
    assert len({id(result) for result in results}) == 1
