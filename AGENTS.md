# ROS2 Dashboard 작업 기준

이 문서는 `ros2_dashboard`의 현재 코드 구조, 책임 경계, 운영 정책과 AI 작업 규칙의 기준이다.
과거 구조나 계획을 보존하는 변경 이력 문서가 아니다. 구현이 바뀌면 오래된 설명을 직접 고치고,
실제 코드와 설정을 source of truth로 삼는다.

## 1. 작업 시작과 인수인계

모든 AI 작업자는 작업을 시작할 때 다음 두 파일을 먼저 확인한다.

```text
.codex/CURRENT_STATUS.md
.codex/WORK_LOG.md
```

`.codex/archive/`는 현재 작업의 과거 근거가 필요할 때만 검색한다. 작업 종료 시 크기와 관계없이
`.codex/WORK_LOG.md`에 날짜와 결과를 누적한다. 구조, 정책, 검증 상태 또는 다음 작업 지점이 바뀌었으면
`.codex/CURRENT_STATUS.md`도 갱신한다.

WORK_LOG는 최근 약 20~30개 작업을 유지한다. 더 길어지면 오래된 항목을 본문과 완료 상태를 바꾸지 않고
`.codex/archive/`로 옮긴다. 구현하지 않았거나 검증하지 않은 항목을 완료로 기록하지 않는다. 코드와 문서가
다르면 코드와 실행 결과를 기준으로 하고 불일치를 기록한다.

## 2. 프로젝트 목적과 기술 스택

`ros2_dashboard`는 단일 ROS2 기기의 Node, Topic, Service, Action 통신 상태를 수집하고 장애 원인을
좁히는 사내 진단 도구다. 일반 배포 제품이나 다중 장비 관제 플랫폼을 전제로 하지 않는다.

```text
OS                 Ubuntu 24.04
ROS2               Jazzy / rclpy
DDS observer       Fast DDS 2.14 계열 C++ helper (optional)
Monitor transport  localhost FastAPI, 기본 127.0.0.1:8765
Web Backend        FastAPI, 기본 127.0.0.1:8000
Alert DB           MariaDB / PyMySQL
Frontend           React / Vite
개발 검증           Gazebo, TurtleBot3, demo nodes 또는 실제 ROS2 장비
```

Node.js는 현재 Vite의 engine 요구사항인 `^20.19.0 || >=22.12.0`을 따른다.

## 3. 현재 폴더 구조

```text
ros2_dashboard/
├─ AGENTS.md
├─ README.md
├─ .codex/
│  ├─ CURRENT_STATUS.md
│  ├─ WORK_LOG.md
│  └─ archive/
├─ backend/
│  ├─ .env.example
│  ├─ requirements.txt
│  ├─ schema/
│  │  └─ 001_alert.sql
│  ├─ config/
│  │  └─ user_preferences.yaml
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ app_state.py
│  │  ├─ settings.py
│  │  ├─ websocket_manager.py
│  │  ├─ alerts/
│  │  ├─ database/
│  │  ├─ monitor_client/
│  │  ├─ routers/
│  │  └─ user_preferences/
│  └─ tests/
├─ config/
│  ├─ nginx/
│  └─ systemd/
├─ docs/
│  ├─ alert_policy/
│  ├─ architecture/
│  ├─ deployment/
│  ├─ docs2/
│  ├─ interface_lab/
│  └─ qos/
├─ frontend/
│  ├─ public/
│  ├─ src/
│  │  ├─ api/
│  │  ├─ components/
│  │  ├─ features/
│  │  │  ├─ actions/
│  │  │  ├─ alerts/
│  │  │  ├─ interface-lab/
│  │  │  ├─ nodes/
│  │  │  ├─ overview/
│  │  │  ├─ services/
│  │  │  └─ topics/
│  │  ├─ hooks/
│  │  ├─ layout/
│  │  ├─ pages/
│  │  └─ utils/
│  ├─ package.json
│  └─ vite.config.js
├─ ros2_ws/
│  └─ src/
│     ├─ ros2_dashboard_monitor/
│     │  ├─ config/
│     │  ├─ launch/
│     │  ├─ ros2_dashboard_monitor/
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
└─ scripts/
   ├─ install.sh
   ├─ start.sh
   ├─ status.sh
   ├─ stop.sh
   └─ systemd/
```

ROS package를 Web Backend 아래에 두던 구 구조는 사용하지 않는다. ROS package는 모두 `ros2_ws/src` 아래에
두고 Web Backend는 `backend/app`, Frontend는 `frontend/src`에 둔다.

생성물은 `ros2_ws/build`, `ros2_ws/install`, `ros2_ws/log`, `frontend/node_modules`,
`frontend/dist`, `.runtime`이다. 소스처럼 직접 수정하거나 Git에 포함하지 않는다.

## 4. 프로세스와 책임 경계

```text
ROS2 Graph / user data
  ↓
ros2_dashboard_dds_observer (optional Fast DDS discovery, 127.0.0.1:8766)
  ↓
ros2_dashboard_monitor (rclpy + localhost HTTP, 127.0.0.1:8765)
  ↓ GET /transport/snapshot, /ros 명령 proxy
FastAPI Backend runtime cache (127.0.0.1:8000)
  ↓ REST + /ws/monitor
React Frontend
```

