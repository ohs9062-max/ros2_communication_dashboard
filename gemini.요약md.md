# 최근 .md 문서 변경 내역 및 Lxx-Lxx 코드 위치 대조 요약

이 문서는 최근 `.md` 문서 변경분(`git diff`)을 분석하여 변경된 문서 목록, 수정된 설명/문구, 변경된 `Lxx-Lxx` 코드 위치 표기 및 실제 코드 파일 경로를 정리한 보고서입니다.

---

## 1. 변경된 .md 파일 전체 요약

| 구분 | 파일 경로 | 주요 변경 내용 요약 |
|:---|:---|:---|
| **설계/운영 기준** | `AGENTS.md` | Multi-domain 동시 감시 체계 설명 반영 |
| | `README.md` | 다중 Domain 동적 관리 및 감시 구조 갱신 |
| | `docs/architecture/monitor_backend_transport.md` | snapshot JSON 구조에 `domains` 필드 추가 |
| | `frontend/README.md` | 주요 화면 목록에 `Domains` 추가 |
| **흐름/상세 문서 (`docs/docs2/`)** | `docs/docs2/01_overall_flow.md` | Monitor 시작·snapshot·Backend·Frontend L 번호 최신화 |
| | `docs/docs2/02_topic_flow.md` | Topic 구독·수집·API·UI L 번호 최신화 |
| | `docs/docs2/03_service_flow.md` | Service snapshot·호출 런타임 L 번호 최신화 |
| | `docs/docs2/04_action_flow.md` | Action 런타임·Goal/Cancel L 번호 최신화 |
| | `docs/docs2/05_node_flow.md` | Node API·Page L 번호 최신화 |
| | `docs/docs2/06_alert_flow.md` | Alert 수집·Action Alert L 번호 최신화 |
| | `docs/docs2/07_interface_lab_flow.md` | Interface Lab 실행/수신 라우트·런타임 L 번호 최신화 |
| | `docs/docs2/08_calculation_reference.md` | 계산 기준 수식/함수 L 번호 최신화 |
| | `docs/docs2/계산.md` | Graph 갱신 함수 L 번호 최신화 |

---

## 2. 파일별 상세 변경 내역 및 L 위치 대조

### 1) AGENTS.md
* **수정된 설명/문구**: 단일 Domain(`ROS_DOMAIN_ID`) 감시 설명 → `MultiDomainRosMonitor`를 통한 다중 Domain 동시 감시, Domains 화면에서의 동적 추가·삭제 반영 및 `domain_id`/`resource_key` 분리 설명으로 최신화.
* **변경된 `Lxx-Lxx` 표기**: 없음 (구조 및 운영 정책 설명 갱신)
* **확인 코드 파일 경로**: N/A

---

### 2) README.md
* **수정된 설명/문구**: `backend/.env`의 단일 Domain 설정 설명 → Domains 화면에서 다중 `ROS_DOMAIN_ID` 동적 관리 및 `MultiDomainRosMonitor` 동시 감시 설명으로 최신화.
* **변경된 `Lxx-Lxx` 표기**: 없음
* **확인 코드 파일 경로**: N/A

---

### 3) docs/architecture/monitor_backend_transport.md
* **수정된 설명/문구**: Transport snapshot JSON 응답 예시에 `"domains": {}` 필드 추가.
* **변경된 `Lxx-Lxx` 표기**: 없음
* **확인 코드 파일 경로**: N/A

---

### 4) frontend/README.md
* **수정된 설명/문구**: 주요 화면 목록에 `Domains` 추가.
* **변경된 `Lxx-Lxx` 표기**: 없음
* **확인 코드 파일 경로**: N/A

---

### 5) docs/docs2/01_overall_flow.md
* **수정된 설명/문구**: Monitor 시작 및 snapshot 생성 단계를 테이블에서 목록형 호출 구조로 정리하고, Backend/Frontend 라인 번호 갱신.
* **변경된 `Lxx-Lxx` 표기 및 실제 코드 파일 경로**:

