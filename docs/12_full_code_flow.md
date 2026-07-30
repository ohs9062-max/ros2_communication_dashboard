# ROS2 Dashboard 전체 코드 흐름

이 문서는 2026-07-30의 실제 코드 기준으로, 브라우저 요청이 ROS2 통신을 거쳐 다시 화면에 표시될 때까지를 추적한다. `Runtime`은 특정 기능의 실제 동작을 담당하는 객체, `Cache`는 최신 결과를 Backend 메모리에 보관한 값, `Snapshot`은 특정 시점의 상태 묶음이다.

## 1. 프로젝트 전체 실행 구조

### 1.1 큰 흐름

```text
Vite + React
→ REST 요청 / WebSocket 연결
→ FastAPI Router
→ RosMonitor public method
→ Topic / Service / Action / Node Runtime cache
→ rclpy Node와 ROS2 Graph/통신
→ JSON 응답
→ React Hook state
→ Page와 Component 렌더링
```

### 1.2 Backend 시작과 종료

| 단계 | 역할·실행 시점 | 호출과 다음 단계 | 실제 코드 |
|---|---|---|---|
| singleton 준비 | 모듈 import 시 설정과 `RosMonitor`를 한 번 만든다 | `load_backend_config()` → `RosMonitor(config)` | `backend/src/ros2_dashboard_backend/ros2_dashboard_backend/app_state.py L1-L10` |
| Runtime 조립 | `RosMonitor` 생성 시 공통 `threading.Lock`과 모든 Runtime을 만든다 | 같은 lock을 Topic, Service, Action, Node와 Interface Lab 실행 Runtime에 전달 | `backend/src/ros2_dashboard_backend/ros2_dashboard_backend/ros_monitor.py L37-L82` |
| FastAPI lifespan | Uvicorn worker 시작·종료 때 실행한다 | startup에서 `start()`, shutdown에서 `stop()` | `backend/src/ros2_dashboard_backend/ros2_dashboard_backend/main.py L20-L27` |
| ROS 시작 | `rclpy.init()` 후 monitor Node를 만든다 | Node → timer → 최초 update → spin thread | `backend/src/ros2_dashboard_backend/ros2_dashboard_backend/ros_monitor.py L84-L98` |
| 주기 timer | `poll_interval_sec`마다 Graph를 다시 읽는다 | `_update_graph()` 호출 | `backend/src/ros2_dashboard_backend/ros2_dashboard_backend/ros_monitor.py L84-L98`, `L681-L688` |
| 종료 | worker 종료 또는 reload 때 실행한다 | timer 취소 → 실행 Runtime clear → `rclpy.shutdown()` → join → Node destroy | `backend/src/ros2_dashboard_backend/ros2_dashboard_backend/ros_monitor.py L100-L124` |

핵심 시작 코드는 다음과 같다.

```python
@asynccontextmanager
async def lifespan(_: FastAPI):
    ros_monitor.start()
    try:
        yield
    finally:
        ros_monitor.stop()
```

파일: `backend/src/ros2_dashboard_backend/ros2_dashboard_backend/main.py L20-L27`

`--reload`를 쓰면 worker와 lifespan도 다시 만들어진다. 따라서 FastAPI만 재시작되는 것이 아니라 rclpy, Node, timer, spin thread도 같이 내려갔다가 올라온다.

### 1.3 Frontend 시작

`frontend/src/main.jsx L1-L10`이 React root를 만들고 `App`을 렌더링한다. `frontend/src/App.jsx L20-L85`는 URL을 화면 id로 바꾸고, 필요한 dashboard hook과 WebSocket hook을 켠 뒤 Page에 전달한다. 실제 route 목록은 `frontend/src/hooks/useBrowserRoute.js L1-L51`에 있다.

Frontend 실행은 Vite 개발 서버, Backend 실행은 Uvicorn이다. React는 ROS2를 직접 읽지 않는다.

## 2. Frontend 요청부터 화면 반영까지

### 2.1 공통 요청 계층

`frontend/src/api/rosApi.js L1-L38`의 공통 fetch가 API base URL, HTTP 오류, JSON 파싱을 담당한다. `usePolling()`은 첫 요청 후 interval마다 반복하고, 이전 요청이 끝나지 않았으면 중복 요청을 건너뛴다. 성공 시 `data`, `lastUpdated`를 갱신하고 `error=null`로 복구한다.

파일: `frontend/src/hooks/usePolling.js L3-L84`

### 2.2 화면별 끝까지 추적

| 화면 | Page → Hook → API/URL | Router → Runtime cache | 화면 표시 |
|---|---|---|---|
| Overview | `OverviewPage.jsx L18-L187` ← App이 Topic/Service/Action/Node/Alert hook 결과 전달 | `/ros/topics`, `/ros/services`, `/ros/actions`, `/ros/nodes`, `/ros/alerts` → `routers/monitoring.py L16-L109` | 각 응답 `meta`와 주요 항목을 카드·차트로 집계. active Alert만 현재 경고/오류에 포함 |
| Topics | `TopicsPage` → `useTopicDashboard` → `fetchTopics`, `fetchTopicLatest`, `fetchTopicHz` | GET `/ros/topics`, `/latest`, `/hz` → `topic_snapshot/latest/hz` → `TopicRuntime` cache | `TopicTable`의 status, count, Hz, latest, last check와 `TopicDetailPanel` |
| Services | `ServicesPage` → `useServiceDashboard` → `fetchServices` | GET `/ros/services` → Service cache + 최근 Interface Lab 호출 summary merge | `ServiceTable`, `ServiceDetailPanel`이 Graph server 상태와 최근 사용자 호출 결과를 분리 |
| Actions | `ActionsPage` → `useActionDashboard` → `fetchActions` | GET `/ros/actions` → Action Graph/관찰 cache + 사용자 Goal summary merge | `ActionTable`, `ActionDetailPanel`의 goal, feedback, result, 상태 |
| Nodes | `NodesPage` → `useNodeDashboard` → `fetchNodes` | GET `/ros/nodes` → Node 관계 cache | Node status와 pub/sub/service/action 관계 |
| Visualization | `VisualizationPage` → `useVisualizationGraph` → 네 목록 API | 별도 Graph API가 아니라 네 REST snapshot을 조합 | `graphTransform.buildCommunicationGraph()`가 React Flow nodes/edges 생성 |
| Alerts | `AlertsPage`가 App에서 받은 alert dashboard 사용 | GET `/ros/alerts` → `RosMonitor.alerts()` | `data`는 현재/최근, `history`는 해결 이력. active/resolved 탭과 severity 표시 |
| Interface Lab | `InterfaceLabPage` → 다수 `rosApi` 함수 | `/ros/interfaces/*` router → management/apply/execution Runtime | 등록·업로드·Apply·Publish/Receive/Call/Goal과 history |
| Settings | 없음 | route, Page, endpoint 없음 | 구현된 기능으로 설명하면 안 됨 |

주요 실제 위치:

