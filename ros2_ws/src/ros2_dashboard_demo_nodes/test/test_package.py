from importlib import import_module


def test_launch_module_imports() -> None:
    import_module('ros2_dashboard_demo_nodes.demo_cleaning_schedule')
    import_module('ros2_dashboard_demo_nodes.demo_robot_control_service')
    import_module('ros2_dashboard_demo_nodes.demo_schedule_crud_service')
    import_module('ros2_dashboard_demo_nodes.demo_can_control_server')
    import_module('ros2_dashboard_demo_nodes.demo_camera_publisher')


def test_camera_pattern_and_png_are_self_contained() -> None:
    module = import_module('ros2_dashboard_demo_nodes.demo_camera_publisher')
    rgb = module.build_test_pattern(12, 6)
    png = module.encode_rgb_png(12, 6, rgb)

    assert len(rgb) == 12 * 6 * 3
    assert png.startswith(b'\x89PNG\r\n\x1a\n')