| 항목 | 변경 전 → 변경 후 | 대상 코드 파일 경로 |
|:---|:---|:---|
| Monitor lifespan | `L22-L29` → `L22-L30` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/transport/api.py` |
| `RosMonitor.start()` | `L125-L139` → `L145-L161` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros_monitor.py` |
| `RosMonitor._update_graph()` | `L348-L357` → `L433-L443` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros_monitor.py` |
| `RosMonitor.snapshot()` | `L165-L180` → `L187-L203` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros_monitor.py` |
| `assemble_topic_snapshot()` | (신규 추가) `L10-L154` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/snapshot.py` |
| `assemble_service_snapshot()` | `L16-L112` → `L16-L114` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/service_snapshot.py` |
| `assemble_action_snapshot()` | `L15-L127` → `L15-L136` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/action_snapshot.py` |
| `assemble_node_snapshot()` | `L13-L65` → `L12-L99` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_node/snapshot.py` |
| `transport_snapshot()` | `L64-L99` → `L66-L102` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/transport/api.py` |
| Service 자동호출 미수행 | `L355-L357` → `L441-L443` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros_monitor.py` |
| Backend `main.py lifespan()` | `L14-L21` → `L14-L22` | `backend/app/main.py` |
| `useTopicDashboard.js` | `L21-L203` → `L23-L257` | `frontend/src/hooks/useTopicDashboard.js` |
| `TopicsPage.jsx` | `L16-L186` → `L17-L196` | `frontend/src/pages/TopicsPage.jsx` |
| `ServicesPage.jsx` | `L10-L130` → `L10-L135` | `frontend/src/pages/ServicesPage.jsx` |
| `ActionsPage.jsx` | `L22-L178` → `L23-L182` | `frontend/src/pages/ActionsPage.jsx` |
| `NodesPage.jsx` | `L16-L170` → `L17-L179` | `frontend/src/pages/NodesPage.jsx` |
| `AlertsPage.jsx` | `L11-L273` → `L11-L277` | `frontend/src/pages/AlertsPage.jsx` |

---

### 6) docs/docs2/02_topic_flow.md
* **수정된 설명/문구**: Topic 수집/구독 흐름 및 API/Frontend Hook 라인 번호 갱신.
* **변경된 `Lxx-Lxx` 표기 및 실제 코드 파일 경로**:

| 항목 | 변경 전 → 변경 후 | 대상 코드 파일 경로 |
|:---|:---|:---|
| `update_subscription_entry()` | `L41-L56` → `L46-L68` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/subscriptions.py` |
| Monitoring router (Topic) | `L16-L46` → `L16-L63` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/transport/routers/monitoring.py` |
| `useTopicDashboard.js` | `L21-L203` → `L23-L257` | `frontend/src/hooks/useTopicDashboard.js` |
| `TopicsPage.jsx` | `L16-L186` → `L17-L196` | `frontend/src/pages/TopicsPage.jsx` |
| `_effective_status()` | `L157-L177` → `L157-L178` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/snapshot.py` |

---

### 7) docs/docs2/03_service_flow.md
* **수정된 설명/문구**: Service snapshot 조립, router, 실행 런타임 코드 위치 최신화.
* **변경된 `Lxx-Lxx` 표기 및 실제 코드 파일 경로**:

| 항목 | 변경 전 → 변경 후 | 대상 코드 파일 경로 |
|:---|:---|:---|
| `assemble_service_snapshot()` | `L16-L112` → `L16-L114` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/service_snapshot.py` |
| `visible_service_snapshot()` | `L115-L131` → `L117-L133` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/service_snapshot.py` |
| `get_ros_services()` | `L50-L63` → `L64-L78` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/transport/routers/monitoring.py` |
| `ServicesPage.jsx` | `L10-L130` → `L10-L135` | `frontend/src/pages/ServicesPage.jsx` |
| Service Execution router | `L27-L67` → `L27-L68` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/transport/routers/service_execution.py` |
| `call_service()` | `L83-L129` → `L84-L156` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/interface_lab/execution/service_call_runtime.py` |
| `callable_services()` | `L76-L81` → `L77-L82` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/interface_lab/execution/service_call_runtime.py` |
| Service history/reset | `L131-L154` → `L158-L203` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/interface_lab/execution/service_call_runtime.py` |
| `RosMonitor._update_graph()` | `L355-L357` → `L441-L443` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros_monitor.py` |
| `dashboard_state_by_service()` | `L160-L164` → `L209-L213` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/interface_lab/execution/service_call_runtime.py` |