- Topic: `frontend/src/hooks/useTopicDashboard.js L17-L178`, `frontend/src/pages/TopicsPage.jsx L14-L185`, `frontend/src/components/TopicTable.jsx L46-L217`
- Service: `frontend/src/hooks/useServiceDashboard.js L7-L78`, `frontend/src/pages/ServicesPage.jsx L50-L320`
- Action: `frontend/src/hooks/useActionDashboard.js L7-L74`, `frontend/src/pages/ActionsPage.jsx L17-L249`
- Node: `frontend/src/hooks/useNodeDashboard.js L6-L66`, `frontend/src/pages/NodesPage.jsx L16-L216`
- Visualization: `frontend/src/hooks/useVisualizationGraph.js L18-L274`, `frontend/src/utils/graphTransform.js L18-L175`
- Alerts: `frontend/src/pages/AlertsPage.jsx L5-L102`
- Interface Lab: `frontend/src/pages/InterfaceLabPage.jsx L45-L538`

예를 들어 Topic 목록은 다음 경로를 지난다.

```text
TopicsPage
→ useTopicDashboard
→ fetchTopics()
→ GET /ros/topics
→ routers/monitoring.py:get_topics()
→ ros_monitor.topic_snapshot()
→ TopicRuntime.snapshot()
→ {success, data, meta}
→ usePolling.data
→ TopicTable
```

## 3. Backend 전체 수집 흐름

### 3.1 실제 호출 순서

`RosMonitor._update_graph()`의 순서는 다음과 같다.

```python
self._node_runtime.update()
self._topic_runtime.update()
self._service_runtime.update()
self._action_runtime.update()
```
0. **토폴로지** : ROS2 네트워크의 전체 구조 (Node, Topic, Service, Action 관계도)
0. **lamda** : 익명 함수 lambda는 Python에서 이름 없이 짧게 만드는 함수야.
0. **rclpy**Python에서 ROS2를 사용하게 해주는 전체 라이브러리
0. **rclpy.node.Node** 객체가 제공하는 Graph 조회 메서드로 읽음
0. **lifespan** FastAPI 애플리케이션의 시작과 종료 생명주기를 관리하는 함수
0. **Cache** 최신 상태를 보관하는 저장소, **Snapshot** 그 Cache를 특정 시점에 읽어 만든 응답 데이터.
0. **Runtime** :프로그램이 실행 중일 때 실제로 동작하면서 ROS2 정보를 수집하고 상태를 계산해 Cache에 저장하는 담당 객체.

파일: `backend/src/ros2_dashboard_backend/ros2_dashboard_backend/ros_monitor.py L681-L688`
1. **Node**: Node 목록과 pub/sub/service/action 관계를 읽어 Node cache를 교체한다.
2. **Topic**: Topic 목록, 타입, publisher/subscriber 수를 읽고 필요한 subscription을 생성·제거한다.
3. **Service**: Service 이름/타입과 server/client 수를 읽는다.
4. **Action**: Action 이름/타입과 server/client 수를 읽고 status/feedback 관찰 subscription을 맞춘다.
5. **Alert**: 별도 timer 단계가 아니다. `/ros/alerts` 또는 WebSocket snapshot 요청 시 각 Runtime alert를 모아 lifecycle cache에 반영한다.
6. **WebSocket**: 연결마다 1초 간격으로 그 시점 cache의 경량 snapshot을 만든다.

Service `update_active_checks()`는 `service/runtime.py L154-L159`에 남아 있지만 위 순서에 호출이 없다. `monitor.yaml`도 `enabled: false`다.

### 3.2 Lock과 cache 갱신

Graph API 호출은 대체로 lock 밖에서 하고, 이전 cache 복사와 최종 교체를 lock 안에서 한다. subscription callback은 spin thread에서 같은 lock으로 latest와 timestamp를 한 번에 갱신한다. REST thread가 중간 상태를 읽지 않게 하기 위한 구조다.

## 4. Topic Runtime 핵심 로직

### 4.1 `/odom`이 화면에 오기까지

```text
node.get_topic_names_and_types()
→ include/exclude 및 exclude_types
→ 지원 full_type 확인
→ get_message(full_type)
→ create_subscription()
→ callback(message)
→ ROS message를 JSON-safe dict로 변환
→ latest + last_received_at + timestamps 저장
→ Hz/stale/Alert 계산
→ REST/WebSocket
→ TopicTable/Detail
```

- Graph 발견과 item 생성: `topic/runtime.py L125-L231`
- 설정 로드·병합: `config_loader.py L62-L94`, `L191-L281`, 명시적 빈 목록과 fallback 구분 `L399-L411`
- Runtime의 include/exclude 및 지원 타입 적용: `topic/runtime.py L141-L162`, `L320-L370`
- subscription 조정과 내부 endpoint 판정: `topic/runtime.py L372-L505`
- callback: `topic/runtime.py L506-L523`
- 변환: `topic/preview.py L1-L21`, `topic/subscriptions.py L1-L60`

지원 타입은 `monitor.yaml`의 `topics.supported_types`와 import 가능한 `interface_registry.yaml`, `interface_packages.yaml`의 msg full type을 합친다. Graph type과 exact match하고 Python import가 가능해야 자동 subscription 대상이다. `auto_discover`가 꺼지면 명시 include 밖 자동 발견을 하지 않고, `auto_subscribe_supported_types`가 꺼지면 상세 구독을 만들지 않는다.

Topic 제외는 `exclude_names`, `exclude_prefixes`, `exclude_types`를 Runtime에서 적용한다. 설정 key가 없을 때만 Python fallback을 사용하며 `exclude_names: []`은 명시적인 빈 정책으로 유지한다. Service도 `exclude_names`와 `exclude_prefixes`를 적용하고 exclude가 include보다 우선한다.

### 4.2 publisher/subscriber 수

Graph의 `count_publishers()`와 `count_subscribers()`를 호환 endpoint 수로 저장한다. 기본 목록의 Publisher/Subscriber 수는 공통 Node 관계 인덱스에서 해당 Topic과 역할을 가진 고유 Node 수를 센다.

```text
subscriber_node_count
= 고유 subscriber Node 수

subscriber_endpoint_count
= 전체 subscriber endpoint 수

external_subscriber_endpoint_count
= get_subscriptions_info_by_topic() 결과 중 소유 Node가 Dashboard 내부 Node가 아닌 endpoint 수
```

같은 Dashboard Node가 자동 감시와 Interface Lab Receive로 동일 Topic을 두 번 구독하면 Node 수는 1, endpoint 수는 2, 내부 endpoint 수는 2, 외부 endpoint 수는 0이다. 기존 `publisher_count`, `subscriber_count`, `external_subscriber_count`는 API 호환용 endpoint 필드로 유지한다.

파일: `topic/runtime.py L164-L173`, endpoint 소유 Node 판정 `L406-L467`, 공통 관계 인덱스 `topology.py L19-L54`, Topic 병합 `ros_monitor.py L126-L171`

### 4.3 Hz의 실제 공식

callback은 wall-clock epoch seconds인 `time.time()` 값을 `timestamps`에 추가한다. 추가할 때 `now - hz_window_sec`보다 오래된 값을 제거한다.

```python
message_count = len(timestamps)
hz = round(message_count / window_sec, 2)
```

파일: `topic/hz.py L14-L22`, `L42-L70`

현재 `hz_window_sec=5.0`이므로:

- 첫 메시지 직후: `1 / 5 = 0.2 Hz`
- 5초 창에 5개: `1.0 Hz`
- 순간적으로 20개: 잠시 `4.0 Hz`
- 메시지가 끊겨 모든 timestamp가 창 밖으로 나가면: `0.0 Hz`
- 지원하지 않거나 상세 구독이 없으면: Hz endpoint가 unsupported 상태를 반환하며 UI는 미지원으로 표시