### Monitor

`ros2_dashboard_monitor`만 ROS2 entity를 생성하고 ROS2 사실을 계산한다.

```text
rclpy Node와 spin lifecycle
ROS2 Graph 자동 발견
Topic latest / Hz / age / missing / stale / disconnected
Service / Action / Node 상태와 연결 관계
Graph endpoint 및 실제 entity의 QoS 관찰·비교
Topic 자동 감시 Subscription
Monitor Alert 원천 상태와 Alert 후보 생성
Interface Lab 등록·upload·build·import·apply
사용자 명시 Topic Publish/Receive, Service Call, Action Goal/Cancel
localhost transport API와 snapshot 제공
```

### Fast DDS observer

`ros2_dashboard_dds_observer`는 Discovery용 `DomainParticipant`만 만든다. Fast DDS EDP에서 Service와
Action Goal/Result/Cancel의 원격 Request Reader와 Response Writer QoS를 관찰해
`127.0.0.1:8766/snapshot`으로 제공한다. 사용자 데이터용 DataWriter/DataReader, Service Client,
ActionClient를 만들거나 요청을 전송하지 않는다.

현재 구현은 `rmw_fastrtps_cpp`와 Fast DDS endpoint 이름 규칙에 종속된다. helper 미실행이나 다른 RMW는
Service/Action Service 채널 QoS를 `graph_unavailable`로 만들 뿐 나머지 Monitoring을 중단하지 않는다.

### Backend

`backend`는 순수 Web Backend이며 `rclpy`를 import하거나 ROS2 Node를 만들지 않는다.

```text
Monitor `/transport/snapshot` polling과 마지막 정상 Runtime Cache
공개 REST API와 Browser WebSocket `/ws/monitor`
`/ros/...` 명령의 localhost Monitor proxy
Alert active/resolved 전이와 MariaDB 저장·조회
DB 장애 시 메모리 fallback과 재연결
사용자 주요 리소스 별표를 YAML로 저장하고 Monitor에 동기화
```

Backend가 Monitor보다 먼저 시작해도 종료되지 않아야 한다. Monitor 연결이 끊기면 마지막 정상 snapshot과
연결 오류를 함께 유지한다. 연결 또는 재연결 시 사용자 우선순위를 `PUT /transport/priority`로 다시 보낸다.
FastAPI async proxy에서 동기 네트워크 I/O를 직접 실행하지 않고 `httpx.AsyncClient` 경로를 사용한다.

### Frontend

Frontend는 Backend REST와 `/ws/monitor`만 사용한다. Monitor 8765, observer 8766, ROS2 또는 MariaDB에
직접 연결하지 않는다. 목록은 빠른 상태 판단, 우측 상세는 원인 분석을 담당한다.

## 5. 설정과 영속 파일

실제 source of truth는 아래 환경변수와 YAML이다. 이 문서의 숫자는 현재 기본값을 설명할 뿐 기능 코드에
복제해서 하드코딩할 근거가 아니다.

### Backend 환경 설정

`backend/app/settings.py`가 `backend/.env`를 읽는다.

```text
MONITOR_BASE_URL                 http://127.0.0.1:8765
MONITOR_TIMEOUT_SEC              30
MONITOR_POLL_INTERVAL_SEC        1
CORS_ORIGINS                     개발 origin 목록
USER_PREFERENCES_PATH            backend/config/user_preferences.yaml
ALERT_DB_ENABLED                 true
MARIADB_HOST / MARIADB_PORT      127.0.0.1 / 3306
MARIADB_UNIX_SOCKET              선택값
MARIADB_DATABASE                 ros2_dashboard
MARIADB_USER                     ros2_dashboard
MARIADB_PASSWORD                 secret, Git 기록 금지
MARIADB_CONNECT_TIMEOUT_SEC      2
MARIADB_RETRY_INTERVAL_SEC       5
```

### Monitor 설정

기본 source는 `ros2_ws/src/ros2_dashboard_monitor/config/monitor.yaml`이다. 설치 package share 설정은
읽기 기본값이며 변경 가능한 Registry와 Apply 상태는 source workspace에 보존한다.

```text
monitor.poll_interval_sec                         1.0
monitor.stale_timeout_sec                         3.0
monitor.hz_window_sec                             5.0
alerts.qos.incompatible_confirmation_count        3
fastdds_observer.enabled                          true
fastdds_observer.port                             8766
fastdds_observer.poll_interval_sec                 0.5
fastdds_observer.request_timeout_sec               0.2
topics.auto_discover                              true
topics.auto_subscribe_supported_types             true
topics.required_stream_names                      /imu, /joint_states, /odom, /scan
topics.command_names                              /cmd_vel, /cmd_vel_smoothed
topics.include_names / exclude_names / prefixes   배포별 필터
topics.supported_types                            자동 deep monitoring type
services.primary/include/exclude                  주요·표시 정책
services.active_check.enabled                     false
nodes.primary/include/exclude                     주요·표시 정책
nodes.stale_timeout_sec                           5.0
actions.primary/include/exclude                   주요·표시 정책
actions.auto_monitor_status/feedback/result       true
```

