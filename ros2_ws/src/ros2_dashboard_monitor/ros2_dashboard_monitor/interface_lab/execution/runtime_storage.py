"""Interface Lab 실행 runtime이 공유하는 thread-safe 상태 저장소입니다."""

from __future__ import annotations

from contextlib import nullcontext
from threading import Lock
from typing import Any, Callable, Generic, Hashable, TypeVar


ClientT = TypeVar('ClientT')
KeyT = TypeVar('KeyT', bound=Hashable)


def _locked(lock: Any):
    """테스트·단일 thread 사용의 선택적 lock과 실제 runtime lock을 함께 지원합니다."""
    return lock if lock is not None else nullcontext()


class RuntimeClientPool(Generic[KeyT, ClientT]):
    """이름·타입 key별 ROS client를 생성하고 재사용합니다."""

    def __init__(self, lock: Any) -> None:
        self._lock = lock
        self._creation_lock = Lock()
        self._clients: dict[KeyT, ClientT] = {}

    def clear(self) -> None:
        with self._creation_lock:
            with _locked(self._lock):
                self._clients.clear()

    def keys(self) -> list[KeyT]:
        with _locked(self._lock):
            return list(self._clients)

    def get_or_create(
        self,
        key: KeyT,
        factory: Callable[[], ClientT],
    ) -> ClientT:
        with self._creation_lock:
            with _locked(self._lock):
                client = self._clients.get(key)
            if client is not None:
                return client

            client = factory()
            with _locked(self._lock):
                self._clients[key] = client
            return client


class BoundedExecutionHistory:
    """최신 항목 우선 순서와 최대 보존 개수를 일관되게 관리합니다."""

    def __init__(self, lock: Any, limit: int) -> None:
        self._lock = lock
        self._limit = max(1, int(limit))
        self._items: list[dict[str, Any]] = []

    def clear(self) -> None:
        with _locked(self._lock):
            self._items.clear()

    def record(self, item: dict[str, Any]) -> None:
        with _locked(self._lock):
            self._items.insert(0, item)
            del self._items[self._limit:]

    def snapshot(self) -> list[dict[str, Any]]:
        with _locked(self._lock):
            return [item.copy() for item in self._items]

    def remove(self, predicate: Callable[[dict[str, Any]], bool]) -> int:
        """조건에 맞는 항목을 제거하고 제거 개수를 반환합니다."""
        with _locked(self._lock):
            before = len(self._items)
            self._items = [item for item in self._items if not predicate(item)]
            return before - len(self._items)
