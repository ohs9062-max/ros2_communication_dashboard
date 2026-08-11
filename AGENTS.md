# AGENTS Codex Lite

이 파일은 Codex가 `ros2_dashboard`에서 작업할 때 따라야 하는 현재 기준 문서다.
구현 정책이 바뀌거나 주요 기능이 추가되면 사용자 요청에 따라 이 문서를 최신 상태로 갱신한다.

## 0. 2026-08-06 구조 분리 이후 우선 적용 기준

이 절은 기존 정책을 삭제하지 않고, 대규모 구조 분리 이후 달라진 경로와 실행 경계를
추가한 최신 기준이다. 아래 기존 절과 경로·프로세스 책임이 충돌하면 이 절을 우선한다.
기존의 API 호환, ROS2 Graph API, 자동 감시와 사용자 명시 실행 분리, Alert, QoS,
Interface Lab 안전 정책은 계속 유효하다.

### 0.0 AI 작업 인수인계 기록

모든 AI 작업자는 작업을 시작할 때 기본 인수인계 자료로 다음 두 파일만 먼저 확인한다.

```text
.codex/CURRENT_STATUS.md
.codex/WORK_LOG.md
```

`.codex/archive/`의 과거 WORK_LOG는 현재 작업의 배경, 과거 판단 근거, 이전 검증값이 실제로 필요할 때만
검색하거나 해당 범위를 읽는다. 일반 작업 시작 시 archive 전체를 미리 읽지 않는다.

모든 작업이 끝나면 크기와 관계없이 별도 사용자 요청이 없어도 `.codex/WORK_LOG.md`에 날짜와 함께
작업 기록을 누적한다. 작업 결과로 프로젝트의 구현 상태, 구조, 정책, 검증 상태 또는 다음 작업 지점이
바뀌었으면 `.codex/CURRENT_STATUS.md`도 함께 갱신한다. CURRENT_STATUS에는 현재 상태, 핵심 구조,
최근 완료 작업, 현재 문제/제한, 다음 우선 작업만 유지하고 과거 작업의 상세 이력을 누적하지 않는다.

WORK_LOG는 최근 작업 약 20~30개를 빠르게 읽을 수 있는 크기로 유지한다. 다시 30개를 크게 넘거나
읽기 어려울 정도로 길어지면 가장 최근 20~30개만 남기고 오래된 항목을 `.codex/archive/` 아래 날짜 또는
월 범위 파일로 이동한다. archive 이동 시 기존 기록의 본문, 의미, 완료/미완료 상태를 바꾸거나 삭제하지
않으며, 과거 기록은 필요할 때 `rg`로 검색한다.

작은 작업은 한두 줄로 짧게 기록할 수 있다. 큰 기능 구현, 리팩토링, 구조 변경, 정책 변경,
트러블슈팅은 반드시 다음 내용을 남긴다.

```text
무엇을 작업했는지
왜 그렇게 작업했는지
어떤 기준으로 판단했는지
주요 변경 내용
검증 결과
남은 문제
다음 AI가 알아야 할 내용
```

다음 AI가 추가 조사 없이 바로 이어서 작업할 수 있도록 현재 상태와 다음 작업 지점을 명확히
쓴다. 구현되지 않았거나 검증하지 않은 내용을 완료된 것처럼 기록하지 않는다. 코드와 문서가
다르면 실제 코드와 실행 결과를 기준으로 기록하고 문서 불일치를 별도로 표시한다. 기존 작업
트리가 dirty 상태라면 사용자 변경을 보존하고 staged/unstaged/untracked 상태도 필요한 범위에서
알린다. `git commit`과 `git push`는 별도 사용자 요청 없이 실행하지 않는다.

### 0.1 현재 최상위 구조

```text
ros2_dashboard/
├─ AGENTS.md
├─ README.md
├─ nextstep.md
├─ backend/
│  ├─ requirements.txt
│  ├─ .env.example
│  ├─ config/
│  │  └─ user_preferences.yaml
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ app_state.py
│  │  ├─ settings.py
│  │  ├─ websocket_manager.py
│  │  ├─ monitor_client/
│  │  ├─ routers/
│  │  ├─ alerts/
│  │  ├─ database/
│  │  └─ user_preferences/
│  └─ tests/
├─ ros2_ws/
│  └─ src/
│     ├─ ros2_dashboard_monitor/
│     │  ├─ config/
│     │  ├─ launch/
│     │  ├─ ros2_dashboard_monitor/
│     │  │  ├─ main.py
│     │  │  ├─ ros_monitor.py
│     │  │  ├─ config_loader.py
│     │  │  ├─ resource_state.py
│     │  │  ├─ topology.py
│     │  │  ├─ priority_state.py
│     │  │  ├─ transport/
│     │  │  ├─ ros2_topic/
│     │  │  ├─ ros2_service/
│     │  │  ├─ ros2_action/
│     │  │  ├─ ros2_node/
│     │  │  └─ interface_lab/
│     │  └─ test/
│     ├─ ros2_dashboard_dds_observer/
│     ├─ ros2_dashboard_interfaces/
│     ├─ ros2_dashboard_demo_nodes/
│     └─ uploaded_interfaces/
│        ├─ generated_interfaces/
│        └─ packages/
├─ frontend/
├─ docs/
└─ scripts/
```

생성물은 `ros2_ws/build/`, `ros2_ws/install/`, `ros2_ws/log/`,
`frontend/node_modules/`, `frontend/dist/`, `.runtime/`이다. 소스처럼 직접 수정하거나
Git에 포함하지 않는다. stale 생성물을 정리할 때도 정확한 package 범위만 제거한다.

### 0.2 프로세스와 책임 경계

```text
ROS2 Graph
→ ros2_dashboard_dds_observer (Fast DDS EDP, optional localhost helper)
→ ros2_dashboard_monitor (rclpy, ROS2 상태 계산, Interface Lab 실제 통신)
→ localhost HTTP transport : 127.0.0.1:8765
→ FastAPI Backend Runtime Cache : 127.0.0.1:8000
→ REST / Browser WebSocket
→ React Frontend
```

`ros2_dashboard_monitor` 책임:

```text
rclpy Node 생성과 spin
ROS2 Graph 조회와 자동 발견
Topic latest / Hz / age / stale / missing
Service / Action / Node 상태 계산
Topology와 ROS2 사실 기반 Alert 생성
QoS와 Publisher / Subscription / Client 실행
Interface 등록·package upload·build/import/apply
사용자 명시 Topic Publish/Receive, Service Call, Action Goal/Cancel
```

`ros2_dashboard_dds_observer` 책임:

```text
rmw_fastrtps_cpp 환경의 원격 rq/rr DataWriter·DataReader Discovery 관찰
Service와 Action Goal/Result/Cancel의 광고된 endpoint QoS를 127.0.0.1:8766 snapshot으로 제공
Service/Action Client나 사용자 데이터 endpoint 생성 금지
History/Depth처럼 Discovery에 없는 값을 default로 추정하지 않음
```

`backend` 책임:

```text
순수 FastAPI app
공개 REST API와 Browser WebSocket
Monitor snapshot polling과 Runtime Cache
Monitor 명령 proxy
사용자 별표 설정
Alert 현재/해결 이력
향후 DB, 인증, 사용자 정책
```

Backend는 `rclpy`를 import하거나 ROS2 Node를 만들지 않는다. Monitor와 Backend는 Python
singleton이나 같은 메모리 cache를 공유하지 않는다. Backend가 Monitor보다 먼저 시작해도
죽지 않아야 하며, 마지막 정상 snapshot을 유지하고 연결 상태를 별도로 표시한다.

Monitor 연결 또는 재연결 시 Backend의 `user_preferences.yaml`을
`PUT /transport/priority`로 다시 동기화한다. 첫 동기화가 실패하면 snapshot polling에서
성공할 때까지 재시도한다.

### 0.3 내부 통신 정책

현재 내부 통신은 localhost HTTP를 사용한다. MariaDB를 실시간 Monitor 전달 수단으로
사용하지 않는다.

```text
Monitor → Backend
= `/transport/snapshot` polling 결과

Backend → Monitor
= 기존 `/ros/...` 요청을 localhost transport로 전달
```

공개 API 경로와 응답 key는 기존 호환을 유지한다. Backend의 async proxy에서 동기
네트워크 I/O를 직접 실행하지 않는다. `httpx.AsyncClient`처럼 event loop를 차단하지 않는
경로를 사용한다. Monitor의 Service Call과 Action Goal/Cancel처럼 기다릴 수 있는 실행도
Monitor API event loop를 막지 않게 worker에서 수행한다.

Browser WebSocket은 Backend `/ws/monitor`만 사용한다. Frontend가 Monitor 8765 포트나
ROS2에 직접 연결하지 않는다. WSS는 배포 proxy/TLS 정책으로 지원하며 개발 safe default는
현재 origin과 환경 설정을 따른다.

### 0.4 현재 경로 이름과 구 경로 대응

이 문서 아래쪽의 구 경로 표현은 다음 최신 경로로 해석한다.

```text
backend/src/ros2_dashboard_backend/...  → backend/app/... 또는 ros2_dashboard_monitor/...
backend/config/monitor.yaml             → ros2_ws/src/ros2_dashboard_monitor/config/monitor.yaml
backend/config/interface_registry.yaml  → ros2_ws/src/ros2_dashboard_monitor/config/interface_registry.yaml
backend/config/interface_packages.yaml  → ros2_ws/src/ros2_dashboard_monitor/config/interface_packages.yaml
backend/config/interface_apply_status.yaml
                                        → ros2_ws/src/ros2_dashboard_monitor/config/interface_apply_status.yaml
backend/src/uploaded_interfaces         → ros2_ws/src/uploaded_interfaces/generated_interfaces
backend/src/uploaded_interface_packages → ros2_ws/src/uploaded_interfaces/packages
backend/src/ros2_dashboard_interfaces   → ros2_ws/src/ros2_dashboard_interfaces
topic/                                  → ros2_topic/
service/                                → ros2_service/
action/                                 → ros2_action/
node/                                   → ros2_node/
```

구 `topic`, `service`, `action`, `node`, `backend/src/ros2_dashboard_backend`,
`backend/src/uploaded_interfaces`, `backend/src/uploaded_interface_packages`를 새 구현 위치로
다시 만들거나 호환 복사본으로 남기지 않는다.

### 0.5 설정과 하드코딩 정책

변경 가능한 배포값과 운영 정책은 `.env` 또는 YAML에서 읽고, 파일이나 key가 없으면 중앙
Settings/Config Loader의 검증된 safe default를 사용한다. 기능 코드가 `os.getenv()`나 YAML을
각자 읽지 않는다.

