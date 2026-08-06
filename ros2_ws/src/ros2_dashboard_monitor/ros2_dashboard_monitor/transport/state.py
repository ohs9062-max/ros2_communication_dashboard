"""ROS2 Dashboard Backend의 app_state 관련 기능을 담당하는 모듈입니다."""

from ros2_dashboard_monitor.config_loader import load_backend_config
from ros2_dashboard_monitor.ros_monitor import RosMonitor
from ros2_dashboard_monitor.priority_state import PriorityState
from ros2_dashboard_monitor.transport.websocket_manager import WebSocketManager


backend_config = load_backend_config()
priority_state = PriorityState()
ros_monitor = RosMonitor(
    backend_config.monitor,
    priority_state=priority_state,
)
websocket_manager = WebSocketManager()
