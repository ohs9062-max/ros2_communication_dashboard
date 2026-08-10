"""검증된 ROS interface package를 저장소에 원자적으로 설치합니다."""

from __future__ import annotations

import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from ros2_dashboard_monitor.interface_lab.management.errors import (
    InterfacePackageError,
)
from ros2_dashboard_monitor.interface_lab.management.package_inspector import (
    collect_interfaces,
    validate_package_identity,
)


def install_package_root(
    package_root: Path,
    *,
    uploaded_root: Path,
    replace: bool,
    parse_interface: Callable[..., Any],
    dependency_candidates: Callable[..., Any],
    display_path: Callable[[Path], str],
    upsert_entry: Callable[[dict[str, Any]], dict[str, Any]],
    registry_path: Path,
) -> dict[str, Any]:
    """검증된 package root를 교체 가능하게 설치하고 Registry에 반영합니다."""
    uploaded_root.mkdir(parents=True, exist_ok=True)
    package_name = validate_package_identity(package_root)
    interfaces = collect_interfaces(
        package_root,
        package_name,
        parse_interface=parse_interface,
        dependency_candidates=dependency_candidates,
        display_path=display_path,
    )
    if sum(len(items) for items in interfaces.values()) == 0:
        raise InterfacePackageError('msg/srv/action 인터페이스가 하나 이상 필요합니다.')

    destination = uploaded_root / package_name
    if destination.exists() and not replace:
        raise InterfacePackageError(
            f'{package_name} 패키지가 이미 있습니다.',
        )

    _replace_package_tree(
        package_root,
        destination=destination,
        uploaded_root=uploaded_root,
        package_name=package_name,
    )
    _rebase_interface_paths(
        interfaces,
        package_root=destination,
        display_path=display_path,
    )

    entry = {
        'name': package_name,
        'path': display_path(destination),
        'absolute_path': str(destination.resolve()),
        'source': 'uploaded_package',
        'uploaded_at': datetime.now(timezone.utc).isoformat(),
        'last_build_status': 'pending',
        'import_available': False,
        'import_error': None,
        'error': None,
        'dependency_candidates': sorted({
            dep for items in interfaces.values()
            for item in items
            for dep in item.get('dependency_candidates', [])
        }),
        'dependency_missing': [],
        'interfaces': interfaces,
        'rebuild_required': True,
    }
    registry = upsert_entry(entry)
    entry['registry_path'] = display_path(registry_path)
    entry['registry'] = registry
    return entry


def _replace_package_tree(
    package_root: Path,
    *,
    destination: Path,
    uploaded_root: Path,
    package_name: str,
) -> None:
    staging = uploaded_root / f'.{package_name}.staging'
    backup = uploaded_root / f'.{package_name}.backup'
    shutil.rmtree(staging, ignore_errors=True)
    shutil.rmtree(backup, ignore_errors=True)
    shutil.copytree(package_root, staging, symlinks=False)
    try:
        if destination.exists():
            destination.rename(backup)
        staging.rename(destination)
        shutil.rmtree(backup, ignore_errors=True)
    except OSError as exc:
        shutil.rmtree(destination, ignore_errors=True)
        if backup.exists():
            backup.rename(destination)
        shutil.rmtree(staging, ignore_errors=True)
        raise InterfacePackageError(f'패키지 저장에 실패했습니다: {exc}') from exc


def _rebase_interface_paths(
    interfaces: dict[str, list[dict[str, Any]]],
    *,
    package_root: Path,
    display_path: Callable[[Path], str],
) -> None:
    for items in interfaces.values():
        for item in items:
            relative = Path(str(item.get('relative_path') or ''))
            absolute = package_root / relative
            item['saved_path'] = display_path(absolute)
            item['absolute_saved_path'] = str(absolute.resolve())
