"""수동 등록 Interface의 Registry CRUD."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from ros2_dashboard_monitor.interface_lab.management.registry_storage import (
    load_registry,
    write_registry,
)


KIND_COLLECTIONS = {'msg': 'messages', 'srv': 'services', 'action': 'actions'}


def upsert_entry(path: Path, entry: dict[str, Any]) -> None:
    registry = load_registry(path)
    collection = registry['interface_registry'][KIND_COLLECTIONS[entry['file_kind']]]
    collection[:] = [
        item for item in collection
        if not (
            item.get('source') == entry.get('source')
            and item.get('full_type') == entry.get('full_type')
        )
    ]
    collection.append(entry)
    write_registry(path, registry)


def find_entry(
    path: Path,
    *,
    kind: str,
    file_name: str,
    source: str | None,
    full_type: str | None,
) -> dict[str, Any] | None:
    registry = load_registry(path)
    collection = registry['interface_registry'][KIND_COLLECTIONS[kind]]
    return next(
        (
            item for item in collection
            if item.get('file_name') == file_name
            and (source is None or item.get('source') == source)
            and (full_type is None or item.get('full_type') == full_type)
        ),
        None,
    )


def remove_exact_entry(
    path: Path,
    *,
    kind: str,
    file_name: str,
    source: str | None,
    full_type: str | None,
) -> None:
    registry = load_registry(path)
    collection = registry['interface_registry'][KIND_COLLECTIONS[kind]]
    collection[:] = [
        item for item in collection
        if not (
            item.get('file_name') == file_name
            and item.get('source') == source
            and item.get('full_type') == full_type
        )
    ]
    write_registry(path, registry)
