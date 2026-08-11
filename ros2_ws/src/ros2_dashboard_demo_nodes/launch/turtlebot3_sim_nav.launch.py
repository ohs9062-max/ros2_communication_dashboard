"""Launch TurtleBot3 Gazebo, keyboard teleop, and Nav2 together."""

from launch import LaunchDescription
from launch.actions import (
    DeclareLaunchArgument,
    ExecuteProcess,
    IncludeLaunchDescription,
    SetEnvironmentVariable,
    TimerAction,
)
from launch.conditions import IfCondition
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration, PathJoinSubstitution
from launch_ros.substitutions import FindPackageShare


def generate_launch_description() -> LaunchDescription:
    model = LaunchConfiguration('model')
    use_sim_time = LaunchConfiguration('use_sim_time')

    gazebo = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            PathJoinSubstitution([
                FindPackageShare('turtlebot3_gazebo'),
                'launch',
                'turtlebot3_world.launch.py',
            ]),
        ),
        launch_arguments={'use_sim_time': use_sim_time}.items(),
    )

    navigation = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            PathJoinSubstitution([
                FindPackageShare('turtlebot3_navigation2'),
                'launch',
                'navigation2.launch.py',
            ]),
        ),
        launch_arguments={'use_sim_time': use_sim_time}.items(),
    )

    teleop = ExecuteProcess(
        cmd=[
            'gnome-terminal',
            '--wait',
            '--title=TurtleBot3 Teleop',
            '--',
            'bash',
            '-c',
            [
                'export TURTLEBOT3_MODEL="',
                model,
                '"; exec ros2 run turtlebot3_teleop teleop_keyboard',
            ],
        ],
        condition=IfCondition(LaunchConfiguration('teleop')),
        output='screen',
    )

    return LaunchDescription([
        DeclareLaunchArgument(
            'model',
            default_value='burger',
            description='TurtleBot3 model: burger, waffle, waffle_pi, or burger_cam',
        ),
        DeclareLaunchArgument(
            'use_sim_time',
            default_value='true',
            description='Use the Gazebo simulation clock',
        ),
        DeclareLaunchArgument(
            'teleop',
            default_value='true',
            description='Open keyboard teleop in a separate terminal',
        ),
        DeclareLaunchArgument(
            'teleop_delay',
            default_value='2.0',
            description='Seconds to wait before opening keyboard teleop',
        ),
        DeclareLaunchArgument(
            'nav2_delay',
            default_value='5.0',
            description='Seconds to wait before starting Nav2',
        ),
        SetEnvironmentVariable('TURTLEBOT3_MODEL', model),
        gazebo,
        TimerAction(
            period=LaunchConfiguration('teleop_delay'),
            actions=[teleop],
        ),
        TimerAction(
            period=LaunchConfiguration('nav2_delay'),
            actions=[navigation],
        ),
    ])
