"""Interface Apply 상태 YAML과 build log 저장소."""

from __future__ import annotations

import os
import tempfile
import threading
from pathlib import Path
from typing import Any, Callable

import yaml

from ros2_dashboard_monitor.interface_lab.apply.errors import InterfaceApplyError


STATUS_LOCK = threading.Lock()
LOG_TAIL_LINES = 80


def read_status(path: Path, *, default_factory: Callable[[], dict[str, Any]]) -> dict[str, Any]:
    if not path.is_file():
        return default_factory()
    try:
        data = yaml.safe_load(path.read_text(encoding='utf-8')) or {}
    except (OSError, UnicodeError, yaml.YAMLError) as exc:
        raise InterfaceApplyError(f'The interface apply status could not be read: {exc}') from exc
    status = default_factory()
    if isinstance(data, dict):
        status.update(data)
    return status


def write_status(path: Path, status: dict[str, Any]) -> None:
    with STATUS_LOCK:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary_name = ''
        try:
            with tempfile.NamedTemporaryFile(
                mode='w', encoding='utf-8', dir=path.parent,
                prefix=f'.{path.name}.', delete=False,
            ) as temporary:
                temporary_name = temporary.name
                yaml.safe_dump(status, temporary, allow_unicode=True, sort_keys=False)
            os.replace(temporary_name, path)
        except OSError as exc:
            if temporary_name:
                Path(temporary_name).unlink(missing_ok=True)
            raise InterfaceApplyError(f'The interface apply status could not be saved: {exc}') from exc


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        mode='w', encoding='utf-8', dir=path.parent,
        prefix=f'.{path.name}.', delete=False,
    ) as temporary:
        temporary_name = temporary.name
        temporary.write(content)
    os.replace(temporary_name, path)


def read_log_tail(path: Path, *, line_limit: int = LOG_TAIL_LINES) -> str:
    if not path.is_file():
        return ''
    try:
        lines = path.read_text(encoding='utf-8', errors='replace').splitlines()
    except OSError:
        return ''
    return '\n'.join(lines[-line_limit:])
