"""Interface Lab의 packages 관련 기능을 담당하는 모듈입니다."""

from __future__ import annotations

import importlib
import os
import re
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ros2_dashboard_monitor.interface_lab.paths import persistent_monitor_config_dir, ros_workspace_root
from ros2_dashboard_monitor.interface_lab.management.registry import (
    InterfaceUploadError,
    _dependency_candidates,
    _display_path,
    parse_interface,
)
from ros2_dashboard_monitor.interface_lab.management.errors import InterfacePackageError
from ros2_dashboard_monitor.interface_lab.management.package_archive import (
    MAX_PACKAGE_FILES,
    MAX_PACKAGE_FILE_SIZE,
    MAX_PACKAGE_ZIP_SIZE,
    extract_multipart_package_files,
    find_package_root as _find_package_root,
    safe_extract_zip as _safe_extract_zip,
    safe_package_relative_path as _safe_package_relative_path,
    validate_folder_upload,
    validate_zip_upload,
)
from ros2_dashboard_monitor.interface_lab.management.package_registry_storage import (
    load_packages_registry as _load_packages_registry,
    write_packages_registry as _write_packages_registry,
)


PACKAGE_NAME_PATTERN = re.compile(r'^[a-z][a-z0-9_]*$')
PROJECT_PATTERN = re.compile(r'project\s*\(\s*([A-Za-z][A-Za-z0-9_]*)\b', re.IGNORECASE)
PACKAGE_NAME_XML_PATTERN = re.compile(r'<name>\s*([^<]+)\s*</name>')
PACKAGE_LOCK = None


def default_packages_registry_path() -> Path:
    """Interface package Registry YAML의 기본 경로를 반환합니다."""
    backend_root = ros_workspace_root()
    configured_value = os.getenv('INTERFACE_PACKAGES_REGISTRY_PATH')
    if not configured_value:
        return persistent_monitor_config_dir() / 'interface_packages.yaml'
    configured = Path(configured_value)
    return configured if configured.is_absolute() else backend_root / configured


def default_uploaded_packages_root() -> Path:
    """업로드한 ROS Interface package를 보관할 기본 폴더를 반환합니다."""
    backend_root = ros_workspace_root()
    configured = Path(
        os.getenv(
            'INTERFACE_UPLOADED_PACKAGES_PATH',
            'src/uploaded_interfaces/packages',
        ),
    )
    return configured if configured.is_absolute() else backend_root / configured


def upload_interface_package(
    file_name: str,
    content: bytes,
    *,
    replace: bool = False,
) -> dict[str, Any]:
    """zip package를 안전하게 풀고 구조를 검증해 package 저장소에 등록합니다."""
    safe_name = validate_zip_upload(file_name, content)

    uploaded_root = default_uploaded_packages_root()
    uploaded_root.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='interface_package_') as temp_name:
        temp_root = Path(temp_name)
        zip_path = temp_root / safe_name
        zip_path.write_bytes(content)
        extract_root = temp_root / 'extract'
        extract_root.mkdir()
        _safe_extract_zip(zip_path, extract_root)
        package_root = _find_package_root(extract_root)
        return _store_package_root(package_root, replace=replace)


def upload_interface_package_folder(
    files: list[tuple[str, bytes]],
    *,
    replace: bool = False,
) -> dict[str, Any]:
    """폴더로 받은 파일을 임시 package로 조립하고 검증해 등록합니다."""
    validate_folder_upload(files)

    with tempfile.TemporaryDirectory(prefix='interface_package_folder_') as temp_name:
        extract_root = Path(temp_name) / 'extract'
        extract_root.mkdir()
        for relative_path, content in files:
            relative = _safe_package_relative_path(relative_path, len(content))
            target = extract_root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
        package_root = _find_package_root(extract_root)
        return _store_package_root(package_root, replace=replace)


