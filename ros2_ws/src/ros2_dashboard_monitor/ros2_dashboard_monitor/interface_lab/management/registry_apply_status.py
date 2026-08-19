"""Interface registry의 build/import 적용 상태 계산."""

from __future__ import annotations

import re
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

from ros2_dashboard_monitor.interface_lab.paths import (
    resolve_stored_workspace_path,
)
from ros2_dashboard_monitor.interface_lab.management.registry_storage import iter_registry_items


ImportChecker = Callable[[str, str, str], tuple[bool, str | None]]
DisplayPath = Callable[[Path], str]


def mark_build_applied(registry: dict[str, Any], *, applied_at: datetime) -> None:
    applied_value = applied_at.isoformat()
    for item in iter_registry_items(registry):
        build = item.get('build')
        if not isinstance(build, dict) or build.get('error'):
            continue
        build['rebuild_required'] = False
        build['last_build_status'] = 'success'
        build['last_build_at'] = applied_value


def refresh_import_status(
    registry: dict[str, Any],
    *,
    allowed_kinds: set[str],
    checked_at: datetime,
    check_import: ImportChecker,
) -> None:
    checked_value = checked_at.isoformat()
    for item in iter_registry_items(registry):
        build = item.get('build')
        if not isinstance(build, dict):
            continue
        package_name = build.get('interface_package')
        kind = item.get('file_kind')
        type_name = item.get('type_name')
        if not package_name or kind not in allowed_kinds or not type_name:
            continue
        available, error = check_import(str(package_name), str(kind), str(type_name))
        build['import_available'] = available
        build['import_error'] = error
        build['import_checked_at'] = checked_value
        if available:
            build['rebuild_required'] = False


def apply_summary(
    registry: dict[str, Any],
    *,
    registry_path: Path,
    require_import_available: bool,
    update_registry: bool,
    default_package: tuple[str, Path],
    workspace_root: Path,
    allowed_kinds: set[str],
    check_import: ImportChecker,
    display_path: DisplayPath,
) -> dict[str, Any]:
    package_name, package_path = default_package
    not_applied: list[dict[str, Any]] = []
    import_pending: list[dict[str, Any]] = []
    total = 0

    for item in iter_registry_items(registry):
        total += 1
        build = item.setdefault('build', {})
        if not isinstance(build, dict):
            build = {}
            item['build'] = build

        kind = str(item.get('file_kind') or '')
        file_name = str(item.get('file_name') or '')
        if item.get('source') == 'manual_type':
            if update_registry:
                package_name = str(build.get('interface_package') or '').strip()
                type_name = str(item.get('type_name') or '').strip()
                if package_name and kind in allowed_kinds and type_name:
                    available, error = check_import(package_name, kind, type_name)
                    build['import_available'] = available
                    build['import_error'] = error
                    build['rebuild_required'] = False
            if require_import_available and not build.get('import_available'):
                not_applied.append({
                    'file_name': file_name,
                    'saved_path': None,
                    'reason': build.get('import_error') or 'import_available false',
                })
            continue

        item_package_path = (
            build.get('interface_package_path')
            or build.get('absolute_interface_package_path')
        )
        active_package_path = (
            resolve_stored_workspace_path(
                str(item_package_path),
                workspace_root=workspace_root,
            )
            if item_package_path else package_path
        )
        active_package_name = str(build.get('interface_package') or package_name)
        interface_path = f'{kind}/{file_name}' if kind and file_name else ''
        actual_path = registered_interface_path(
            active_package_path,
            build,
            interface_path,
            workspace_root=workspace_root,
        )
        file_saved = actual_path.is_file()
        cmake_text = read_optional_text(active_package_path / 'CMakeLists.txt')
        cmake_registered = bool(
            interface_path and cmake_text
            and (interface_path in cmake_text or f'"{interface_path}"' in cmake_text)
        )
        package_xml_checked = package_xml_satisfies(
            read_optional_text(active_package_path / 'package.xml'),
            active_package_name,
            build.get('dependency_candidates', []),
        )

        if update_registry:
            build['interface_package'] = active_package_name
            build['interface_package_path'] = display_path(active_package_path)
            build['saved_path'] = display_path(actual_path) if file_saved else build.get('saved_path')
            build.pop('absolute_interface_package_path', None)
            build.pop('absolute_saved_path', None)
            build['file_saved'] = file_saved
            build['cmake_registered'] = cmake_registered
            build['package_xml_checked'] = package_xml_checked

        reasons: list[str] = []
        if build.get('error'):
            reasons.append(str(build['error']))
        if not file_saved:
            reasons.append('file_saved false')
        if not cmake_registered:
            reasons.append('cmake_registered false')
        if not package_xml_checked:
            reasons.append('package_xml_checked false')
        if require_import_available and not build.get('import_available'):
            reasons.append('import_available false')
        elif not require_import_available and not build.get('import_available'):
            import_pending.append({
                'file_name': file_name,
                'reason': build.get('import_error') or 'import-check pending after reload',
            })
        if reasons:
            not_applied.append({
                'file_name': file_name,
                'saved_path': build.get('saved_path'),
                'reason': ', '.join(reasons),
            })

    real_apply_success = total > 0 and not not_applied
    ready_for_build = total > 0 and not any(
        item for item in not_applied
        if 'import_available false' not in item['reason']
    )
    return {
        'status': 'empty' if total == 0 else ('success' if real_apply_success else 'partial'),
        'real_apply_success': real_apply_success,
        'ready_for_build': ready_for_build,
        'registry_exists': registry_path.is_file(),
        'registry_path': display_path(registry_path),
        'interface_package': package_name,
        'interface_package_path': display_path(package_path),
        'total': total,
        'applied_count': total - len(not_applied),
        'not_applied': not_applied,
        'import_pending': import_pending,
        'requires_import_available': require_import_available,
    }