---

### 8) docs/docs2/04_action_flow.md
* **수정된 설명/문구**: Action 런타임, snapshot, 실행 router 코드 위치 최신화.
* **변경된 `Lxx-Lxx` 표기 및 실제 코드 파일 경로**:

| 항목 | 변경 전 → 변경 후 | 대상 코드 파일 경로 |
|:---|:---|:---|
| `ActionRuntime.update()` | `L84-L165` → `L84-L166` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_action/runtime.py` |
| `assemble_action_snapshot()` | `L15-L127` → `L15-L136` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/action_snapshot.py` |
| `get_ros_actions()` | `L67-L76` → `L96-L106` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/transport/routers/monitoring.py` |
| `ActionsPage.jsx` | `L22-L178` → `L23-L182` | `frontend/src/pages/ActionsPage.jsx` |
| Action Goal route | `L27-L75` → `L27-L76` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/transport/routers/action_execution.py` |
| Action Cancel route | `L100-L112` → `L101-L114` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/transport/routers/action_execution.py` |
| Action History/reset | `L146-L179` → `L146-L186` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/interface_lab/execution/action_goal_runtime.py` |
| `dashboard_state_by_action()` | `L185-L189` → `L208-L212` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/interface_lab/execution/action_goal_runtime.py` |

---

### 9) docs/docs2/05_node_flow.md
* **수정된 설명/문구**: Node API 및 UI 페이지 라인 번호 갱신.
* **변경된 `Lxx-Lxx` 표기 및 실제 코드 파일 경로**:

| 항목 | 변경 전 → 변경 후 | 대상 코드 파일 경로 |
|:---|:---|:---|
| `get_ros_nodes()` | `L80-L89` → `L124-L134` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/transport/routers/monitoring.py` |
| `NodesPage.jsx` | `L16-L170` → `L17-L179` | `frontend/src/pages/NodesPage.jsx` |

---

### 10) docs/docs2/06_alert_flow.md
* **수정된 설명/문구**: Alert 수집 함수, snapshot, UI 페이지 및 Action Alert 빌더 코드 위치 갱신.
* **변경된 `Lxx-Lxx` 표기 및 실제 코드 파일 경로**:

