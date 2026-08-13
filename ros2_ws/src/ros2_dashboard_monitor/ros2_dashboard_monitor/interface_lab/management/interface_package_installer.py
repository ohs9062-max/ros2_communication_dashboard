"""단일 업로드 Interface를 생성 package에 반영하는 기능."""

from __future__ import annotations

import os
import re
import shutil
import tempfile
from pathlib import Path
from typing import Any, Callable

from ros2_dashboard_monitor.interface_lab.management.errors import InterfaceUploadError


DEPENDENCY_PATTERN = re.compile(
    r'(?<![A-Za-z0-9_])([A-Za-z][A-Za-z0-9_]*)/'
    r'[A-Za-z][A-Za-z0-9_]*(?:\[[^]]*\])?',
)


def install_interface(
    safe_name: str,
    kind: str,
    type_name: str,
    raw_text: str,
    *,
    package: tuple[str, Path],
    check_import: Callable[[str, str, str], tuple[bool, str | None]],
    display_path: Callable[[Path], str],
) -> dict[str, Any]:
    package_name, package_path = package
    package_xml = package_path / 'package.xml'
    cmake_path = package_path / 'CMakeLists.txt'
    if not package_path.is_dir() or not package_xml.is_file() or not cmake_path.is_file():
        raise InterfaceUploadError(f'The interface package structure was not found: {package_path}')

    declared_name = re.search(r'<name>\s*([^<]+)\s*</name>', package_xml.read_text(encoding='utf-8'))
    if not declared_name or declared_name.group(1).strip() != package_name:
        raise InterfaceUploadError('INTERFACE_PACKAGE_NAME does not match the package name in package.xml.')

    dependencies = dependency_candidates(raw_text, package_name)
    destination = package_path / kind / safe_name
    destination.parent.mkdir(parents=True, exist_ok=True)
    try:
        atomic_write(destination, raw_text)
        if package_name == 'uploaded_interfaces':
            from ros2_dashboard_monitor.interface_lab.management.manual_interfaces import (
                regenerate_uploaded_interfaces_package,
            )
            regenerate_uploaded_interfaces_package(package_path)
            cmake_changed = True
            package_changed = True
        else:
            cmake_changed = update_cmake(cmake_path, f'{kind}/{safe_name}', dependencies)
            package_changed = update_package_xml(package_xml, dependencies)
    except (OSError, UnicodeError) as exc:
        raise InterfaceUploadError(f'Failed to update the interface package: {exc}') from exc

    import_available, import_error = check_import(package_name, kind, type_name)
    return {
        'interface_package': package_name,
        'saved_path': display_path(destination),
        'absolute_saved_path': str(destination),
        'file_saved': True,
        'cmake_registered': True,
        'cmake_updated': cmake_changed,
        'package_xml_checked': True,
        'package_xml_updated': package_changed,
        'dependency_candidates': dependencies,
        'rebuild_required': True,
        'import_available': import_available,
        'import_error': import_error,
        'error': None,
    }


def failed_build_info(raw_text: str, error: str, *, package_name: str) -> dict[str, Any]:
    return {
        'interface_package': package_name,
        'saved_path': None,
        'file_saved': False,
        'cmake_registered': False,
        'package_xml_checked': False,
        'dependency_candidates': dependency_candidates(raw_text, package_name),
        'rebuild_required': False,
        'import_available': False,
        'import_error': None,
        'error': error,
    }


def dependency_candidates(raw_text: str, package_name: str) -> list[str]:
    without_comments = '\n'.join(line.split('#', 1)[0] for line in raw_text.splitlines())
    return sorted({
        match for match in DEPENDENCY_PATTERN.findall(without_comments)
        if match != package_name
    })


def update_cmake(path: Path, interface_path: str, dependencies: list[str]) -> bool:
    text = path.read_text(encoding='utf-8')
    match = re.search(r'rosidl_generate_interfaces\s*\(', text)
    if not match:
        raise InterfaceUploadError('CMakeLists.txt does not contain a rosidl_generate_interfaces block.')
    end = closing_parenthesis(text, match.end() - 1)
    block = text[match.start():end + 1]
    updated = block
    if f'"{interface_path}"' not in updated and interface_path not in updated:
        dependency_position = re.search(r'^\s*DEPENDENCIES\b', updated, re.MULTILINE)
        insertion = dependency_position.start() if dependency_position else updated.rfind(')')
        updated = updated[:insertion] + f'  "{interface_path}"\n' + updated[insertion:]
    for dependency in dependencies:
        if not re.search(rf'\b{re.escape(dependency)}\b', dependencies_section(updated)):
            dep_match = re.search(r'^(\s*DEPENDENCIES\b[^\n]*)', updated, re.MULTILINE)
            if dep_match:
                line = dep_match.group(1) + f' {dependency}'
                updated = updated[:dep_match.start()] + line + updated[dep_match.end():]
            else:
                updated = updated[:-1] + f'  DEPENDENCIES {dependency}\n)'
    prefix = ''
    for dependency in dependencies:
        if not re.search(rf'find_package\s*\(\s*{re.escape(dependency)}\s+REQUIRED\s*\)', text):
            prefix += f'find_package({dependency} REQUIRED)\n'
    result = text[:match.start()] + prefix + updated + text[end + 1:]
    if result == text:
        return False
    backup(path)
    atomic_write(path, result)
    return True


def dependencies_section(block: str) -> str:
    match = re.search(r'\bDEPENDENCIES\b(.*)', block, re.DOTALL)
    return match.group(1) if match else ''


def closing_parenthesis(text: str, opening: int) -> int:
    depth = 0
    for index in range(opening, len(text)):
        if text[index] == '(':
            depth += 1
        elif text[index] == ')':
            depth -= 1
            if depth == 0:
                return index
    raise InterfaceUploadError('The rosidl_generate_interfaces block is not closed.')


def update_package_xml(path: Path, dependencies: list[str]) -> bool:
    text = path.read_text(encoding='utf-8')
    additions: list[str] = []
    for tag, name in (
        ('build_depend', 'rosidl_default_generators'),
        ('exec_depend', 'rosidl_default_runtime'),
    ):
        if not re.search(rf'<(?:{tag}|depend)>\s*{re.escape(name)}\s*</(?:{tag}|depend)>', text):
            additions.append(f'  <{tag}>{name}</{tag}>')
    for dependency in dependencies:
        if not re.search(
            rf'<(?:depend|build_depend|exec_depend)>\s*{re.escape(dependency)}\s*'
            rf'</(?:depend|build_depend|exec_depend)>', text,
        ):
            additions.append(f'  <depend>{dependency}</depend>')
    if not re.search(r'<member_of_group>\s*rosidl_interface_packages\s*</member_of_group>', text):
        additions.append('  <member_of_group>rosidl_interface_packages</member_of_group>')
    if not additions:
        return False
    marker = text.find('  <export>')
    if marker < 0:
        marker = text.find('</package>')
    if marker < 0:
        raise InterfaceUploadError('The closing package tag was not found in package.xml.')
    result = text[:marker] + '\n'.join(additions) + '\n\n' + text[marker:]
    backup(path)
    atomic_write(path, result)
    return True


def backup(path: Path) -> None:
    backup_path = path.with_name(f'{path.name}.bak')
    if not backup_path.exists():
        shutil.copy2(path, backup_path)


def atomic_write(path: Path, content: str) -> None:
    with tempfile.NamedTemporaryFile(
        mode='w', encoding='utf-8', dir=path.parent,
        prefix=f'.{path.name}.', delete=False,
    ) as temporary:
        temporary_name = temporary.name
        temporary.write(content)
    os.replace(temporary_name, path)
