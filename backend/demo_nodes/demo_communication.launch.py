#!/usr/bin/env python3


import sys
from pathlib import Path

from launch import LaunchDescription
from launch.actions import ExecuteProcess


DEMO_NODE_FILES = (
    'demo_cleaning_schedule.py',
    'demo_robot_control_service.py',
    'demo_schedule_crud_service.py',
    'demo_can_control_server.py',
)


def generate_launch_description() -> LaunchDescription:
    demo_nodes_dir = Path(__file__).resolve().parent
    processes = [
        ExecuteProcess(
            cmd=[sys.executable, str(demo_nodes_dir / file_name)],
            name=Path(file_name).stem,
            output='screen',
        )
        for file_name in DEMO_NODE_FILES
    ]
    return LaunchDescription(processes)