def missing_registry_summary(
    path: Path,
    *,
    default_package: tuple[str, Path],
    display_path: DisplayPath,
) -> dict[str, Any]:
    package_name, package_path = default_package
    return {
        'status': 'failed',
        'real_apply_success': False,
        'ready_for_build': False,
        'registry_exists': False,
        'registry_path': display_path(path),
        'interface_package': package_name,
        'interface_package_path': display_path(package_path),
        'total': 0,
        'applied_count': 0,
        'not_applied': [{
            'file_name': None,
            'saved_path': None,
            'reason': f'interface_registry.yaml was not found: {display_path(path)}',
        }],
        'import_pending': [],
        'requires_import_available': False,
    }


def registered_interface_path(
    package_path: Path,
    build: dict[str, Any],
    interface_path: str,
    *,
    workspace_root: Path,
) -> Path:
    saved = build.get('saved_path') or build.get('absolute_saved_path')
    if not saved:
        return package_path / interface_path
    return resolve_stored_workspace_path(
        str(saved),
        workspace_root=workspace_root,
    )


def package_xml_satisfies(package_text: str, package_name: str, dependencies: Any) -> bool:
    if not package_text or not re.search(rf'<name>\s*{re.escape(package_name)}\s*</name>', package_text):
        return False
    required_patterns = (
        r'<(?:build_depend|depend)>\s*rosidl_default_generators\s*</(?:build_depend|depend)>',
        r'<(?:exec_depend|depend)>\s*rosidl_default_runtime\s*</(?:exec_depend|depend)>',
        r'<member_of_group>\s*rosidl_interface_packages\s*</member_of_group>',
    )
    if any(not re.search(pattern, package_text) for pattern in required_patterns):
        return False
    return all(
        re.search(
            rf'<(?:depend|build_depend|exec_depend)>\s*{re.escape(str(dependency))}\s*'
            rf'</(?:depend|build_depend|exec_depend)>', package_text,
        )
        for dependency in dependencies if isinstance(dependencies, list)
    )


def read_optional_text(path: Path) -> str:
    try:
        return path.read_text(encoding='utf-8')
    except (OSError, UnicodeError):
        return ''