```text
backend/.env
= MONITOR_BASE_URL, MONITOR_TIMEOUT_SEC, MONITOR_POLL_INTERVAL_SEC,
  CORS_ORIGINS, USER_PREFERENCES_PATH

Monitor process environment
= ROS2_MONITOR_HOST, ROS2_MONITOR_PORT, ROS2_MONITOR_LOG_LEVEL,
  ROS2_DASHBOARD_WS_ROOT, ROS2_DASHBOARD_MONITOR_CONFIG_DIR,
  MONITOR_CONFIG_PATH, INTERFACE_*_PATH

monitor.yaml
= ROS2 발견·필터·상태·QoS와 Fast DDS observer 관련 운영 정책

backend/config/user_preferences.yaml
= 사용자 별표
```

설정으로 이동할 대상:

```text
base URL과 port
timeout, polling/reconnect 주기
history/retention 제한
include/exclude와 stale/Hz 기준
배포별 CORS, DB 연결, 사용자 정책
```

코드에 유지할 불변값:

```text
기존 API path와 JSON response key
ROS2 표준 status code와 full_type 문법
event type, enum, 자료형
허용 HTTP method
interface 문법과 보안 검증의 절대 상한
package.xml/CMake/ROS protocol 규칙
```

기본값은 필요하지만 여러 기능 파일에 복제하지 않는다. Backend는 `settings.py`, Monitor는
`config_loader.py`와 Interface Lab path helper, Frontend는 중앙 config/API client만 기본값을
소유한다. Frontend는 YAML을 직접 읽지 않는다.

### 0.6 설정과 사용자 데이터 저장 위치

Monitor package share의 설치 YAML은 읽기 기본값이다. 변경 가능한 Registry와 Apply 상태를
`install/share` 복사본에 저장하지 않는다. 일반 `colcon build`가 install을 덮어써도 사용자
데이터가 유실되지 않도록 기본 영속 위치는 source workspace다.

```text
ros2_ws/src/ros2_dashboard_monitor/config/monitor.yaml
ros2_ws/src/ros2_dashboard_monitor/config/interface_registry.yaml
ros2_ws/src/ros2_dashboard_monitor/config/interface_packages.yaml
ros2_ws/src/ros2_dashboard_monitor/config/interface_apply_status.yaml
ros2_ws/src/ros2_dashboard_monitor/config/interface_apply_last.log
backend/config/user_preferences.yaml
```

Monitor config 폴더에 `user_preferences.yaml`을 다시 만들지 않는다. Backend config 폴더에
Interface Apply log나 ROS2 Monitor YAML을 다시 만들지 않는다.

Interface Apply가 build와 import 확인에 성공하면 응답 전송 후 Monitor 프로세스를 동일 PID로
재실행한다. 삭제된 `reload_trigger.py`와 Backend uvicorn reload에 다시 의존하지 않는다.
Backend와 Frontend는 유지되고 Backend polling이 Monitor에 자동 재연결한다.

### 0.7 업로드 Interface 정책

```text
ros2_ws/src/uploaded_interfaces/generated_interfaces/
= manual definition과 단일 .msg/.srv/.action을 모은 실제 ROS package

ros2_ws/src/uploaded_interfaces/packages/<package_name>/
= 사용자가 업로드한 완성 ROS interface package
```

`uploaded_interfaces/` 상위 폴더 자체를 ROS package로 취급하지 않는다. 각 실제 package만
`package.xml`을 가지며 `colcon list`에서 독립 package로 보여야 한다. Registry, package name,
원본 interface와 적용 상태를 삭제하거나 빈 파일로 덮어쓰지 않는다.

### 0.8 실행과 검수 기준

```bash
cd ros2_ws
source /opt/ros/jazzy/setup.bash
colcon build --symlink-install
source install/setup.bash
ros2 run ros2_dashboard_monitor monitor

cd backend
source .venv/bin/activate
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000

cd frontend
npm run dev
```

각 새 터미널은 ROS2 base와 `ros2_ws/install/setup.bash`를 다시 source한다. launch 파일은
어느 위치에서든 package 방식으로 실행한다.

```bash
ros2 launch ros2_dashboard_monitor dashboard_monitor.launch.py
ros2 launch ros2_dashboard_demo_nodes demo_communication.launch.py
```

`run_dashboard_stack.sh`는 Backend `.venv`와 필수 dependency를 확인하고 Monitor → Backend →
Frontend 순서로 시작한다. Vite는 5173 strict port를 사용한다. 세 프로세스 중 하나라도
예상하지 않게 끝나면 해당 로그 경로를 출력하고 생성한 stack 프로세스를 종료한다.

최소 검수:

```bash
python3 -m compileall backend/app
python3 -m compileall ros2_ws/src/ros2_dashboard_monitor
cd ros2_ws && colcon list
colcon build --symlink-install
colcon test
colcon test-result --verbose
cd backend && .venv/bin/python -m pytest -q tests
cd frontend && npm run lint && npm run build
```

2026-08-07 마지막 전체 검수 기준 ROS2 test 결과는 119 tests, 0 failures다. 사용자 업로드 package가 없어도
Monitor 자체 test가 특정 업로드 package에 직접 의존하지 않게 유지한다.

### 0.9 다음 Frontend/Backend 기능 리팩토링 기준

대형 파일을 기능 단위로 분리하되 줄 수만 보고 의미 있는 짧은 파일을 합치지 않는다.

```text
항상 함께 변경되는 작은 wrapper/re-export
→ 통합 검토

독립적으로 변경되는 router/schema/hook/adapter
→ 20~30줄이어도 분리 유지 가능

React page/component 300줄 이상
Python service/runtime 500줄 이상
800줄 이상 파일
→ 복수 책임 조사와 feature 분리 우선 대상
```

`App.jsx`는 Provider, route, layout 조립만 남기는 방향으로 분리한다. Frontend는 장기적으로
`features/<overview|topics|services|actions|nodes|alerts|topology|preferences|interface-lab>`와
`shared/` 구조를 사용한다. Interface Lab은 registry, package upload, apply, Topic execution,
Service execution, Action execution, history를 독립 feature로 분리한다.

Backend는 Router → Service → Repository 또는 MonitorClient 의존 방향을 지킨다. Router에
YAML 읽기, DB 쿼리, ROS2 실행, 긴 정책 계산을 넣지 않는다. 구조 이동과 동작 변경을 한 번에
섞지 말고, feature 하나를 이동할 때마다 기존 API와 Frontend 동작을 검증한다.

### 0.10 `nextstep.md` 확정 개선 정책

이 절은 `nextstep.md`의 HTML 주석을 제외하고, 문서 하단의 사용자 확정 답변을 우선해
정리한 향후 기능 기준이다. 아직 구현되지 않은 항목을 현재 기능인 것처럼 보고하지 않는다.

#### WSS와 외부 접속 보안

WSS 적용은 확정 요구사항이다.

```text
개발 환경
→ ws:// 허용

HTTPS 운영·외부 접속 환경
→ wss:// 필수
→ Nginx 또는 HTTPS reverse proxy에서 TLS 종료 가능
```

Frontend는 현재 page protocol과 중앙 runtime/environment config로 WebSocket scheme과
주소를 결정한다. WebSocket URL을 component나 hook에 직접 하드코딩하지 않는다. HTTPS
페이지에서 `ws://`를 사용해 mixed-content 오류를 만들지 않는다. 완료 검증에는 WSS 연결,
기존 실시간 snapshot, 연결 해제 후 자동 재연결, 인증서 오류 여부가 포함된다.

WSS는 Browser ↔ Backend 구간의 보안 정책이다. localhost Monitor transport를 외부에
노출하거나 Frontend가 Monitor에 직접 연결하는 근거로 사용하지 않는다.

#### 범용 구조

현재 `ros2_ws` / `backend` / `frontend` 분리 구조를 범용화의 기준으로 유지한다. 모든 ROS2
프로젝트에 특정 로봇 package나 Topic 이름을 강요하지 않는다. ROS2 package는
`ros2_ws/src`, 웹 Backend와 Frontend는 workspace 밖에 둔다. 이 구조를 다시
`backend/src` 단일 workspace로 합치지 않는다.

#### 경고 정책 문서화

Topic, Service, Action, Node의 모든 Alert code는 `docs/alert_policy/`에 다음 정보를
문서화하고 실제 메시지·해제 동작과 일치시킨다.

```text
경고 code와 대상 kind/name
발생 조건
정상으로 보는 예외
INFO / WARNING / ERROR level
사용자 메시지
해제 조건
first_detected_at / last_detected_at
설정 가능 여부와 관련 YAML key
```

정상 대기 상태를 기본 장애로 만들지 않는다.

```text
Service server만 있고 client 없음
→ 요청 대기형 Service의 정상 상태, 기본 Alert 제외

Action server만 있고 goal client 없음
→ Goal 대기 상태, 기본 Alert 제외

일반 Topic subscriber 없음
→ 기본 Alert 제외

필수 stream/command 정책에 명시된 대상
→ YAML 정책과 실제 Graph 사실을 함께 사용해 판정
```

`missing`은 감시 subscription이 생성됐지만 제한 시간 동안 한 번도 수신하지 못한 상태,
`stale`은 이전 수신 후 기준 시간을 초과한 상태로 구분한다. Graph에 보인다는 사실만으로
메시지 수신 정상이나 QoS 호환을 단정하지 않는다.

#### MariaDB Alert 이력

MariaDB는 제안 사항이 아니라 필수 영속 저장소다. ROS2 실시간 Monitor transport로는
사용하지 않고 Backend의 Alert 과거 이력 영속 저장과 조회에만 사용한다. 단일 `alert` 테이블의
확정 스키마와 전체 정책은 `docs/alert_policy/05_alert_lifecycle.md`를 따른다.

```text
동일 active Alert
→ 같은 alert_key이며 resolved_at IS NULL인 행이 있으면 중복 INSERT 금지

정상 복귀
→ 기존 active 행의 resolved_at에 해결 시각 기록

해결 후 동일 Alert 재발
→ 새 발생 건으로 새 row INSERT

현재 Alert / 이전 Alert
→ resolved_at IS NULL / resolved_at IS NOT NULL 기준으로 구분
```

DB에는 50건 제한 없이 전체 Alert 이력을 보존한다. UI의 이전 Alert만 `resolved_at` 최신순으로
한 페이지당 50개씩 조회하며, 검색은 Topic·Service·Action·Node를 모두 포함하는 `name` 기준이다.
Alert의 lifecycle 상태(`발생 중`/`해결됨`)와 level(`warning`/`error`/`critical`)은 별도 개념이며
서로 덮어쓰지 않는다.