loader는 `include`/`exclude`를 우선 key로 읽고 `include_names`/`exclude_names`도 호환한다. 현재 기본 YAML은
후자의 명시적 이름을 사용하므로 key를 정리할 때 loader와 테스트를 함께 갱신한다.
`MONITOR_CONFIG_PATH`, `ROS2_DASHBOARD_WS_ROOT`, `ROS2_DASHBOARD_MONITOR_CONFIG_DIR`,
`INTERFACE_REGISTRY_PATH`, `INTERFACE_PACKAGES_REGISTRY_PATH` 등은 배포 경로 override용이다.

영속 파일은 다음 위치를 사용한다.

```text
ros2_ws/src/ros2_dashboard_monitor/config/monitor.yaml
ros2_ws/src/ros2_dashboard_monitor/config/interface_registry.yaml
ros2_ws/src/ros2_dashboard_monitor/config/interface_packages.yaml
ros2_ws/src/ros2_dashboard_monitor/config/interface_apply_status.yaml
ros2_ws/src/ros2_dashboard_monitor/config/interface_apply_last.log
backend/config/user_preferences.yaml
```

Frontend polling 기본값은 `frontend/.env.example`의 `VITE_TOPIC_POLL_INTERVAL_MS=1000`,
`VITE_DASHBOARD_POLL_INTERVAL_MS=3000`, `VITE_VISUALIZATION_POLL_INTERVAL_MS=5000`이며,
`VITE_API_BASE_URL`이 비어 있으면 현재 page origin을 사용한다.

## 6. Resource Monitoring 정책

### 공통 Graph 원칙

ROS2 CLI 출력 subprocess parsing을 상태 원천으로 사용하지 않는다. rclpy Graph API와 endpoint API,
Action Graph API, Fast DDS observer를 사용한다. 특정 로봇 이름을 보편 조건으로 하드코딩하지 않는다.

Backend `is_primary`가 주요 여부의 최종 값이며 Frontend가 다른 규칙으로 재계산하지 않는다. 사용자 별표,
등록 Interface, include/primary 설정과 resource별 필터 정책을 Monitor에서 합친다.

Topic/Service/Action의 기본 목록 Node 수와 연결 Node 이름은 내부
`/ros2_dashboard_topic_monitor`를 제외한다. `publisher_count`, `subscriber_count`, `server_count`,
`client_count`와 endpoint 진단은 Dashboard 포함 raw Graph 값으로 상세에 유지하고,
`publisher_node_count`, `subscriber_node_count`, `server_node_count`, `client_node_count`를 기본 목록에 쓴다.
Interface Lab에서 사용자가 명시적으로 만든 entity는 실행 사실이므로 별도로 빼지 않는다.

### Topic

지원 type은 기존 discovery/filter/QoS/Subscription 흐름을 재사용한다. 현재 기본 지원 목록은 Image,
CompressedImage, LaserScan, Odometry, Imu, Twist, TwistStamped, JointState, MonitorStatus이며 등록 후 import 가능한
Message type도 합쳐진다.

```text
missing       감시 Subscription 생성 후 stale timeout 동안 한 번도 못 받음
stale         이전 수신은 있으나 마지막 수신 age가 stale timeout 초과
disconnected  이전에 보였던 감시 Topic이 Graph에서 사라짐
waiting       Publisher가 없는 감시 대상
```

일반 Topic의 Subscriber 없음은 장애가 아니다. `command_names`는 정상 대기할 수 있어 수신 Alert에서 제외한다.
수신 Alert는 `required_stream_names` 또는 등록 Interface type인 감시 대상에 한정한다. Publisher가 Graph에 있다는
사실만으로 실제 데이터 수신이나 QoS 호환을 단정하지 않는다.
설정에 이름만 있고 Graph에서 한 번도 발견되지 않은 Topic은 placeholder로 목록이나 Alert에 추가하지 않는다.
`required_stream_names`와 `command_names`는 실제 발견된 Topic의 역할과 Alert 대상 여부를 분류할 때만 사용한다.

### Service

Graph의 Server 존재가 기본 관찰 사실이다. Client 없음은 요청 대기형 Service의 정상 상태다. 자동 active check는
기본 비활성화이며 allowlist와 명시적 안전 요청 없이 일반 Service를 주기 호출하지 않는다. 실제 요청/응답은
Interface Lab의 사용자 Call로 확인하고 최근 상태, 응답, 시간, 오류를 snapshot에 합친다.

### Action

Action Server 발견과 Goal/Result/Cancel Service, Feedback/Status Topic을 조립한다. Feedback/Status는 Graph Topic
QoS와 자동 Subscription을 사용하고, 설정이 켜진 경우 관찰한 Goal의 Result를 조회한다. 사용자가 명시한 Goal의
accept, feedback, result, cancel과 실행 이력을 Interface Lab runtime에서 관리한다. Client 없음은 정상 대기다.

### Node