즉 `(개수-1)/(마지막-첫 timestamp)` 방식도, 실제 관측시간으로 나누는 방식도 아니다. 고정된 설정 창으로 나눈다. 짧은 시작 구간에서는 실제 발행률보다 낮게 보일 수 있다.

### 4.4 latest와 stale

callback은 변환된 message, 수신 epoch, timestamp window를 같은 cache entry에 저장한다. custom msg는 `message_to_ordereddict()` fallback을 사용하므로 generated message를 dict로 내보낼 수 있다.

`last_received_at`이 없고 publisher가 계속 있으면 timeout 뒤 `topic_message_missing`, 마지막 수신 후 `stale_timeout_sec`(현재 3초)를 넘으면 `topic_stale`이다. command 성격 Topic은 지속 발행이 아닐 수 있어 missing/stale 기본 대상에서 제외된다.

파일: `topic/alerts.py L27-L158`, `L161-L281`

지속 stream과 command Topic 이름은 `monitor.yaml`의 `topics.required_stream_names`, `topics.command_names`에서 읽는다. 항목이 없으면 빈 목록이며, 등록 Interface 타입을 Alert 대상으로 보는 기존 조건은 유지한다.

## 5. stale와 disconnected 상태

### 5.1 Topic

```text
정상 수신
→ now - last_received_at > stale_timeout_sec
→ topic_stale active Alert
→ 새 메시지 수신
→ 즉시 resolved
→ resolved_at부터 60초 보관
→ 60초 뒤 lifecycle cache에서 제거
```

Graph에서 Topic 자체가 사라지면, 이전에 발견된 주요 Topic은 `disconnected`와 `topic_disconnected`가 된다. “비정상 종료” 여부는 Graph만으로 알 수 없으므로 종료 감지라고 표현한다.

### 5.2 Node

Node의 `last_seen_at`은 Graph에서 보일 때 갱신된다. 하지만 현재 `NodeRuntime`은 `stale_timeout_sec`로 시간 차를 계산하지 않는다. 한 번 발견된 Node가 다음 Graph snapshot에서 사라지면 즉시 `disconnected`로 보존한다.

파일: `node/runtime.py L72-L159`, `resource_state.py L11-L44`

따라서 문서나 UI에서 “Node stale 5초 후”라고 설명하면 현재 코드와 다르다. 호환 Alert code는 `node_stale`지만 의미는 Graph 연결 종료 감지다.

### 5.3 오탐 가능성

이벤트가 있을 때만 발행하는 Topic을 지속 stream으로 등록하면 3초 뒤 stale가 될 수 있다. 현재 완화는 command Topic 제외와 감시 대상 제한이다. YAML에 등록하는 순간 모든 msg가 주기 stream이라는 뜻은 아니므로 운영 설정에서 주기성을 검토해야 한다.

## 6. Service Runtime 핵심 로직

### 6.1 자동 발견과 목록

`get_service_names_and_types()`로 Service를 찾고 server/client 수를 수집한다. 상태는 server가 있으면 `active`, server 없이 client만 있으면 `waiting_server`, 둘 다 없으면 `inactive`, 잘못된 type은 `unknown`, 이전 존재 후 사라지면 `disconnected`다.

파일: `service/runtime.py L90-L153`, `service/models.py L28-L60`

YAML의 import 가능한 srv와 Graph type이 exact match하면 `allowlisted=true`로 주요 Service 판정에 쓰인다. 등록만으로 자동 호출하지 않는다.

### 6.2 active check와 사용자 Call의 차이

- background active check: 호환 클래스와 응답 field가 남아 있으나 timer 경로에서 실행되지 않는다.
- Interface Lab Service Call: 사용자가 버튼을 눌렀을 때만 request를 만든다.

사용자 호출 경로는 `routers/service_execution.py L20-L75` → `RosMonitor.call_registered_service()` → `ServiceCallRuntime.call_service()`다.

### 6.3 응답시간의 실제 계산

`time.time()`을 시작 전에 저장하고 `call_async()` future가 끝나거나 timeout/예외가 발생한 시점에 다시 읽는다.

```text
elapsed_ms = (time.time() - started_at) × 1000
```

파일: `interface_lab/execution/service_call_runtime.py L85-L188`

- 성공: response를 JSON-safe dict로 저장, `success=true`, `elapsed_ms` 저장
- response 안의 `success=false`: 호출 전송은 됐지만 `call_status=failed`
- timeout: `event.wait(timeout_sec)`가 false, `call_status=timeout`, 기다린 elapsed 저장
- 예외: `call_status=failed`, error 문자열과 그때까지 elapsed 저장
- history: 메모리 event 목록에 남고 REST history로 조회

최근 호출 summary와 공통 관계 인덱스의 Server/Client Node 수는 `ros_monitor.py L173-L232`에서 Service Graph item에 병합한다. 기존 endpoint count는 호환·상세 진단용으로 유지한다. Frontend는 `response_time_ms`/`elapsed_ms`, request, response, call status를 목록·상세에 표시한다.

Service timeout/실패 Alert는 `service/alerts.py L10-L67`에서 최근 사용자 호출을 기준으로 만든다. 서버가 Graph에 있다는 이유로 timeout을 정상으로 덮지 않는다.

## 7. Action Runtime 핵심 로직

### 7.1 관찰과 사용자 실행을 분리

- `ActionRuntime`: Graph에서 Action server/client를 발견하고 `_action/status`, `_action/feedback`을 관찰한다.
- `ActionResultRuntime`: 관찰한 terminal goal id에 대해서만 result를 조회한다.
- `ActionGoalRuntime`: Interface Lab에서 사용자가 누른 Goal만 새로 보낸다.

위치는 각각 `action/runtime.py L88-L165`, `L285-L461`, `action/result_runtime.py L82-L224`, `interface_lab/execution/action_goal_runtime.py L91-L239`다.

### 7.2 Goal/Feedback/Result

1. `ActionClient.send_goal_async()`로 Goal을 보낸다.
2. 수락 future가 timeout이면 acceptance timeout, 거절이면 `accepted=false/rejected`.
3. feedback callback은 ROS feedback을 JSON-safe dict로 바꾸어 history와 latest feedback에 저장한다.
4. accepted goal의 result future를 기다려 status code와 result payload를 저장한다.
5. `elapsed_ms`는 Goal 시작부터 현재 완료/실패 시점까지의 wall-clock 차이다.

ROS status는 accepted, executing, canceling, succeeded, canceled, aborted로 변환한다. 사용자 실행 event에는 `sent_at`, `accepted`, `goal`, `feedback`, `result`, `status`, `elapsed_ms`, `error/result_error`가 있다. `completed_at`과 별도 `duration` 이름의 필드는 현재 없다.

cancel 전송 UI/API는 현재 지원하지 않는다. 관찰된 `canceled` 상태는 표시·Alert 가능하지만 Dashboard가 cancel request를 보내지는 않는다.

최근 사용자 Goal summary와 공통 관계 인덱스의 Server/Client Node 수는 `ros_monitor.py L274-L318`에서 Graph item에 병합되고 `/ros/actions`로 전달된다. Action Alert는 aborted, canceled, rejected, Goal 전송 실패, result timeout/수신 실패를 구분한다.

파일: `action/alerts.py L21-L175`

## 8. Node Runtime 핵심 로직

