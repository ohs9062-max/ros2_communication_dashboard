"""업로드 Interface package의 build/import/apply 상태 계산."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Iterator


ImportChecker = Callable[[str, str, str], tuple[bool, str | None]]


def iter_package_interface_lists(
    package: dict[str, Any],
) -> Iterator[tuple[str, list[dict[str, Any]]]]:
    interfaces = package.get('interfaces') if isinstance(package.get('interfaces'), dict) else {}
    for kind in ('msg', 'srv', 'action'):
        items = interfaces.get(kind)
        if isinstance(items, list):
            yield kind, items


def mark_build_applied(registry: dict[str, Any], *, built_at: datetime) -> None:
    built_value = built_at.isoformat()
    for package in registry['packages']:
        package['last_build_status'] = 'success'
        package['last_build_at'] = built_value
        package['rebuild_required'] = False


def refresh_import_status(
    registry: dict[str, Any],
    *,
    checked_at: datetime,
    check_import: ImportChecker,
) -> None:
    checked_value = checked_at.isoformat()
    for package in registry['packages']:
        errors: list[str] = []
        total = 0
        available_count = 0
        package_name = str(package.get('name') or '')
        for kind, items in iter_package_interface_lists(package):
            for item in items:
                total += 1
                type_name = str(item.get('type_name') or '')
                available, error = check_import(package_name, kind, type_name)
                item['import_available'] = available
                item['import_error'] = error
                item['import_checked_at'] = checked_value
                if available:
                    available_count += 1
                elif error:
                    errors.append(f'{item.get("type")}: {error}')
        package['import_available'] = total > 0 and available_count == total
        package['import_error'] = '; '.join(errors) if errors else None
        package['import_checked_at'] = checked_value
        if package['import_available']:
            package['rebuild_required'] = False


def apply_summary(
    registry: dict[str, Any],
    *,
    require_import_available: bool,
    registry_path: Path,
    uploaded_packages_path: Path,
    display_path: Callable[[Path], str],
) -> dict[str, Any]:
    not_applied: list[dict[str, Any]] = []
    import_pending: list[dict[str, Any]] = []
    total = 0
    for package in registry['packages']:
        package_name = str(package.get('name') or '')
        package_path = Path(str(package.get('absolute_path') or ''))
        package_reasons: list[str] = []
        if not package_path.is_dir():
            package_reasons.append('package path missing')
        if not (package_path / 'package.xml').is_file():
            package_reasons.append('package.xml missing')
        if not (package_path / 'CMakeLists.txt').is_file():
            package_reasons.append('CMakeLists.txt missing')
        if package.get('error'):
            package_reasons.append(str(package['error']))

        for _kind, items in iter_package_interface_lists(package):
            for item in items:
                total += 1
                actual_path = package_path / Path(str(item.get('relative_path') or ''))
                reasons = list(package_reasons)
                if not actual_path.is_file():
                    reasons.append('file_saved false')
                if not cmake_contains_interface(package_path / 'CMakeLists.txt', item):
                    reasons.append('cmake_registered false')
                if require_import_available and item.get('import_available') is not True:
                    reasons.append('import_available false')
                elif not require_import_available and item.get('import_available') is not True:
                    import_pending.append({
                        'file_name': item.get('file_name'),
                        'type': item.get('type'),
                        'reason': item.get('import_error') or 'import-check pending after build',
                    })
                if reasons:
                    not_applied.append({
                        'file_name': item.get('file_name'),
                        'package_name': package_name,
                        'type': item.get('type'),
                        'saved_path': item.get('saved_path'),
                        'reason': ', '.join(reasons),
                    })

    real_apply_success = total > 0 and not not_applied
    ready_for_build = total > 0 and not any(
        item for item in not_applied
        if 'import_available false' not in item['reason']
    )
    return {
        'status': 'success' if real_apply_success else ('empty' if total == 0 else 'partial'),
        'real_apply_success': real_apply_success,
        'ready_for_build': ready_for_build,
        'registry_exists': registry_path.is_file(),
        'registry_path': display_path(registry_path),
        'uploaded_packages_path': display_path(uploaded_packages_path),
        'package_count': len(registry['packages']),
        'total': total,
        'applied_count': total - len(not_applied),
        'not_applied': not_applied,
        'import_pending': import_pending,
        'requires_import_available': require_import_available,
    }


def cmake_contains_interface(cmake_path: Path, item: dict[str, Any]) -> bool:
    try:
        text = cmake_path.read_text(encoding='utf-8')
    except (OSError, UnicodeError):
        return False
    relative = str(item.get('relative_path') or '')
    return bool(relative and (relative in text or f'"{relative}"' in text))
