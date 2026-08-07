"""Interface registry YAML의 thread-safe 읽기·쓰기와 기본 구조."""

from __future__ import annotations

import os
import tempfile
import threading
from pathlib import Path
from typing import Any, Iterator

import yaml

from ros2_dashboard_monitor.interface_lab.management.errors import InterfaceUploadError


REGISTRY_COLLECTIONS = ('messages', 'services', 'actions')
REGISTRY_LOCK = threading.Lock()


def empty_registry() -> dict[str, Any]:
    return {
        'interface_registry': {
            collection: [] for collection in REGISTRY_COLLECTIONS
        },
    }


def load_registry(path: Path) -> dict[str, Any]:
    """Registry가 없거나 root 형식이 잘못된 경우 비어 있는 정규 모델을 반환합니다."""
    if not path.is_file():
        return empty_registry()
    try:
        data = yaml.safe_load(path.read_text(encoding='utf-8')) or {}
    except (OSError, UnicodeError, yaml.YAMLError) as exc:
        raise InterfaceUploadError(f'타입 registry를 읽을 수 없습니다: {exc}') from exc

    root = data.get('interface_registry') if isinstance(data, dict) else None
    if not isinstance(root, dict):
        return empty_registry()
    normalized = empty_registry()
    for name in REGISTRY_COLLECTIONS:
        value = root.get(name)
        normalized['interface_registry'][name] = value if isinstance(value, list) else []
    return normalized


def iter_registry_items(registry: dict[str, Any]) -> Iterator[dict[str, Any]]:
    root = registry.get('interface_registry', {})
    for collection_name in REGISTRY_COLLECTIONS:
        collection = root.get(collection_name, [])
        if isinstance(collection, list):
            yield from collection


def write_registry(path: Path, registry: dict[str, Any]) -> None:
    """같은 디렉터리의 임시 파일을 교체해 Registry를 원자적으로 저장합니다."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_name = ''
    try:
        with tempfile.NamedTemporaryFile(
            mode='w', encoding='utf-8', dir=path.parent,
            prefix=f'.{path.name}.', delete=False,
        ) as temporary:
            temporary_name = temporary.name
            yaml.safe_dump(
                registry, temporary, allow_unicode=True, sort_keys=False,
            )
        os.replace(temporary_name, path)
    except OSError as exc:
        if temporary_name:
            Path(temporary_name).unlink(missing_ok=True)
        raise InterfaceUploadError(f'타입 registry를 저장할 수 없습니다: {exc}') from exc