def _store_package_root(package_root: Path, *, replace: bool) -> dict[str, Any]:
    uploaded_root = default_uploaded_packages_root()
    uploaded_root.mkdir(parents=True, exist_ok=True)
    package_name = _validate_package_identity(package_root)
    interfaces = _collect_interfaces(package_root, package_name)
    total_interfaces = sum(len(items) for items in interfaces.values())
    if total_interfaces == 0:
        raise InterfacePackageError('msg/srv/action 인터페이스가 하나 이상 필요합니다.')

    destination = uploaded_root / package_name
    if destination.exists() and not replace:
        raise InterfacePackageError(
            f'{package_name} 패키지가 이미 있습니다.',
        )

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

    _rebase_interface_paths(interfaces, destination)
    entry = {
        'name': package_name,
        'path': _display_path(destination),
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
    registry = upsert_package_entry(entry)
    entry['registry_path'] = _display_path(default_packages_registry_path())
    entry['registry'] = registry
    return entry


def _rebase_interface_paths(
    interfaces: dict[str, list[dict[str, Any]]],
    package_root: Path,
) -> None:
    for items in interfaces.values():
        for item in items:
            relative = Path(str(item.get('relative_path') or ''))
            absolute = package_root / relative
            item['saved_path'] = _display_path(absolute)
            item['absolute_saved_path'] = str(absolute.resolve())


def packages_snapshot() -> dict[str, Any]:
    """Package Registry를 읽어 등록된 package 목록을 반환합니다."""
    return _load_packages_registry(default_packages_registry_path())


def delete_interface_package(package_name: str) -> dict[str, Any]:
    """Interface Lab에서 등록 항목이나 파일을 삭제하는 함수입니다."""
    if not PACKAGE_NAME_PATTERN.fullmatch(package_name):
        raise InterfacePackageError('패키지명이 올바르지 않습니다.')
    destination = default_uploaded_packages_root() / package_name
    if destination.exists():
        shutil.rmtree(destination)
    registry = _load_packages_registry(default_packages_registry_path())
    registry['packages'] = [
        item for item in registry['packages']
        if item.get('name') != package_name
    ]
    _write_packages_registry(default_packages_registry_path(), registry)
    return {
        'name': package_name,
        'deleted': True,
        'rebuild_required': True,
        'registry': registry,
    }


def upsert_package_entry(entry: dict[str, Any]) -> dict[str, Any]:
    """같은 package 이름의 Registry 항목을 추가하거나 최신 값으로 교체합니다."""
    path = default_packages_registry_path()
    registry = _load_packages_registry(path)
    registry['packages'] = [
        item for item in registry['packages']
        if item.get('name') != entry.get('name')
    ]
    registry['packages'].append(entry)
    registry['packages'].sort(key=lambda item: str(item.get('name') or ''))
    _write_packages_registry(path, registry)
    return registry


def mark_packages_build_applied() -> dict[str, Any]:
    """build가 끝난 package 항목의 build_required 표시를 해제합니다."""
    path = default_packages_registry_path()
    registry = _load_packages_registry(path)
    built_at = datetime.now(timezone.utc).isoformat()
    for package in registry['packages']:
        package['last_build_status'] = 'success'
        package['last_build_at'] = built_at
        package['rebuild_required'] = False
    _write_packages_registry(path, registry)
    return registry


def refresh_package_imports() -> dict[str, Any]:
    """Interface Lab에서 생성된 interface 타입 import 가능 여부를 확인하는 함수입니다."""
    path = default_packages_registry_path()
    registry = _load_packages_registry(path)
    checked_at = datetime.now(timezone.utc).isoformat()
    for package in registry['packages']:
        errors: list[str] = []
        total = 0
        available_count = 0
        package_name = str(package.get('name') or '')
        for kind, items in _iter_package_interface_lists(package):
            for item in items:
                total += 1
                type_name = str(item.get('type_name') or '')
                available, error = _check_import(package_name, kind, type_name)
                item['import_available'] = available
                item['import_error'] = error
                item['import_checked_at'] = checked_at
                if available:
                    available_count += 1
                elif error:
                    errors.append(f'{item.get("type")}: {error}')
        package['import_available'] = total > 0 and available_count == total
        package['import_error'] = '; '.join(errors) if errors else None
        package['import_checked_at'] = checked_at
        if package['import_available']:
            package['rebuild_required'] = False
    summary = package_apply_summary(registry=registry, require_import_available=True)
    registry['apply_summary'] = summary
    _write_packages_registry(path, registry)
    return registry


def package_apply_summary(
    *,
    registry: dict[str, Any] | None = None,
    require_import_available: bool = False,
) -> dict[str, Any]:
    """Interface Lab에서 interface build/apply 상태를 처리하는 함수입니다."""
    registry = registry or _load_packages_registry(default_packages_registry_path())
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

        for kind, items in _iter_package_interface_lists(package):
            for item in items:
                total += 1
                interface_path = Path(str(item.get('relative_path') or ''))
                actual_path = package_path / interface_path
                reasons = list(package_reasons)
                if not actual_path.is_file():
                    reasons.append('file_saved false')
                if not _cmake_contains_interface(package_path / 'CMakeLists.txt', item):
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
        'registry_exists': default_packages_registry_path().is_file(),
        'registry_path': _display_path(default_packages_registry_path()),
        'uploaded_packages_path': _display_path(default_uploaded_packages_root()),
        'package_count': len(registry['packages']),
        'total': total,
        'applied_count': total - len(not_applied),
        'not_applied': not_applied,
        'import_pending': import_pending,
        'requires_import_available': require_import_available,
    }