Node는 Graph에서 보이면 `active`, 이전에 보였으나 사라지면 `disconnected`로 유지해 종료를 알린다. 재등장하면
active로 복귀한다. Graph의 순간 누락과 프로세스 사망을 별도 신호로 확정하는 기능은 없으므로 상태 문구는
“Graph에서 사라짐”의 의미를 유지한다. 기본 목록은 내부 Dashboard/ros2cli Node와 hidden 정책을 적용하며,
상세에는 실제 Pub/Sub, Service Server/Client, Action Server/Client 관계를 보존한다.

## 7. QoS 구조

QoS의 공통 상태는 다음과 같다.

| 상태 | 의미 |
|---|---|
| `compatible` | Dashboard 적용 profile 또는 비교한 endpoint 조합이 모두 호환 |
| `partial` | 선택 profile이 일부 원격 endpoint와만 호환 |
| `incompatible` | 확정 QoS 불일치 |
| `observed` | 상대 endpoint QoS는 발견했지만 적용 profile과의 호환 판정 전 |
| `unknown` | 비교할 QoS를 확인하지 못함 |

`graph_unavailable`은 주로 `qos_detection_source`이며 오류 상태로 승격하지 않는다.

### Topic QoS

`get_publishers_info_by_topic()`과 `get_subscriptions_info_by_topic()`의 Reliability, Durability, History,
Depth, Deadline, Lifespan, Liveliness, Lease Duration을 직렬화한다. Graph의 Publisher×Subscription 조합은
`qos_check_compatible()`로 비교한다. Interface Lab Auto는 로컬 역할 반대편의 외부 endpoint profile 후보 중
가장 많은 endpoint와 호환되는 profile을 적용하고 `compatible/partial/incompatible`을 계산한다.

Dashboard가 실제 만든 Publisher/Subscription에는 RMW incompatible event callback을 연결한다. 이벤트가
발생하면 `qos_detection_source=incompatible_qos_event`로 Graph 추정과 구분한다.

### Service QoS

rclpy Graph만으로 Service Request/Response DDS endpoint QoS를 충분히 얻을 수 없어 Fast DDS observer의
원격 Request Reader와 Response Writer를 사용한다. 한 rclpy Client profile로 두 방향을 함께 만족시키며,
Discovery에서 알 수 없는 History/Depth만 local Service 기본값을 사용한다. endpoint 전체 미발견 또는 단일
profile로 양방향을 만족할 수 없을 때 전체 Service 기본 profile로 fallback하고 사유를 표시한다.

### Action QoS

Action을 하나의 QoS로 합치지 않는다.

```text
Goal Service    Fast DDS Service QoS
Result Service  Fast DDS Service QoS
Cancel Service  Fast DDS Service QoS
Feedback Topic  rclpy Topic endpoint QoS
Status Topic    rclpy Topic endpoint QoS
```

Interface Lab Auto/Manual과 Monitoring 상세 모두 5개 채널을 구분한다. RMW event도 실제 생성된 채널 entity에
반영한다.

### UI와 Alert 연결

Topic/Service/Action 목록은 대표 상태 아래 소형 QoS 배지를 표시한다. `compatible` 초록,
`partial` 노랑, `incompatible` 빨강, `observed` 정보색, `unknown` 회색이다. 상세 상단에는 요약을 두고
endpoint profile과 mismatch policy는 접힌 `QosDetails`에서 본다. QoS Alert 클릭은 대상 상세를 열고
QoS 영역을 펼치며 Action이면 문제 채널로 이동한다.

미수신·timeout만으로 QoS 불일치를 추정하지 않는다. Topic missing/stale의 `reception_diagnosis`는 Subscription
생성 실패와 실제 RMW incompatible event를 확정 근거로, Graph QoS incompatible와 Publisher 존재 여부를 원인
후보로 구분한다. compatible이면 Publisher의 실제 발행과 callback/type 경로를, unknown/observed이면 판단 불가를
안내하지만 QoS 외 원인을 확정하거나 새 Alert code를 만들지는 않는다.

## 8. Alert 생성과 생명주기

Monitor의 `alert_assembler.py`가 resource builder와 `qos_alerts.py` 결과를 합친다. 안정적인 ID 형식은
`<source>:<name>:<code>`이며 Action QoS는 끝에 `:<channel>`을 붙인다.

현재 실제 code는 21종이다.

```text
Topic:
  waiting_publisher, topic_message_missing, topic_stale,
  topic_disconnected, topic_qos_incompatible
MonitorStatus:
  monitor_status_warning, monitor_status_error, monitor_status_critical
Service:
  service_call_timeout, service_call_failed,
  service_disconnected, service_qos_incompatible
Action:
  action_disconnected, action_goal_aborted, action_goal_canceled,
  action_goal_rejected, action_goal_send_failed, action_result_timeout,
  action_result_unavailable, action_qos_incompatible
Node:
  node_stale
```

주요 level과 대상 제한은 다음과 같다.

- Topic missing/stale/waiting은 warning, disconnected는 error다. required stream 또는 등록 감시 대상만 수신
  Alert로 만들며 command Topic은 제외한다.
