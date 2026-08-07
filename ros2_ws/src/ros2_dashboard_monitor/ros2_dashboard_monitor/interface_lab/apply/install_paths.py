"""colcon install의 Python package 경로 탐색과 현재 프로세스 반영."""

from __future__ import annotations

import importlib
import sys
from pathlib import Path


def refresh_python_paths(workspace: Path) -> dict[str, list[str]]:
    paths = find_site_packages(workspace)
    added: list[str] = []
    for path in reversed(paths):
        value = str(path)
        if value not in sys.path:
            sys.path.insert(0, value)
            added.append(value)
    importlib.invalidate_caches()
    return {
        'site_packages': [str(path) for path in paths],
        'added': added,
    }


def find_site_packages(workspace: Path) -> list[Path]:
    install_root = workspace / 'install'
    current = f'python{sys.version_info.major}.{sys.version_info.minor}'
    candidates = [
        path.resolve()
        for path in install_root.glob('*/lib/python*/site-packages')
        if path.is_dir()
    ]
    return sorted(
        candidates,
        key=lambda path: (
            0 if path.parent.name == current else 1,
            path.as_posix(),
        ),
    )