def registered_package_services() -> list[dict[str, Any]]:
    """업로드 package에서 import 가능한 Service 타입만 반환합니다."""
    return _registered_package_interfaces('srv', 'service_type', 'request', 'response')


def registered_package_messages() -> list[dict[str, Any]]:
    """Interface Lab에서 interface 등록 정보를 저장하는 함수입니다."""
    entries = []
    for package in packages_snapshot()['packages']:
        for item in package.get('interfaces', {}).get('msg', []):
            entries.append({
                'source': 'uploaded_package',
                'package_name': package.get('name'),
                'file_name': item.get('file_name'),
                'type_name': item.get('type_name'),
                'message_type': item.get('type'),
                'message_schema': item.get('parsed', []) if isinstance(item.get('parsed'), list) else [],
                'saved_path': item.get('saved_path'),
                'import_available': item.get('import_available') is True,
                'import_error': item.get('import_error') or package.get('import_error'),
            })
    return entries


def registered_package_actions() -> list[dict[str, Any]]:
    """업로드 package에서 import 가능한 Action 타입만 반환합니다."""
    entries = []
    for package in packages_snapshot()['packages']:
        for item in package.get('interfaces', {}).get('action', []):
            parsed = item.get('parsed') if isinstance(item.get('parsed'), dict) else {}
            entries.append({
                'source': 'uploaded_package',
                'package_name': package.get('name'),
                'file_name': item.get('file_name'),
                'type_name': item.get('type_name'),
                'action_type': item.get('type'),
                'goal_schema': parsed.get('goal', []),
                'result_schema': parsed.get('result', []),
                'feedback_schema': parsed.get('feedback', []),
                'saved_path': item.get('saved_path'),
                'import_available': item.get('import_available') is True,
                'import_error': item.get('import_error') or package.get('import_error'),
            })
    return entries


