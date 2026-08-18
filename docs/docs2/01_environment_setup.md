# 새 환경 설치와 실행 가이드

이 문서는 Ubuntu 24.04 / ROS2 Jazzy 환경에서 현재 코드의 설치·실행 경로를 정리한다.

## 디렉터리와 생성물

```text
ros2_dashboard/
├─ ros2_ws/                 # colcon workspace
│  └─ src/
│     ├─ ros2_dashboard_monitor/
│     ├─ ros2_dashboard_dds_observer/
│     ├─ ros2_dashboard_interfaces/
│     ├─ ros2_dashboard_demo_nodes/
│     └─ uploaded_interfaces/
├─ backend/                 # 순수 FastAPI Web Backend
├─ frontend/                # React / Vite
├─ config/                  # systemd / Nginx template
└─ scripts/                 # 설치·실행·상태·종료
```

다음은 생성물이므로 다른 PC에서 복사해 재사용하거나 Git에 포함하지 않는다.

```text
ros2_ws/build
ros2_ws/install
ros2_ws/log
backend/.venv
frontend/node_modules
frontend/dist
.runtime
```

## 제품 설치

프로젝트 루트에서 실행한다.

```bash
sudo ./scripts/install.sh
```

설치기는 apt dependency, ROS workspace build, Backend/Frontend dependency와 production build, MariaDB 전용
DB·계정·schema, systemd unit, Nginx/TLS를 설치하고 실제 service와 health를 확인한다.

`backend/.venv`가 현재 프로젝트 경로·머신과 맞지 않으면 설치기가 다시 만들고
`backend/.venv/bin/python -m pip`로 dependency를 설치한다. 기존 DB 데이터, Registry, 인증서와 기존
`.env` 값은 재설치에서 보존한다. 시스템 설정 백업은
`/var/backups/ros2-dashboard/<시각>/`, 설치 로그는 `/var/log/ros2-dashboard/install.log`에 남는다.

## ROS Domain과 RMW

제품 설정의 기준은 `backend/.env`다.

```dotenv
ROS_DOMAIN_ID=0
RMW_IMPLEMENTATION=rmw_fastrtps_cpp
```

설치 시 우선순위:

```text
ROS2_DASHBOARD_ROS_DOMAIN_ID / ROS2_DASHBOARD_RMW_IMPLEMENTATION
→ backend/.env
→ 현재 shell의 ROS_DOMAIN_ID / RMW_IMPLEMENTATION
→ 0 / rmw_fastrtps_cpp
```

`install.sh`와 `start.sh`는 선택한 값을 `/etc/ros2-dashboard/dashboard.env`에 반영한다. systemd
Monitor와 DDS observer는 같은 Domain/RMW를 사용한다. `scripts/systemd/run_monitor.sh`는 값을 자체 결정하지
않고 ROS2 base와 workspace setup만 source한다.

```bash
./scripts/start.sh
./scripts/status.sh
```

`start.sh`는 프로젝트 값과 systemd 반영값이 다르면 Monitor를 재시작한다. 다른 ROS Domain을 자동 탐지하지
않으므로 장비와 Dashboard 값을 직접 맞춰야 한다.

## 제품 실행과 종료

```bash
./scripts/start.sh
./scripts/status.sh
./scripts/stop.sh
```

동일한 대상은 다음 systemd unit으로 관리된다.

```bash
sudo systemctl start ros2-dashboard.target
sudo systemctl stop ros2-dashboard.target
systemctl status ros2-dashboard.target
systemctl status ros2-dashboard-monitor.service
systemctl status ros2-dashboard-backend.service
```

`stop.sh`는 Dashboard 전용 Monitor와 Backend만 중지한다. 공용 MariaDB와 Nginx는 중지하지 않는다.

```text
Monitor          127.0.0.1:8765
DDS observer     127.0.0.1:8766
Backend          127.0.0.1:8000
Frontend         /var/lib/ros2-dashboard/frontend
HTTPS UI         https://localhost/
Systemd env      /etc/ros2-dashboard/dashboard.env
```

