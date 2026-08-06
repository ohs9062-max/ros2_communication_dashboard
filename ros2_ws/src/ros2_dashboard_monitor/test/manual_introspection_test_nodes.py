"""Compatibility import for manual ROS 2 service introspection demo nodes."""

from ros2_dashboard_monitor.ros2_service.introspection_test_nodes import (  # noqa: F401
    IntrospectionAddTwoIntsClient,
    IntrospectionAddTwoIntsServer,
    client_main,
    server_main,
)