`get_node_names_and_namespaces()`로 name과 namespace를 받고 `/` 규칙으로 `full_name`을 만든다. 이어 각 Node별 API로 publisher, subscriber, service server/client, action server/client 관계를 모은다.

파일: `node/runtime.py L72-L228`, 관계 item 조립 `node/discovery.py L1-L69`

현재 Graph에서 보이면 `ever_discovered=true`, `last_seen_at=now`다. 사라진 Node를 cache에서 즉시 버리지 않는 이유는 “이전에는 있었지만 지금 연결이 끊김”을 표시하고 Alert와 Visualization에 남기기 위해서다. Backend 재시작 시 이 메모리 이력은 초기화된다.

Frontend `nodeFilters.js`는 Node의 관계 full type을 주요 Topic/Service/Action type과 exact match해 주요 Node를 판단한다. Nav2/TurtleBot 이름 fallback은 사용하지 않으며 Backend `is_internal`로 Dashboard Node를 숨긴다. Visualization은 Node 관계 배열을 edge로 바꾼다.

Topic, Service, Action 기본 목록은 이 Node 관계 cache를 `topology.py L19-L54`에서 `(역할, 리소스 전체 이름, full_type)`별 고유 Node 집합으로 역집계한다. 따라서 리소스 탭의 Node 수와 Node 탭의 고유 리소스 관계 수는 같은 Topology를 반대 방향에서 표시한다.

### 8.1 화면별 주요/전체/숨김 필터 한 문장 요약

Topic은 지원·등록 타입이거나 실제 통신·상세 감시 흔적이 있는 비내부 Topic을 주요 항목으로 보고 전체 또는 숨김 포함 시 Backend가 반환한 모든 Topic을 표시하며,

Service는 등록 타입·대기/오류·숨김 아닌 사용자 Service를 주요 항목으로 보고 전체에서는 내부·Parameter·Action 내부·관리 Service를 제외하고 내부/관리 포함에서 모두 표시하며,

Action은 등록 타입이거나 Goal·Feedback·Result 관찰 흔적이 있는 Action을 주요 항목으로 보고 전체 또는 대기 Action 포함 시 발견된 모든 Action을 표시하고, Node는 등록·지원 Topic/Service/Action 타입 관계가 있거나 종료가 감지된 비내부 Node를 주요 항목으로 보고 전체에서는 내부 Node를 제외하며 숨김 포함에서 Dashboard 내부 Node까지 모두 표시한다.

파일: 공통 등록 판정 `frontend/src/utils/primaryFilters.js L1-L78`, Topic 적용 `frontend/src/pages/TopicsPage.jsx L33-L83`, Service 적용 `frontend/src/pages/ServicesPage.jsx L68-L110`, `L241-L319`, Action 적용 `frontend/src/pages/ActionsPage.jsx L35-L74`, `L180-L223`, Node 적용 `frontend/src/utils/nodeFilters.js L1-L72`, `frontend/src/pages/NodesPage.jsx L35-L60`

## 9. Alert 전체 로직

### 9.1 생성과 lifecycle

각 Runtime은 `{id, level, source, name, code, message, status, ...}` item을 만든다. `RosMonitor.alerts()`가 Topic, MonitorStatus, Service, Node, Action Alert를 합친 뒤 공통 lifecycle cache에 넣는다.

파일: `ros_monitor.py L500-L568`

공통 lifecycle:

```text
현재 조건 존재 → active=true, last_detected_at 갱신
조건 해소 → active=false, resolved_at 기록
60초 안 재발 → 같은 id를 다시 active, resolved_at=null
해결 후 60초 경과 → 최근 목록 cache에서 제거
해결 history → 최대 50개
```

파일: `topic/alerts.py L60-L158`

Alert id는 source/code/name 등 안정된 식별값으로 같은 장애를 재사용한다. `meta.warning/error/critical`은 active만 집계한다. resolved는 목록/history에는 보이지만 현재 장애 수에서는 즉시 빠진다.

### 9.2 현재 주요 조건

| Source | 조건 | 등급 |
|---|---|---|
| Topic | message missing, stale, waiting publisher | warning |
| Topic | 이전 존재 후 disconnected | error |
| Service | 주요 Service disconnected | error |
| Service | 최근 사용자 call timeout | warning |
| Service | 최근 사용자 call 실패 | error |
| Action | disconnected, aborted, send/result 실패 | 주로 error |
| Action | canceled, 일부 timeout/rejected | warning 또는 코드별 정책 |
| Node | 이전 존재 후 Graph에서 사라짐(`node_stale` 호환 code) | error |
| MonitorStatus | message level warning/error/critical | 같은 severity |

publisher가 있고 외부 subscriber가 0인 Topic은 기본 장애 Alert가 아니다. subscriber만 있고 publisher가 없는 주요 감시 Topic은 `waiting_publisher`가 될 수 있다. 관련 없는/미발견 항목은 빨간 Alert로 만들지 않는다.

Overview는 alert response `meta`와 active item으로 현재 건수를 표시하고, AlertsPage는 active/resolved와 최대 50개 history를 나눠 보여준다.

## 10. REST와 WebSocket 역할

### 10.1 주기

| 데이터 | Frontend 주기 |
|---|---:|
| Topic/health/Topic alert/선택 latest·Hz | 1초 |
| Service/Action/Node 및 관련 alert | 3초 |
| Visualization 네 목록 | 5초 |
| Backend WebSocket 전송 | 1초 |
| WebSocket 재연결 | 2.5초 |

파일: `config/polling.js L1-L21`, `useTopicDashboard.js L17-L178`, `useServiceDashboard.js L7-L78`, `useActionDashboard.js L7-L74`, `useNodeDashboard.js L6-L66`, `useVisualizationGraph.js L18-L274`, `useMonitorWebSocket.js L4-L63`

세 REST polling 주기는 `frontend/.env.example`의 `VITE_TOPIC_POLL_INTERVAL_MS`, `VITE_DASHBOARD_POLL_INTERVAL_MS`, `VITE_VISUALIZATION_POLL_INTERVAL_MS`로 덮어쓸 수 있고, `config/polling.js L1-L21`이 값을 한 번만 양의 정수로 파싱해 미설정·0·음수·문자열이면 기존 1000/3000/5000ms로 fallback한다.

### 10.2 역할 차이

REST는 목록 전체, 관계, 선택 Topic latest/Hz처럼 화면이 실제로 렌더링하는 상세 데이터다. WebSocket은 연결 상태와 빠른 Overview 신호를 위한 경량 snapshot이다.

`websocket_snapshot()`은 Topic/Service/Action 요약과 Node/Alert meta를 만든다. Topic에는 latest map도 포함하지만 Service/Action 실행 history 전체를 보내지 않는다.

파일: `ros_monitor.py L460-L490`, `L571-L667`

- 전부 WebSocket으로 보내지 않는 이유: 큰 관계·history를 매초 밀면 payload와 렌더 비용이 커진다.
- 전부 REST만 쓰지 않는 이유: 연결 상태와 최신 통합 snapshot을 별도 채널로 빠르게 알 수 있다.
- WebSocket이 끊겨도 상세 화면은 REST polling으로 계속 동작한다.
- Cache는 매 HTTP 요청마다 ROS Graph와 통신을 다시 수행하지 않게 한다.

`useMonitorWebSocket`은 close 시 disconnected로 바꾸고 2.5초 뒤 새 socket을 만든다. effect cleanup이 닫은 socket은 재연결하지 않는다.