DB 연결 문자열과 credential은 `.env`로 관리하고 실제 값을 Git에 넣지 않는다. schema,
migration, repository를 사용하며 Router에서 직접 SQL을 실행하지 않는다. DB 장애가 ROS2
Monitor 수집을 중단시키면 안 되고, 저장 실패 원인을 Backend 로그에서 확인할 수 있어야 한다.
현재 구현은 `backend/app/alerts/service.py` 한 곳에서 Monitor Alert snapshot을 받아
`backend/app/database/alert_repository.py`로 동기화한다. Monitor는 DB에 직접 INSERT하지 않는다.
Alert의 `detected_at`과 `resolved_at`은 MariaDB `DATETIME(6)`에 KST(`UTC+09:00`) 값으로 저장하며,
API에서는 기존과 같이 epoch timestamp를 사용한다.

#### 실제 기기 QoS 검증

실제 장비의 QoS와 Dashboard subscription QoS가 다를 수 있음을 항상 고려한다. 개발자가
수동 검증할 때는 다음 명령을 사용할 수 있다.

```bash
ros2 topic info /topic_name --verbose
```

이는 수동 진단 명령이며 Monitor 구현에서 ROS2 CLI 출력을 subprocess로 파싱해 데이터
원천으로 사용하면 안 된다. 코드에서는 rclpy Graph endpoint/QoS 정보로 Reliability,
Durability, History, Depth, Deadline, Lifespan, Liveliness를 확인한다.

검증 순서:

```text
Graph와 Publisher 존재
→ 실제 발행 여부
→ Publisher QoS
→ Dashboard subscription QoS
→ 호환성 비교
→ latest / Hz / missing / stale 재확인
```

알려진 sensor type은 Sensor Data QoS와 publisher endpoint QoS를 검토한다. QoS 불일치
가능성을 단순 미수신과 구분해 상세 화면에 실제 Publisher QoS와 감시 QoS를 표시하는 방향을
사용한다. 특정 실제 장비 QoS를 보편 기본값으로 하드코딩하지 않는다.

Interface Lab Auto QoS는 발견 가능한 정책보다 기본값을 우선하지 않는다. Topic과 Action Topic 채널은
Graph endpoint profile을 역할별로 비교한다. Service와 Action Goal/Result/Cancel은 Fast DDS의 원격 Request
Reader와 Response Writer를 Dashboard Client 관점에서 동시에 만족하는 Reliability, Durability, Deadline,
Liveliness, Lease Duration을 선택하고 관찰된 Response Writer Lifespan도 profile에 전달한다. 한 방향만
발견되어도 확인된 정책은 유지한다. Discovery에서 알 수 없는 History/Depth만 local Service 기본값을 사용하며,
endpoint 전체 미발견 또는 단일 Client profile로 호환 불가능할 때만 Service 기본 profile 전체 fallback과
그 사유를 표시한다. Remote QoS와 Dashboard 실행 QoS를 같은 값으로 합쳐 표시하지 않는다.

#### Camera Topic 이미지 시각화

첫 구현 대상은 사용자 확정에 따라 카메라 이미지다.

```text
sensor_msgs/msg/Image
sensor_msgs/msg/CompressedImage
```

LaserScan, OccupancyGrid, Path, Pose 시각화는 이번 확정 범위가 아니며 별도 요청 없이 함께
확장하지 않는다. 타입별 decoder/renderer를 분리하고 고주파 원본을 매 callback마다 Browser로
보내지 않는다. 최신 frame 기준 갱신 제한, 크기 제한, 축소/압축 정책을 설정에서 관리한다.

```text
ROS2 image Topic
→ Monitor type/QoS 확인과 최신 frame 수신
→ 안전한 변환·크기 제한
→ Backend 전달
→ Frontend image renderer
```

데이터 없음, 아직 미수신, stale, decode 실패를 구분한다. 큰 binary를 기존 경량 monitor
snapshot에 무조건 포함하지 않는다. 전체 JSON 직렬화나 base64 전송이 성능에 미치는 영향을
측정하고 별도 endpoint/stream 사용을 검토한다.

#### Interface Lab Gazebo TurtleBot 명령 제어

확정 범위는 Gazebo에서 TurtleBot을 명령으로 움직이는 기능이다. Nav2 Goal과 실제 로봇
제어까지 자동 확대하지 않는다. 기존 범용 Interface Lab의 명시적 Topic Publish 실행 경로를
재사용하며 `/cmd_vel`이나 특정 TurtleBot type을 Monitor 핵심 동작 조건으로 하드코딩하지 않는다.

사용자가 Graph/등록 interface에서 제어 Topic과 type을 명시적으로 선택한 뒤 실행한다.
직진·후진·좌회전·우회전·정지 preset을 제공하더라도 payload mapping과 제한값은 설정 계층에서
검증한다.

안전 기준:

```text
Simulation / 실제 장비 구분 표시
낮은 기본 속도와 설정 가능한 절대 상한
발행 주기 제한과 중복 continuous publish 방지
항상 보이는 즉시 정지
화면 이탈·연결 해제·Runtime cleanup 시 continuous command 종료
사용자 명시 실행 없이 이동 명령 전송 금지
실행 주체 Node와 history 기록
```

연결 해제 시 자동 정지 전송은 안전 효과와 예기치 않은 추가 명령 가능성을 함께 검토하고,
검증된 Simulation 정책 없이 임의 구현하지 않는다.

#### 향후 작업 우선순위

```text
1. 경고 정책 문서화, WebSocket/WSS 현황, 실제 QoS, 책임 경계 확인
2. 범용 설정, WSS 배포 구조, MariaDB schema/repository, QoS 표시 설계
3. Camera Topic 시각화, Gazebo TurtleBot 명령, Action feedback/result/cancel 강화
```

## 1. 목적

Codex는 이 프로젝트에서 아래 원칙을 우선한다.

```text
불필요한 구조 변경 방지
기존 API 경로와 응답 key 유지
ROS2 / FastAPI / React 역할 분리
ROS2 CLI subprocess 기반 모니터링 금지
ROS2 Graph API 기반 자동 발견
하드코딩된 로봇 Topic / Service / Action 이름 의존 금지
사용자 명시 실행과 자동 모니터링 경로 분리
생성물 폴더 직접 수정 금지
```

사용자용 긴 설명은 `docs/`와 각 package의 README에 둔다.
Codex 작업 제한, 금지사항, 설계 원칙은 이 파일 기준으로 판단한다.

## 2. 프로젝트 정의

`ros2_dashboard`는 ROS2에서 실행 중인 Node, Topic, Service, Action의 통신 상태를 수집하고,
FastAPI backend와 React web dashboard에서 확인하는 ROS2 Communication Monitor Dashboard다.

목표는 단순 목록 표시가 아니라 ROS2 시스템 디버깅, 운영 상태 확인, 등록된 interface 기반 테스트 실행이다.

## 3. 기술 스택

```text
OS: Ubuntu 24.04
ROS2: Jazzy
ROS2 수집: Python / rclpy
Backend API: FastAPI
Frontend UI: React
Dev server: Vite
테스트 환경: TurtleBot3 + Gazebo 또는 실제 ROS2 장비
```

Node.js는 설치된 Vite 8의 engine인 `^20.19.0 || >=22.12.0`을 따른다.

## 4. 프로젝트 구조 기준 (리팩토링 전 기록)

이 절의 기존 트리와 설명은 정책의 유래를 보존하기 위한 리팩토링 전 기록이다.
현재 경로와 프로세스 책임에는 `0.1`~`0.9`를 적용하고, 아래의 세부 기능 정책만 이어서 사용한다.

```text
ros2_dashboard/
├─ AGENTS.md
├─ docs/
├─ backend/
│  ├─ config/
│  │  ├─ monitor.yaml
│  │  ├─ interface_registry.yaml
│  │  ├─ interface_packages.yaml
│  │  ├─ interface_apply_status.yaml
│  │  └─ user_preferences.yaml
│  ├─ build/              # 생성물, 직접 수정 금지
│  ├─ install/            # 생성물, 직접 수정 금지
│  ├─ log/                # 생성물, 직접 수정 금지
│  └─ src/
│     ├─ ros2_dashboard_backend/
│     │  └─ ros2_dashboard_backend/
│     │     ├─ main.py
│     │     ├─ app_state.py
│     │     ├─ ros_monitor.py
│     │     ├─ resource_state.py
│     │     ├─ topology.py
│     │     ├─ user_preferences.py
│     │     ├─ websocket_manager.py
│     │     ├─ routers/
│     │     │  ├─ monitoring.py
│     │     │  ├─ interface_management.py
│     │     │  ├─ interface_apply.py
│     │     │  ├─ topic_execution.py
│     │     │  ├─ service_execution.py
│     │     │  ├─ action_execution.py
│     │     │  └─ user_preferences.py
│     │     ├─ interface_lab/
│     │     │  ├─ paths.py
│     │     │  ├─ management/
│     │     │  │  ├─ registry.py
│     │     │  │  ├─ manual_interfaces.py
│     │     │  │  └─ packages.py
│     │     │  ├─ apply/
│     │     │  │  └─ runtime.py
│     │     │  ├─ execution/
│     │     │  │  ├─ topic_runtime.py
│     │     │  │  ├─ service_call_runtime.py
│     │     │  │  └─ action_goal_runtime.py
│     │     │  └─ common/
│     │     │     └─ value_converter.py
│     │     ├─ topic/
│     │     ├─ service/
│     │     ├─ action/
│     │     └─ node/
│     ├─ ros2_dashboard_interfaces/
│     ├─ uploaded_interfaces/
│     └─ uploaded_interface_packages/
└─ frontend/
   ├─ package.json
   ├─ index.html
   └─ src/
      ├─ App.jsx
      ├─ api/rosApi.js
      ├─ hooks/
      │  ├─ usePolling.js
      │  ├─ useTopicDashboard.js
      │  ├─ useServiceDashboard.js
      │  ├─ useActionDashboard.js
      │  ├─ useNodeDashboard.js
      │  ├─ useMonitorWebSocket.js
      │  ├─ useVisualizationGraph.js
      │  └─ useUserPriority.js
      ├─ components/
      │  ├─ PriorityStarButton.jsx
      │  └─ visualization/
      ├─ utils/
      │  ├─ interfaceTopics.js
      │  ├─ nodeFilters.js
      │  └─ primaryFilters.js
      └─ pages/
         ├─ OverviewPage.jsx
         ├─ TopicsPage.jsx
         ├─ ServicesPage.jsx
         ├─ ActionsPage.jsx
         ├─ NodesPage.jsx
         ├─ AlertsPage.jsx
         ├─ VisualizationPage.jsx
         └─ InterfaceLabPage.jsx
```