## 개발 실행

```bash
./scripts/run_dashboard_stack.sh
./scripts/stop_dashboard_stack.sh
```

개별 실행이 필요하면 새 터미널마다 ROS2 환경을 source한다.

```bash
cd ros2_ws
source /opt/ros/jazzy/setup.bash
colcon build --symlink-install
source install/setup.bash
ros2 run ros2_dashboard_monitor monitor
```

```bash
cd backend
source .venv/bin/activate
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

```bash
cd frontend
npm run dev
```

개발 Vite는 5173 strict port를 사용하며 제품 Nginx/static 실행과 동시에 사용하지 않는다.

## MariaDB

설치기는 전용 DB와 전용 사용자를 자동 생성한다. 비밀번호가 없으면 48자리 hex 값을 생성해
`backend/.env`에 `0600` 권한으로 저장하고 재실행에서는 기존 값을 재사용한다. Backend는 root가 아니라
전용 사용자로 접속한다.

```dotenv
ALERT_DB_ENABLED=true
MARIADB_HOST=127.0.0.1
MARIADB_PORT=3306
MARIADB_DATABASE=ros2_dashboard
MARIADB_USER=ros2_dashboard
MARIADB_PASSWORD=<installer generated secret>
```

```bash
./scripts/status.sh
backend/.venv/bin/python scripts/check_database.py
```

## Interface Lab 영속 파일

```text
ros2_ws/src/ros2_dashboard_monitor/config/monitor.yaml
ros2_ws/src/ros2_dashboard_monitor/config/interface_registry.yaml
ros2_ws/src/ros2_dashboard_monitor/config/interface_packages.yaml
ros2_ws/src/ros2_dashboard_monitor/config/interface_apply_status.yaml
ros2_ws/src/ros2_dashboard_monitor/config/interface_apply_last.log
backend/config/user_preferences.yaml
```

업로드한 ROS package는 `ros2_ws/src/uploaded_interfaces/packages/<package_name>`에, 수동 정의 package는
`ros2_ws/src/uploaded_interfaces/generated_interfaces`에 둔다. Apply는 `ros2_ws`를 build하고 import를
검사한 뒤 Monitor를 재실행한다.

## API와 연결 확인

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/ros/topics
curl http://127.0.0.1:8000/ros/services
curl http://127.0.0.1:8000/ros/actions
curl http://127.0.0.1:8000/ros/nodes
curl http://127.0.0.1:8000/ros/alerts
curl http://127.0.0.1:8000/ros/preferences/priority
curl -k https://localhost/health
```

Frontend는 Backend REST와 `/ws/monitor`만 사용한다. HTTPS 화면에서는 Nginx가 WSS를 종료한다.

## Demo와 테스트

```bash
cd ros2_ws
source /opt/ros/jazzy/setup.bash
source install/setup.bash
ros2 launch ros2_dashboard_demo_nodes demo_communication.launch.py
```

```bash
cd backend
.venv/bin/python -m pytest -q tests

cd ../ros2_ws
source /opt/ros/jazzy/setup.bash
source install/setup.bash
python3 -m pytest -q src/ros2_dashboard_monitor/test

cd ../frontend
npm run test:unit
npm run lint
npm run build
```

## 문제 확인

- 목록이 비어 있으면 `./scripts/status.sh`, systemd의 Domain/RMW, 장비 Domain, ROS Graph를 확인한다.
- `ros2 run`은 그 shell의 `ROS_DOMAIN_ID`, 제품 실행은 `/etc/ros2-dashboard/dashboard.env`를 사용한다.
- Monitor: `journalctl -u ros2-dashboard-monitor -n 100 --no-pager`
- Backend/DB: `journalctl -u ros2-dashboard-backend -n 100 --no-pager`, `scripts/check_database.py`
- Installer: `/var/log/ros2-dashboard/install.log`