## 11. Runtime Cache와 공통 Lock

`RosMonitor.__init__()`의 단일 `threading.Lock`을 모든 monitoring Runtime과 Interface Lab execution Runtime이 공유한다. Runtime마다 별도 lock이 아니다.

파일: `ros_monitor.py L37-L82`

왜 필요한가:

- spin thread callback이 `latest`를 쓰는 동안 FastAPI thread가 snapshot을 읽을 수 있다.
- timer가 Graph cache를 교체하는 동안 WebSocket task가 meta를 만들 수 있다.
- Service/Action future callback과 Interface Lab history 조회가 동시에 일어날 수 있다.

일반 패턴은 “lock 안에서 copy → lock 밖에서 ROS Graph 처리 → lock 안에서 cache 교체”다. snapshot도 lock 안에서 복사한 뒤 반환한다.

주의할 부분:

- `TopicRuntime._ensure_subscription()`의 subscription destroy/create 일부는 공통 lock 안에서 실행된다(`topic/runtime.py L382-L399`). ROS API가 지연되면 다른 snapshot/callback이 잠시 기다릴 수 있다.
- 여러 Runtime이 하나의 lock을 공유해 단순하고 일관적이지만, 긴 작업이 lock 안으로 들어오면 서로 무관한 Topic/Service/Action도 막힌다.
- Apply의 colcon build는 별도 `_APPLY_LOCK`을 쓰며 공통 Runtime lock을 장시간 잡지 않는다.
- Cache snapshot은 서로 다른 REST 요청 시점이므로 Visualization의 네 목록이 완전히 같은 순간이라고 보장되지는 않는다. Frontend가 stable graph로 짧은 차이를 완화한다.

## 12. Interface Lab 전체 흐름

### 12.1 단일 정의

```text
.msg/.srv/.action 입력 또는 단일 업로드
→ backend/src/uploaded_interfaces/<kind> 저장
→ 남은 파일 전체 scan
→ CMakeLists.txt/package.xml 전체 재생성
→ registry와 pending 저장
→ Apply
→ colcon build --symlink-install
→ install site-packages 경로 반영
→ Python import check
→ callable 후보와 monitoring 지원 타입 반영
```

관리: `interface_lab/management/manual_interfaces.py L1-L276`, registry: `management/registry.py L1-L430`

파일이 0개이면 rosidl 호출이 없는 build 가능한 빈 ament package metadata를 만든다. 파일을 append하는 것이 아니라 현재 파일 기준으로 전체를 다시 쓴다.

### 12.2 실제 장비 패키지 업로드

ZIP/folder를 받아 안전한 package root, `package.xml`, `CMakeLists.txt`, package name과 interface 파일을 검증한다. 원본 package name을 유지해 `backend/src/uploaded_interface_packages/<package>`에 복사하고 `interface_packages.yaml`에 기록한다.

파일: `interface_lab/management/packages.py L1-L250`, 업로드 검증/복사 `L330-L610`

Apply는 중복 workspace package를 먼저 탐지하고, 업로드 package의 이전 build/install/log 산출물을 정리한 다음 colcon을 실행한다.

파일: `interface_lab/apply/runtime.py L100-L339`, cleanup `L401-L424`

빌드 성공 후 import를 확인하고 `reload_trigger.py`를 0.75초 뒤 갱신한다. Uvicorn `--reload` 실행 중일 때만 이 변경이 worker reload로 이어진다.

### 12.3 실제 통신

- Topic Publish/Receive: `interface_lab/execution/topic_runtime.py`
- Service Call: `interface_lab/execution/service_call_runtime.py`
- Action Goal: `interface_lab/execution/action_goal_runtime.py`
- 공통 schema/payload 변환: `interface_lab/common/value_converter.py L1-L220`

사용자가 실행 버튼을 누른 경우에만 publish/call/goal을 수행한다. 자동 Monitoring subscription과 Interface Lab Receive subscription은 목적과 cache가 다르다.

### 12.4 삭제 범위

| 삭제 종류 | 실제 제거 | 즉시 제거하지 않는 것 |
|---|---|---|
| 개별 uploaded interface | 해당 src 파일, registry entry; metadata 재생성; rebuild pending | 기존 build/install 산출물은 다음 Apply 전까지 남을 수 있음 |
| uploaded package | package source folder와 package registry entry | build/install/log는 삭제 endpoint에서 즉시 전부 지우지 않고 Apply cleanup에서 대상 package를 정리 |
| manual type | registry entry | 원래 설치된 외부 package |

Backend import module cache와 실행 history를 삭제 API가 강제로 모두 비우지는 않는다. 새 build/reload 또는 Backend 재시작이 경계를 만든다. 이 점은 “삭제 즉시 프로세스에서 타입이 완전히 사라진다”와 다르다.

## 13. 반드시 알아야 할 핵심 코드 블록 20개

코드 전문 대신 판단에 필요한 실제 핵심 줄만 인용했다.

| #/중요도 | 파일·함수·라인 | 실제 핵심 코드 | 역할 / 입력 → 출력 / 다음 연결 |
|---|---|---|---|
| 1/A | `main.py`, `lifespan`, L20-L27 | `ros_monitor.start()` / `stop()` | Uvicorn 생명주기 → ROS 전체 생명주기 |
| 2/A | `ros_monitor.py`, `__init__`, L37-L82 | `self._lock = threading.Lock()` | 설정 → 공통 lock과 Runtime 조립 |
| 3/A | `ros_monitor.py`, `start`, L84-L98 | `rclpy.init(); Node(...); create_timer(...)` | 프로세스 → Node/timer/spin |
| 4/A | `ros_monitor.py`, `stop`, L100-L124 | `rclpy.shutdown(); thread.join()` | 안전한 callback 종료 |
| 5/A | `ros_monitor.py`, `_update_graph`, L681-L688 | `node → topic → service → action` | 실제 수집 순서 |
| 6/A | `topic/runtime.py`, `update`, L125-L231 | `get_topic_names_and_types()` | Graph → Topic cache |
| 7/A | `topic/runtime.py`, callback, L506-L523 | `latest[...] = message; timestamps...` | ROS message → latest/수신시간 |
| 8/A | `topic/hz.py`, `build_hz_snapshot`, L42-L70 | `len(timestamps) / window_sec` | timestamp 창 → Hz |
| 9/A | `topic/alerts.py`, builders, L161-L281 | `age_sec > stale_timeout_sec` | latest age → missing/stale |
| 10/A | `service_call_runtime.py`, `call_service`, L85-L188 | `(time() - started_at) * 1000` | 사용자 request → response/timeout/history |
| 11/A | `action_goal_runtime.py`, Goal 실행, L91-L239 | `send_goal_async(...feedback_callback...)` | Goal → accepted/feedback/result |
| 12/A | `node/runtime.py`, `update`, L72-L159 | `merge_resource_state(...)` | Graph 현재/과거 → disconnected 보존 |
| 13/A | `ros_monitor.py`, `alerts`, L500-L568 | `retain_alerts(...)` | Runtime Alerts → active/resolved/meta |
| 14/A | `topic/alerts.py`, lifecycle, L60-L127 | `resolved_at + 60초`, history 50 | 해결·재발·제거 |
| 15/A | `ros_monitor.py`, `websocket_snapshot`, L460-L490 | `return {'timestamp': ..., ...}` | cache → 1초 경량 WS JSON |
| 16/B | `routers/monitoring.py`, endpoints, L16-L109 | `return ros_monitor.*_snapshot()` | HTTP → public snapshot |
| 17/A | `rosApi.js`, monitoring API, L41-L72 | `requestJson('/ros/topics')` | UI intent → REST URL |
| 18/A | `usePolling.js`, `usePolling`, L3-L84 | `setInterval(poll, intervalMs)` | REST result/error → React state |
| 19/A | `useTopicDashboard.js`, hook, L17-L178 | `usePolling(fetchTopics, TOPIC_POLL_INTERVAL_MS)` | Topic API → 목록/선택 state |
| 20/B | `graphTransform.js`, `buildCommunicationGraph`, L18-L175 | `graphNodes`, `graphEdges` 조립 | 네 REST 목록 → React Flow |