역할 기준:

```text
backend/
= ROS2 workspace 역할. colcon build는 항상 여기서 실행한다.

backend/src/ros2_dashboard_backend/
= ROS2 ament_python backend 패키지

ros_monitor.py
= RosMonitor coordinator. rclpy Node 생성, spin thread, runtime 조립,
  Topology/주요 상태 조립, Alert 통합과 public API용 snapshot 제공. Interface Lab 실행 runtime도 생성하고
  public method 호환을 위해 위임하지만, registry/build/file 관리 세부 구현을 직접 하지 않는다.

app_state.py
= FastAPI router가 공유하는 backend_config / ros_monitor singleton 생성 위치

main.py
= FastAPI app 생성, lifespan, middleware, exception 처리, router 등록, health endpoint만 담당한다.

routers/
= FastAPI endpoint 계층. request/query/path/body 파싱, RosMonitor 또는 Interface Lab runtime 호출,
  HTTP response 반환만 담당한다. registry/build/rclpy 실행 로직을 router에 넣지 않는다.

topology.py
= Node snapshot의 역할·리소스 이름·full_type exact match를 인덱싱하고
  Topic / Service / Action별 외부 연결 Node 목록을 계산한다.

user_preferences.py, routers/user_preferences.py
= 사용자 별표 목록을 별도 YAML에 저장하는 thread-safe store와 조회·등록·해제 API다.

websocket_manager.py
= WebSocket 연결 집합과 JSON 전송 실패 정리만 담당한다. payload는 RosMonitor가 만든다.

topic/
= Topic discovery / filter / subscription / preview / hz / alert 로직

service/
= Service graph 조회 / filter / status / alert / allowlist active_check 로직
  명시적 Service Call 실행 runtime은 interface_lab/execution/service_call_runtime.py에 둔다.

action/
= Action graph 조회 / status-feedback topic 관찰 / result 관찰 / alert 로직
  명시적 Action Goal 실행 runtime은 interface_lab/execution/action_goal_runtime.py에 둔다.

node/
= Node graph 조회 / pub-sub-service-action 관계 조립 / Graph 연결 종료 감지 / alert 로직

interface_lab/management/registry.py
= single_upload 등록, registry snapshot, registry entry 삭제 보조

interface_lab/management/manual_interfaces.py
= manual_type, manual_definition, uploaded_interfaces 파일 삭제,
  CMakeLists.txt/package.xml 전체 재생성 함수 관리

interface_lab/management/packages.py
= package_upload zip/folder 저장, package registry, package 삭제 관리

interface_lab/apply/runtime.py
= build/apply/import 상태와 pending 상태 관리

interface_lab/execution/topic_runtime.py
= Interface Lab의 사용자 명시 Topic Receive start/stop/history 관리
  및 Topic Publish 실행 runtime

interface_lab/common/value_converter.py
= Interface Lab Topic Publish, Service Call, Action Goal에서 공유하는 schema 생성,
  payload validation, ROS generated object 생성, JSON-safe 변환 helper

frontend/
= Vite React web UI. Dashboard와 Interface Lab 화면을 제공한다.

frontend/src/utils/primaryFilters.js
= Topic / Service / Action의 Backend `is_primary` 최종 판정을 그대로 사용한다.

frontend/src/utils/nodeFilters.js
= Backend `is_primary`로 Node 주요 여부를 판정하고 dashboard/ros2cli 내부 Node를 식별한다.

frontend/src/hooks/useUserPriority.js, components/PriorityStarButton.jsx
= 네 목록의 낙관적 별표 변경, 요청 중 중복 방지, 실패 rollback·오류 표시를 공유한다.

frontend/src/utils/interfaceTopics.js
= Interface Lab Topic Publish Graph 후보의 exact Message type 일치와
  Action 내부 Topic 제외 조건을 관리한다.
```

`backend/build/`, `backend/install/`, `backend/log/`, `frontend/node_modules/`는 생성물이다.
직접 수정하지 않는다.

빌드는 항상 `backend/`에서 실행한다.
루트에 `build/`, `install/`, `log/`가 생기면 잘못된 위치에서 빌드한 것이다.

## 5. 시스템 흐름

```text
TurtleBot3 + Gazebo 또는 실제 ROS2 장비
        ↓
ROS2 Nodes / Topics / Services / Actions
        ↓
Python rclpy Monitor Node
        ↓
FastAPI Backend
        ↓
REST API + 경량 WebSocket
        ↓
React UI
```

React는 ROS2에 직접 접근하지 않는다.

```text
React → FastAPI → Python rclpy → ROS2
```

## 6. 현재 구현된 API

기존 API 경로와 JSON key를 제거하지 않는다.

```text
GET    /health
GET    /ros/topics
GET    /ros/topics/latest?name=...
GET    /ros/topics/hz?name=...
GET    /ros/services
GET    /ros/actions
GET    /ros/nodes
GET    /ros/alerts

GET    /ros/preferences/priority
PUT    /ros/preferences/priority/{kind}
DELETE /ros/preferences/priority/{kind}

POST   /ros/interfaces/upload
GET    /ros/interfaces/registry
DELETE /ros/interfaces/registry/{kind}/{file_name}
POST   /ros/interfaces/manual-type
POST   /ros/interfaces/manual-definition
POST   /ros/interfaces/manual-definition/validate
PUT    /ros/interfaces/manual-definition/{kind}/{type_name}
DELETE /ros/interfaces/manual-definition/{kind}/{type_name}
POST   /ros/interfaces/uploaded-interfaces/rebuild-cmake

POST   /ros/interfaces/packages/upload
POST   /ros/interfaces/packages/folder-upload
GET    /ros/interfaces/packages
DELETE /ros/interfaces/packages/{package_name}

POST   /ros/interfaces/apply
GET    /ros/interfaces/apply/status
POST   /ros/interfaces/import-check

GET    /ros/interfaces/callable-services
POST   /ros/interfaces/service-call
GET    /ros/interfaces/service-call/history

GET    /ros/interfaces/callable-actions
POST   /ros/interfaces/action-goal
GET    /ros/interfaces/action-goal/history

GET    /ros/interfaces/callable-messages
GET    /ros/interfaces/message-schema
POST   /ros/interfaces/topic-publish
POST   /ros/interfaces/topic-publish/continuous/start
POST   /ros/interfaces/topic-publish/continuous/stop
GET    /ros/interfaces/topic-publish/continuous
GET    /ros/interfaces/topic-publish/history
POST   /ros/interfaces/topic-publish/history/reset

POST   /ros/interfaces/receive/topics/start
POST   /ros/interfaces/receive/topics/stop
GET    /ros/interfaces/receive/topics
GET    /ros/interfaces/receive/topics/history
POST   /ros/interfaces/receive/topics/history/reset
GET    /ros/interfaces/receive/services/history
POST   /ros/interfaces/receive/services/history/reset
GET    /ros/interfaces/receive/actions/history
POST   /ros/interfaces/receive/actions/history/reset

WS     /ws/monitor
```

주요 endpoint는 `backend/src/ros2_dashboard_backend/ros2_dashboard_backend/routers/`에 기능별로 둔다.
`main.py`는 app 조립, lifespan, middleware, router 등록, health endpoint만 담당한다.
frontend API 함수는 `frontend/src/api/rosApi.js`에 둔다.
`GET /ros/alerts`는 현재/최근 Alert를 `data`, 해결된 최근 이력을 `history`로 반환하며,
기존 `data`와 `meta` key를 제거하거나 의미를 바꾸지 않는다.

`GET /ros/preferences/priority`는 전체 `priority` 목록을 반환하고 PUT/DELETE는
`{kind}`에 `topics|services|actions|nodes`, JSON body에 `{"name": "..."}`을 받는다.
중복 등록·이미 해제된 항목은 성공하되 `changed=false`다.

`WS /ws/monitor`는 1초마다 `monitor_snapshot` 경량 요약(count/status 집계, Topic latest map,
현재 Alert)을 push한다. 전체 목록과 상세 latest/Hz를 대체하지 않으므로 화면 데이터는 REST
polling을 계속 사용하며, Frontend WebSocket은 끊기면 2.5초 뒤 재연결한다.

## 7. Configuration Policy

선택적 `.env`와 `ros2_ws/src/ros2_dashboard_monitor/config/monitor.yaml`의 책임을 분리한다. Loader는 먼저
`backend/.env`, 다음으로 backend Python package 옆 `.env`를 찾고 없으면 process 환경변수와
safe default를 사용한다. 현재 저장소에는 `.env`를 커밋하지 않는다.

`.env`:

```text
CORS_ORIGINS
MONITOR_CONFIG_PATH
INTERFACE_REGISTRY_PATH
INTERFACE_PACKAGES_REGISTRY_PATH
INTERFACE_PACKAGE_PATH
INTERFACE_UPLOADED_PACKAGES_PATH
INTERFACE_APPLY_STATUS_PATH
INTERFACE_APPLY_LOG_PATH
```

Backend Python 코드는 `API_HOST`/`API_PORT`를 읽지 않는다. host/port는 uvicorn 실행 인자로
지정한다. Frontend API와 polling override는 `VITE_API_BASE_URL`,
`VITE_TOPIC_POLL_INTERVAL_MS`, `VITE_DASHBOARD_POLL_INTERVAL_MS`,
`VITE_VISUALIZATION_POLL_INTERVAL_MS`를 사용한다.

`monitor.yaml`:

```text
monitor.poll_interval_sec / stale_timeout_sec / hz_window_sec
topics.auto_discover / auto_subscribe_supported_types
topics.include_names / exclude_names / exclude_prefixes / exclude_types
topics.supported_types / required_stream_names / command_names
services.include_names / exclude_names / exclude_prefixes / primary_names
services.active_check.enabled / interval_sec / default_timeout_sec / allowlist
actions.include_names / exclude_names / exclude_prefixes / primary_names
actions.auto_monitor_status / auto_monitor_feedback / auto_fetch_result_for_observed_goals
nodes.include_names / exclude_names / exclude_prefixes / primary_names / stale_timeout_sec
```

Loader는 `include_names`/`exclude_names`와 함께 `include`/`exclude`도 읽으며,
둘 다 있으면 suffix 없는 key를 우선한다. include는 빈 목록이면 전체 후보를 허용하고,
exclude name/prefix/type은 include보다 우선한다.

