# 새 환경 설치와 실행 최종 가이드

이 문서는 새 Ubuntu 환경에서 `ros2_dashboard`를 설치하고 ROS2 기기에 연결해
Backend와 Frontend를 실행하는 현재 기준 절차다.

기준 환경:

```text
OS: Ubuntu 24.04
ROS2: Jazzy
ROS Client: Python 3 / rclpy
Backend: FastAPI / Uvicorn
Frontend: React 19 / Vite 8
Node.js: ^20.19.0 또는 >=22.12.0
```

## 1. 디렉터리 구조와 실행 위치

저장소 루트가 아니라 `backend/`가 ROS2 workspace다.

```text
ros2_dashboard/
├─ backend/                   # colcon build와 Backend 실행 기준 위치
│  ├─ config/
│  ├─ src/
│  ├─ build/                 # 생성물
│  ├─ install/               # 생성물
│  └─ log/                   # 생성물
├─ frontend/                 # npm install, Vite 실행 위치
├─ docs/
└─ dds_qos.md                # 현재 DDS/QoS 상세 기준
```

다음 폴더는 build 또는 dependency 생성물이므로 직접 수정하지 않는다.

```text
ros2_ws/build/
ros2_ws/install/
ros2_ws/log/
frontend/node_modules/
frontend/dist/
```

`colcon build`는 항상 `backend/`에서 실행한다. 저장소 루트에 `build/`, `install/`,
`log/`가 생겼다면 잘못된 위치에서 build한 것이다.

## 2. 시스템 필수 도구 확인

ROS2 Jazzy가 설치된 Ubuntu 24.04를 기준으로 다음 명령이 동작해야 한다.

```bash
python3 --version
node --version
npm --version
colcon --help
ros2 --help
```

Node.js는 Vite 8 요구사항 때문에 다음 중 하나를 사용한다.

```text
20.19.0 이상인 Node.js 20
또는
22.12.0 이상
```

Node 버전이 낮으면 Frontend dependency 설치나 Vite 실행이 실패할 수 있다.

ROS2 환경을 확인한다.

```bash
source /opt/ros/jazzy/setup.bash
ros2 doctor --report
```

## 3. ROS2 네트워크와 DDS 환경 설정

Backend를 시작하기 전에 기기와 동일한 ROS2 환경을 설정해야 한다. 환경변수는
Backend뿐 아니라 검증용 ROS2 CLI를 실행하는 모든 터미널에서 동일하게 적용한다.

예시:

```bash
export ROS_DOMAIN_ID=99
export ROS_LOCALHOST_ONLY=0
export ROS_AUTOMATIC_DISCOVERY_RANGE=SUBNET
```

`ROS_DOMAIN_ID=99`는 현재 확인 환경의 예시다. 실제 실행에서는 반드시 연결할 기기의
Domain ID와 맞춘다.

RMW를 명시하려면 양쪽 환경에서 같은 구현을 선택한다.

```bash
export RMW_IMPLEMENTATION=rmw_fastrtps_cpp
```

현재 프로젝트는 DDS 구현을 코드에서 강제하지 않는다. `RMW_IMPLEMENTATION`이 없으면
ROS2 환경의 기본 RMW를 사용하며, 현재 확인 환경에서는 `rmw_fastrtps_cpp`, 즉 Fast DDS가
선택됐다.

확인:

```bash
printenv ROS_DOMAIN_ID
printenv ROS_LOCALHOST_ONLY
printenv ROS_AUTOMATIC_DISCOVERY_RANGE
printenv RMW_IMPLEMENTATION
ros2 doctor --report
```

현재 QoS와 통신별 적용값은 [dds_qos.md](../../dds_qos.md)를 참고한다.

## 4. Backend 최초 준비

저장소 루트에서 시작한다.

```bash
cd /path/to/ros2_dashboard/backend
source /opt/ros/jazzy/setup.bash
```

### Python 가상환경

`rclpy`는 일반 pip package가 아니라 ROS2 설치 환경에서 제공된다. 가상환경에서도
시스템 ROS2 Python package를 볼 수 있도록 `--system-site-packages`를 사용한다.

```bash
python3 -m venv --system-site-packages .venv
source .venv/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt
```

현재 `backend/requirements.txt`의 주요 dependency는 다음과 같다.

```text
fastapi
uvicorn[standard]
python-dotenv
PyYAML
```

### ROS dependency 확인

새 환경에서는 workspace source package의 ROS dependency를 확인한다.

