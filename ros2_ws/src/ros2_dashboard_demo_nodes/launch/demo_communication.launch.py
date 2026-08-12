from launch import LaunchDescription
from launch_ros.actions import Node


DEMO_EXECUTABLES = (
    'cleaning_schedule',
    'robot_control_service',
    'schedule_crud_service',
    'can_control_server',
    'camera_publisher',
)


def generate_launch_description() -> LaunchDescription:
    nodes = [
        Node(
            package='ros2_dashboard_demo_nodes',
            executable=executable,
            name=f'demo_{executable}',
            output='screen',
        )
        for executable in DEMO_EXECUTABLES
    ]
    return LaunchDescription(nodes)
