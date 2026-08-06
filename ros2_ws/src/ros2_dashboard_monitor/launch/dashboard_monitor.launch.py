"""Launch the standalone ROS2 dashboard monitor."""

from launch import LaunchDescription
from launch_ros.actions import Node


def generate_launch_description() -> LaunchDescription:
    return LaunchDescription([
        Node(
            package='ros2_dashboard_monitor',
            executable='monitor',
            name='ros2_dashboard_monitor_transport',
            output='screen',
        ),
    ])
