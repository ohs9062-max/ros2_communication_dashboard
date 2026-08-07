import stat
from pathlib import Path
from zipfile import ZipInfo

import pytest
import yaml

from ros2_dashboard_monitor.interface_lab.management.errors import InterfacePackageError
from ros2_dashboard_monitor.interface_lab.management.package_archive import (
    safe_package_relative_path,
    safe_zip_member,
)
from ros2_dashboard_monitor.interface_lab.management.package_registry_storage import (
    load_packages_registry,
    write_packages_registry,
)


@pytest.mark.parametrize('path', ('../package.xml', '/package.xml', 'pkg/build/file.msg'))
def test_package_relative_path_rejects_escape_and_generated_directories(path: str):
    with pytest.raises(InterfacePackageError):
        safe_package_relative_path(path, 1)


def test_package_relative_path_allows_ros_interface_source():
    path = safe_package_relative_path('demo_interfaces/msg/Status.msg', 10)
    assert path.as_posix() == 'demo_interfaces/msg/Status.msg'


def test_zip_member_rejects_symlink():
    info = ZipInfo('demo_interfaces/msg/Status.msg')
    info.external_attr = (stat.S_IFLNK | 0o777) << 16
    with pytest.raises(InterfacePackageError, match='symlink'):
        safe_zip_member(info)


def test_package_registry_storage_normalizes_invalid_packages(tmp_path: Path):
    path = tmp_path / 'interface_packages.yaml'
    path.write_text('packages: invalid\n', encoding='utf-8')
    assert load_packages_registry(path) == {'packages': []}

    registry = {'packages': [{'name': 'demo_interfaces'}]}
    write_packages_registry(path, registry)
    assert yaml.safe_load(path.read_text(encoding='utf-8')) == registry