def _registered_package_interfaces(
    kind: str,
    type_key: str,
    request_key: str,
    response_key: str,
) -> list[dict[str, Any]]:
    entries = []
    for package in packages_snapshot()['packages']:
        for item in package.get('interfaces', {}).get(kind, []):
            parsed = item.get('parsed') if isinstance(item.get('parsed'), dict) else {}
            entries.append({
                'source': 'uploaded_package',
                'package_name': package.get('name'),
                'file_name': item.get('file_name'),
                'type_name': item.get('type_name'),
                type_key: item.get('type'),
                'request_schema': parsed.get(request_key, []),
                'response_schema': parsed.get(response_key, []),
                'saved_path': item.get('saved_path'),
                'import_available': item.get('import_available') is True,
                'import_error': item.get('import_error') or package.get('import_error'),
            })
    return entries


def _validate_package_identity(package_root: Path) -> str:
    package_xml = package_root / 'package.xml'
    cmake = package_root / 'CMakeLists.txt'
    if not package_xml.is_file():
        raise InterfacePackageError('package.xml이 필요합니다.')
    if not cmake.is_file():
        raise InterfacePackageError('CMakeLists.txt가 필요합니다.')
    package_match = PACKAGE_NAME_XML_PATTERN.search(package_xml.read_text(encoding='utf-8'))
    project_match = PROJECT_PATTERN.search(cmake.read_text(encoding='utf-8'))
    if not package_match:
        raise InterfacePackageError('package.xml에서 <name>을 찾을 수 없습니다.')
    if not project_match:
        raise InterfacePackageError('CMakeLists.txt에서 project(...)를 찾을 수 없습니다.')
    package_name = package_match.group(1).strip()
    project_name = project_match.group(1).strip()
    if package_name != project_name:
        raise InterfacePackageError('package.xml <name>과 CMakeLists.txt project(...)가 다릅니다.')
    if not PACKAGE_NAME_PATTERN.fullmatch(package_name):
        raise InterfacePackageError('패키지명은 소문자, 숫자, underscore만 사용할 수 있습니다.')
    return package_name


def _collect_interfaces(package_root: Path, package_name: str) -> dict[str, list[dict[str, Any]]]:
    interfaces: dict[str, list[dict[str, Any]]] = {'msg': [], 'srv': [], 'action': []}
    for kind in interfaces:
        directory = package_root / kind
        if not directory.is_dir():
            continue
        for path in sorted(directory.glob(f'*.{kind}')):
            raw_text = path.read_text(encoding='utf-8')
            type_name = path.stem
            try:
                parsed = parse_interface(raw_text, kind)
                parsed_error = None
            except InterfaceUploadError as exc:
                parsed = {}
                parsed_error = str(exc)
            relative = path.relative_to(package_root)
            entry = {
                'file_name': path.name,
                'file_kind': kind,
                'type_name': type_name,
                'type': f'{package_name}/{kind}/{type_name}',
                'relative_path': relative.as_posix(),
                'saved_path': _display_path(path),
                'absolute_saved_path': str(path.resolve()),
                'raw_text': raw_text,
                'parsed': parsed,
                'parsed_error': parsed_error,
                'dependency_candidates': _dependency_candidates(raw_text, package_name),
                'import_available': False,
                'import_error': None,
            }
            interfaces[kind].append(entry)
    return interfaces


def _iter_package_interface_lists(package: dict[str, Any]):
    interfaces = package.get('interfaces') if isinstance(package.get('interfaces'), dict) else {}
    for kind in ('msg', 'srv', 'action'):
        items = interfaces.get(kind)
        if isinstance(items, list):
            yield kind, items


def _cmake_contains_interface(cmake_path: Path, item: dict[str, Any]) -> bool:
    try:
        text = cmake_path.read_text(encoding='utf-8')
    except (OSError, UnicodeError):
        return False
    relative = str(item.get('relative_path') or '')
    return bool(relative and (relative in text or f'"{relative}"' in text))


def _check_import(package_name: str, kind: str, type_name: str) -> tuple[bool, str | None]:
    try:
        importlib.invalidate_caches()
        module = importlib.import_module(f'{package_name}.{kind}')
        getattr(module, type_name)
        return True, None
    except (ImportError, AttributeError) as exc:
        return False, str(exc)
