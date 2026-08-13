# ROS2 Dashboard 실행 방법

리팩토링 이후 ROS2 Monitor, FastAPI Backend, React Frontend는 서로 다른 프로세스로 실행한다.

```text
ROS2 Graph
→ ROS2 Monitor : 127.0.0.1:8765
→ FastAPI Backend : 127.0.0.1:8000
→ React Frontend : 127.0.0.1:5173
```

## Server

### 최초 1회 준비

```bash
cd ~/rang/ros2_dashboard/backend
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
deactivate

cd ~/rang/ros2_dashboard/frontend
npm install
```

환경값을 변경해야 할 때만 예제 파일을 복사한다. 실제 `.env`는 Git에 포함하지 않는다.

```bash
cd ~/rang/ros2_dashboard
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 1. ROS2 Workspace 빌드

```bash
cd ~/rang/ros2_dashboard/ros2_ws
source /opt/ros/jazzy/setup.bash
colcon build --symlink-install
source install/setup.bash
```

ROS2 빌드는 `backend/`가 아니라 `ros2_ws/`에서 실행한다.

### 2. ROS2 Monitor 실행

터미널 1:

```bash
cd ~/rang/ros2_dashboard/ros2_ws
source /opt/ros/jazzy/setup.bash
source install/setup.bash
ros2 run ros2_dashboard_monitor monitor
```

launch 파일로 실행하려면:

```bash
ros2 launch ros2_dashboard_monitor dashboard_monitor.launch.py
```

확인:

```bash
curl http://127.0.0.1:8765/health
```

### 3. FastAPI Backend 실행

터미널 2:

```bash
cd ~/rang/ros2_dashboard/backend
source .venv/bin/activate
python3 -m uvicorn app.main:app \
  --host 127.0.0.1 \
  --port 8000 \
  --reload