- Service timeout은 warning, 명시 Call 실패와 allowlisted disconnected는 error다. user category와 hidden 정책을
  적용한다.
- Action canceled/rejected/result timeout은 warning, aborted/send failure/result unavailable와 allowlisted
  disconnected는 error다.
- Node가 이전 발견 후 Graph에서 사라진 `node_stale`은 error다.
- 일반 Topic Subscriber 없음, Service/Action Client 없음, observer 미사용, fallback 자체는 Alert가 아니다.

### QoS Alert

QoS Alert code는 `topic_qos_incompatible`, `service_qos_incompatible`, `action_qos_incompatible`이다.

- `partial`, `unknown`, `observed`, `graph_unavailable`, fallback, 미수신, timeout은 QoS Alert 대상이 아니다.
- 주요/등록/감시 대상과 hidden 제외 정책을 통과한 확정 `incompatible`만 후보가 된다.
- `alerts.qos.incompatible_confirmation_count`의 서로 다른 Graph 갱신에서 연속 확인된 뒤 생성한다. 현재 기본 3회다.
- 일부 endpoint 조합 불일치는 warning이다.
- 실제 RMW incompatible event 또는 Dashboard 적용 profile이 모든 원격 endpoint와 통신 불가능하면 error다.
- Action은 Goal/Result/Cancel/Feedback/Status 채널마다 ID, 메시지, resolve를 분리한다.
- compatible 복귀나 endpoint 소멸로 비교 불가가 되면 후보가 사라져 기존 active Alert가 resolved 된다.

### Active, resolved, recurrence

Monitor는 retained active/resolved 상태를 관리하고 메모리 history를 최대 50건 유지한다. Backend
`AlertHistoryService`는 현재 snapshot과 이전 active set을 비교해 active/resolved를 분리하고 MariaDB에
동기화한다.

```text
첫 발생  같은 alert_key의 미해결 row가 없으면 INSERT
지속     같은 미해결 row 유지, polling마다 INSERT하지 않음
해결     active set에서 사라지면 resolved_at UPDATE
재발     과거 row가 해결된 뒤 새 row INSERT
```

현재 Alert의 “확인 처리”는 Backend 메모리의 dismiss set일 뿐 DB acknowledged 상태가 아니다. 재발 이력과
해결 상태를 바꾸지 않는다. DB 장애 시 monitoring은 계속되고 Backend 메모리 history로 fallback하며 설정된
주기로 DB 재연결을 시도한다.

Frontend Alert 클릭은 Topic/Service/Action/Node 화면의 해당 행과 우측 상세로 이동한다. QoS Alert는 상세
QoS를 자동으로 펼치고 Action channel을 함께 찾는다.

세부 발생·해제 조건은 `docs/alert_policy/00_total_alert.md`와 source별 문서가 기준이다.

## 9. MariaDB 명세

MariaDB는 ROS2 실시간 transport가 아니라 Backend 소유 Alert 이력 저장소다. `backend/app/app_state.py`가
설정에 따라 `MariaDbConnectionFactory`와 `MariaDbAlertRepository`를 조립하고,
`backend/app/alerts/service.py`만 저장·조회 진입점으로 사용한다. Router에서 SQL을 실행하지 않는다.

현재 DB 테이블은 `alert` 하나뿐이다. Backend는 시작 시 `SELECT 1 FROM alert`로 존재를 확인하고 DB 장애 시
fallback하지만 runtime 중 schema를 변경하지 않는다. 제품 설치기는 `backend/schema/001_alert.sql`을 멱등 적용하고
필수 9개 컬럼의 이름·타입·NULL 제약을 검증한다. 기존 schema가 다르면 데이터를 변경하지 않고 설치를 실패시킨다.

| 컬럼 | 타입/제약 | 목적 |
|---|---|---|
| `id` | `BIGINT AUTO_INCREMENT PRIMARY KEY` | 발생 건 DB 내부 PK |
| `alert_key` | `VARCHAR(768) NOT NULL` | 대상·code·채널의 안정적 key |
| `source` | `VARCHAR(64) NOT NULL` | topic/service/action/node/monitor_status |
| `name` | `VARCHAR(512) NOT NULL` | ROS2 resource 이름 |
| `code` | `VARCHAR(64) NOT NULL` | Alert code |
| `level` | `VARCHAR(16) NOT NULL` | warning/error/critical |
| `message` | `TEXT NOT NULL` | 사용자 메시지 |
| `detected_at` | `DATETIME(6) NOT NULL` | 이번 발생 건 최초 감지 시각 |
| `resolved_at` | `DATETIME(6) NULL` | 해결 시각, NULL이면 active |

확정 DDL에는 `id` PK 외 unique key나 secondary index가 없다. 동일 `alert_key`의 active row 중복은 MariaDB
advisory lock `ros2_dashboard.alert.sync`, transaction, `SELECT ... FOR UPDATE`로 방지한다.

별도 `status`, `last_detected_at`, `occurrence_count`, `acknowledged`, `detail/json` 컬럼은 구현되어 있지 않다.
Lifecycle은 `resolved_at IS NULL/IS NOT NULL`로 파생하고, 첫 감지는 `detected_at` 하나만 저장한다. API의
`first_detected_at`, `active`, `alert_state`는 DB record를 변환하면서 만든다.

