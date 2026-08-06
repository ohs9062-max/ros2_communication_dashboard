"""Console entry point for the standalone ROS2 monitor process."""

from __future__ import annotations

import os


def main() -> None:
    """Run the localhost-only monitor transport API and rclpy lifespan."""
    import uvicorn

    host = os.getenv('ROS2_MONITOR_HOST', '127.0.0.1')
    port = int(os.getenv('ROS2_MONITOR_PORT', '8765'))
    uvicorn.run(
        'ros2_dashboard_monitor.transport.api:app',
        host=host,
        port=port,
        log_level=os.getenv('ROS2_MONITOR_LOG_LEVEL', 'info'),
    )


if __name__ == '__main__':
    main()