이 20개를 알면 startup, 수집, 계산, cache, API, 화면을 연결해 설명할 수 있다.

## 14. 실제 값 12개를 끝까지 추적

1. **Topic Hz** → callback timestamp(`topic/runtime.py L506-L523`) → `topic/hz.py L42-L70` → `hz` → `/ros/topics/hz` → `fetchTopicHz` → `topicHzByName` → `TopicTable` `HzBadge`.
2. **Topic latest** → ROS callback → preview dict → latest cache → `/ros/topics` item 및 `/latest`, WS `topics.latest` → `useTopicDashboard.latest` → TopicTable/Detail JSON popup.
3. **Topic stale** → `last_received_at` → age와 3초 비교 → Topic Alert cache/status → `/ros/topics`, `/ros/alerts` → Topic/Alert hooks → StatusBadge/AlertsPage.
4. **Publisher Node 수** → Node 관계 cache → 공통 관계 인덱스 → Topic item `publisher_node_count` → `/ros/topics` → `topics.data` → TopicTable `Publisher Node`.
5. **외부 Subscriber endpoint 수** → `get_subscriptions_info_by_topic()` endpoint 소유 Node 판정 → `external_subscriber_endpoint_count` → `/ros/topics` → hook → Topic 상세 진단.
6. **Service response time** → `started_at=time()` → 완료 시 차이×1000 → history `elapsed_ms`/summary → `/ros/services` merge → service hook → Service detail.
7. **Service result** → future result → JSON-safe response → call history/summary → `/ros/services` → `ServiceTable`/detail popup.
8. **Action feedback** → feedback callback → Goal history/latest summary → `/ros/actions` → action hook → ActionTable feedback/Detail popup.
9. **Action result** → result future/status → result/history → Graph item merge → `/ros/actions` → action hook → ActionTable/Detail.
10. **Node disconnected** → Node Graph 누락 + `ever_discovered` → Node cache `status=disconnected` → `/ros/nodes` → node hook → NodeTable/Visualization.
11. **Alert count** → 각 builder → lifecycle active 필터 → response `meta` → `fetchAlerts` → alert state → Overview 카드/AlertsPage.
12. **WebSocket connection status** → browser `WebSocket.onopen/onclose` → `status` state → App prop → Overview/Visualization realtime 표시.

## 15. 현재 프로젝트에서 꼭 알아야 할 로직

### A. 반드시 설명할 수 있어야 함

1. React → REST Router → RosMonitor → Runtime cache → React의 왕복: 프로젝트 전체 구조다.
2. rclpy Node, timer, spin thread의 역할 차이: Graph polling과 callback 처리가 왜 함께 가능한지 설명한다.
3. Topic 자동 subscription과 Interface Lab Receive의 차이: 자동 관찰과 사용자 실행을 혼동하지 않는다.
4. Hz가 `최근 5초 개수/5초`라는 점: 화면 수치 해석에 직접 영향이 있다.
5. stale와 disconnected 차이: 메시지 미수신과 Graph 소멸은 다른 장애다.
6. Service Graph 상태와 최근 사용자 호출 결과 분리: server 존재가 timeout 성공을 뜻하지 않는다.
7. Action 관찰과 새 Goal 전송 분리: 자동으로 장비를 움직이지 않는 안전 설계다.
8. Alert active/resolved/60초/재발: Overview 현재 건수와 history가 다른 이유다.
9. YAML 등록 type exact match 정책: 이름 하드코딩 없이 주요 항목과 실행 후보를 연결한다.

### B. 코드를 보면서 설명할 수 있어야 함

1. Interface upload, metadata 재생성, Apply/import check.
2. Node의 여섯 관계 수집과 Visualization edge 변환.
3. 공통 lock의 read-copy/update-commit 패턴.
4. REST polling 주기와 WebSocket 경량 snapshot.
5. custom ROS message의 재귀 JSON 변환.

세부 schema와 화면 CSS는 파일 위치를 찾고 설명하면 충분하다.

### C. 현재는 몰라도 됨

1. rclpy executor와 DDS discovery 내부 구현.
2. React Flow layout 라이브러리 내부 알고리즘.
3. Vite HMR 내부 구현.
4. generated ROS Python class의 metaclass 세부.

프로젝트가 이 라이브러리를 어떻게 호출하는지는 알아야 하지만 라이브러리 내부까지 발표 범위는 아니다.

## 16. 현재 코드의 문제점과 미완성 부분

| 문제 | 현재 동작 / 실제 영향 | 재현·우선순위 / 수정 위치 |
|---|---|---|
| 루트 README 없음 | AGENTS 구조 설명과 다르고 시작 문서가 없다 | `ls README.md`; 중 / 새 루트 README |
| frontend README 기본문 | 프로젝트 실행·구조와 무관한 Vite template | 파일 열기; 중 / `frontend/README.md` |
| Settings 미구현 | route/Page/API가 없다 | Sidebar/route 검색; 요구 기능이면 중 |
| Node stale 명칭 불일치 | config timeout을 저장하지만 계산하지 않고 Graph 누락 즉시 disconnected | Node 종료 후 다음 poll; 높음 / `node/runtime.py`, 문구/tests |
| Service active check 잔존 | 실행되지는 않지만 model/API 호환 field와 클래스가 남아 이해 비용 발생 | `rg active_check`; 낮음. 제거 시 API 호환 검토 필요 |
| Hz 초기 편향 | 고정 5초 분모라 시작 직후 실제 rate보다 낮음 | publisher 시작 직후 `/hz`; 중 / `topic/hz.py` |
| 이벤트 Topic stale 오탐 | YAML 등록 주기성 없는 msg도 deep monitoring 대상이 될 수 있음 | 1회 publish 후 3초; 높음 / `topics.command_names` 운영 설정 검토 |
| 무거운 Topic 자동 구독 | import 가능한 등록 msg를 모두 deserialize하면 CPU/메모리 증가 가능 | 고주파 image/point cloud 등록; 높음 / Topic config/QoS/preview limit |
| 공통 lock 병목 | subscription create/destroy 일부가 lock 안에서 ROS API 호출 | Graph 변동 중 응답 지연 측정; 중 / `topic/runtime.py L382-L399` |
| snapshot 시점 차이 | Visualization 네 REST 호출이 다른 poll 순간일 수 있음 | 빠른 생성/종료 반복; 중 / version/timestamp 비교 |
| wall clock 사용 | 시스템 시간이 바뀌면 age/elapsed가 튈 수 있음 | 시간 보정; 중 / duration은 monotonic 검토 |
| 삭제 잔여물 | source 삭제 즉시 build/install/import cache/history까지 모두 지우지 않음 | package 삭제 후 apply 전 import; 중 / delete/apply UX |
| reload 전체 재시작 | Apply trigger로 FastAPI와 ROS Runtime도 재시작 | `--reload` 중 Apply; 중 / reload 감시 범위 또는 수동 재시작 |
| WebSocket error 표현 | `onerror` 후 `onclose`가 disconnected로 바뀌며 상세 원인은 일반 문자열 | Backend 중단; 낮음 / `useMonitorWebSocket.js` |
| polling 중복 비용 | 화면별 hook이 alert/node를 별도로 요청할 수 있음 | Network 탭; 중 / shared query cache 검토 |
| demo 품질 | `demo_malang` timer가 주석 처리되고 setup entry point도 없음 | 직접 python 실행 필요; 낮음 / demo 정리 |
| package metadata TODO | backend `setup.py` description/license가 TODO | package build metadata 확인; 중 |
| cancel 미지원 | canceled 관찰은 되지만 사용자 cancel API 없음 | 실행 중 Goal UI; 계획 기능일 때만 추가 |
| 테스트 경계 | 단위 테스트는 있으나 실제 DDS, reload, 고부하·시간 변경 E2E는 제한적 | 실제 ROS 통합 시나리오; 높음 |
| Frontend effect 위험 | 현재 polling은 stable ref/in-flight guard가 있으나 새 effect가 매 render 객체를 dependency로 받으면 반복 가능 | React console; 지속 lint/review |