DB에는 해결 이력을 전체 보존한다. UI/API는 이전 Alert를 `resolved_at DESC`로 50개씩 페이지 조회하고 `name`
부분 검색을 제공한다. `POST /ros/alerts/history/reset`은 해결 row를 삭제한다. KST epoch를 MariaDB
`DATETIME(6)` KST 벽시계로 변환하며 읽을 때도 timezone 없는 값을 Asia/Seoul로 해석한다.

## 10. Camera Topic Image Preview

지원 type은 다음 둘이다.

```text
sensor_msgs/msg/Image
sensor_msgs/msg/CompressedImage
```

Camera도 일반 Topic discovery, filter, QoS 선택, Subscription, latest timestamp, Hz, age, missing/stale 판정을
그대로 사용한다. callback의 경량 snapshot에는 binary `data` 배열을 넣지 않고 header와 metadata만 저장한다.

Raw Image 지원 encoding은 `rgb8`, `bgr8`, `mono8`이다. Raw frame은 브라우저용 PNG로 변환하며 bgr8은 RGB
순서로 바꾼다. CompressedImage는 format 문자열과 magic byte가 일치하는 JPEG/JPG 또는 PNG만 그대로 data URL로
만든다. `compressedDepth`, zstd, theora와 그 밖의 encoding/format은 지원하지 않으며 Topic 전체를 실패시키지
않고 `unsupported_encoding` 또는 `unsupported_format` 상태와 설명을 반환한다.

```text
GET /ros/topics/image-preview?name=<topic>
→ demand TTL 활성화
→ 다음 수신 frame을 rate/size 제한 안에서 변환
→ image/png 또는 image/jpeg base64 data URL 응답
```

`topics.camera_preview` 현재 기본 제한은 TTL 3초, 최소 encode 간격 0.5초, source 4,000,000 bytes,
1920×1080이다. 요청 TTL이 끝나면 저장된 data URL을 제거한다. 이미지 전체는 정기
`/transport/snapshot`, Backend Runtime Cache, `/ws/monitor` payload에 포함하지 않는다. 따라서 Preview는 Topic
상세 화면이 endpoint를 polling할 때만 생성되는 demand-driven 경로다.

Frontend `TopicDetailPanel`은 metadata, 수신 시각, Hz와 이미지를 표시한다. 이미지를 클릭하면 닫기, 확대/축소,
맞춤/원본 보기 기능이 있는 크게 보기 overlay를 연다.

`ros2_dashboard_demo_nodes/demo_camera_publisher.py`는 외부 이미지 없이 코드로 만든 패턴을
`/demo_camera/image_raw`와 `/demo_camera/image_compressed`에 발행한다. Gazebo camera는 예를 들어
`/camera/image_raw`, 실제 USB camera는 별도 `v4l2_camera` 같은 ROS2 camera node가 `/image_raw` 등을 발행해야
Dashboard가 구독할 수 있다. Dashboard는 물리 카메라를 ROS2 Topic으로 변환하는 driver가 아니다.

## 11. Interface Lab

Interface Lab은 자동 Monitoring과 분리된 사용자 명시 실행 도구다. 화면 진입이나 Graph 발견만으로 Publish,
Call, Goal을 보내지 않는다.

### 저장 구조

```text
ros2_ws/src/uploaded_interfaces/generated_interfaces/
  manual definition과 단일 msg/srv/action을 모은 실제 ROS package

ros2_ws/src/uploaded_interfaces/packages/<package_name>/
  사용자가 올린 완성 ROS interface package
```

`uploaded_interfaces` 상위 폴더 자체는 ROS package가 아니다. 각 실제 package만 `package.xml`을 가지며
`colcon list`에 독립 package로 보여야 한다. Registry, package registry, apply status와 원본 Interface를
빌드 과정에서 삭제하거나 빈 파일로 덮어쓰지 않는다.

### Management와 apply

현재 기능은 manual type/definition 등록·검증·수정·삭제, 단일 Interface 파일 upload, package zip/folder upload,
Registry/Package 목록, CMake/package.xml 재생성, colcon build, import check, apply status를 포함한다. Apply 성공 후
응답을 전송하고 Monitor가 동일 PID로 재실행되어 새 Python interface를 import한다. Backend와 Frontend는 유지되고
Backend polling이 재연결한다.

upload는 path traversal, package 이름, archive/file size, extension과 ROS interface 문법을 검증한다. 생성물
`install/share`를 영속 저장소로 사용하지 않는다.

### 실행과 수신

```text
Topic    1회 Publish, 지속 Publish, Receive start/stop, 수신 history
Service  Call, timeout, response/error, call/receive history
Action   Goal, accept, Feedback, Result, 활성 Goal Cancel, goal/receive history
```

Message/Request/Goal은 schema 기반 입력을 실제 generated ROS object로 변환한다. 실행 결과와 raw JSON은 history에
남기고 화면에서 선택 조회한다. 현재 runtime 상한은 Topic Publish 100건, Topic Receive 기본/최대 500건,
Service Call과 Action Goal 각각 30건이다. 이력은 MariaDB Alert 테이블과 연결되지 않는 Monitor runtime 데이터다.

