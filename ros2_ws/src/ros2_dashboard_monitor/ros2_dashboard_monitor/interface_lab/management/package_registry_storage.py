"""업로드 Interface package Registry YAML 저장소."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path
from typing import Any

import yaml

from ros2_dashboard_monitor.interface_lab.management.errors import InterfacePackageError


def load_packages_registry(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {'packages': []}
    try:
        data = yaml.safe_load(path.read_text(encoding='utf-8')) or {}
    except (OSError, UnicodeError, yaml.YAMLError) as exc:
        raise InterfacePackageError(f'패키지 registry를 읽을 수 없습니다: {exc}') from exc
    packages = data.get('packages') if isinstance(data, dict) else []
    return {'packages': packages if isinstance(packages, list) else []}


def write_packages_registry(path: Path, registry: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_name = ''
    try:
        with tempfile.NamedTemporaryFile(
            mode='w', encoding='utf-8', dir=path.parent,
            prefix=f'.{path.name}.', delete=False,
        ) as temporary:
            temporary_name = temporary.name
            yaml.safe_dump(registry, temporary, allow_unicode=True, sort_keys=False)
        os.replace(temporary_name, path)
    except OSError as exc:
        if temporary_name:
            Path(temporary_name).unlink(missing_ok=True)
        raise InterfacePackageError(f'패키지 registry를 저장할 수 없습니다: {exc}') from exc
