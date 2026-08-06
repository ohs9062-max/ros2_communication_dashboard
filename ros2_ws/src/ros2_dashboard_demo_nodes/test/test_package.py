from importlib import import_module


def test_launch_module_imports() -> None:
    import_module('ros2_dashboard_demo_nodes.demo_cleaning_schedule')
    import_module('ros2_dashboard_demo_nodes.demo_robot_control_service')
    import_module('ros2_dashboard_demo_nodes.demo_schedule_crud_service')
    import_module('ros2_dashboard_demo_nodes.demo_can_control_server')