| 항목 | 변경 전 → 변경 후 | 대상 코드 파일 경로 |
|:---|:---|:---|
| `RosMonitor.alerts()` | `L278-L324` → `L366-L412` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros_monitor.py` |
| `transport_snapshot()` | `L64-L99` → `L66-L102` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/transport/api.py` |
| `AlertsPage.jsx` | `L11-L273` → `L11-L277` | `frontend/src/pages/AlertsPage.jsx` |
| `build_action_alerts()` | `L21-L176` → `L21-L177` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_action/alerts.py` |

---

### 11) docs/docs2/07_interface_lab_flow.md
* **수정된 설명/문구**: Interface Lab의 1회/지속 Topic Publish, Receive, Service Call, Action Goal 라우트 및 런타임 코드 위치 갱신.
* **변경된 `Lxx-Lxx` 표기 및 실제 코드 파일 경로**:

| 항목 | 변경 전 → 변경 후 | 대상 코드 파일 경로 |
|:---|:---|:---|
| 1회 Publish route | `L44-L88` → `L44-L89` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/transport/routers/topic_execution.py` |
| 지속 Publish route | `L98-L158` → `L99-L165` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/transport/routers/topic_execution.py` |
| 지속 Publish runtime | `L178-L205` → `L178-L201` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/interface_lab/execution/topic_continuous_runtime.py` |
| Publish history reset | `L161-L172` → `L168-L179` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/transport/routers/topic_execution.py` |
| Receive start/stop/list | `L16-L53` → `L16-L59` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/transport/routers/topic_receive.py` |
| Receive history/reset | `L56-L90` → `L61-L96` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/transport/routers/topic_receive.py` |
| Service Call route | `L15-L67` → `L15-L68` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/transport/routers/service_execution.py` |
| `call_service()` runtime | `L83-L129` → `L84-L156` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/interface_lab/execution/service_call_runtime.py` |
| Service history route | `L70-L110` → `L70-L112` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/transport/routers/service_execution.py` |
| Service history runtime | `L131-L154` → `L158-L203` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/interface_lab/execution/service_call_runtime.py` |
| Action Goal route | `L15-L75` → `L15-L76` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/transport/routers/action_execution.py` |
| Action Cancel route | `L100-L112` → `L101-L114` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/transport/routers/action_execution.py` |
| Action history route | `L78-L133` → `L78-L135` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/transport/routers/action_execution.py` |
| Action history runtime | `L146-L179` → `L146-L186` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/interface_lab/execution/action_goal_runtime.py` |

---

### 12) docs/docs2/08_calculation_reference.md
* **수정된 설명/문구**: 계산 기준 테이블의 snapshot 조립, 모델, Hz, 런타임, Alert 코드 위치 갱신.
* **변경된 `Lxx-Lxx` 표기 및 실제 코드 파일 경로**:

| 항목 | 변경 전 → 변경 후 | 대상 코드 파일 경로 |
|:---|:---|:---|
| `assemble_service_snapshot()` | `L16-L112` → `L16-L114` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/service_snapshot.py` |
| `assemble_action_snapshot()` | `L15-L127` → `L15-L136` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/action_snapshot.py` |
| `_effective_status()` | `L157-L177` → `L157-L178` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/snapshot.py` |
| `node_status()` | `L27-L39` → `L27-L40` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_node/models.py` |
| `update_subscription_entry()` | `L41-L56` → `L46-L68` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_topic/subscriptions.py` |
| `_elapsed_time_ms()` | `L214-L223` → `L269-L279` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_action/subscriptions.py` |
| `call_service()` | `L83-L129` → `L84-L156` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/interface_lab/execution/service_call_runtime.py` |
| Action Alert 후보 | `L21-L176` → `L21-L177` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros2_action/alerts.py` |
| `RosMonitor.alerts()` | `L278-L324` → `L366-L412` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros_monitor.py` |

---

### 13) docs/docs2/계산.md
* **수정된 설명/문구**: Graph 갱신 순서 코드 위치 갱신.
* **변경된 `Lxx-Lxx` 표기 및 실제 코드 파일 경로**:

| 항목 | 변경 전 → 변경 후 | 대상 코드 파일 경로 |
|:---|:---|:---|
| `RosMonitor._update_graph()` | `L348-L357` → `L433-L443` | `ros2_ws/src/ros2_dashboard_monitor/ros2_dashboard_monitor/ros_monitor.py` |


gemini.md 요약 을 바탕으로 제미나이한테 시켜야할거 같은데 diff 로 .md 원본 유지하고 L 만 바꾸는걸로 로직이나 코드함수 설명이 바뀌어야 한다면 그때만 본문 수정으로 제미나이가 전에 작업할때 기존 문서를 너무 간략화해서 내가 못알아보는게 이유야 제미나이 프롬프트 줘 git diff는 현재 diff 바탕이 아니라 제미나이가 처음 .md 문서를 수정했을때 기준으로 잡아야해