`backend/config/user_preferences.yaml`은 사용자가 별표로 지정한 주요 Topic / Service /
Action / Node 이름을 저장한다. `monitor.yaml`과 Interface Registry를 수정하지 않으며,
`priority.topics/services/actions/nodes`의 중복 없는 정렬 목록을 임시 파일과 `os.replace()`로
원자적으로 저장하고 Backend 재시작 후에도 유지한다. 파일이 없으면 빈 구조로 생성한다.

Topic Runtime의 최종 지원 타입은 아래 원천을 합쳐 중복 제거한다.

```text
monitor.yaml의 topics.supported_types 또는 safe default
+
interface_registry.yaml에서 import_available=true인 msg full_type
+
interface_packages.yaml에서 import_available=true인 msg full_type
```

YAML registry의 srv / action 타입은 각 Runtime이 import 가능한 등록 타입을 읽고
현재 ROS2 Graph의 실제 full_type과 exact match한 경우에만 `allowlisted=true`로 표시한다.
Frontend는 YAML 파일을 다시 해석하지 않고 이 Backend 결과를 사용한다.

원칙:

```text
.env에 ROS2 감시 대상 목록을 넣지 않는다.
frontend에 새로운 ROS2 감시 대상 이름이나 타입 목록을 추가하지 않는다.
설정 파일이 없어도 safe default로 서버가 죽지 않아야 한다.
설정 key가 없을 때만 safe default를 사용하고 명시적인 빈 list는 빈 정책으로 보존한다.
지속 stream과 command Topic 이름 정책은 monitor.yaml에서 읽고 누락 시 빈 목록을 사용한다.
기존 호환용 이름 fallback은 확대하지 않고 YAML 등록 타입과 Backend 판정 신호를 우선한다.
Gazebo/TurtleBot3 이름을 새 Backend 동작 조건으로 하드코딩하지 않는다.
```

## 8. ROS2 Graph API 정책

ROS2 목록 조회 모니터링을 CLI subprocess 파싱으로 만들지 않는다.

금지:

```python
subprocess.run(["ros2", "topic", "list"])
subprocess.run(["ros2", "node", "list"])
subprocess.run(["ros2", "service", "list"])
subprocess.run(["ros2", "action", "list"])
```

사용:

```python
node.get_node_names()
node.get_topic_names_and_types()
node.get_service_names_and_types()
node.count_publishers(topic_name)
node.count_subscribers(topic_name)
node.count_services(service_name)
node.count_clients(service_name)
rclpy.action.graph.get_action_names_and_types(node)
rclpy.action.graph.get_action_server_names_and_types_by_node(...)
rclpy.action.graph.get_action_client_names_and_types_by_node(...)
```

`ros2` CLI는 개발자가 수동 검증 명령으로 실행할 수는 있지만,
backend 기능 구현의 데이터 소스로 사용하지 않는다.

공통 Graph 상태 정책:

```text
현재 Graph에 존재
→ Topic / Service / Action / Node별 기존 active, waiting, executing 등 상태 유지
→ 정상 또는 중립

Backend 실행 이후 한 번 이상 발견됐지만 현재 Graph에서 사라짐
→ status=disconnected
→ 종료 감지 / 연결 끊김 / 현재 사용 불가
→ error, 빨강

Backend 실행 이후 한 번도 발견되지 않음
→ 없음 / 대기 / 미발견
→ 중립 또는 주의
→ 회색 또는 노랑
```

Graph 정보만으로 정상 종료와 비정상 종료를 구분할 수 없으므로
`비정상 종료`라고 단정하지 않는다.
공통 상태 helper는 `resource_state.py`에서 `graph_present`, `ever_discovered`,
`last_seen_at`, `disconnected_at`을 관리한다.
처음부터 발견되지 않은 선택적 항목이나 관계없는 항목을 빨간 오류로 만들지 않는다.
Backend 재시작 시 발견 이력과 메모리 cache가 초기화되는 현재 동작을 유지한다.

기본 Topology의 Dashboard 내부 통신 제외 정책:

```text
Topic / Service / Action 탭의 Node 수와 연결 Node 목록
= ROS2 Graph에서 확인한 고유 Node 관계에서 /ros2_dashboard_topic_monitor 관계를 제외

Dashboard 내부 Node가 만드는 관계
= 자동 Topic 감시, Interface Lab Topic Publish/Receive,
  Service Call Client, Action Goal Client

원본 publisher_count / subscriber_count / server_count / client_count와
endpoint 진단 필드
= 기존 API 호환과 Graph 진단을 위해 Dashboard 통신을 포함한 원본값 유지

Interface Lab 실행 이력
= Publish / Receive / Call / Goal Activity이므로 차감하지 않음

Node 탭
= 내부 Node를 is_internal로 표시하고 기존 숨김/숨김 포함 정책 유지
```

기본 화면에는 내부/외부 구독자를 별도 Topology 숫자 열로 나누지 않는다.
Dashboard 관계를 차감한 값을 일반 Publisher / Subscriber / Server / Client
Node 수로 표시하고, 별도 `Dashboard 통신` 열에서 내부 통신 목적을 배지로 표시한다.

```text
Topic
= 자동 감시 / Interface Lab 수신 / Interface Lab 발행

Service
= Interface Lab Client 생성 여부

Action
= Interface Lab Client 생성 여부
```

Dashboard 통신 배지는 Node 수에 다시 더하지 않는다.
Action의 status·feedback 자동 관찰은 계속 동작하지만 메인 목록 배지에는 표시하지 않는다.
Graph 원본 endpoint 수와 Interface Lab 실행 이력 유지 정책도 바꾸지 않는다.

## 9. Topic 정책

대시보드는 특정 토픽 이름에 의존하면 안 된다.

예시 토픽 이름:

```text
/scan
/odom
/cmd_vel
/imu
/joint_states
```

위 이름은 테스트나 문서 예시에는 사용할 수 있지만, 대시보드 동작의 필수 조건이면 안 된다.

기본 흐름:

```text
1. ROS2 graph에서 topic 목록 조회
2. topic name과 message type 확인
3. include / exclude 적용
4. 기본 지원 타입 또는 import 가능한 YAML 등록 msg 타입이면 자동 subscription 생성
5. 기존 subscription이 있으면 재사용
6. latest / hz / stale / alerts cache 계산
```

깊은 모니터링은 topic name보다 message type 기준으로 처리한다.

기본 지원 타입 예:

```text
sensor_msgs/msg/LaserScan
nav_msgs/msg/Odometry
sensor_msgs/msg/Imu
geometry_msgs/msg/Twist
geometry_msgs/msg/TwistStamped
sensor_msgs/msg/JointState
ros2_dashboard_interfaces/msg/MonitorStatus
```

위 목록은 safe default 예시이며 최종 지원 타입을 제한하는 별도 하드코딩 gate가 아니다.
YAML 등록 msg 타입은 generated Python message를 동적 import할 수 있고
현재 Graph type과 full_type이 exact match할 때 같은 자동 감시 경로에 포함한다.
preview 전용 Python 타입 목록이나 serializer 분기 유무를
subscription 생성 가능 여부의 추가 조건으로 사용하지 않는다.

Topic 상세 감시는 UI 표시만 의미하지 않는다.

```text
동적 subscription 생성
최신 메시지와 마지막 수신 시각 저장
수신 timestamp window 기반 Hz 계산
stale / 미수신 판단
supported_type / deep_monitoring / detailed_monitoring_enabled 결과 제공
```

custom msg preview가 제한적이더라도 실제 subscription, 마지막 수신 시각, Hz 계산은 유지한다.

`GET /ros/topics/latest`와 `GET /ros/topics/hz`는 Graph에서 type을 찾고 최종 지원 타입인지,
generated message class를 import할 수 있는지 확인한 뒤 subscription을 보장한다.
지원하지 않거나 import하지 못한 타입은 `success=false`와 이유를 반환하며 임의 generic
subscription을 만들지 않는다. latest는 `received`, `last_received_at`, `message_preview`를 반환한다.
Hz는 최근 `hz_window_sec` 안의 callback timestamp 개수를 정리한 뒤
`message_count / hz_window_sec`를 소수 둘째 자리로 계산한다. `age_sec`는 현재 시각과
마지막 수신 시각의 차이이고, 마지막 수신이 없으면 `status=never_received`,
수신 후 `stale_timeout_sec`를 넘으면 `status=stale`, `is_stale=true`다.

Interface Lab의 Topic Receive는 일반 TopicRuntime 자동 deep monitoring과 다르다.
사용자가 명시적으로 수신 시작/중지를 누른 Topic만
`interface_lab/execution/topic_runtime.py`의 `InterfaceReceiveRuntime`이 구독하고 history를 관리한다.

Interface Lab Topic Publish 후보 정책:

```text
기존 Graph Topic 후보는 현재 선택 Message full_type과 Graph type이 exact match인 Topic만 표시한다.
이 후보는 기존 Topic에 추가 Publisher로 참여할 채널을 선택하는 용도다.
이름에 /_action/이 포함되거나 /_action으로 끝나는 Action 내부 Topic은
일반 Message Publish 자동 후보에서 제외하되 Monitoring/Action 관찰 목록에서는 제거하지 않는다.
Graph 후보가 정확히 1개이고 Publish Topic name이 비어 있을 때만 자동 입력할 수 있다.
후보가 0개이면 공란을 유지하고, 2개 이상이면 사용자가 직접 선택한다.
Graph 후보 선택 시 Topic 이름을 입력란에 복사하되 입력란은 계속 직접 편집 가능해야 한다.
사용자가 직접 입력한 정상 Topic 이름은 polling, Graph 재조회, 렌더링으로 덮어쓰지 않는다.
Graph에 없는 유효한 새 Topic 이름은 사용자의 명시적 Publish로 Publisher 생성을 허용한다.
```

Interface Lab Topic Publish type 안전 정책:

```text
Action 내부 Topic 이름은 Graph 존재/type 여부와 관계없이 일반 Message Publish에서 거부한다.
같은 Topic 이름에 요청 full_type과 다른 Message type이 Graph에 하나라도 있으면
interface_lab/execution/topic_runtime.py의 publish_topic()이 Publisher 생성 전에 거부한다.
실제 publish를 수행하지 않고 success=false, published=false, sent_to_topic=false,
error_type=action_internal_topic 또는 topic_type_conflict와 graph_state를
기존 Publish history 형식으로 기록한다.
Frontend 경고는 사용자 안내용이며 Backend Graph 검증을 대체하지 않는다.
```

Interface Lab Topic 지속 발행 정책:

