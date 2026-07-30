# Frontend 데이터 흐름

## 1. 기능을 한 문장으로 설명

Frontend는 FastAPI의 JSON 응답을 일정 주기로 가져와 React state에 저장하고, 목록·상세·Overview·Visualization·Alerts 화면으로 보여준다.

Polling은 “Frontend가 일정 시간마다 Backend에 다시 요청하는 방식”이다. Frontend는 ROS2에 직접 연결하지 않는다.

## 2. 전체 흐름

```text
FastAPI REST/WebSocket
→ rosApi.js
→ polling/WebSocket hook
→ React state
→ filter/status helper
→ page
→ table/detail component
→ StatusBadge와 JSON popup
```

## 3. 단계별 쉬운 설명

### 1) App이 현재 화면에 필요한 hook을 켠다

- 파일: `App.jsx L20~L85`
- 역할: 현재 route에 따라 Topic, Service, Action, Node polling을 활성화하고 각 Page에 데이터를 전달한다.
- 왜 필요한가: 보이지 않는 화면의 불필요한 요청을 줄이기 위해서다.

### 2) API 함수가 Backend를 호출한다

- 파일: `api/rosApi.js L24~L73`
- 역할: `/health`, `/ros/topics`, `/ros/services`, `/ros/actions`, `/ros/nodes`, `/ros/alerts` 응답을 JSON으로 읽는다.
- 파일: `api/rosApi.js L74~L360`
- 역할: Interface Lab 등록·Apply·Publish·Call·Goal·history API를 호출한다.

### 3) usePolling이 반복 요청을 안전하게 관리한다

- 파일: `hooks/usePolling.js L3~L85`
- 역할: loading, data, error를 저장하고 interval을 시작·정리한다.
- 중요한 동작: 다음 요청이 성공하면 이전 error를 지우고, component가 사라지면 timer를 정리한다.

### 4) 화면별 hook이 응답을 읽기 쉬운 state로 바꾼다

| 화면 | hook과 주기 |
|---|---|
| Topic | `useTopicDashboard.js L17~L178`, 목록 1초 |
| Service | `useServiceDashboard.js L7~L78`, 3초 |
| Action | `useActionDashboard.js L7~L74`, 3초 |
| Node | `useNodeDashboard.js L6~L66`, 3초 |
| Visualization | `useVisualizationGraph.js L18~L274`, 5초 |

주기 값은 `config/polling.js L1~L21`에서 Vite 환경변수를 한 번 파싱하며, 설정이 없거나 잘못되면 위 기존 주기로 돌아간다.
| WebSocket | `useMonitorWebSocket.js L4~L74`, 연결 유지 |

### 5) 주요 항목을 판정한다

- 파일: `utils/primaryFilters.js L1~L78`
- 파일: `utils/nodeFilters.js L1~L77`
- Topic/Service/Action은 Backend의 등록 타입 일치 신호를 사용한다.
- Node는 실제 관계 배열의 타입이 주요 리소스 타입과 정확히 같은지 확인한다.
- 특정 Topic·Nav2·TurtleBot 이름 fallback은 사용하지 않고 Backend `supported_type`, `allowlisted`, `category`, `is_internal`과 관계 타입을 사용한다.
- Frontend가 YAML을 직접 읽지는 않는다.

### 6) Page가 검색·필터·선택을 관리한다

- Topic: `pages/TopicsPage.jsx L14~L186`
- Service: `pages/ServicesPage.jsx L50~L214`
- Action: `pages/ActionsPage.jsx L17~L179`
- Node: `pages/NodesPage.jsx L16~L169`
- 각 Page는 API data 자체를 새로 만들기보다 표시할 목록과 선택 항목을 정한다.

### 7) Table과 Detail이 실제 필드를 표시한다

- Topic: `TopicTable.jsx L46~L146`, `TopicDetailPanel.jsx L11~L192`
- Service: `ServiceTable.jsx L33~L136`, `ServiceDetailPanel.jsx L6~L159`
- Action: `ActionTable.jsx L41~L158`, `ActionDetailPanel.jsx L6~L246`

현재 주요 표시:

- Topic: 마지막 값과 마지막 확인, Hz, 상세 감시
- Service: 서버 상태와 최근 Call 결과, 마지막 요청/응답
- Action: 서버 상태와 마지막 Goal, Feedback 값, Result, 실행 시간

긴 JSON은 목록에서 `...`로 줄여 보이고 클릭하면 공용 JSON popup으로 전체 값을 보여준다.

### 8) StatusBadge가 문구와 색을 정한다

- 파일: `components/StatusBadge.jsx L1~L125`
- 예:
  - active/succeeded: 초록
  - accepted/executing: 파랑
  - canceled/rejected/Result Timeout: 노랑
  - disconnected/aborted/전송 실패: 빨강
  - unknown: 회색

### 9) Overview와 Alerts를 표시한다

- 파일: `pages/OverviewPage.jsx L18~L188`, `L371~L419`
- 파일: `pages/AlertsPage.jsx L5~L102`
- 파일: `components/AlertsPreview.jsx L5~L96`
- Overview는 `/ros/alerts` meta로 현재 warning/error를 계산한다.
- Alerts 현재 탭은 active, 이전 탭은 resolved history 최대 50개를 보여준다.

## 4. 실제 코드 위치

| 기능 | 코드 위치 |
|---|---|
| 전체 page 조립 | `App.jsx L20~L85` |
| 공통 API | `rosApi.js L24~L73` |
| 공통 polling | `usePolling.js L3~L85` |
| 공통 상태 배지 | `StatusBadge.jsx L1~L125` |
| 주요 항목 | `primaryFilters.js L1~L78` |
| 주요 Node | `nodeFilters.js L1~L77` |

## 5. 입력 데이터

- REST JSON
- WebSocket snapshot
- 사용자 검색, 필터, 선택, Interface Lab 입력

## 6. 처리 과정

hook이 data/error/loading을 관리하고 Page가 표시 범위를 정한다. Component는 Backend 필드명을 그대로 읽어 문구와 색으로 바꾼다. 실패 상태가 `null` fallback 때문에 사라지지 않도록 사용자 Call/Goal summary를 Runtime 상태보다 먼저 읽는 구간이 있다.

## 7. 출력 데이터

- 화면 목록과 상세 패널
- 상태 badge
- Alert 현재/이전 목록
- JSON 전체보기 popup

## 8. 다음 단계와 연결

관계 그래프는 [10_visualization_flow.md](10_visualization_flow.md), 사용자 실행 화면은 [12_interface_lab_flow.md](12_interface_lab_flow.md)로 이어진다.

## 9. 핵심 요약

1. Frontend는 ROS2가 아니라 FastAPI 응답을 읽는다.
2. hook은 요청과 state를, Page는 필터를, component는 표시를 담당한다.
3. Backend 상태 필드와 Frontend가 읽는 필드명이 정확히 같아야 실패가 숨지 않는다.
