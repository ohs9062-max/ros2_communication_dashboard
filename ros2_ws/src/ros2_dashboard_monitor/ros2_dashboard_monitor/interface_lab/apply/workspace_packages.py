"""업로드 package의 workspace 중복 검사와 package 범위 생성물 정리."""

from __future__ import annotations

import re
import shutil
from pathlib import Path
from typing import Any

from ros2_dashboard_monitor.interface_lab.apply.errors import InterfaceApplyError


PACKAGE_NAME_PATTERN = re.compile(r'^[a-z][a-z0-9_]*$')
PACKAGE_NAME_XML_PATTERN = re.compile(r'<name>\s*([^<]+)\s*</name>')


def uploaded_package_names(registry: dict[str, Any]) -> list[str]:
    names = []
    for package in registry.get('packages', []):
        name = str(package.get('name') or '')
        if PACKAGE_NAME_PATTERN.fullmatch(name):
            names.append(name)
    return sorted(set(names))


def cleanup_build_artifacts(workspace: Path, package_names: list[str]) -> dict[str, Any]:
    removed: list[str] = []
    for package_name in sorted(set(package_names)):
        if not PACKAGE_NAME_PATTERN.fullmatch(package_name):
            continue
        for relative in (
            Path('build') / package_name,
            Path('install') / package_name,
            Path('log') / 'latest' / package_name,
            Path('log') / 'latest_build' / package_name,
        ):
            target = safe_workspace_child(workspace, relative)
            if target.exists() or target.is_symlink():
                if target.is_dir() and not target.is_symlink():
                    shutil.rmtree(target)
                else:
                    target.unlink()
                removed.append(display_workspace_path(workspace, target))
    return {
        'package_names': sorted(set(package_names)),
        'removed': removed,
        'duplicates': {},
    }


def duplicate_packages(workspace: Path, package_names: list[str]) -> dict[str, list[str]]:
    selected = set(package_names)
    if not selected:
        return {}
    found: dict[str, list[str]] = {name: [] for name in selected}
    src_root = safe_workspace_child(workspace, Path('src'))
    if not src_root.is_dir():
        return {}
    for package_xml in src_root.glob('**/package.xml'):
        try:
            text = package_xml.read_text(encoding='utf-8')
        except (OSError, UnicodeError):
            continue
        match = PACKAGE_NAME_XML_PATTERN.search(text)
        if not match:
            continue
        package_name = match.group(1).strip()
        if package_name in found:
            found[package_name].append(display_workspace_path(workspace, package_xml.parent))
    return {name: sorted(paths) for name, paths in found.items() if len(paths) > 1}


def safe_workspace_child(workspace: Path, relative: Path) -> Path:
    root = workspace.resolve()
    if relative.is_absolute() or '..' in relative.parts:
        raise InterfaceApplyError(f'A path outside the workspace cannot be cleaned: {relative}')
    target = root / relative
    try:
        target.resolve().relative_to(root)
    except ValueError as exc:
        raise InterfaceApplyError(f'A path outside the workspace cannot be cleaned: {target}') from exc
    return target


def display_workspace_path(workspace: Path, path: Path) -> str:
    try:
        return path.relative_to(workspace.resolve()).as_posix()
    except ValueError:
        return str(path)