```

Backend는 ROS2 workspace가 아니므로 `backend/install/setup.bash`를 source하지 않는다.

확인:

```bash
curl http://127.0.0.1:8000/health
```

### 4. Frontend 실행

터미널 3:

```bash
cd ~/rang/ros2_dashboard/frontend
npm run dev
```

브라우저:

```text
http://127.0.0.1:5173
```

## 자동 실행

Backend `.venv`와 Frontend dependency가 준비된 뒤 다음 명령으로 전체 Stack을 실행한다.

```bash
cd ~/rang/ros2_dashboard
./scripts/run_dashboard_stack.sh
```

실행 로그와 PID는 `.runtime/`에 저장된다.

```text
.runtime/monitor.log
.runtime/backend.log
.runtime/frontend.log
```

종료:

```bash
cd ~/rang/ros2_dashboard
./scripts/stop_dashboard_stack.sh
```

자동 실행 터미널에서 `Ctrl+C`를 눌러도 스크립트가 생성한 세 프로세스만 종료한다.

## 환경 설정

Backend 설정:

```text
backend/.env
MONITOR_BASE_URL=http://127.0.0.1:8765
MONITOR_TIMEOUT_SEC=30
MONITOR_POLL_INTERVAL_SEC=1
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
USER_PREFERENCES_PATH=config/user_preferences.yaml
ALERT_DB_ENABLED=true
MARIADB_HOST=127.0.0.1
MARIADB_PORT=3306
MARIADB_DATABASE=ros2_dashboard
MARIADB_USER=ros2_dashboard
MARIADB_PASSWORD=<secret>
MARIADB_CONNECT_TIMEOUT_SEC=2
MARIADB_RETRY_INTERVAL_SEC=5
```

Frontend 설정:

```text
frontend/.env
VITE_API_BASE_URL=
VITE_TOPIC_POLL_INTERVAL_MS=1000
VITE_DASHBOARD_POLL_INTERVAL_MS=3000
VITE_VISUALIZATION_POLL_INTERVAL_MS=5000
```

Monitor host 또는 port를 변경할 때는 Monitor 환경과 Backend의 `MONITOR_BASE_URL`을 함께 맞춘다.

```bash
export ROS2_MONITOR_HOST=127.0.0.1
export ROS2_MONITOR_PORT=8765
```

ROS2 감시 정책과 Interface Registry는 다음 위치에서 관리한다.

```text
ros2_ws/src/ros2_dashboard_monitor/config/monitor.yaml
ros2_ws/src/ros2_dashboard_monitor/config/interface_registry.yaml
ros2_ws/src/ros2_dashboard_monitor/config/interface_packages.yaml
ros2_ws/src/ros2_dashboard_monitor/config/interface_apply_status.yaml
```

## Demo Nodes

ROS2 Dashboard용 Topic, Service, Action demo를 한 번에 실행한다.

```bash
cd ~/rang/ros2_dashboard/ros2_ws
source /opt/ros/jazzy/setup.bash
source install/setup.bash
ros2 launch ros2_dashboard_demo_nodes demo_communication.launch.py
```

개별 실행 예시:

```bash
ros2 run ros2_dashboard_demo_nodes cleaning_schedule
ros2 run ros2_dashboard_demo_nodes robot_control_service
ros2 run ros2_dashboard_demo_nodes schedule_crud_service
ros2 run ros2_dashboard_demo_nodes can_control_server
ros2 run ros2_dashboard_demo_nodes can_control_outcome_server
ros2 run ros2_dashboard_demo_nodes demo_camera_publisher
```

Camera demo는 외부 이미지 없이 생성한 패턴을 `/demo_camera/image_raw`와
`/demo_camera/image_compressed`에 1 Hz로 발행한다. Preview는 Topic 상세을 열었을 때만 요청형으로 생성된다.

## Gazebo

```bash
source /opt/ros/jazzy/setup.bash
export TURTLEBOT3_MODEL=burger
ros2 launch turtlebot3_gazebo turtlebot3_world.launch.py
```

키보드 제어가 필요하면 다른 터미널에서 실행한다.

```bash
source /opt/ros/jazzy/setup.bash
export TURTLEBOT3_MODEL=burger
ros2 run turtlebot3_teleop teleop_keyboard
```

## Nav2

Gazebo가 실행된 상태에서 다른 터미널을 사용한다.

```bash
source /opt/ros/jazzy/setup.bash
export TURTLEBOT3_MODEL=burger
ros2 launch turtlebot3_navigation2 navigation2.launch.py use_sim_time:=True
```

## Test Service Server

ROS2 기본 Service 테스트:

```bash
source /opt/ros/jazzy/setup.bash
ros2 run demo_nodes_cpp add_two_ints_server
```

다른 터미널:

```bash
source /opt/ros/jazzy/setup.bash
ros2 service call /add_two_ints example_interfaces/srv/AddTwoInts "{a: 2, b: 3}"
```

Dashboard Monitor package의 introspection 테스트:

```bash
cd ~/rang/ros2_dashboard/ros2_ws
source /opt/ros/jazzy/setup.bash
source install/setup.bash
ros2 run ros2_dashboard_monitor introspection_add_two_ints_server
```

다른 터미널:

```bash
cd ~/rang/ros2_dashboard/ros2_ws
source /opt/ros/jazzy/setup.bash
source install/setup.bash
ros2 run ros2_dashboard_monitor introspection_add_two_ints_client --a 2 --b 3
```

## Build

ROS2만 다시 빌드:

```bash
cd ~/rang/ros2_dashboard
./scripts/build_ros2_ws.sh
```

또는 직접 빌드:

```bash
cd ~/rang/ros2_dashboard/ros2_ws
source /opt/ros/jazzy/setup.bash
colcon build --symlink-install
source install/setup.bash
```

Frontend 배포 빌드:

```bash
cd ~/rang/ros2_dashboard/frontend
npm run build
```

## Test

전체 정적 검사와 테스트:

```bash
cd ~/rang/ros2_dashboard
python3 -m compileall backend/app
python3 -m compileall ros2_ws/src/ros2_dashboard_monitor

cd ~/rang/ros2_dashboard/ros2_ws
source /opt/ros/jazzy/setup.bash
colcon build --symlink-install
source install/setup.bash
colcon list
colcon test
colcon test-result --verbose

cd ~/rang/ros2_dashboard/backend
.venv/bin/python -m pytest -q tests

cd ~/rang/ros2_dashboard/frontend
npm run test:unit
npm run lint
npm run build
```

## 자주 발생하는 실행 오류

### package not found

새 터미널에서 ROS2 환경을 다시 적용한다.

```bash
cd ~/rang/ros2_dashboard/ros2_ws
source /opt/ros/jazzy/setup.bash
source install/setup.bash
ros2 pkg list | grep ros2_dashboard
```

### Monitor 연결 실패

다음 순서로 확인한다.

```bash
curl http://127.0.0.1:8765/health
curl http://127.0.0.1:8000/health
```

`backend/.env`의 `MONITOR_BASE_URL`과 Monitor port가 같아야 한다.

### Frontend API 연결 실패

Vite 개발 proxy나 Nginx same-origin 구성이면 `VITE_API_BASE_URL`은 비워둔다. 별도 Backend origin을
사용할 때만 URL을 지정하고 Frontend를 다시 실행한다.

```text
VITE_API_BASE_URL=
```
