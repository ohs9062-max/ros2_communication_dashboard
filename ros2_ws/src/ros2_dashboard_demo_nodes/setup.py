from glob import glob
from setuptools import find_packages, setup

package_name = 'ros2_dashboard_demo_nodes'

setup(
    name=package_name,
    version='0.1.0',
    packages=find_packages(),
    data_files=[
        ('share/ament_index/resource_index/packages', ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
        ('share/' + package_name + '/launch', glob('launch/*.launch.py')),
    ],
    install_requires=['setuptools'],
    extras_require={'test': ['pytest']},
    zip_safe=True,
    maintainer='hs',
    maintainer_email='ohs9062@gmail.com',
    description='Demo nodes for the ROS2 dashboard.',
    license='Apache-2.0',
    entry_points={'console_scripts': [
        'can_control_server = ros2_dashboard_demo_nodes.demo_can_control_server:main',
        'can_control_outcome_server = ros2_dashboard_demo_nodes.demo_can_control_outcome_server:main',
        'can_control_outcome_client = ros2_dashboard_demo_nodes.demo_can_control_outcome_client:main',
        'cleaning_schedule = ros2_dashboard_demo_nodes.demo_cleaning_schedule:main',
        'robot_control_service = ros2_dashboard_demo_nodes.demo_robot_control_service:main',
        'schedule_crud_service = ros2_dashboard_demo_nodes.demo_schedule_crud_service:main',
    ]},
)
