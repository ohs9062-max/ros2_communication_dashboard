"""Interface Lab의 paths 관련 기능을 담당하는 모듈입니다."""

from __future__ import annotations

from pathlib import Path


def backend_workspace_root() -> Path:
    """Interface build와 config를 포함하는 Backend workspace 루트를 반환합니다."""
    return Path(__file__).resolve().parents[4]


def backend_python_package_root() -> Path:
    """ros2_dashboard_backend Python package 루트를 반환합니다."""
    return (
        backend_workspace_root()
        / 'src'
        / 'ros2_dashboard_backend'
        / 'ros2_dashboard_backend'
    )


def reload_trigger_path() -> Path:
    """Apply 성공 뒤 갱신할 reload trigger 파일 경로를 반환합니다."""
    return backend_python_package_root() / 'reload_trigger.py'
