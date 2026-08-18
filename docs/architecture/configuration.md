# 설정 구조

설정은 역할별 한 곳에서 읽고 기능 코드가 환경변수나 YAML을 개별적으로 해석하지 않는다.

## Backend

Backend는 `backend/app/settings.py`가 `backend/.env`를 읽는다.

| 설정 | 기본값/역할 |
|---|---|
| `MONITOR_BASE_URL` | `http://127.0.0.1:8765` |
| `MONITOR_TIMEOUT_SEC` | Monitor 요청 timeout |
| `MONITOR_POLL_INTERVAL_SEC` | snapshot polling 주기 |
| `CORS_ORIGINS` | 개발 Browser origin 목록 |
| `USER_PREFERENCES_PATH` | 주요 리소스 YAML |
| `ALERT_DB_ENABLED` | MariaDB Alert 저장 사용 여부 |
| `MARIADB_*` | Alert DB 연결 정보와 재시도 설정 |

비밀번호가 포함된 실제 `.env`는 Git에 포함하지 않는다. 예시는 `backend/.env.example`을 사용한다.

## Monitor

기본 설정은 `ros2_ws/src/ros2_dashboard_monitor/config/monitor.yaml`이다.

- polling, stale/Graph missing timeout, Hz window
- Topic 자동 발견·지원 type·필수 stream·command 예외
- Service/Action/Node 주요 대상과 hidden 필터
- QoS incompatible 연속 확인 횟수
- Fast DDS observer 연결과 timeout
- Camera Preview TTL, encode 간격과 frame 크기 제한

설정 key가 없으면 중앙 loader의 검증된 safe default를 사용한다. Interface Lab의 Registry, Package, Apply 상태는
Monitor source workspace YAML에 보존하며 생성된 `build/install/log`를 저장소로 사용하지 않는다.

## Frontend

Frontend는 `frontend/.env`를 선택적으로 사용한다.

| 설정 | 역할 |
|---|---|
| `VITE_API_BASE_URL` | Backend base URL. 빈 값이면 현재 page origin |
| `VITE_TOPIC_POLL_INTERVAL_MS` | Topic 화면 polling |
| `VITE_DASHBOARD_POLL_INTERVAL_MS` | 일반 Dashboard polling |
| `VITE_VISUALIZATION_POLL_INTERVAL_MS` | Visualization polling |

HTTPS 화면에서는 Frontend가 현재 protocol을 기준으로 `/ws/monitor`를 WSS로 연결한다.

## 실행 환경

각 ROS2 터미널은 `/opt/ros/jazzy/setup.bash`와 workspace `install/setup.bash`를 source한다. `ROS_DOMAIN_ID`,
`RMW_IMPLEMENTATION`, discovery 범위는 Dashboard가 강제하지 않고 실행 환경 값을 따른다. Fast DDS observer를
사용할 때 Monitor와 같은 domain 및 `rmw_fastrtps_cpp` naming 환경이 필요하다.

제품 Monitor는 `/etc/ros2-dashboard/dashboard.env`의 `ROS_DOMAIN_ID`, `RMW_IMPLEMENTATION`, workspace/config
경로와 `ROS_LOG_DIR`을 읽고 `scripts/systemd/run_monitor.sh`가 ROS2 base와 workspace setup을 적용한다. 설치기는
기존 ROS domain/RMW 값을 보존하고 프로젝트 경로 key만 현재 checkout에 맞춘다. 설치 중에는 `C.UTF-8`을
프로세스 환경으로만 사용하며 시스템 locale을 변경하지 않는다.

`scripts/start.sh` 실행 환경에 `ROS_DOMAIN_ID`가 명시돼 있으면 제품 설정과 비교해 다른 경우 해당 값으로
동기화하고 Monitor를 재시작한다. 값이 없으면 기존 제품 설정을 보존한다. 최초 설치에서 명시적으로 지정할 때는
`sudo ROS2_DASHBOARD_ROS_DOMAIN_ID=<domain> ./scripts/install.sh` 형식을 사용할 수 있다.

제품·개발 실행 명령은 루트 [`config.md`](../../config.md), HTTPS/WSS는
[`docs/deployment/https_wss.md`](../deployment/https_wss.md)를 따른다.
