from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[4]
MONITOR_PACKAGE_ROOT = PROJECT_ROOT / 'ros2_ws' / 'src' / 'ros2_dashboard_monitor'
PYTHON_PACKAGE_ROOT = MONITOR_PACKAGE_ROOT / 'ros2_dashboard_monitor'


def test_legacy_interface_lab_import_paths_are_not_used_in_monitor_code():
    legacy_paths = [
        'ros2_dashboard_monitor.' + 'interface_apply',
        'ros2_dashboard_monitor.' + 'interface_registry',
        'ros2_dashboard_monitor.' + 'interface_packages',
        'ros2_dashboard_monitor.' + 'manual_interfaces',
        'ros2_dashboard_monitor.' + 'interface_receive_runtime',
        'ros2_dashboard_monitor.' + 'interface_value_converter',
        'ros2_dashboard_monitor.ros2_service.' + 'call_runtime',
        'ros2_dashboard_monitor.ros2_action.' + 'goal_runtime',
    ]
    files = [
        path for path in PYTHON_PACKAGE_ROOT.rglob('*.py')
        if '__pycache__' not in path.parts
    ]

    hits = []
    for path in files:
        text = path.read_text(encoding='utf-8')
        for legacy_path in legacy_paths:
            if legacy_path in text:
                hits.append(f'{path.relative_to(PROJECT_ROOT)}: {legacy_path}')

    assert hits == []


def test_introspection_console_scripts_point_to_installed_monitor_modules():
    setup_py = MONITOR_PACKAGE_ROOT / 'setup.py'
    text = setup_py.read_text(encoding='utf-8')
    compact = ''.join(text.split())

    assert 'introspection_add_two_ints_server' in compact
    assert 'ros2_dashboard_monitor.ros2_service.introspection_test_nodes:server_main' in compact
    assert 'introspection_add_two_ints_client' in compact
    assert 'ros2_dashboard_monitor.ros2_service.introspection_test_nodes:client_main' in compact
    assert 'test.manual_introspection_test_nodes' not in text