```bash
rosdep install --from-paths src --ignore-src -r -y
```

업로드된 interface package가 별도 ROS package를 참조한다면 해당 dependency도 새 환경에
설치돼 있어야 한다.

### 최초 build

```bash
colcon build --symlink-install
source install/setup.bash
```

build 대상에는 다음 package가 포함될 수 있다.

```text
ros2_dashboard_backend
ros2_dashboard_interfaces
uploaded_interfaces
uploaded_interface_packages 아래 등록 package
```

build 확인:

```bash
ros2 pkg prefix ros2_dashboard_backend
ros2 pkg prefix ros2_dashboard_interfaces
```

## 5. Backend 설정 파일

기본 설정 위치:

```text
backend/config/monitor.yaml
backend/config/interface_registry.yaml
backend/config/interface_packages.yaml
backend/config/interface_apply_status.yaml
backend/config/interface_apply_last.log
backend/config/user_preferences.yaml
```

역할:

| 파일 | 역할 |
|---|---|
| `monitor.yaml` | Graph polling, stale/Hz, include/exclude, 자동 감시 정책 |
| `interface_registry.yaml` | 수동 등록·정의·단일 업로드 interface 목록 |
| `interface_packages.yaml` | 업로드된 ROS interface package 목록 |
| `interface_apply_status.yaml` | 마지막 build/apply/import 상태 |
| `interface_apply_last.log` | 마지막 Interface Apply build 로그 |
| `user_preferences.yaml` | Topic·Service·Action·Node 사용자 별표 목록 |

`user_preferences.yaml`은 `monitor.yaml`과 별개다. 사용자가 지정한 주요 항목을 다음 구조로
저장하며 Backend 재시작 후에도 유지한다.

```yaml
priority:
  topics: []
  services: []
  actions: []
  nodes: []
```

Interface Lab 실행 History와 Alert History는 DB에 저장하지 않고 Backend 메모리에만
보관한다. Backend 프로세스를 종료하면 초기화된다.

## 6. 선택적 Backend `.env`

저장소에는 Backend `.env`가 필수로 포함되지 않는다. 설정이 필요하면 다음 위치를 사용한다.

```text
backend/.env
```

지원 환경변수:

```dotenv
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
MONITOR_CONFIG_PATH=config/monitor.yaml
INTERFACE_REGISTRY_PATH=config/interface_registry.yaml
INTERFACE_PACKAGES_REGISTRY_PATH=config/interface_packages.yaml
INTERFACE_PACKAGE_NAME=uploaded_interfaces
INTERFACE_PACKAGE_PATH=src/uploaded_interfaces
INTERFACE_UPLOADED_PACKAGES_PATH=src/uploaded_interface_packages
INTERFACE_APPLY_STATUS_PATH=config/interface_apply_status.yaml
INTERFACE_APPLY_LOG_PATH=config/interface_apply_last.log
```

상대경로는 Backend workspace를 기준으로 해석된다. 별도 경로가 필요하지 않으면 기본값을
그대로 사용하는 편이 안전하다.

Backend 코드는 `API_HOST`, `API_PORT`를 읽지 않는다. 주소와 포트는 Uvicorn 실행 인자로
지정한다.

## 7. Backend 실행

새 Backend 터미널에서 다음 순서로 실행한다.

```bash
cd /path/to/ros2_dashboard/backend
source /opt/ros/jazzy/setup.bash
source .venv/bin/activate
source install/setup.bash

export ROS_DOMAIN_ID=99
export ROS_LOCALHOST_ONLY=0
export ROS_AUTOMATIC_DISCOVERY_RANGE=SUBNET

python3 -m uvicorn \
  ros2_dashboard_backend.main:app \
  --host 127.0.0.1 \
  --port 8000
```

`ROS_DOMAIN_ID`는 실제 기기 값으로 변경한다.

### 다른 PC의 브라우저에서 접속할 경우

Backend를 외부 인터페이스에 열어야 한다.

```bash
python3 -m uvicorn \
  ros2_dashboard_backend.main:app \
  --host 0.0.0.0 \
  --port 8000
```

이 경우 `CORS_ORIGINS`에 실제 Frontend 주소를 추가하고 Frontend의
`VITE_API_BASE_URL`에는 Backend PC의 실제 IP를 사용한다.

### 개발용 reload

```bash
python3 -m uvicorn \
  ros2_dashboard_backend.main:app \
  --host 127.0.0.1 \
  --port 8000 \
  --reload
```

