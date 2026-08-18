# ROS2 Dashboard 실행과 설정

## 제품 설치

```bash
cd ~/rang/ros2_dashboard
sudo ./scripts/install.sh
```

설치기는 Ubuntu 24.04의 `amd64`/`arm64`에서 ROS2 Jazzy, ROS 개발 도구, 지원 Node.js, Backend Python
의존성, MariaDB, Nginx를 준비하고 ROS workspace와 production Frontend를 빌드한다. Demo/Gazebo 의존성은
제품 설치에서 제외한다. 설치 과정은 `C.UTF-8`을 사용하지만 시스템 locale과 사용자 언어는 변경하지 않는다.

기존 `.env`, Interface Registry/Package/Apply 상태, MariaDB Alert 이력과 TLS 인증서는 재설치 시 보존한다.
기존 systemd/Nginx 설정은 `/var/backups/ros2-dashboard/<시각>/`에 백업한다.

## 제품 실행

```bash
cd ~/rang/ros2_dashboard
./scripts/start.sh
./scripts/status.sh
./scripts/stop.sh
```

`backend/.env`의 `ROS_DOMAIN_ID`와 `RMW_IMPLEMENTATION`이 프로젝트 기준값이다. `install.sh`와 `start.sh`가
이를 `/etc/ros2-dashboard/dashboard.env`에 반영하고 값이 바뀌면 Monitor를 재시작한다.

```bash
sudo systemctl start ros2-dashboard.target
sudo systemctl stop ros2-dashboard.target
systemctl status ros2-dashboard.target
```

제품 모드는 다음 경로를 사용한다.

```text
ROS2 Graph
→ Monitor + Fast DDS observer 127.0.0.1:8765 / 8766
→ FastAPI Backend             127.0.0.1:8000
→ Nginx HTTPS/WSS             :443
→ React production build      /var/lib/ros2-dashboard/frontend
```

`stop.sh`는 Dashboard 전용 Monitor와 Backend만 중지한다. 공용 MariaDB와 Nginx는 유지한다.

## 제품 설정

```text
backend/.env
  ROS_DOMAIN_ID
  RMW_IMPLEMENTATION
  MONITOR_BASE_URL
  MONITOR_TIMEOUT_SEC
  MONITOR_POLL_INTERVAL_SEC
  CORS_ORIGINS
  USER_PREFERENCES_PATH
  ALERT_DB_ENABLED
  MARIADB_HOST / MARIADB_PORT / MARIADB_UNIX_SOCKET
  MARIADB_DATABASE / MARIADB_USER / MARIADB_PASSWORD
  MARIADB_CONNECT_TIMEOUT_SEC / MARIADB_RETRY_INTERVAL_SEC

/etc/ros2-dashboard/dashboard.env
  위 ROS runtime 값의 systemd 반영본
  ROS2_DASHBOARD_WS_ROOT
  ROS2_DASHBOARD_MONITOR_CONFIG_DIR
  ROS_LOG_DIR

ros2_ws/src/ros2_dashboard_monitor/config/monitor.yaml
  Graph polling, timeout, 주요/감시 대상, Topic filter
  QoS confirmation, Fast DDS observer, Camera Preview 제한

ros2_ws/src/ros2_dashboard_monitor/config/
  interface_registry.yaml
  interface_packages.yaml
  interface_apply_status.yaml
  interface_apply_last.log

frontend/.env
  VITE_API_BASE_URL
  VITE_TOPIC_POLL_INTERVAL_MS
  VITE_DASHBOARD_POLL_INTERVAL_MS
  VITE_VISUALIZATION_POLL_INTERVAL_MS
```

제품 Frontend는 `VITE_API_BASE_URL`을 비운 same-origin build를 사용한다. HTTPS에서는 `/ws/monitor`가 자동으로
WSS가 된다.

## 개발 실행

제품 서비스를 먼저 정지한다.

```bash
cd ~/rang/ros2_dashboard
./scripts/stop.sh
./scripts/run_dashboard_stack.sh
```

```bash
cd ~/rang/ros2_dashboard
./scripts/stop_dashboard_stack.sh
```

개발 스택은 Vite `5173`, Backend `8000`, Monitor `8765`, observer `8766`을 사용한다. 네 포트 중 하나라도
이미 점유됐으면 기존 PID 파일을 덮지 않고 시작을 거부한다.

## 개별 개발 실행

```bash
cd ~/rang/ros2_dashboard/ros2_ws
source /opt/ros/jazzy/setup.bash
colcon build --symlink-install
source install/setup.bash
ros2 run ros2_dashboard_monitor monitor
```

```bash
cd ~/rang/ros2_dashboard/backend
source .venv/bin/activate
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

```bash
cd ~/rang/ros2_dashboard/frontend
npm run dev
```

## Demo Nodes

```bash
cd ~/rang/ros2_dashboard/ros2_ws
source /opt/ros/jazzy/setup.bash
source install/setup.bash
ros2 launch ros2_dashboard_demo_nodes demo_communication.launch.py
```

Camera demo는 `/demo_camera/image_raw`와 `/demo_camera/image_compressed`에 코드 생성 패턴을 1 Hz로 발행한다.
Preview는 Camera Topic 상세에서 요청할 때만 생성된다.

## Gazebo / Nav2

```bash
source /opt/ros/jazzy/setup.bash
source ~/rang/ros2_dashboard/ros2_ws/install/setup.bash
export TURTLEBOT3_MODEL=burger
ros2 launch ros2_dashboard_demo_nodes turtlebot3_sim_nav.launch.py
```

현재 검증 환경의 이동 명령은 `/cmd_vel` `geometry_msgs/msg/TwistStamped`다. Interface Lab 사용 절차는
[`docs/interface_lab/turtlebot3_gazebo_topic_publish.md`](docs/interface_lab/turtlebot3_gazebo_topic_publish.md)를
따른다.

## Build / Test

```bash
cd ~/rang/ros2_dashboard
python3 -m compileall backend/app
python3 -m compileall ros2_ws/src/ros2_dashboard_monitor

cd ros2_ws
source /opt/ros/jazzy/setup.bash
colcon build --symlink-install
source install/setup.bash
colcon test
colcon test-result --verbose

cd ../backend
.venv/bin/python -m pytest -q tests

cd ../frontend
npm run test:unit
npm run lint
npm run build
```

## 상태와 로그

```bash
cd ~/rang/ros2_dashboard
./scripts/status.sh
journalctl -u ros2-dashboard-monitor.service -u ros2-dashboard-backend.service -n 100 --no-pager
sudo nginx -t
systemctl status mariadb.service nginx.service
```

```bash
curl http://127.0.0.1:8765/health
curl http://127.0.0.1:8000/health
curl -k https://localhost/health
```