Service 자동 호출을 다시 켜는 것은 단순 정리 작업이 아니다. 장비 제어 Service를 사용자 승인 없이 호출할 위험이 있으므로 현재 비활성 정책을 유지해야 한다.

## 17. 직접 검증 명령

### 17.1 환경과 실행

```bash
cd /home/hs/rang/ros2_dashboard/backend
source /opt/ros/jazzy/setup.bash
colcon build --symlink-install
source install/setup.bash
export ROS_DOMAIN_ID=0
python3 -m uvicorn ros2_dashboard_backend.main:app \
  --host 127.0.0.1 --port 8000
```

Backend `.env`의 `API_HOST`, `API_PORT`는 현재 Uvicorn 명령에 자동 연결되지 않으며 위 CLI 인자가 실제 주소를 결정한다.

다른 terminal:

```bash
cd /home/hs/rang/ros2_dashboard/frontend
npm install
npm run dev
```

`ROS_DOMAIN_ID`는 장비와 동일한 값이어야 한다. 위 `0`은 검증 예시이며 실제 장비 설정이 다르면 맞춘다.

### 17.2 Graph와 API

```bash
source /opt/ros/jazzy/setup.bash
source /home/hs/rang/ros2_dashboard/backend/install/setup.bash
ros2 node list
ros2 topic list -t
ros2 service list -t
ros2 action list -t

curl -s http://127.0.0.1:8000/health
curl -s http://127.0.0.1:8000/ros/topics
curl -s http://127.0.0.1:8000/ros/services
curl -s http://127.0.0.1:8000/ros/actions
curl -s http://127.0.0.1:8000/ros/nodes
curl -s http://127.0.0.1:8000/ros/alerts
curl -s \
  'http://127.0.0.1:8000/ros/topics/hz?name=/demo_cleaning_schedule'
```

WebSocket은 브라우저 Console에서 확인할 수 있다.

```javascript
const ws = new WebSocket('ws://127.0.0.1:8000/ws/monitor')
ws.onmessage = (event) => console.log(JSON.parse(event.data))
```

### 17.3 실제 확인된 demo

custom Topic demo:

```bash
cd /home/hs/rang/ros2_dashboard/backend
source /opt/ros/jazzy/setup.bash
source install/setup.bash
python3 demo_nodes/demo_cleaning_schedule.py
ros2 topic echo /demo_cleaning_schedule
```

Service와 Action demo:

```bash
python3 demo_nodes/demo_robot_control_service.py
python3 demo_nodes/demo_can_control_server.py
```

실제 request/goal 필드는 업로드된 `RobotControl.srv`, `CanControl.action` 정의에 따라 달라지므로 추측한 CLI payload를 문서에 고정하지 않는다. 다음 명령으로 현재 schema를 먼저 확인한 후 실행한다.

```bash
ros2 interface show rths_interfaces/srv/RobotControl
ros2 interface show rths_interfaces/action/CanControl
ros2 service call /RobotControl \
  rths_interfaces/srv/RobotControl '<현재 schema에 맞는 YAML>'
ros2 action send_goal /CanControl \
  rths_interfaces/action/CanControl \
  '<현재 schema에 맞는 YAML>' --feedback
```

stale 재현은 `demo_cleaning_schedule.py`를 실행해 수신을 확인한 뒤 Ctrl+C로 publisher만 중지한다. Topic이 Graph에서 바로 사라지면 disconnected, publisher가 남고 발행만 멈추면 3초 뒤 stale다.

로그와 UI:

- Backend terminal에서 startup, callback 예외, reload를 확인한다.
- 브라우저 Network에서 polling URL, status, response payload를 확인한다.
- Console에서 Maximum update depth, WebSocket reconnect 오류를 확인한다.
- 테스트는 `backend`에서 `pytest`, `frontend`에서 `npm run lint`와 `npm run build`로 확인한다.

## 문서와 실제 코드가 달랐던 지점

1. 루트 README가 있다는 구조 설명과 달리 파일이 없다.
2. `frontend/README.md`는 프로젝트 안내가 아니라 Vite template이다.
3. 일부 기존 Topic 문서는 Hz를 “timestamp 사이 간격”처럼 표현하지만 실제 공식은 `count/window_sec`다.
4. Node의 `stale_timeout_sec` 설정은 현재 disconnected 판정에 사용되지 않는다.
5. Service active check 파일과 응답 호환 field는 남아 있지만 실제 graph timer는 호출하지 않는다.
6. Settings는 요청 목록에 있지만 현재 구현은 없다.
7. Action event에는 `completed_at`, `duration` 필드가 없고 `sent_at`, `elapsed_ms`를 사용한다.
8. uploaded package 삭제가 즉시 build/install/log/import/history 전체 삭제를 뜻하지 않는다.

## 전체 흐름 10줄 요약

1. Uvicorn lifespan이 `RosMonitor.start()`를 호출한다.
2. RosMonitor는 rclpy Node, timer, spin thread와 공통 Runtime을 시작한다.
3. timer는 Node → Topic → Service → Action 순서로 ROS2 Graph를 읽는다.
4. Topic/Action subscription과 사용자 실행 future는 spin thread에서 callback을 처리한다.
5. Runtime은 latest, 관계, 상태, history를 공통 lock으로 보호한 메모리 cache에 저장한다.
6. FastAPI Router는 ROS를 다시 조회하지 않고 RosMonitor snapshot을 반환한다.
7. React API 함수가 REST 응답을 받고 화면별 hook이 1·3·5초 간격으로 state를 갱신한다.
8. WebSocket은 1초마다 경량 통합 snapshot과 연결 상태를 전달한다.
9. Page와 Table/Detail/React Flow가 state를 문구, 배지, JSON, 그래프로 렌더링한다.
10. 종료·reload 시 lifespan이 rclpy, thread, Node를 함께 정리한다.