```text
기본 실행은 1회 발행이며, 지속 발행은 사용자가 별도 버튼으로 명시적으로 시작한다.
지속 발행 주기는 0.1~50 Hz 범위에서만 허용한다.
같은 topic_name/full_type 조합의 중복 지속 발행을 허용하지 않는다.
사용자 중지 요청과 Backend Runtime cleanup 시 발행 thread를 종료한다.
지속 발행도 1회 발행과 동일한 Action 내부 Topic 차단, Graph type 충돌 검사,
payload validation을 거쳐야 한다.
```

## 10. Service 정책

Service는 Topic처럼 지속 메시지를 흘리지 않는다.

Service에는 세 경로가 있다.

```text
ServiceRuntime
= Graph 상태, server/client count, category/status/reason, alert snapshot

ServiceActiveCheckRuntime
= monitor.yaml allowlist에 등록된 안전한 Service만 background active_check

ServiceCallRuntime (interface_lab/execution/service_call_runtime.py)
= Interface Lab에서 사용자가 실행 버튼을 누른 경우에만 명시적 Service request 전송
```

Service 상태 기준:

```text
server_count > 0
→ active

server_count == 0 and client_count > 0
→ waiting_server

server_count == 0 and client_count == 0
→ inactive

type 없음 또는 비정상
→ unknown

이전에 발견됐지만 현재 Graph에서 사라짐
→ disconnected
```

`/ros/services`의 `allowlisted`는 import 가능한 YAML 등록 srv 타입과
Graph의 실제 service full_type이 exact match했다는 주요 항목 판정 신호다.
background active_check 지원 여부와는 별개이며,
등록됐다는 이유만으로 Service를 자동 호출하지 않는다.

현재 `monitor.yaml`은 `services.active_check.enabled=false`, `allowlist=[]`이므로 background
active check를 실행하지 않는다. 기능을 켜더라도 이름·타입 allowlist exact match인 대상만
설정된 request와 timeout으로 실행하며, Interface Lab의 사용자 Call과 이력을 섞지 않는다.

기본 제외 대상:

```text
*/describe_parameters
*/get_parameter_types
*/get_parameters
*/list_parameters
*/set_parameters
*/set_parameters_atomically
action_internal service
ros_internal service
hidden management service
```

명시적 Service Call 정책:

```text
사용자가 UI에서 실행 버튼을 누른 경우에만 호출한다.
호출 후보는 import 가능한 등록 .srv와 현재 ROS2 graph의 exact service_name/full_type match다.
server_count >= 1이어야 callable이다.
request schema는 parsed.request 또는 get_fields_and_field_types() 기반이다.
interface_lab/common/value_converter.py가 scalar, sequence, nested custom msg,
custom msg array를 재귀 변환한다.
validation 실패 시 sent_to_server=false로 기록하고 ROS server에 보내지 않는다.
timeout, response, history를 저장한다.
Graph에 보이는 모든 Service를 자동 호출하거나 숨은 Service를 임의 호출하지 않는다.
```

장비 제어 가능성이 있는 Service는 사용자의 명시 실행 없이 호출하지 않는다.

## 11. Action 정책

Action은 내부적으로 service와 topic을 사용하지만, dashboard API는 Action 단위로 묶어서 표시한다.

예:

```text
/CanControl
/CanControl/_action/send_goal
/CanControl/_action/get_result
/CanControl/_action/cancel_goal
/CanControl/_action/feedback
/CanControl/_action/status
```

`/ros/actions`는 `/CanControl` 하나로 표시한다.
Service 화면에서는 action_internal service를 기본 숨김 처리한다.

Action에는 두 경로가 있다.

```text
ActionRuntime + ActionResultRuntime
= Graph/status/feedback/result 관찰 경로.
  새 Goal을 만들지 않고, status topic에서 관찰된 terminal goal_id에 대해서만 get_result를 시도한다.

ActionGoalRuntime (interface_lab/execution/action_goal_runtime.py)
= Interface Lab에서 사용자가 실행 버튼을 누른 경우에만 명시적 Action Goal 전송.
```

Action 상태 기준:

```text
server_count > 0
→ active

server_count == 0 and client_count > 0
→ waiting_server

server_count == 0 and client_count == 0
→ inactive

type 없음 또는 비정상
→ unknown

이전에 발견됐지만 현재 Graph에서 사라짐
→ disconnected
```

`/ros/actions`의 `allowlisted`는 import 가능한 YAML 등록 action 타입과
Graph의 실제 action full_type이 exact match했다는 주요 항목 판정 신호다.
등록됐다는 이유만으로 Goal을 전송하지 않는다.

관찰 대상:

```text
status topic: <action_name>/_action/status
feedback topic: <action_name>/_action/feedback
```

`action_msgs/msg/GoalStatusArray` status code 매핑:

```text
0 unknown
1 accepted
2 executing
3 canceling
4 succeeded
5 canceled
6 aborted
```

명시적 Action Goal 정책:

```text
사용자가 UI에서 실행 버튼을 누른 경우에만 Goal을 보낸다.
호출 후보는 import 가능한 등록 .action과 현재 ROS2 graph의 exact action_name/full_type match다.
server_count >= 1이어야 callable이다.
같은 action_name이라도 full_type이 다르면 다른 Action으로 취급한다.
ActionClient cache key는 (action_name, action_type) 쌍이다.
goal schema는 parsed.goal 또는 get_fields_and_field_types() 기반이다.
goal 변환은 interface_lab/common/value_converter.py의 recursive converter 원칙을 따른다.
validation 실패 시 sent_to_server=false로 기록하고 ROS server에 보내지 않는다.
accepted/rejected, timeout, feedback, result, result_error, history를 저장한다.
Graph에 보이는 모든 Action을 자동 실행하거나 반복 실행하지 않는다.
```

금지:

```text
사용자 승인 없는 Action Goal 전송
Action cancel 전송 기능 임의 추가
관찰하지 않은 goal_id에 대한 Action get_result 직접 호출
Action active_check 구현
장비가 움직일 수 있는 action 임의 실행
```

## 12. Interface Lab 정책

Interface Lab은 등록, build/apply/import 확인, 명시적 Service Call, 명시적 Action Goal,
명시적 Topic Receive, Service/Action history를 다루는 작업 도구다.

구현 위치와 책임:

```text
interface_lab/management/
= registry, manual_type, manual_definition, single upload, package upload/list/delete,
  uploaded_interfaces metadata 재생성, CMakeLists.txt/package.xml 재생성

interface_lab/apply/
= apply 요청, colcon build, apply status, build log, install 경로 확인,
  import-check와 registry import 가능 여부 반영

interface_lab/execution/
= Topic Publish/Receive, Service Call, Action Goal, feedback/result/history,
  publisher/subscription/client cache, cleanup

interface_lab/common/
= schema 생성, payload validation, ROS generated object 생성,
  ROS message/response/feedback/result의 JSON-safe 변환

interface_lab/paths.py
= module 위치가 바뀌어도 유지되어야 하는 ROS2 workspace root,
  package share와 영속 config 경로 계산
```

원칙:

```text
Interface Lab 사용자 데이터 경로는 코드 모듈 위치와 분리한다.
registry/package/apply/uploaded data 경로를 __file__.parent 임시 계산으로 만들지 않는다.
backend/config와 backend/src/uploaded_*의 기존 데이터를 새 빈 파일로 덮어쓰지 않는다.
management는 ROS2 publish/call/goal 실행을 하지 않는다.
apply는 interface 파일 생성/삭제 책임을 가져오지 않는다.
execution runtime은 registry/schema 조회는 가능하지만 파일 관리와 colcon build를 직접 하지 않는다.
```

등록 방식:

```text
manual_type
= 이미 설치/import 가능한 type을 registry에 등록한다. 파일을 만들지 않고 build가 필요 없다.

manual_definition
= 사용자가 .msg/.srv/.action 정의를 직접 입력한다.
  backend/src/uploaded_interfaces/<msg|srv|action>/에 파일을 쓰고 build가 필요하다.

single_upload
= 단일 .msg/.srv/.action 파일 업로드.
  기본 대상은 backend/src/uploaded_interfaces이며 build가 필요하다.

package_upload
= zip 또는 folder로 완성된 ROS interface package 업로드.
  backend/src/uploaded_interface_packages/<package_name>/에 package 단위로 저장한다.
```

저장 위치:

```text
ros2_ws/src/ros2_dashboard_monitor/config/interface_registry.yaml
= manual_type, manual_definition, single_upload 개별 interface registry

ros2_ws/src/ros2_dashboard_monitor/config/interface_packages.yaml
= package_upload 기록. 단일 interface 삭제 시 건드리지 않는다.

ros2_ws/src/ros2_dashboard_monitor/config/interface_apply_status.yaml
= 마지막 pending/build/import/apply 상태

backend/src/uploaded_interfaces
= 직접 작성/단일 업로드 파일을 모은 하나의 ROS interface package

backend/src/uploaded_interface_packages
= 업로드된 ROS interface package를 package 이름 그대로 보존하는 저장소

backend/src/ros2_dashboard_interfaces
= MonitorStatus.msg, KeyValue.msg 등 프로젝트 내장 공통 interface package
```

`uploaded_interfaces`와 `uploaded_interface_packages`는 역할이 다르다.
삭제, registry, build metadata를 서로 섞지 않는다.

`uploaded_interfaces` metadata 재생성 원칙:

```text
interface_lab/management/manual_interfaces.py의 scan_uploaded_interface_files()로
실제 남은 .msg/.srv/.action 파일을 다시 스캔한다.
regenerate_uploaded_interfaces_cmake()는 append하지 않고 CMakeLists.txt 전체를 다시 쓴다.
regenerate_uploaded_interfaces_package_xml()도 현재 파일 수 기준으로 전체를 다시 쓴다.
regenerate_uploaded_interfaces_package()는 위 과정을 묶는 재사용 함수다.
```

interface 파일이 1개 이상이면:

```text
find_package(ament_cmake REQUIRED)
find_package(rosidl_default_generators REQUIRED)
rosidl_generate_interfaces(${PROJECT_NAME} ...)
ament_export_dependencies(rosidl_default_runtime)
ament_package()
```

interface 파일이 0개이면:

```text
rosidl_generate_interfaces() 호출을 남기지 않는다.
uploaded_interfaces는 최소 ament_cmake 빈 package로 build 가능해야 한다.
package.xml도 rosidl 관련 의존성을 제거하거나 build 가능한 빈 package 상태를 유지한다.
```

삭제 생명주기:

```text
삭제 API는 source/full_type/kind/file_name에 맞는 정확한 항목만 제거한다.
manual_definition 또는 single_upload 파일 삭제 후 uploaded_interfaces metadata를 반드시 재생성한다.
config/interface_registry.yaml에서 삭제된 entry를 제거한다.
config/interface_packages.yaml과 uploaded_interface_packages의 다른 package는 건드리지 않는다.
mark_interface_change_pending()으로 build_required/rebuild_required 상태를 남긴다.
frontend는 삭제 성공 후 registry/package/callable/apply 상태를 다시 fetch한다.
```

