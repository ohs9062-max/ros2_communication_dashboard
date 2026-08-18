from glob import glob

from setuptools import find_packages, setup

package_name = 'ros2_dashboard_monitor'

setup(
    name=package_name,
    version='0.0.0',
    packages=find_packages(exclude=['test']),
    data_files=[
        ('share/ament_index/resource_index/packages',
            ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
        ('share/' + package_name + '/config', glob('config/*.yaml')),
        ('share/' + package_name + '/launch', glob('launch/*.launch.py')),
    ],
    install_requires=['setuptools', 'PyYAML', 'python-dotenv', 'fastapi', 'uvicorn'],
    zip_safe=True,
    maintainer='hs',
    maintainer_email='ohs9062@gmail.com',
    description='Standalone ROS2 graph monitor and Interface Lab runtime.',
    license='Apache-2.0',
    extras_require={
        'test': [
            'pytest',
        ],
    },
    entry_points={
        'console_scripts': [
            'monitor = ros2_dashboard_monitor.main:main',
            (
                'introspection_add_two_ints_server = '
                'ros2_dashboard_monitor.ros2_service.introspection_test_nodes:server_main'
            ),
            (
                'introspection_add_two_ints_client = '
                'ros2_dashboard_monitor.ros2_service.introspection_test_nodes:client_main'
            ),
        ],
    },
)