## 발표 질문 대비 20문답

1. **React가 ROS2를 직접 읽나요?** 아니요. FastAPI와 rclpy Backend만 ROS2에 접근합니다.
2. **Graph polling과 message callback은 무엇이 다른가요?** timer는 이름·관계를 찾고 spin thread는 실제 수신 callback을 처리합니다.
3. **수집 순서는?** Node, Topic, Service, Action입니다.
4. **왜 cache가 필요한가요?** HTTP 요청마다 DDS Graph와 subscription을 다시 만들지 않기 위해서입니다.
5. **Hz 공식은?** 최근 5초 창에 남은 timestamp 개수를 5초로 나눕니다.
6. **첫 메시지가 왜 0.2 Hz인가요?** 고정 5초 분모를 사용하기 때문입니다.
7. **stale와 disconnected 차이는?** stale는 메시지 미수신, disconnected는 이전 Graph 항목의 소멸입니다.
8. **Node stale도 5초인가요?** 현재는 아닙니다. 다음 Graph 갱신에서 사라지면 disconnected입니다.
9. **custom msg를 어떻게 감시하나요?** YAML 등록, import 가능, Graph full type exact match이면 subscription을 만듭니다.
10. **Dashboard 구독자를 왜 빼나요?** Dashboard 때문에 외부 subscriber 수가 1 증가하는 왜곡을 막기 위해서입니다.
11. **Service가 살아 있으면 호출도 성공인가요?** 아닙니다. Graph server 상태와 최근 사용자 호출 결과를 따로 저장합니다.
12. **Service를 자동 호출하나요?** 현재 주기 경로에서는 하지 않습니다.
13. **응답시간 단위는?** wall-clock 차이에 1000을 곱한 ms입니다.
14. **Action을 자동 실행하나요?** 아닙니다. 관찰과 사용자 Goal 전송 Runtime이 분리됩니다.
15. **cancel을 지원하나요?** canceled 상태 관찰은 하지만 사용자 cancel 요청 기능은 없습니다.
16. **resolved Alert가 오류 수에 남나요?** 아니요. 즉시 현재 집계에서 빠지고 60초만 최근 기록으로 남습니다.
17. **왜 REST와 WebSocket을 같이 쓰나요?** REST는 상세, WebSocket은 연결 상태와 경량 실시간 요약에 적합합니다.
18. **WebSocket이 끊기면 화면이 멈추나요?** 상세 목록은 REST polling으로 계속 동작합니다.
19. **Lock은 Runtime별인가요?** 아니요. RosMonitor가 만든 하나의 lock을 공유합니다.
20. **Apply는 무엇을 하나요?** colcon build, install Python path 반영, import check, reload trigger 갱신을 수행합니다.

## 내가 외워야 할 핵심 15개

1. `main.lifespan`이 ROS Runtime의 시작·종료 경계다.
2. `RosMonitor`가 coordinator이고 기능별 Runtime이 실제 수집을 한다.
3. 실제 갱신 순서는 Node → Topic → Service → Action이다.
4. timer는 Graph, spin thread는 callback을 처리한다.
5. 모든 Runtime은 하나의 공통 lock을 공유한다.
6. Topic 지원은 YAML/import/Graph full type exact match다.
7. Hz는 `5초 창 메시지 수 ÷ 5초`다.
8. stale는 `now-last_received_at > 3초`다.
9. Node는 현재 시간 stale가 아니라 Graph 소멸 disconnected다.
10. Service Graph 상태와 최근 Call 결과는 다르다.
11. Service 자동 active check는 현재 실행되지 않는다.
12. Action 관찰과 사용자 Goal 전송은 분리돼 있다.
13. active Alert만 현재 severity 집계에 들어간다.
14. resolved는 60초, history는 최대 50개다.
15. REST는 상세, WebSocket은 경량 snapshot과 연결 상태다.

## Qos
**Reliability** = 메시지를 반드시 전달할지 정하는 정책 = 센서 Topic 자동 감시는 일부 손실을 허용해 BEST_EFFORT, 일반/custom Topic·Interface Lab·Action 관찰은 전달 보장을 위해 RELIABLE을 사용합니다.

**Durability** = 늦게 들어온 구독자가 과거 메시지를 받을지 정하는 정책 = 현재 모든 명시적 Topic QoS는 과거 메시지를 보관하지 않는 VOLATILE을 사용합니다.

**History** = 메시지를 어떤 방식으로 보관할지 정하는 정책 = 현재 모두 최근 메시지만 저장하는 KEEP_LAST를 사용합니다.

**Depth** = KEEP_LAST일 때 최근 메시지를 몇 개 보관할지 정하는 값 = 센서 Topic 자동 감시는 5개, 일반/custom Topic·Interface Lab·Action 관찰은 10개를 보관합니다.

**Sensor Data QoS** = 손실보다 최신성이 중요한 센서 통신용 QoS = LaserScan·Imu·JointState·Odometry 자동 감시에 BEST_EFFORT + VOLATILE + KEEP_LAST 5를 적용합니다.

**기본 Depth 10 QoS** = 일반 메시지를 안정적으로 전달하기 위한 기본 QoS = 일반/custom Topic과 Action status·feedback 관찰에 RELIABLE + VOLATILE + KEEP_LAST 10을 적용합니다.

**Interface Lab QoS** = 사용자가 직접 Publish·Receive할 때 적용되는 QoS = 현재 타입과 관계없이 정수 10을 전달하므로 RELIABLE + VOLATILE + KEEP_LAST 10으로 생성됩니다.

**Service QoS** = 요청과 응답을 안정적으로 전달하기 위한 Service 기본 정책 = 별도 설정 없이 rclpy 기본 Service QoS를 사용하며 일반적으로 RELIABLE + VOLATILE + KEEP_LAST 10입니다.

**Action QoS** = Goal·Result·Cancel Service와 Feedback·Status Topic에 적용되는 정책 = ActionClient는 rclpy 기본값을 사용하고, 대시보드의 status·feedback 관찰 구독은 RELIABLE + VOLATILE + KEEP_LAST 10을 사용합니다.

**Deadline** = 정해진 시간 안에 메시지가 계속 도착해야 하는지 정하는 정책 = 현재 코드에서는 직접 설정하지 않습니다.

**Lifespan** = 발행된 메시지가 얼마 동안 유효한지 정하는 정책 = 현재 코드에서는 직접 설정하지 않습니다.

**Liveliness** = 발행자가 살아 있음을 어떤 방식으로 확인할지 정하는 정책 = 현재 코드에서는 수동 설정하지 않고 기본값을 사용합니다.

**TRANSIENT_LOCAL** = 늦게 들어온 구독자에게 이전 메시지를 전달하는 Durability 정책 = 현재 코드에서는 사용하지 않습니다.

**KEEP_ALL** = 수신한 메시지를 제한 없이 보관하는 History 정책 = 현재 코드에서는 사용하지 않습니다.


## 코드 작업에서 내가 알아야 할 것 3줄 요약

1. Frontend 요청이 어떤 Router와 Runtime을 거쳐 화면에 돌아오는지 설명할 수 있어야 합니다.
2. Hz, stale, Service 응답시간, Action 결과가 실제로 계산되는 코드 위치와 기준을 알아야 합니다.
3. 현재 구현된 기능과 향후 확장 계획을 구분해서 설명할 수 있어야 합니다.