`--reload`가 발생하면 FastAPI만 다시 읽는 것이 아니라 다음 항목도 함께 재생성된다.

```text
rclpy context
/ros2_dashboard_topic_monitor Node
spin thread
Topic Subscription
Service Client
Action Client
Interface Lab 메모리 History
Alert 메모리 상태
```

연결 안정성이나 간헐적 연결 끊김을 조사할 때는 우선 `--reload` 없이 실행한다.

## 8. Backend 기본 확인

다른 터미널에서 실행한다.

```bash
curl http://127.0.0.1:8000/health
curl http://127.0.0.1:8000/ros/topics
curl http://127.0.0.1:8000/ros/services
curl http://127.0.0.1:8000/ros/actions
curl http://127.0.0.1:8000/ros/nodes
curl http://127.0.0.1:8000/ros/alerts
curl http://127.0.0.1:8000/ros/preferences/priority
```

정상 health 예시:

```json
{
  "success": true,
  "data": {
    "status": "running"
  },
  "message": "Backend is running"
}
```

ROS2 Graph도 같은 환경에서 확인한다.

```bash
cd /path/to/ros2_dashboard/backend
source /opt/ros/jazzy/setup.bash
source install/setup.bash
export ROS_DOMAIN_ID=99

ros2 node list
ros2 topic list -t
ros2 service list -t
ros2 action list -t
```

Dashboard 내부 Node 이름은 다음과 같다.

```text
/ros2_dashboard_topic_monitor
```

이 Node가 만드는 통신은 외부 Publisher·Subscriber·Client Node 수와 상태 판정에서는
제외된다. Interface Lab에서 실제 Publish, Service Call, Action Goal을 실행하면 상세
실행 주체에는 `/ros2_dashboard_topic_monitor`가 표시된다.

## 9. Frontend 최초 준비와 실행

새 Frontend 터미널에서 실행한다.

환경변수 예제 파일은 `frontend/.env.example`에 있다.

```bash
cd /path/to/ros2_dashboard/frontend
npm install
cp .env.example .env
npm run dev
```

기본 접속 주소:

```text
http://127.0.0.1:5173
```

