"""업로드 ROS Interface package identity와 Interface 정의 수집."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Callable

from ros2_dashboard_monitor.interface_lab.management.errors import (
    InterfacePackageError,
    InterfaceUploadError,
)


PACKAGE_NAME_PATTERN = re.compile(r'^[a-z][a-z0-9_]*$')
PROJECT_PATTERN = re.compile(r'project\s*\(\s*([A-Za-z][A-Za-z0-9_]*)\b', re.IGNORECASE)
PACKAGE_NAME_XML_PATTERN = re.compile(r'<name>\s*([^<]+)\s*</name>')


def validate_package_identity(package_root: Path) -> str:
    package_xml = package_root / 'package.xml'
    cmake = package_root / 'CMakeLists.txt'
    if not package_xml.is_file():
        raise InterfacePackageError('package.xml is required.')
    if not cmake.is_file():
        raise InterfacePackageError('CMakeLists.txt is required.')
    package_match = PACKAGE_NAME_XML_PATTERN.search(package_xml.read_text(encoding='utf-8'))
    project_match = PROJECT_PATTERN.search(cmake.read_text(encoding='utf-8'))
    if not package_match:
        raise InterfacePackageError('The <name> element was not found in package.xml.')
    if not project_match:
        raise InterfacePackageError('project(...) was not found in CMakeLists.txt.')
    package_name = package_match.group(1).strip()
    project_name = project_match.group(1).strip()
    if package_name != project_name:
        raise InterfacePackageError('The package.xml <name> and CMakeLists.txt project(...) values do not match.')
    if not PACKAGE_NAME_PATTERN.fullmatch(package_name):
        raise InterfacePackageError('The package name may contain only lowercase letters, numbers, and underscores.')
    return package_name


def collect_interfaces(
    package_root: Path,
    package_name: str,
    *,
    parse_interface: Callable[[str, str], Any],
    dependency_candidates: Callable[[str, str], list[str]],
    display_path: Callable[[Path], str],
) -> dict[str, list[dict[str, Any]]]:
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
            interfaces[kind].append({
                'file_name': path.name,
                'file_kind': kind,
                'type_name': type_name,
                'type': f'{package_name}/{kind}/{type_name}',
                'relative_path': relative.as_posix(),
                'saved_path': display_path(path),
                'absolute_saved_path': str(path.resolve()),
                'raw_text': raw_text,
                'parsed': parsed,
                'parsed_error': parsed_error,
                'dependency_candidates': dependency_candidates(raw_text, package_name),
                'import_available': False,
                'import_error': None,
            })
    return interfaces
