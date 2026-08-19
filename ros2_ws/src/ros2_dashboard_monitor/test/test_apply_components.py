import subprocess
from pathlib import Path

from ros2_dashboard_monitor.interface_lab.apply.build_executor import run_colcon
from ros2_dashboard_monitor.interface_lab.apply import result_builder


def test_run_colcon_uses_workspace_and_non_throwing_capture(tmp_path: Path):
    calls = []

    def runner(*args, **kwargs):
        calls.append((args, kwargs))
        return subprocess.CompletedProcess(args[0], 0, 'ok', '')

    completed = run_colcon(tmp_path, command='colcon test', runner=runner)

    assert completed.returncode == 0
    assert calls[0][0][0] == ['/bin/bash', '-lc', 'colcon test']
    assert calls[0][1] == {
        'cwd': tmp_path,
        'capture_output': True,
        'check': False,
        'text': True,
    }


def test_completed_apply_status_requires_build_import_and_summary_success(tmp_path: Path):
    common = {
        'started_at': 'start',
        'finished_at': 'finish',
        'workspace': tmp_path,
        'log_path': tmp_path / 'apply.log',
        'returncode': 0,
        'summary': {'real_apply_success': True, 'not_applied': []},
        'import_check': {'status': 'success'},
        'cleanup': {'package_names': [], 'removed': [], 'duplicates': {}},
    }
    success = result_builder.completed(
        **common,
        path_refresh={'site_packages': ['/install/site-packages'], 'added': []},
    )
    missing_paths = result_builder.completed(
        **common,
        path_refresh={'site_packages': [], 'added': []},
    )

    assert success['status'] == 'success'
    assert success['restart_scheduled'] is True
    assert missing_paths['status'] == 'import_failed'
    assert missing_paths['restart_scheduled'] is True


def test_duplicate_package_status_preserves_cleanup_details(tmp_path: Path):
    status = result_builder.duplicate_packages(
        started_at='start',
        finished_at='finish',
        workspace=tmp_path,
        log_path=tmp_path / 'apply.log',
        message='duplicate',
        duplicate_lines=['demo: src/a, src/b'],
        duplicates={'demo': ['src/a', 'src/b']},
        package_names=['demo'],
        summary={'not_applied': []},
    )

    assert status['status'] == 'failed'
    assert status['build_status'] == 'skipped'
    assert status['cleanup']['duplicates'] == {'demo': ['src/a', 'src/b']}


def test_completed_apply_status_serializes_workspace_paths_portably(tmp_path: Path):
    workspace = tmp_path / 'checkout' / 'ros2_ws'
    site_packages = workspace / 'install' / 'demo' / 'lib' / 'python3.12' / 'site-packages'
    status = result_builder.completed(
        started_at='start',
        finished_at='finish',
        workspace=workspace,
        log_path=workspace / 'src' / 'monitor' / 'config' / 'apply.log',
        returncode=0,
        summary={'real_apply_success': True, 'not_applied': []},
        path_refresh={'site_packages': [str(site_packages)], 'added': []},
        import_check={
            'status': 'success',
            'install_python_paths': [str(site_packages)],
            'install_python_paths_added': [],
        },
        cleanup={'package_names': [], 'removed': [], 'duplicates': {}},
    )

    assert status['workspace_path'] == 'ros2_ws'
    assert status['log_path'] == 'ros2_ws/src/monitor/config/apply.log'
    assert status['install_python_paths'] == [
        'ros2_ws/install/demo/lib/python3.12/site-packages',
    ]
    assert status['import_check']['install_python_paths'] == [
        'ros2_ws/install/demo/lib/python3.12/site-packages',
    ]