apply/import:

```text
POST /ros/interfaces/apply는 ros2_ws에서 colcon build --symlink-install을 실행한다.
build log는 ros2_ws/src/ros2_dashboard_monitor/config/interface_apply_last.log에 저장한다.
상태는 ros2_ws/src/ros2_dashboard_monitor/config/interface_apply_status.yaml에 저장한다.
동시 apply는 lock으로 막는다.
build 성공 후 import-check로 generated Python import 가능 여부를 registry에 반영한다.
build 성공 응답 후 Monitor를 동일 PID로 재실행해 Python import cache를 초기화한다.
Backend 프로세스를 kill/restart하거나 systemd/tmux를 제어하지 않는다.
```

## 13. Receive와 History 정책

Topic Receive:

```text
interface_lab/execution/topic_runtime.py의 InterfaceReceiveRuntime만 명시적 Topic subscription을 생성한다.
start_topic / stop_topic / topics / topic_history / reset_topic_history 흐름을 유지한다.
일반 Topic monitoring의 자동 subscription과 목적이 다르다.
```

Service history:

```text
Service는 Topic처럼 response topic을 subscribe하는 구조가 아니다.
interface_lab/execution/service_call_runtime.py의 ServiceCallRuntime 명시적 호출 history에서
response history를 제공한다.
reset은 timestamp 경계를 갱신해 이전 event를 숨기는 방식이다.
```

Action history:

```text
Action history는 별도 "수신 구독 시작" 구조가 아니다.
interface_lab/execution/action_goal_runtime.py의 ActionGoalRuntime 사용자 Goal 실행에서 발생한
feedback/result event를 history로 제공한다.
기존 ActionRuntime은 Graph/status/feedback 관찰을 계속 담당한다.
```

## 14. MonitorStatus / KeyValue 정책

공통 interface:

```text
KeyValue.msg

string key
string value
string value_type
string unit
```

```text
MonitorStatus.msg

string device_name
string node_name
string source
string level
string status
string message
builtin_interfaces/Time stamp
KeyValue[] values
```

백엔드는 `values`의 key 의미를 깊게 해석하지 않는다.

해야 할 일:

```text
MonitorStatus 수신
수신 시간 기록
Hz 계산
stale 판단
alert 판단
values를 안전한 JSON 배열로 변환
```

하지 않을 일:

```text
node_id, port, error_code 같은 key 의미를 임의 해석
장치별 custom rule을 기본 동작에 하드코딩
```

## 15. Alert 정책

`GET /ros/alerts`는 공통 alert item 구조를 유지한다.

기본 필드:

```text
id
level
source
name
code
message
status
last_received_at
age_sec
detected_at
```

상태형 Alert 추가 필드:

```text
active
alert_state
first_detected_at
last_detected_at
resolved_at
```

level:

```text
info
warning
error
critical
```

source:

```text
topic
monitor_status
service
node
action
```

Topic alert 기준:

```text
대상
= 기존 필수 stream 호환 대상 또는 import 가능한 YAML 등록 msg 타입을 사용하는 Topic

topic_message_missing
= Publisher가 있고 상세 감시 subscription 생성 후 stale_timeout 동안 한 번도 메시지를 받지 못함
→ warning

topic_stale
= 마지막 수신 이후 stale_timeout 초과
→ warning

topic_disconnected
= 이전에 발견된 감시 대상 Topic이 현재 Graph에서 사라짐
→ error

waiting_publisher
= 필수 stream 또는 등록 타입 Alert 대상에 Publisher가 없음
→ warning, 현재 상태만 표시

command topic
= 명령이 있을 때만 발행될 수 있으므로 message missing / stale 기본 대상에서 제외
= monitor.yaml의 topics.command_names로 지정

required stream topic
= monitor.yaml의 topics.required_stream_names로 지정
= 등록 Interface 타입을 Alert 대상으로 보는 기존 조건과 함께 적용

publisher_count > 0 and subscriber_count == 0
= 기본 장애 Alert로 보지 않음
```

MonitorStatus alert 기준:

```text
level warning  → monitor_status_warning
level error    → monitor_status_error
level critical → monitor_status_critical
level info / active / empty → alert 아님
```

Service alert 기준:

```text
service_disconnected
= import 가능한 YAML 등록 srv 타입과 Graph 타입이 exact match했던 주요 Service가 사라짐
→ error

service_call_timeout
= Interface Lab에서 실제 server로 보낸 최근 사용자 Service Call이 timeout
→ warning

user category이며 hidden_by_default가 아닌 Service만 기본 Alert 대상으로 한다.
YAML 등록만으로 Service를 자동 호출하지 않는다.
waiting_server, type_mismatch, 상태만 표시는 기본 Alert로 보지 않는다.
현재 active_check 결과 자체를 별도 Alert code로 생성하지 않는다.
```

Action alert 기준:

```text
action_disconnected
= import 가능한 YAML 등록 action 타입과 Graph 타입이 exact match했던 주요 Action이 사라짐
→ error

last_goal_status aborted
→ action_goal_aborted
→ error

last_goal_status canceled
→ action_goal_canceled
→ warning

사용자 Goal이 rejected → action_goal_rejected, warning
Goal 전송 실패 또는 accept timeout → action_goal_send_failed, error
사용자 Goal result timeout → action_result_timeout, warning
result 수신 실패 또는 관찰 Runtime result_error → action_result_unavailable, error

waiting_server, Goal 미관찰, 단순 result unavailable은 기본 alert로 보지 않는다.
```

Node alert 기준:

```text
Backend 실행 이후 발견됐던 Node가 현재 Graph에서 사라짐
→ status=disconnected
→ 기존 API 호환 code=node_stale
→ error

처음부터 발견되지 않은 Node는 Alert가 아니다.
문구는 비정상 종료가 아니라 종료 감지 / 연결 끊김으로 표현한다.
```

상태형 Alert 유지 정책:

```text
장애가 계속 중
→ active=true, alert_state=active
→ 현재 warning / error / critical 집계에 포함

장애 해결
→ 즉시 active=false, alert_state=resolved
→ 현재 severity 집계에서 즉시 제외
→ resolved_at 기록
→ 현재/최근 목록에는 resolved_at 기준 60초 유지

해결 후 60초 경과
→ retained cache와 현재/최근 목록에서 제거

60초 안에 동일 id 장애 재발
→ 기존 Alert를 active로 전환
→ resolved_at=null
→ first_detected_at 유지, last_detected_at 갱신
```

상태 유지 적용 code:

```text
topic_message_missing
topic_stale
topic_disconnected
service_call_timeout
service_disconnected
action_disconnected
action_goal_aborted
action_goal_canceled
action_goal_rejected
action_goal_send_failed
action_result_timeout
action_result_unavailable
node_stale
```

위 목록에 없는 `waiting_publisher`와 MonitorStatus 이벤트 Alert는 active/resolved 보존 대상이
아니며 현재 계산 결과를 그대로 통과시킨다.

이전 Alert 정책:

```text
현재 구현:
현재 코드에서 생성되는 모든 Alert 발생 건을 MariaDB alert 테이블에 영구 보존한다.
동일 alert_key의 미해결 row가 있으면 polling마다 중복 INSERT하지 않는다.
정상 복귀 시 resolved_at을 기록하고, 그 뒤 같은 alert_key가 재발하면 새 row를 만든다.
DB 전체 이력 보존과 UI 50건 페이지 조회를 혼동하지 않는다.
DB 연결 실패 시 Monitor 수집을 유지하기 위해 메모리 최대 50건 fallback을 사용하고 재연결을 시도한다.
```

## 16. FastAPI + rclpy 실행 구조 (리팩토링 전 기록)

이 절의 동일 프로세스 설명은 역사적 기록이다. 현재 실행 경계는 `0.2`와 `0.3`을 적용한다.

현재 구조:

```text
FastAPI lifespan에서 monitor runtime 시작
rclpy Monitor Node 생성
rclpy spin은 background thread에서 실행
timer로 graph/cache 갱신
FastAPI endpoint는 cache snapshot 또는 명시 요청 runtime 결과만 반환
```

금지:

```text
endpoint 안에서 rclpy.spin() 호출
endpoint 호출마다 ROS2 node 생성
Context 직접 생성/전달
Executor 직접 제어
rclpy private/internal 속성 사용
공유 cache lock 없이 접근
```

종료 시 `destroy_node()`와 `rclpy.shutdown()`을 처리한다.

## 17. Frontend UI 정책

공통 원칙:

```text
Topic / Service / Action / Node 화면의 기본 탭은 주요 항목이다.
전체, 대기/오류, 미수신, 미지원, 숨김/내부 포함 등은 별도 탭으로 제공한다.
목록 화면의 count 숫자는 유지하고, 상세 패널에서 실제 연결 Node 목록을 보여준다.
상세 패널 항목명은 한글 중심으로 통일한다.
ROS2 고유 용어 Topic / Service / Action / Node / Goal은 그대로 사용할 수 있다.
긴 Topic/Service/Action/Node 이름은 줄바꿈 처리하고 가로 스크롤을 만들지 않는다.
```

주요 항목 판정은 Backend가 조립하며 Frontend는 `primaryFilters.js`와 `nodeFilters.js`에서
각 응답의 `is_primary`만 사용한다. Frontend가 registry YAML이나 관계 타입으로 주요 여부를
다시 계산하지 않는다.

```text
interface_registry.yaml 또는 interface_packages.yaml에서 import_available=true인 타입
+ 현재 Graph의 Topic / Service / Action full_type exact match
→ primary_priority=1, 주요 항목. msg는 자동 구독해 Hz·마지막 값·stale을 감시한다.

topics.required_stream_names / command_names / supported_types와 일치하는 Topic
→ primary_priority=2, 주요 Topic과 자동 구독·Hz·마지막 값 감시

services.primary_names에 등록된 Service
→ primary_priority=2
→ 주요 Service

actions.primary_names에 등록된 Action
→ primary_priority=2
→ 주요 Action

Action monitoring runtime에서 status/feedback/result가 실제로 관찰된 Action
→ primary_priority=3, 주요 Action

nodes.primary_names에 등록됐거나 위 주요 통신을 실제 관계 이름과 full_type exact match로 사용하는 Node
→ 주요 Node

이전에 발견됐지만 현재 disconnected인 Node
→ 주요 Node

일반 사용자 Service라는 이유나 Service의 waiting/disconnected/error 상태만으로는
→ 자동 주요 Service가 되지 않음

각 리소스 응답의 최종 판정
→ system_primary = 기존 자동 주요 판정
→ user_primary = user_preferences.yaml 별표 지정
→ is_primary = system_primary OR user_primary
```