`frontend/.env` 지원값:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_TOPIC_POLL_INTERVAL_MS=1000
VITE_DASHBOARD_POLL_INTERVAL_MS=3000
VITE_VISUALIZATION_POLL_INTERVAL_MS=5000
```

Frontend와 Backend가 다른 PC에 있다면 다음처럼 Backend의 실제 IP를 지정한다.

```dotenv
VITE_API_BASE_URL=http://192.168.0.10:8000
```

환경변수를 변경하면 Vite 개발 서버를 다시 시작한다.

Frontend 검증:

```bash
npm run lint
npm run build
```

## 10. Interface 등록과 새 환경 반영

Interface Lab은 다음 등록 방식을 지원한다.

| 방식 | 저장 위치 | build 필요 |
|---|---|---|
| 설치된 타입 직접 등록 | Registry만 갱신 | 아니오 |
| `.msg/.srv/.action` 직접 작성 | `ros2_ws/src/uploaded_interfaces/generated_interfaces/` | 예 |
| 단일 interface 파일 업로드 | `ros2_ws/src/uploaded_interfaces/generated_interfaces/` | 예 |
| ROS interface package 업로드 | `ros2_ws/src/uploaded_interfaces/packages/` | 예 |

새 환경으로 저장소를 복사했다면 registry YAML만 확인하지 말고 실제 source interface 파일과
package도 함께 존재하는지 확인한다.

```bash
find ros2_ws/src/uploaded_interfaces/generated_interfaces -type f
find ros2_ws/src/uploaded_interfaces/packages -type f
```

Interface Lab에서 `적용`을 실행하면 Backend workspace에서 다음 build를 수행한다.

```bash
colcon build --symlink-install
```

수동으로 build했다면 Backend 실행 터미널을 다시 열거나 overlay를 다시 source한다.

```bash
cd backend
source /opt/ros/jazzy/setup.bash
source .venv/bin/activate
colcon build --symlink-install
source install/setup.bash
```

생성된 Python interface import 확인 예시:

```bash
python3 -c "from rths_interfaces.action import CanControl; print(CanControl)"
python3 -c "from rths_interfaces.srv import RobotControl; print(RobotControl)"
```

Interface Lab 실행 조건:

```text
등록 타입이 import_available=true
현재 ROS2 Graph의 실제 full_type과 exact match
Service/Action Server가 현재 Graph에 존재
사용자가 Publish/Call/Goal 실행을 명시적으로 요청
```

Interface Lab의 Publish, Service Call, Action Goal은 테스트용 가짜 호출이 아니라
실제 ROS2 기기로 전송된다. 장비 동작을 일으킬 수 있으므로 payload와 대상 이름을 확인한다.

## 11. 현재 주요 항목과 사용자 별표

Topic, Service, Action, Node의 최종 주요 여부는 Backend에서 계산한다.

```text
is_primary = system_primary OR user_primary
```

- `system_primary`: 등록 interface 타입, `monitor.yaml` 우선 이름 등 자동 정책
- `user_primary`: 사용자가 각 행의 별표로 지정한 이름
- `is_primary`: Frontend 주요 항목 필터의 최종 기준

사용자 별표는 다음 파일에 영구 저장된다.

```text
backend/config/user_preferences.yaml
```

별표 해제는 사용자 지정만 제거한다. 자동 주요 조건을 만족하면 주요 항목에 계속 남는다.

## 12. Alert 현재 항목과 이력

Alert API:

```text
GET  /ros/alerts
POST /ros/alerts/current/reset
POST /ros/alerts/history/reset
```

- 현재 Alert 삭제는 같은 장애 발생 건을 확인 처리하고 원인이 유지되는 동안 숨긴다.
- 원인이 해소된 후 다시 발생하면 새 Alert로 표시한다.
- 이전 Alert 이력 삭제는 해결된 메모리 이력만 지운다.
- Alert 상태와 이력은 Backend 메모리 기반이므로 Backend 재시작 시 초기화된다.

Frontend에서는 현재 Alert와 이전 Alert 탭에서 삭제 버튼을 누르면 경고와 `확인/취소`가
표시된다.

## 13. 일반 데모 통신 실행

정상 Topic 1개, Service 2개, Action 1개를 한 번에 실행하는 launch 파일:

```text
backend/demo_nodes/demo_communication.launch.py
```

실행 대상:

```text
Topic: /demo_cleaning_schedule
Service: /RobotControl
Service: /ScheduleCrud
Action: /CanControl
```

실행:

```bash
cd /path/to/ros2_dashboard
source /opt/ros/jazzy/setup.bash
source ros2_ws/install/setup.bash
export ROS_DOMAIN_ID=99
ros2 launch backend/demo_nodes/demo_communication.launch.py
```

이 launch에는 outcome, failure, cancel, timeout 데모가 포함되지 않는다.

### 실패·취소·Timeout 개별 데모

이 데모는 정상 통신 launch와 분리돼 있으며 명령 뒤에 mode 옵션을 붙이지 않는다.

Action 실패·취소 서버:

```bash
python3 backend/demo_nodes/demo_can_control_outcome_server.py
```

다른 터미널에서 실패 또는 취소 Client 중 하나를 실행한다.

```bash
# 실패 Goal
python3 backend/demo_nodes/demo_can_control_outcome_client.py

# 취소 Goal
python3 backend/demo_nodes/demo_can_control_cancel_client.py
```

Service 응답 실패·Timeout 서버:

```bash
python3 backend/demo_nodes/demo_robot_control_outcome_server.py
```

Service Client는 Dashboard Backend API를 사용하므로 Backend가 먼저 실행 중이어야 한다.

```bash
# success=false 응답
python3 backend/demo_nodes/demo_robot_control_outcome_client.py

