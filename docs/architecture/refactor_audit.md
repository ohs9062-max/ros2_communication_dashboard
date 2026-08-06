# ROS2 / Web Backend 분리 조사 결과

## 기존 결합

- `app_state.py`가 `RosMonitor` singleton과 사용자 설정 store를 함께 생성했습니다.
- FastAPI lifespan이 `RosMonitor.start()`와 `stop()`을 호출해 같은 프로세스에서
  `rclpy.init`, Node 생성, spin thread, shutdown을 수행했습니다.
- 모든 monitoring/Interface Lab Router가 singleton의 Python 메서드를 직접 호출했습니다.
- `RosMonitor`가 Topic, Service, Action, Node Runtime과 Interface Lab execution Runtime의
  cache를 조립했으며 Router는 이 메모리를 직접 읽었습니다.
- Interface 등록·package upload·apply Runtime은 ROS2 workspace 상대 경로와
  `__file__.parents` 계산에 의존했습니다.

## 직접 의존 파일

- rclpy: `ros_monitor.py`, `ros2_topic/runtime.py`, `ros2_service/introspection_test_nodes.py`,
  `ros2_action/runtime.py`, `ros2_node/runtime.py`, Interface Lab의
  `action_goal_runtime.py`.
- FastAPI: 기존 `main.py`, WebSocket manager, monitoring 및 Interface Lab Router 일체.
- 혼합 책임: 기존 `app_state.py`, `main.py`, `config_loader.py`, `ros_monitor.py`,
  Interface management/apply Router.

## 새 경계

- ROS2 Graph, 상태 판정, Publisher/Subscription/Client, interface 파일 및 build는
  `ros2_dashboard_monitor`가 소유합니다.
- 공개 REST/WebSocket, 사용자 설정, Runtime Cache와 Alert 이력은 `backend/app`이 소유합니다.
- Backend에는 `rclpy` import가 없습니다.
- source/install 어느 위치에서도 경로가 유지되도록 ament package share와
  `ROS2_DASHBOARD_WS_ROOT` fallback을 사용합니다.

## 마이그레이션과 롤백

설정 YAML과 업로드 파일을 새 workspace로 먼저 복사하고 `colcon list/build`, 테스트를
통과한 뒤 구 `backend/src`를 제거했습니다. 롤백은 Git에서 리팩토링 전 commit을 복원하고
새 `ros2_ws`를 제거하는 방식이며, 사용자 데이터는 YAML과 interface 원본을 별도 백업한 뒤
수행해야 합니다.
