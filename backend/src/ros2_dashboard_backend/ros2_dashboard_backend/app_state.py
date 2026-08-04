"""ROS2 Dashboard Backend의 app_state 관련 기능을 담당하는 모듈입니다."""

from ros2_dashboard_backend.config_loader import load_backend_config
from ros2_dashboard_backend.ros_monitor import RosMonitor
from ros2_dashboard_backend.interface_lab.paths import backend_workspace_root
from ros2_dashboard_backend.user_preferences import UserPreferencesStore
from ros2_dashboard_backend.websocket_manager import WebSocketManager


backend_config = load_backend_config()
user_preferences = UserPreferencesStore(
    backend_workspace_root() / 'config' / 'user_preferences.yaml',
)
ros_monitor = RosMonitor(
    backend_config.monitor,
    user_preferences=user_preferences,
)
websocket_manager = WebSocketManager()