Topic, Service, Action 실행에는 Auto/Manual QoS가 있다. Manual은 Reliability, Durability, History, Depth,
Deadline, Lifespan, Liveliness, Lease Duration을 설정한다. Topic Publish/Receive와 Service Request/Response,
Action 5채널을 독립 설정하거나 UI의 실행/수신 연동으로 맞출 수 있다. entity pool은 name/type뿐 아니라 QoS
fingerprint가 같을 때만 재사용한다.

### 현재 UI 구조

초기 화면은 제목·주의사항, 4개 요약, 항상 펼쳐진 Interface 관리, 검색·상태 필터와
전체/Topic/Service/Action/Package 목록으로 구성된다. 항목을 선택하면 목록 위치를 유지한 채 우측 상세가 열리고
`통신 상세 / History / 고급 정보 / 실행`을 제공한다. 실행 버튼은 해당 Topic/Service/Action 실행 workbench를
열고 각 workbench와 수신 workbench는 명시적 닫기 동작을 가진다. QoS/Graph/schema/raw text는 상세 또는 고급
영역에 두며 기본 목록은 이름, type, 대표 상태와 주요 동작 중심이다. Schema가 object/array JSON 입력을 만들면
Topic Publish, Service Request, Action Goal 모두 공통 입력 컴포넌트를 사용하고 필드별 크게 보기/줄이기를 제공한다.

## 12. Web, HTTPS와 WSS

개발 HTTP 화면은 `ws://`를 사용할 수 있다. HTTPS 화면은 반드시 `wss://`를 사용한다. Frontend
`monitorWebSocketUrl()`은 `window.location.protocol`이 HTTPS면 WSS, 아니면 WS를 선택하고
`VITE_API_BASE_URL`이 비어 있으면 현재 host의 `/ws/monitor`로 연결한다. 연결 종료 후 현재 2.5초 뒤 재연결한다.

운영/외부 접속의 TLS는 Nginx에서 종료한다.

```text
Browser HTTPS / WSS
→ Nginx :443
  /                    → production static Frontend `/var/lib/ros2-dashboard/frontend`
  /health, /ros        → FastAPI 127.0.0.1:8000
  /user-preferences    → FastAPI 127.0.0.1:8000
  /ws/monitor          → FastAPI WebSocket 127.0.0.1:8000
```

FastAPI, Frontend build, Monitor에 인증서를 직접 넣지 않는다. 제품 설치 스크립트는 self-signed 인증서를 만들 수
있으나 Browser가 인증서를 신뢰하지 않으면 HTTPS/WSS가 거부될 수 있다. Nginx 설정과 실행 기준은
`docs/deployment/https_wss.md`, `config/nginx`, `scripts/install_local_https.sh`를 따른다.

WebSocket snapshot은 Backend의 마지막 Monitor cache를 전송하며 Camera binary는 포함하지 않는다. REST polling은
WebSocket 연결 실패 시에도 화면의 상태 조회 경로로 유지한다.

## 13. API와 transport 경계

공개 Browser API는 Backend 8000이 소유한다.

```text
GET  /health
GET  /ros/topics, /ros/services, /ros/actions, /ros/nodes
GET  /ros/alerts, /ros/alerts/history
POST /ros/alerts/current/reset, /ros/alerts/history/reset
GET/PUT/DELETE /user-preferences/...
WS   /ws/monitor
```

그 밖의 `/ros/...` Interface Lab과 Camera preview 요청은 Backend `monitor_proxy`가 method/body/content-type을
보존해 Monitor로 전달한다. Monitor transport는 monitoring query, Interface management/package/apply,
Topic execution/receive, Service execution, Action execution router를 소유한다. 기존 공개 path와 JSON response
key는 호환을 유지한다.

Monitor와 Backend는 Python singleton이나 메모리를 공유하지 않는다. MariaDB를 snapshot 전달 수단으로 사용하지
않고 localhost HTTP만 사용한다.

## 14. 실행과 검수

각 새 터미널은 ROS2 base와 workspace install을 다시 source한다.

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

제품 최초 설치는 `sudo ./scripts/install.sh`, 평상시 실행·상태·종료는 각각 `scripts/start.sh`, `status.sh`,
`stop.sh`를 사용한다. 제품 모드는 `ros2-dashboard.target` 아래 Monitor와 Backend systemd service 및 Nginx
production static Frontend를 사용한다. MariaDB와 Nginx는 공용 service로 간주해 `stop.sh`가 중지하지 않는다.
설치기는 시스템 locale이나 NetworkManager/netplan 설정을 바꾸지 않고 설치 프로세스에만 `C.UTF-8`을 적용한다.
`start.sh`를 실행한 터미널에 `ROS_DOMAIN_ID`가 명시돼 있으면 `/etc/ros2-dashboard/dashboard.env`와 동기화하고
값이 바뀐 Monitor만 재시작한다. 터미널 값이 없으면 기존 제품 Domain 설정을 유지한다.