Frontend 주요 필터는 `is_primary`를 사용한다. 별표 해제는 `user_primary`만 제거하며
`system_primary=true`인 자동 주요 항목을 주요 목록에서 제거하지 않는다.
별표 버튼은 Topic / Service / Action / Node 각 행에 있으며 클릭 즉시 낙관적으로 반영한다.
같은 항목의 요청 중 재클릭을 막고, API 실패 시 override를 제거해 Backend 상태로 복구하고
오류를 표시한다. 숨김 관리 Service와 내부 Node도 `user_primary=true`이면 주요 탭에서는 보존한다.

Node 관계는 `/ros/nodes`의 `topic_publishers`, `topic_subscribers`,
`service_servers`, `service_clients`, `action_servers`, `action_clients`를 사용한다.
등록 타입과 monitor.yaml 정책을 분리하고 등록 타입을 항상 우선한다.
dashboard monitor 내부 Node와 숨김 / 내부 항목 제외 정책은 유지한다.
Topics / Services / Actions / Nodes / Overview는 Backend의 같은 기준을 재사용하고,
각 화면에서 등록 타입 또는 로봇 이름을 새로 하드코딩하지 않는다.
기존 호환용 이름 fallback은 새로운 주요 항목 정책의 근거로 확대하지 않는다.

Frontend polling 정책:

```text
공통 polling은 frontend/src/hooks/usePolling.js를 사용한다.
setInterval/setTimeout은 cleanup에서 반드시 clearInterval/clearTimeout 한다.
polling effect를 응답 data/latest/hz state에 의존시키지 않는다.
fetcher 함수 identity 때문에 interval이 매 render 재생성되지 않도록 resetKey를 명시한다.
Topic 상세 latest/hz는 Topics 화면에서 선택된 Topic에 대해서만 실행한다.
선택 Topic의 개별 Hz 응답은 응답의 name과 현재 selectedTopicName이
exact match할 때만 topicHzByName에 병합해 이전 요청 결과가 새 선택을 덮어쓰지 않게 한다.
/_action/feedback, /_action/status, /_service_event, /clock, /rosout 등 내부 Topic은
Topic 상세 기본 선택 후보와 목록용 Hz polling 후보에서 제외한다.
숨김 포함 해제 후 표시 Topic이 0개이면 selectedTopicName은 빈 값으로 안정화하고
다른 hook이 다시 내부 Topic을 기본 선택하지 않게 한다.
App.jsx는 activePage 기준으로 필요한 dashboard hook만 polling enabled 처리한다.
현재 Nodes 화면에서는 Node와 Topic / Service / Action dashboard polling을 함께 활성화하지만,
Node 주요 판정 자체는 `/ros/nodes`의 Backend `is_primary`를 사용한다.
WebSocket reconnect가 REST polling timer를 추가 생성하면 안 된다.
filtered 목록에 맞춰 selected item을 보정하는 effect는 빈 목록에서 다른 hook의
기본 선택과 경쟁해 `빈 값 ↔ 첫 항목`을 반복하지 않아야 하며,
현재 값과 같은 state를 setter로 다시 넣지 않는다.
```

Interface Lab UI:

```text
/interface-lab route는 InterfaceLabPage를 표시한다.
InterfaceUploadControl은 등록 방식 선택, package upload, 삭제, apply,
Service Call, Action Goal, Topic Receive/history 조작을 연결한다.
registry row와 package row는 type/full_type 기준으로 병합한다.
Service/Action 실행 후보는 graph name과 full_type exact match를 보존한다.
schema 기반 동적 form은 nested custom msg 입력을 지원한다.
삭제 성공 후 registry/package/callable/apply 상태를 다시 fetch한다.
failed to fetch 같은 원문 에러는 사용자가 이해 가능한 한글 설명으로 표시한다.
Topic Publish의 Graph 후보와 Topic Receive 후보는 의미가 다르므로 상태를 묶어 자동 변경하지 않는다.
Publish Graph 후보는 exact Message full_type 일치와 Action 내부 Topic 제외 규칙을 적용한다.
Publish Topic name 직접 입력은 새 Topic Publisher 생성 경로로 유지한다.
Publish Topic 입력 출처는 empty / auto / graph / user를 구분하고,
Graph 후보가 정확히 1개인 자동 입력은 현재 이름이 이미 같으면 setter를 호출하지 않는다.
polling 또는 후보 재계산은 user 출처의 직접 입력값을 덮어쓰지 않는다.
Message import됨만 보기 체크 여부는 Message 목록만 필터링하며,
Topic Receive Graph 후보의 exact Message full_type 비교는 체크/해제 상태와 관계없이 유지한다.
Receive Graph 후보 변경 시 이전 자동/후보 선택값만 갱신하고 사용자가 직접 입력한 Topic 이름은 보존한다.
```

Frontend participant map 정책:

```text
/ros/nodes 응답의 node 기준 관계를 프론트에서 역매핑해
Visualization 상세 패널의 참여 Node 목록을 만든다.
topic_publishers / topic_subscribers → 발행자 Node / 구독자 Node
service_servers / service_clients → 응답자 Node / 요청자 Node
action_servers / action_clients → Goal 실행자 Node / Goal 요청자 Node
일반 Topic / Service / Action API도 RosMonitor가 같은 exact type 관계를 조립한
publisher_nodes/subscriber_nodes/server_nodes/client_nodes와 내부 제외 count를 반환한다.
```

Visualization 화면 정책:

```text
통신 시각화는 React Flow(@xyflow/react)를 사용한다.
첫 진입 화면은 노드 중심이다.
노드 중심은 Node 목록을 크게 보여주고, Node 선택 시 연결 중심으로 이동한다.
연결 중심은 선택 Node와 직접 연결된 Topic / Service / Action 1-hop 관계만 표시한다.
노드 선택 목록의 기본 필터는 Backend `is_primary`이고 active/전체 Node 필터로 전환할 수 있다.
그래프 리소스는 선택 또는 전체 Node의 실제 관계 목록으로 만들며, 주요 리소스만으로 제한하지 않는다.
activeOnly는 연결/endpoint가 있는 활성 리소스를 남기고, includeHidden=false이면 dashboard/ros2cli
내부 Node와 내부 Topic·관리 Service·Action 내부 통신을 숨긴다.
연결 중심은 Topic 30개, Service 20개, Action 20개, edge 80개 제한을 적용하고 생략 여부를 표시한다.
전체 보기는 ROS2 Graph가 복잡할 수 있으며 120 Node 또는 300 edge 초과 여부를 경고한다.
React Flow 그래프는 polling마다 remount하거나 자동 fitView 하지 않는다.
fitView는 최초 필요 시 또는 사용자가 버튼을 눌렀을 때만 실행한다.
nodes/edges id는 안정적으로 유지하고 Date.now()/Math.random()으로 만들지 않는다.
```

Alert UI 정책:

```text
Overview 최근 Alert는 기본 접힘 상태에서 3개를 표시한다.
펼치면 Backend가 반환한 현재/최근 Alert 중 최대 10개를 표시한다.
Overview 최근 Alert의 작은 font/badge 규칙은 다른 목록과 상세 화면에 전파하지 않는다.

Alerts 화면은 현재 Alert / 이전 Alert 탭으로 구분한다.
현재 Alert는 `resolved_at IS NULL`, 이전 Alert는 `resolved_at IS NOT NULL`로 MariaDB에서 조회한다.
현재 Alert는 상태·레벨·출처·이름·메시지·코드·감지 시각 순으로 표시한다.
이전 Alert는 같은 컬럼 뒤에 해결 시각을 추가하고, `resolved_at` 최신순으로 50개씩 페이지 조회한다.
이전 Alert 검색은 리소스 종류에 한정하지 않고 `name` 컬럼 전체를 대상으로 한다.
발생 중/해결됨 상태 배지와 원래 warning/error/critical level 배지를 별도로 표시한다.
현재 Alert와 이전 Alert의 개수를 각 탭에 표시한다.
```

## 18. 작업 명령

ROS2 workspace:

```bash
cd ~/rang/ros2_dashboard/ros2_ws
source /opt/ros/jazzy/setup.bash
colcon build --symlink-install
source install/setup.bash
colcon test
colcon test-result --verbose
```

Backend Python tests:

```bash
cd ~/rang/ros2_dashboard/backend
.venv/bin/python -m compileall app
.venv/bin/python -m pytest -q tests
```

FastAPI:

```bash
cd ~/rang/ros2_dashboard/backend
.venv/bin/python -m uvicorn app.main:app \
  --host 127.0.0.1 \
  --port 8000
```

ROS2 Monitor:

```bash
cd ~/rang/ros2_dashboard/ros2_ws
source /opt/ros/jazzy/setup.bash
source install/setup.bash
ros2 run ros2_dashboard_monitor monitor
```

Frontend:

```bash
cd ~/rang/ros2_dashboard/frontend
npm install
npm run dev
npm run build
npm run lint
```

검증을 못 돌렸으면 이유를 명확히 보고한다.

## 19. Codex 작업 제한

금지:

```text
사용자 요청 없는 frontend/backend 동시 대규모 변경
기존 API 제거
기존 JSON key 제거
기존 파일/폴더 구조 임의 변경
필요 없는 새 구조 생성
MariaDB Alert 이력 범위를 벗어난 DB 기능 또는 사용자 요청 없는 인증 / JWT 추가
외부 라이브러리 임의 추가
rclpy를 pip로 설치
생성물 폴더 직접 수정
WebSocket 임의 구현
사용자 승인 없는 Service request 전송
사용자 승인 없는 Action Goal 전송
Action cancel 전송 기능 임의 추가
관찰하지 않은 goal_id에 대한 Action get_result 전송
장비 제어 기능 임의 구현
```

허용 Python 패키지:

```text
fastapi
uvicorn
python-dotenv
PyYAML
ROS2 Jazzy 환경에 포함된 rclpy 및 ROS2 표준 패키지
```

새 라이브러리가 필요하면 먼저 이유를 설명하고 사용자 확인을 받는다.

## 20. Codex 응답 방식

전체 코드를 길게 출력하지 않는다.

기본 보고 형식:

```text
수정 파일 목록
핵심 변경 내용
실행 명령
검증 결과
주의할 점
```

불확실한 부분은 확실한 것처럼 말하지 않는다.
실행하지 못한 검증은 실행하지 못했다고 말한다.
