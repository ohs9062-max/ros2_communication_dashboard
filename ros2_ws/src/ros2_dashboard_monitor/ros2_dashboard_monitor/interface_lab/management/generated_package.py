"""사용자 작성 Interface를 담는 generated ROS package 재생성."""

from __future__ import annotations

from pathlib import Path
from typing import Callable


def ensure_package_directories(package_root: Path) -> None:
    for folder in ('msg', 'srv', 'action'):
        (package_root / folder).mkdir(parents=True, exist_ok=True)


def scan_interface_files(package_root: Path) -> list[str]:
    interface_paths: list[str] = []
    for folder, suffix in (('msg', '.msg'), ('srv', '.srv'), ('action', '.action')):
        interface_paths.extend(
            f'{folder}/{path.name}'
            for path in sorted((package_root / folder).glob(f'*{suffix}'))
        )
    return interface_paths


def regenerate_package(
    package_root: Path,
    *,
    atomic_write: Callable[[Path, str], None],
    dependency_candidates: Callable[[str, str], list[str]],
) -> dict[str, list[str]]:
    package_name = 'uploaded_interfaces'
    ensure_package_directories(package_root)
    interface_paths = scan_interface_files(package_root)
    dependencies = dependencies_from_files(
        package_root,
        package_name,
        dependency_candidates=dependency_candidates,
    )
    regenerate_cmake(
        package_root,
        interface_paths,
        dependencies,
        atomic_write=atomic_write,
    )
    regenerate_package_xml(
        package_root,
        bool(interface_paths),
        dependencies,
        atomic_write=atomic_write,
    )
    return {'interfaces': interface_paths, 'dependencies': dependencies}


def regenerate_cmake(
    package_root: Path,
    interface_paths: list[str],
    dependencies: list[str],
    *,
    atomic_write: Callable[[Path, str], None],
) -> None:
    if not interface_paths:
        cmake = '''cmake_minimum_required(VERSION 3.8)
project(uploaded_interfaces)

find_package(ament_cmake REQUIRED)

ament_package()
'''
        atomic_write(package_root / 'CMakeLists.txt', cmake)
        return
    dependency_lines = ''.join(f'find_package({name} REQUIRED)\n' for name in dependencies)
    dependency_arg = f'  DEPENDENCIES {" ".join(dependencies)}\n' if dependencies else ''
    interface_block = '\n'.join(f'  "{path}"' for path in interface_paths)
    cmake = f'''cmake_minimum_required(VERSION 3.8)
project(uploaded_interfaces)

find_package(ament_cmake REQUIRED)
find_package(rosidl_default_generators REQUIRED)
{dependency_lines}
rosidl_generate_interfaces(${{PROJECT_NAME}}
{interface_block}
{dependency_arg})

ament_export_dependencies(rosidl_default_runtime)
ament_package()
'''
    atomic_write(package_root / 'CMakeLists.txt', cmake)


def regenerate_package_xml(
    package_root: Path,
    has_interfaces: bool,
    dependencies: list[str],
    *,
    atomic_write: Callable[[Path, str], None],
) -> None:
    rosidl_dependencies = ''
    if has_interfaces:
        dependency_tags = ''.join(f'  <depend>{name}</depend>\n' for name in dependencies)
        rosidl_dependencies = f'''  <build_depend>rosidl_default_generators</build_depend>
  <exec_depend>rosidl_default_runtime</exec_depend>
{dependency_tags}  <member_of_group>rosidl_interface_packages</member_of_group>
'''
    atomic_write(package_root / 'package.xml', f'''<?xml version="1.0"?>
<package format="3">
  <name>uploaded_interfaces</name>
  <version>0.0.0</version>
  <description>User-authored interfaces from ros2_dashboard.</description>
  <maintainer email="user@example.com">ros2_dashboard</maintainer>
  <license>Apache-2.0</license>
  <buildtool_depend>ament_cmake</buildtool_depend>
{rosidl_dependencies}
  <export>
    <build_type>ament_cmake</build_type>
  </export>
</package>
''')


def dependencies_from_files(
    package_root: Path,
    package_name: str,
    *,
    dependency_candidates: Callable[[str, str], list[str]],
) -> list[str]:
    dependencies: set[str] = set()
    for relative_path in scan_interface_files(package_root):
        file_path = package_root / relative_path
        dependencies.update(
            dependency_candidates(file_path.read_text(encoding='utf-8'), package_name)
        )
    return sorted(dependencies)