개발 통합 실행은 `./scripts/run_dashboard_stack.sh`, 종료는 `./scripts/stop_dashboard_stack.sh`를 사용한다. Vite는
5173 strict port를 사용하며 제품 서비스와 동시에 실행하지 않는다. ROS demo는 다음 package launch를 사용한다.

```bash
ros2 launch ros2_dashboard_monitor dashboard_monitor.launch.py
ros2 launch ros2_dashboard_demo_nodes demo_communication.launch.py
```

변경 위험에 맞춰 최소한 다음을 검증한다.

```bash
python3 -m compileall backend/app
python3 -m compileall ros2_ws/src/ros2_dashboard_monitor

cd ros2_ws
source /opt/ros/jazzy/setup.bash
colcon list
colcon build --symlink-install
source install/setup.bash
colcon test
colcon test-result --verbose

cd backend
.venv/bin/python -m pytest -q tests

cd frontend
npm run test:unit
npm run lint
npm run build
```

문서만 수정한 작업은 경로·설정·코드 grep 대조와 `git diff --check`를 우선하고 불필요한 전체 build는 생략할 수
있다. 최신 전체 test 수치는 고정 문서에 복제하지 않고 `.codex/CURRENT_STATUS.md`를 확인한다.

## 15. 코드와 파일 작업 규칙

- 불필요한 대규모 구조 변경을 하지 않는다.
- 기존 API path와 응답 key를 유지한다.
- ROS2 실행은 Monitor, Web/DB는 Backend, 표현은 Frontend 책임으로 둔다.
- 자동 Monitoring과 사용자 명시 실행을 섞지 않는다.
- ROS2 CLI subprocess parsing을 구현 원천으로 사용하지 않는다.
- 특정 로봇 Topic/Service/Action 이름을 범용 로직에 하드코딩하지 않는다.
- Backend Router에 SQL, YAML 처리, ROS2 실행 또는 긴 정책 계산을 넣지 않는다.
- 설정 파일과 key가 없으면 중앙 loader의 검증된 safe default를 사용한다. 기능 파일이 각자 env/YAML을 읽지 않는다.
- 생성물 폴더를 직접 수정하지 않는다.
- dirty worktree의 사용자 변경을 보존하고 관련 없는 파일을 되돌리지 않는다.
- 사용자가 요청하지 않은 `git commit`, `git push`를 하지 않는다.
- Interface 삭제, history 초기화, package 교체 등 파괴 작업은 정확한 대상을 확인하고 기존 안전 절차를 유지한다.

Frontend 대형 기능은 `features/<domain>`과 shared component로 나누되 줄 수만 보고 의미 있는 작은 파일을 합치지
않는다. Backend 의존 방향은 Router → Service → Repository/MonitorClient를 유지한다. 구조 이동과 동작 변경은
한 번에 섞지 않고 feature별 API와 UI 회귀를 확인한다.

## 16. 문서 기준과 현재 제한

상세 문서는 다음을 사용한다.

```text
docs/architecture/monitor_backend_transport.md  프로세스와 snapshot 경계
docs/architecture/configuration.md              설정 source와 override
docs/alert_policy/00_total_alert.md             실제 Alert code 전체
docs/alert_policy/05_alert_lifecycle.md         MariaDB DDL과 lifecycle
docs/qos/dds_qos.md                             QoS 비교·Auto/Manual 정책
docs/qos/fastdds_passive_observer.md            observer 가시성·제한
docs/deployment/https_wss.md                    HTTPS/WSS/Nginx
docs/docs2/                                     resource별 실제 흐름
```

현재 구현 제한을 완료 기능처럼 쓰지 않는다.

- Backend runtime migration은 없다. 제품 설치기만 `backend/schema/001_alert.sql`을 멱등 적용하고 기존 필수
  schema가 다르면 데이터를 변경하지 않고 실패한다.
- Alert DB에는 acknowledgement, occurrence count, last detected, JSON detail 컬럼이 없다.
- Fast DDS observer는 History/Depth를 발견하지 못하고 다른 RMW adapter가 없다.
- QoS compatible인데 미수신이면 Publisher 실제 발행과 callback/type 경로를 점검하도록 안내하지만 그 원인을
  Dashboard가 확정하지는 않는다.
- Camera는 rgb8/bgr8/mono8와 JPEG/PNG만 지원한다.
- Dashboard는 물리 카메라 driver가 아니며 ROS2 camera publisher가 별도로 필요하다.
- MariaDB는 Alert 이력만 저장하며 Interface Lab 실행 history의 영속 DB가 아니다.
- 현재 Ubuntu 24.04 host의 설치·재설치·장애 fallback/reconnect와 재부팅 자동 복구는 검증했다. dependency가
  전혀 없는 별도 Fresh Ubuntu 최초 설치만 acceptance 미검증 항목이다.

문서와 코드가 충돌하면 코드를 먼저 확인하고 같은 작업에서 기존 문구를 직접 수정한다. “최신 내용”을 문서
끝에 덧붙여 구 구조와 신 구조를 병렬로 남기지 않는다.