# Timeout
python3 backend/demo_nodes/demo_robot_control_timeout_client.py
```

## 14. 테스트 명령

### Backend 전체 테스트

설치된 이전 package가 아니라 현재 source를 정확히 테스트하려면 Backend Python package
디렉터리에서 실행한다.

```bash
cd /path/to/ros2_dashboard/ros2_ws/src/ros2_dashboard_monitor
source /opt/ros/jazzy/setup.bash
source ../../install/setup.bash
python3 -m pytest test
```

### Frontend 검사

```bash
cd /path/to/ros2_dashboard/frontend
npm run lint
npm run build
```

### Python demo 문법 검사

```bash
cd /path/to/ros2_dashboard
python3 -m py_compile backend/demo_nodes/*.py
```

## 15. 변경 종류별 반영 방법

| 변경 | 필요한 반영 |
|---|---|
| Backend Python 소스 | Backend 재시작, 개발 중이면 reload |
| Frontend JSX/CSS | Vite HMR 또는 dev server 재시작 |
| `frontend/.env` | Vite dev server 재시작 |
| `monitor.yaml` | Backend 재시작 |
| Backend `.env` | Backend 재시작 |
| `.msg/.srv/.action` | `colcon build --symlink-install`, overlay 재-source, Backend 재시작 |
| 업로드 interface package | Interface Apply 또는 수동 build/import 확인 |
| `user_preferences.yaml` | 일반적으로 API/별표를 통해 변경, 외부 수정 시 Backend 재시작 권장 |

## 16. 새 환경에서 자주 발생하는 문제

### `/health`는 성공하지만 ROS2 목록이 비어 있음

확인 순서:

1. Backend 터미널에서 `/opt/ros/jazzy/setup.bash`를 source했는가
2. `ros2_ws/install/setup.bash`를 source했는가
3. 기기와 `ROS_DOMAIN_ID`가 같은가
4. `ROS_LOCALHOST_ONLY=0`인가
5. discovery 범위가 `SUBNET` 또는 기기 환경과 호환되는가
6. 방화벽이 DDS UDP 통신을 차단하지 않는가
7. Dashboard와 기기가 호환 가능한 RMW를 사용하는가

### Topic은 보이지만 메시지를 받지 못함

```bash
ros2 topic info /topic_name --verbose
```

Interface Lab Receive는 현재 `RELIABLE + VOLATILE + depth 10`이다. 기기 Publisher가
`BEST_EFFORT`이면 QoS 비호환으로 수신하지 못할 수 있다.

### Service 또는 Action이 Timeout

Dashboard와 같은 환경에서 CLI로 직접 호출해 범위를 나눈다.

```bash
ros2 service call /service_name package_name/srv/TypeName "{field: value}"
ros2 action send_goal /action_name package_name/action/TypeName "{field: value}" --feedback
```

```text
CLI도 실패
→ DDS/RMW, 네트워크 locator, 방화벽 또는 기기 callback 문제

CLI는 성공하고 Dashboard만 실패
→ Dashboard payload, timeout 또는 Runtime 경로 문제
```

### Backend 연결 끊김이 반복됨

- `--reload` 없이 실행해 비교한다.
- `/health`를 연속 호출한다.
- Backend PID가 재시작되는지 확인한다.
- 브라우저 Network에서 REST와 `/ws/monitor`을 구분한다.
- Frontend `VITE_API_BASE_URL`이 실제 Backend 주소인지 확인한다.

### 등록 Interface가 호출 후보에 나오지 않음

확인 순서:

1. Registry의 `import_available=true`
2. build 성공 여부와 `interface_apply_last.log`
3. 현재 터미널의 overlay source 여부
4. Graph full type exact match
5. Service/Action Server 존재 여부

## 17. 최종 실행 체크리스트

새 환경에서 아래 순서대로 확인한다.

- [ ] Ubuntu 24.04와 ROS2 Jazzy 설치
- [ ] Node.js `^20.19.0 || >=22.12.0` 확인
- [ ] `backend/.venv`를 `--system-site-packages`로 생성
- [ ] Backend Python requirements 설치
- [ ] `rosdep install --from-paths src --ignore-src -r -y`
- [ ] `backend/`에서 `colcon build --symlink-install`
- [ ] ROS2 base와 Backend overlay source
- [ ] 기기와 `ROS_DOMAIN_ID`, RMW, discovery 범위 일치
- [ ] Backend Uvicorn 실행
- [ ] `/health`와 ROS2 리소스 API 확인
- [ ] Frontend `npm install` 및 `.env` 생성
- [ ] Frontend Vite 실행
- [ ] 등록 interface import와 Graph full type 확인
- [ ] Topic Publish, Service Call, Action Goal 실제 기기 통신 확인
- [ ] Frontend lint/build와 Backend test 실행

## 18. 핵심 요약

1. `backend/`에서 build하고 ROS2 환경과 `install/setup.bash`를 source한 뒤 Backend를 실행한다.
2. DDS 구현은 프로젝트가 고정하지 않으므로 기기와 Domain ID, RMW, discovery 범위를 실행 환경에서 맞춘다.
3. Interface Lab 통신은 실제 기기로 전달되며, 등록·import·Graph type exact match와 QoS 호환이 필요하다.
4. Frontend는 `frontend/`에서 Node.js 요구 버전을 확인하고 `.env`의 Backend 주소를 설정한 뒤 실행한다.
5. Interface/Alert 실행 History는 메모리 기반이고 사용자 주요 별표만 YAML에 영구 저장된다.
